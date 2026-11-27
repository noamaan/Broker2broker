import "server-only";
import { deliverQueuedPush } from "./push";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { backendError, BackendError } from "./errors";
import { dbResult, mapDatabaseError, selectAll, supabaseAdmin } from "./supabase";
import type { CurrentUser, Role, Listing } from "@/lib/types";

type Row = Record<string, any>;
type Data = Record<string, any>;
const APP_BUCKET = "b2b-private-assets";
const BACKUP_BUCKET = "b2b-private-backups";
const NOW = () => new Date().toISOString();
const newID = (prefix: string) => `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
const str = (value: unknown, fallback = "") => value === undefined || value === null ? fallback : String(value);
const num = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const arr = (value: unknown): any[] => Array.isArray(value) ? value : [];
const clampPage = (value: unknown, fallback: number, max: number) => Math.min(max, Math.max(1, Math.floor(Number(value) || fallback)));
const dateString = (value: unknown) => value ? new Date(String(value)).toISOString() : "";
const validHash = (salt: unknown, hash: unknown) => /^[a-f0-9]{32}$/i.test(str(salt)) && /^[a-f0-9]{128}$/i.test(str(hash));

async function one(table: string, column: string, value: unknown): Promise<Row | null> {
  const client = supabaseAdmin();
  return dbResult<Row | null>(client.from(table).select("*").eq(column, value).maybeSingle());
}
async function insertOne(table: string, value: Row): Promise<Row> {
  return dbResult<Row>(supabaseAdmin().from(table).insert(value).select("*").single());
}
async function updateOne(table: string, column: string, value: unknown, patch: Row): Promise<Row | null> {
  return dbResult<Row | null>(supabaseAdmin().from(table).update(patch).eq(column, value).select("*").maybeSingle());
}
async function audit(actorID: string, action: string, entityType: string, entityID: string, details: Row = {}) {
  await insertOne("audit_logs", { audit_id: newID("AUD"), actor_id: actorID || "SYSTEM", action, entity_type: entityType, entity_id: entityID || "", details, created_at: NOW() });
}
async function notify(userID: string, type: string, title: string, body: string, relatedID = "") {
  await insertOne("notifications", { notification_id: newID("NTF"), user_id: userID, type, title, body, related_id: relatedID || "", read_at: null, created_at: NOW() });
}
async function securityLog(actorID: string, eventType: string, subject: string, data: Data = {}) {
  await insertOne("security_logs", {
    security_log_id: newID("SEC"), actor_id: actorID || "", event_type: eventType,
    subject: str(subject).slice(0, 160), ip_hash: str(data.ipHash), user_agent: str(data.userAgent).slice(0, 300),
    details: data.details || {}, created_at: NOW()
  });
}

const RATE_LIMITS: Record<string, [number, number]> = {
  "auth.getByEmail": [12, 600], "auth.register": [6, 3600], "auth.reset.request": [4, 3600],
  "auth.reset.complete": [6, 3600], "auth.changePassword": [6, 3600], "ai.context": [12, 60],
  "payment.createRequest": [6, 3600], "developer.grantMembership": [30, 3600], "push.rate": [20, 3600], "enquiries.create": [15, 3600], "listings.public": [120, 60], "files.public": [240, 60], "listings.search": [60, 60], "files.upload": [12, 3600]
};
async function rateLimit(action: string, data: Data) {
  const subject = str(data.actorID || data.rateKey || data.email || data.token || data.userID || data.fileID || "server").toLowerCase().slice(0, 120);
  const digest = createHash("sha256").update(subject).digest("hex").slice(0, 32);
  const [maxRequests, windowSeconds] = RATE_LIMITS[action] || [90, 60];
  const allowed = await dbResult<boolean>(supabaseAdmin().rpc("b2b_check_rate_limit", {
    p_action: action, p_subject_hash: digest, p_max_requests: maxRequests, p_window_seconds: windowSeconds
  }));
  if (!allowed) throw backendError("RATE_LIMITED", "Too many requests. Please wait and try again.");
}

async function getSettingMap(keys?: string[]) {
  let query = supabaseAdmin().from("settings").select("key,value");
  if (keys?.length) query = query.in("key", keys);
  const rows = await dbResult<Row[]>(query);
  return Object.fromEntries(rows.map((row) => [str(row.key), str(row.value)])) as Record<string, string>;
}
const SETTING_DEFAULTS: Record<string, string> = {
  "payment.upiId": "", "payment.payeeName": "", "payment.upiQrFileId": "", "payment.whatsappNumber": "",
  "payment.monthlyPrice": "199", "payment.yearlyPrice": "1999", "payment.monthlyDurationDays": "30", "payment.yearlyDurationDays": "365",
  "payment.instructions": "Scan the QR code or pay directly to the UPI ID shown above. After completing payment, submit your UTR and payment date for manual verification.",
  "payment.customerSupportMessage": "For payment questions, contact the support number shown here. Membership is activated only after an administrator verifies the UPI credit.",
  "support.email": "", "support.hours": "", "platform.maintenanceMode": "false", "ai.provider": "rule-based", "ai.model": ""
};
function settingValue(map: Record<string, string>, key: string) { return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : SETTING_DEFAULTS[key] || ""; }
function publicSettingsFromMap(map: Record<string, string>) {
  return {
    upiId: settingValue(map, "payment.upiId"), payeeName: settingValue(map, "payment.payeeName"),
    whatsappNumber: settingValue(map, "payment.whatsappNumber"), monthlyPrice: 199,
    yearlyPrice: num(settingValue(map, "payment.yearlyPrice"), 1999), monthlyDurationDays: 30,
    yearlyDurationDays: num(settingValue(map, "payment.yearlyDurationDays"), 365), paymentInstructions: settingValue(map, "payment.instructions"),
    customerSupportMessage: settingValue(map, "payment.customerSupportMessage"), supportEmail: settingValue(map, "support.email"),
    supportHours: settingValue(map, "support.hours"), maintenanceMode: settingValue(map, "platform.maintenanceMode") === "true"
  };
}
async function updateSettings(actorID: string, updates: Record<string, string | number | boolean>) {
  const entries = Object.entries(updates);
  const current = entries.length
    ? await dbResult<Row[]>(supabaseAdmin().from("settings").select("key,setting_id").in("key", entries.map(([key]) => key)))
    : [];
  const ids = new Map(current.map((row) => [str(row.key), str(row.setting_id)]));
  const now = NOW();
  const rows = entries.map(([key, raw]) => {
    const value = String(raw);
    return {
      setting_id: ids.get(key) || newID("SET"), key, value,
      value_type: typeof raw === "number" ? "number" : typeof raw === "boolean" ? "boolean" : "string",
      is_public: key.startsWith("payment.") || key.startsWith("support."), updated_by: actorID || "SYSTEM", updated_at: now
    };
  });
  if (rows.length) await dbResult(supabaseAdmin().from("settings").upsert(rows, { onConflict: "key" }));
}

function hasActiveMembership(user: Row | null) {
  if (!user || str(user.account_status) !== "ACTIVE" || str(user.membership_status) !== "ACTIVE") return false;
  const expiry = Date.parse(str(user.membership_expires_at));
  return Number.isFinite(expiry) && expiry > Date.now();
}
async function ownerHasActiveMembership(ownerID: string) {
  return hasActiveMembership(await getUserRow(ownerID));
}
// Free directory previews must not disclose the unrestricted biography or obvious contact details.
function directoryPreviewField(value: unknown) {
  return str(value).replace(/[^\s@]+@[^\s@]+/g, "").replace(/(?:https?:\/\/|www\.)\S+/gi, "").replace(/@\S+/g, "").replace(/[^\p{L}\p{M}\s.'-]/gu, "").replace(/\s+/g, " ").trim();
}
function membershipStatusFromRows(user: Row, requests: Row[]) {
  if (str(user.account_status) === "SUSPENDED") return "SUSPENDED";
  const expiry = Date.parse(str(user.membership_expires_at));
  if (hasActiveMembership(user)) return "ACTIVE";
  if (requests.some((request) => ["PENDING VERIFICATION", "MORE INFO REQUIRED"].includes(str(request.status)))) return "PAYMENT PENDING";
  if (requests.length && str(requests[0].status) === "REJECTED") return "PAYMENT REJECTED";
  if (Number.isFinite(expiry) && expiry > 0 && expiry <= Date.now()) return "EXPIRED";
  return "FREE ACCOUNT";
}
function groupRequestsByUser(requests: Row[]) {
  const grouped = new Map<string, Row[]>();
  for (const request of requests) {
    const key = str(request.user_id), rows = grouped.get(key) || [];
    rows.push(request);
    grouped.set(key, rows);
  }
  for (const rows of grouped.values()) rows.sort((a, b) => str(b.request_date).localeCompare(str(a.request_date)));
  return grouped;
}
async function membershipStatus(user: Row) {
  if (str(user.account_status) === "SUSPENDED") return "SUSPENDED";
  if (hasActiveMembership(user)) return "ACTIVE";
  const requests = await dbResult<Row[]>(supabaseAdmin().from("payment_requests").select("status,request_date").eq("user_id", user.user_id).order("request_date", { ascending: false }));
  return membershipStatusFromRows(user, requests);
}
async function getUserRow(userID: string) { return one("users", "user_id", userID); }
async function isCanonicalDeveloper(userID: string) {
  const config = await one("platform_config", "key", "developer_user_id");
  if (!config || str(config.value) !== userID) return false;
  const developer = await dbResult<Row | null>(supabaseAdmin().from("developers").select("developer_id").eq("user_id", userID).eq("status", "ACTIVE").maybeSingle());
  return !!developer;
}
async function requireRole(userID: string, roles: Role[]) {
  const user = await getUserRow(userID);
  if (!user) throw backendError("UNAUTHENTICATED", "Account not found.");
  if (str(user.account_status) !== "ACTIVE") throw backendError("FORBIDDEN", "This account is not active.");
  if (!roles.includes(str(user.role) as Role)) throw backendError("FORBIDDEN", "You do not have permission for this action.");
  return user;
}
async function requireAdmin(userID: string) {
  const actor = await requireRole(userID, ["ADMIN", "DEVELOPER"]);
  if (actor.role === "DEVELOPER" && !(await isCanonicalDeveloper(userID))) throw backendError("FORBIDDEN", "Only the original developer account can access this function.");
  return actor;
}
async function requireDeveloper(userID: string) {
  const actor = await requireRole(userID, ["DEVELOPER"]);
  if (!(await isCanonicalDeveloper(userID))) throw backendError("FORBIDDEN", "Only the original developer account can access this function.");
  return actor;
}
async function requireMember(userID: string) {
  const user = await requireRole(userID, ["USER", "ADMIN", "DEVELOPER"]);
  if (!hasActiveMembership(user)) throw backendError("MEMBERSHIP_REQUIRED", "An active approved membership is required.");
  return user;
}
function mapPublicUser(row: Row, status: string, profile: Row | null, maintenanceMode: boolean): CurrentUser {
  return {
    userID: str(row.user_id), fullName: str(row.full_name), mobile: str(row.mobile), email: str(row.email), agencyName: str(row.agency_name),
    whatsappNumber: str(row.whatsapp_number), city: str(row.city), preferredLocalities: arr(row.preferred_localities).map(String),
    role: str(row.role, "USER") as Role, accountStatus: str(row.account_status, "ACTIVE"), membershipStatus: status,
    currentPlan: str(row.current_plan, "FREE"), membershipStartAt: dateString(row.membership_start_at),
    membershipExpiresAt: dateString(row.membership_expires_at), createdAt: dateString(row.created_at),
    brokerProfile: profile ? {
      profileID: str(profile.profile_id), bio: str(profile.bio), languages: arr(profile.languages), specialties: arr(profile.specialties),
      isVerified: profile.is_verified === true, verifiedAt: dateString(profile.verified_at)
    } : undefined,
    maintenanceMode
  };
}
async function publicUserFromRow(row: Row): Promise<CurrentUser> {
  const [profile, status, settings] = await Promise.all([
    one("broker_profiles", "user_id", str(row.user_id)), membershipStatus(row), getSettingMap(["platform.maintenanceMode"])
  ]);
  return mapPublicUser(row, status, profile, settingValue(settings, "platform.maintenanceMode") === "true");
}
async function getPublicUser(userID: string): Promise<CurrentUser | null> {
  const row = await getUserRow(userID);
  return row ? publicUserFromRow(row) : null;
}

function publicPaymentRequest(row: Row) {
  return {
    requestID: str(row.request_id), userID: str(row.user_id), fullName: str(row.full_name), mobile: str(row.mobile), email: str(row.email),
    agencyName: str(row.agency_name), subscriptionPlan: str(row.subscription_plan), amount: num(row.amount),
    upiTransactionID: str(row.upi_transaction_id), paymentDate: str(row.payment_date).slice(0, 10), requestDate: dateString(row.request_date),
    status: str(row.status), adminNotes: str(row.admin_notes), approvedBy: str(row.approved_by), approvalDate: dateString(row.approval_date),
    reviewedBy: str(row.reviewed_by), reviewedAt: dateString(row.reviewed_at), screenshotFileID: str(row.screenshot_file_id),
    durationDays: num(row.duration_days), whatsappNumber: str(row.whatsapp_number)
  };
}
function publicListingFields(row: Row): Omit<Listing, "broker"> {
  const due = dateString(row.reconfirm_due_at);
  return {
    isPublic: row.is_public === true, listingID: str(row.listing_id), ownerID: str(row.owner_id), title: str(row.title), transactionType: str(row.transaction_type),
    propertyType: str(row.property_type), bhk: str(row.bhk), city: str(row.city), locality: str(row.locality), landmark: str(row.landmark),
    carpetArea: str(row.carpet_area), builtUpArea: str(row.built_up_area), furnishing: str(row.furnishing, "NOT_SPECIFIED"), floor: str(row.floor),
    amenities: arr(row.amenities).map(String), price: num(row.price), rent: num(row.rent), deposit: num(row.deposit), availability: str(row.availability),
    tenantPreference: str(row.tenant_preference), contactNumbers: arr(row.contact_numbers).map(String), description: str(row.description),
    originalText: str(row.original_text), images: arr(row.images).map(String), status: str(row.status, "DRAFT"),
    availabilityConfirmedAt: dateString(row.availability_confirmed_at), reconfirmDueAt: due, createdAt: dateString(row.created_at), updatedAt: dateString(row.updated_at)
  };
}
async function brokerSummaries(ownerIDs: string[]) {
  const ids = [...new Set(ownerIDs.filter(Boolean))];
  if (!ids.length) return new Map<string, NonNullable<Listing["broker"]>>();
  const [users, profiles] = await Promise.all([
    dbResult<Row[]>(supabaseAdmin().from("users").select("user_id,full_name,agency_name,city").in("user_id", ids)),
    dbResult<Row[]>(supabaseAdmin().from("broker_profiles").select("user_id,bio,is_verified").in("user_id", ids))
  ]);
  const profileMap = new Map(profiles.map((profile) => [str(profile.user_id), profile]));
  return new Map(users.map((user) => {
    const profile = profileMap.get(str(user.user_id));
    return [str(user.user_id), {
      userID: str(user.user_id), fullName: str(user.full_name), agencyName: str(user.agency_name), city: str(user.city),
      isVerified: profile?.is_verified === true, bio: str(profile?.bio)
    }];
  }));
}
async function publicListings(rows: Row[]) {
  const brokers = await brokerSummaries(rows.map((row) => str(row.owner_id)));
  return rows.map((row) => ({ ...publicListingFields(row), broker: brokers.get(str(row.owner_id)) || null }));
}
async function publicListing(row: Row) {
  return (await publicListings([row]))[0];
}
function listingData(input: Data) {
  const text = (key: string, max: number, required = false) => {
    const value = str(input[key]).trim();
    if (required && value.length < 2) throw backendError("INVALID_INPUT", `${key} is required.`);
    if (value.length > max) throw backendError("INVALID_INPUT", `${key} is too long.`);
    return value;
  };
  const transaction = str(input.transactionType);
  if (!["RENT", "SALE", "RESALE", "HEAVY_DEPOSIT", "LEASE", "COMMERCIAL_RENT", "COMMERCIAL_SALE"].includes(transaction)) throw backendError("INVALID_INPUT", "Invalid transaction type.");
  const furnishing = str(input.furnishing, "NOT_SPECIFIED");
  if (!["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED", "NOT_SPECIFIED"].includes(furnishing)) throw backendError("INVALID_INPUT", "Invalid furnishing value.");
  const numberField = (key: string) => {
    const raw = str(input[key]).replace(/[₹,\s]/g, "");
    if (!raw) return 0;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) throw backendError("INVALID_INPUT", `Invalid numeric value for ${key}.`);
    return Math.round(value);
  };
  const listField = (key: string, maxItems: number, maxLength: number) => {
    const values = arr(input[key]);
    if (values.length > maxItems) throw backendError("INVALID_INPUT", `${key} has too many values.`);
    return values.map((value) => str(value).trim()).filter(Boolean).map((value) => {
      if (value.length > maxLength) throw backendError("INVALID_INPUT", `${key} contains a value that is too long.`);
      return value;
    });
  };
  const amenities = listField("amenities", 30, 60);
  const contacts = listField("contactNumbers", 10, 24);
  if (contacts.some((value) => !/^\+?[0-9][0-9\s().-]{7,19}$/.test(value))) throw backendError("INVALID_INPUT", "Invalid contact number.");
  return {
    is_public: input.isPublic === true, title: text("title", 140, true), transaction_type: transaction, property_type: text("propertyType", 80, true), bhk: text("bhk", 20),
    city: text("city", 80, true), locality: text("locality", 100, true), landmark: text("landmark", 120), carpet_area: text("carpetArea", 40),
    built_up_area: text("builtUpArea", 40), furnishing, floor: text("floor", 40), amenities, price: numberField("price"), rent: numberField("rent"),
    deposit: numberField("deposit"), availability: text("availability", 80), tenant_preference: text("tenantPreference", 100),
    contact_numbers: contacts, description: text("description", 3000), original_text: text("originalText", 12000), images: listField("images", 10, 120)
  };
}
function parseArea(row: Row) {
  const raw = str(row.carpet_area || row.built_up_area).replace(/[^0-9.]/g, "");
  return Number(raw || 0);
}
function duplicateCandidates(rows: Row[], candidate: Row, excludeID: string) {
  const normalize = (value: unknown) => str(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  return rows.filter((row) => {
    if (str(row.listing_id) === excludeID || ["DELETED", "SOLD", "RENTED", "UNAVAILABLE"].includes(str(row.status))) return false;
    if (normalize(row.city) !== normalize(candidate.city) || normalize(row.locality) !== normalize(candidate.locality) ||
      normalize(row.property_type) !== normalize(candidate.property_type) || normalize(row.transaction_type) !== normalize(candidate.transaction_type) ||
      normalize(row.bhk) !== normalize(candidate.bhk)) return false;
    const oldPrice = num(row.price || row.rent), newPrice = num(candidate.price || candidate.rent);
    return !oldPrice || !newPrice || Math.abs(oldPrice - newPrice) / Math.max(oldPrice, newPrice) <= 0.1;
  }).slice(0, 5).map((row) => ({ listingID: row.listing_id, title: row.title, city: row.city, locality: row.locality, status: row.status }));
}
async function validateListingImages(images: string[], ownerID: string, listingID: string) {
  if (!images.length) return;
  const rows = await dbResult<Row[]>(supabaseAdmin().from("file_assets").select("file_id,owner_id,purpose,related_id,active").in("file_id", images));
  const byID = new Map(rows.map((row) => [str(row.file_id), row]));
  for (const fileID of images) {
    const file = byID.get(fileID);
    if (!file || file.purpose !== "LISTING_IMAGE" || file.active !== true || str(file.owner_id) !== ownerID || str(file.related_id) !== listingID) {
      throw backendError("INVALID_INPUT", "A listing photo reference is invalid.");
    }
  }
}

async function createBackup(actorID: string) {
  const contents = await dbResult<Row>(supabaseAdmin().rpc("b2b_export_snapshot"));
  const createdAt = NOW();
  const snapshot = {
    format: "broker2broker-supabase-json-v1", projectRef: new URL(str(process.env.SUPABASE_URL)).hostname.split(".")[0],
    createdAt, tables: contents
  };
  const body = Buffer.from(JSON.stringify(snapshot), "utf8");
  if (body.byteLength > 50_000_000) throw new BackendError("The database snapshot is larger than the configured private Storage limit.", 413, "BACKUP_TOO_LARGE");
  const backupID = newID("BKP");
  const fileName = `broker2broker-backup-${createdAt.replace(/[:.]/g, "-")}.json`;
  const storagePath = `${createdAt.slice(0, 10)}/${backupID}.json`;
  const client = supabaseAdmin();
  const uploaded = await client.storage.from(BACKUP_BUCKET).upload(storagePath, body, { contentType: "application/json", cacheControl: "0", upsert: false });
  if (uploaded.error) throw mapDatabaseError(uploaded.error);
  try {
    await insertOne("database_backups", { backup_id: backupID, created_by: actorID, bucket: BACKUP_BUCKET, storage_path: storagePath, file_name: fileName, size_bytes: body.byteLength, created_at: createdAt });
    await audit(actorID, "DATABASE_BACKUP_CREATED", "DATABASE_BACKUP", backupID, { fileName, sizeBytes: body.byteLength });
  } catch (error) {
    await client.storage.from(BACKUP_BUCKET).remove([storagePath]).catch(() => null);
    throw error;
  }
  try {
    const backups = (await selectAll("database_backups")).sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)));
    for (const stale of backups.slice(14)) {
      const removed = await client.storage.from(str(stale.bucket, BACKUP_BUCKET)).remove([str(stale.storage_path)]);
      if (!removed.error) await dbResult(client.from("database_backups").delete().eq("backup_id", stale.backup_id));
    }
  } catch { /* Keep the committed snapshot; retry retention cleanup on the next scheduled run. */ }
  return { created: true, backupID, fileName, sizeBytes: body.byteLength, createdAt };
}

async function analyticsForDeveloper(actorID: string) {
  await requireDeveloper(actorID);
  const [payments, requests, users, subscriptions] = await Promise.all([
    selectAll("payments"), selectAll("payment_requests"), selectAll("users"), selectAll("subscriptions")
  ]);
  const approved = payments.filter((payment) => str(payment.status) === "APPROVED");
  const sum = (rows: Row[]) => rows.reduce((total, payment) => total + num(payment.amount), 0);
  const monthlyRevenue = sum(approved.filter((payment) => str(payment.plan) === "MONTHLY"));
  const yearlyRevenue = sum(approved.filter((payment) => str(payment.plan) === "YEARLY"));
  const requestsByUser = groupRequestsByUser(requests);
  const statusByUser = new Map<string, string>();
  for (const user of users) statusByUser.set(str(user.user_id), membershipStatusFromRows(user, requestsByUser.get(str(user.user_id)) || []));
  const renewalCount = subscriptions.filter((subscription) => str(subscription.renewal_type) === "RENEWAL").length;
  const approvedRequests = requests.filter((request) => str(request.status) === "APPROVED");
  const trend: { month: string; revenue: number; payments: number }[] = [];
  const now = new Date();
  for (let offset = 11; offset >= 0; offset--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = approved.filter((payment) => str(payment.verified_at).slice(0, 7) === month);
    trend.push({ month, revenue: sum(inMonth), payments: inMonth.length });
  }
  return {
    totalPaymentRequests: requests.length,
    pendingVerification: requests.filter((request) => ["PENDING VERIFICATION", "MORE INFO REQUIRED"].includes(str(request.status))).length,
    approvedPayments: approved.length, rejectedPayments: requests.filter((request) => str(request.status) === "REJECTED").length,
    monthlyMembershipRevenue: monthlyRevenue, yearlyMembershipRevenue: yearlyRevenue, totalCollectedRevenue: sum(approved),
    activeSubscribers: [...statusByUser.values()].filter((status) => status === "ACTIVE").length,
    expiredSubscribers: [...statusByUser.values()].filter((status) => status === "EXPIRED").length,
    subscriptionRenewals: renewalCount, renewalRate: approvedRequests.length ? Math.round(renewalCount / approvedRequests.length * 100) : 0,
    monthlyTrend: trend
  };
}

async function uploadFile(actorID: string, data: Data) {
  const actor = await requireRole(actorID, ["USER", "ADMIN", "DEVELOPER"]);
  const purpose = str(data.purpose), relatedID = str(data.relatedID);
  if (purpose === "QR_CODE" && actor.role !== "ADMIN" && actor.role !== "DEVELOPER") throw backendError("FORBIDDEN", "Only administrators can upload the payment QR image.");
  if (purpose === "LISTING_IMAGE") {
    await requireMember(actorID);
    const listing = await one("listings", "listing_id", relatedID);
    if (!listing || str(listing.owner_id) !== actorID) throw backendError("FORBIDDEN", "Listing image must belong to one of your listings.");
  }
  if (!["PAYMENT_PROOF", "LISTING_IMAGE", "QR_CODE"].includes(purpose)) throw backendError("INVALID_INPUT", "Invalid file purpose.");
  const mime = str(data.mimeType);
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) throw backendError("INVALID_INPUT", "Upload a JPEG, PNG or WebP image.");
  const bytes = Buffer.from(str(data.base64), "base64");
  if (!bytes.byteLength || bytes.byteLength > 2_600_000) throw backendError("INVALID_INPUT", "Image size must be 2.5 MB or less.");
  const fileID = newID("FIL");
  const fileName = str(data.fileName, "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-140) || "image";
  const extension = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const storagePath = `${actorID.replace(/[^a-zA-Z0-9_-]/g, "_")}/${purpose.toLowerCase()}/${fileID}.${extension}`;
  const client = supabaseAdmin();
  const upload = await client.storage.from(APP_BUCKET).upload(storagePath, bytes, { contentType: mime, cacheControl: "3600", upsert: false });
  if (upload.error) throw mapDatabaseError(upload.error);
  try {
    await insertOne("file_assets", {
      file_id: fileID, owner_id: actorID, purpose, related_id: relatedID, bucket: APP_BUCKET, storage_path: storagePath,
      file_name: fileName, mime_type: mime, size_bytes: bytes.byteLength, active: true, created_at: NOW()
    });
    if (purpose === "QR_CODE") await updateSettings(actorID, { "payment.upiQrFileId": fileID });
    await audit(actorID, "FILE_UPLOADED", "FILE", fileID, { purpose, mimeType: mime, sizeBytes: bytes.byteLength });
  } catch (error) {
    await client.storage.from(APP_BUCKET).remove([storagePath]).catch(() => null);
    throw error;
  }
  return { fileID, fileName, mimeType: mime, sizeBytes: bytes.byteLength };
}
async function getFile(actorID: string, fileID: string) {
  const actor = await requireRole(actorID, ["USER", "ADMIN", "DEVELOPER"]);
  const file = await one("file_assets", "file_id", fileID);
  if (!file || file.active !== true) throw backendError("NOT_FOUND", "File was not found.");
  const admin = actor.role === "ADMIN" || actor.role === "DEVELOPER";
  let allowed = admin || str(file.owner_id) === actorID;
  if (!allowed && file.purpose === "LISTING_IMAGE") {
    const listing = await one("listings", "listing_id", str(file.related_id));
    const status = await membershipStatus(actor);
    if (listing && listing.status === "ACTIVE" && Date.parse(str(listing.reconfirm_due_at)) > Date.now() && status === "ACTIVE" && await ownerHasActiveMembership(str(listing.owner_id))) {
      allowed = arr(listing.images).map(String).includes(fileID);
    }
  }
  if (!allowed && file.purpose === "QR_CODE") {
    const settings = await getSettingMap(["payment.upiQrFileId"]);
    allowed = settingValue(settings, "payment.upiQrFileId") === fileID;
  }
  if (!allowed) throw backendError("FORBIDDEN", "You do not have access to this file.");
  const download = await supabaseAdmin().storage.from(str(file.bucket, APP_BUCKET)).download(str(file.storage_path));
  if (download.error || !download.data) throw backendError("NOT_FOUND", "Stored file could not be found.");
  const bytes = Buffer.from(await download.data.arrayBuffer());
  if (bytes.byteLength > 2_700_000) throw backendError("INVALID_INPUT", "Stored image exceeds the file limit.");
  return { fileName: str(file.file_name), mimeType: str(file.mime_type), base64: bytes.toString("base64") };
}

// Public previews deliberately exclude broker identities, free-form notes and contact fields.
function publicPreviewText(value: unknown) {
  return str(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[hidden]").replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[hidden]");
}
function previewListing(row: Row) {
  return { listingID: str(row.listing_id), propertyType: publicPreviewText(row.property_type), bhk: publicPreviewText(row.bhk), city: publicPreviewText(row.city), locality: publicPreviewText(row.locality), transactionType: str(row.transaction_type), price: num(row.price), rent: num(row.rent), images: arr(row.images).map(String) };
}
async function publicFile(listingID: string, fileID: string) {
  const listing = await one("listings", "listing_id", listingID);
  if (!listing || listing.is_public !== true || listing.status !== "ACTIVE" || !(Date.parse(str(listing.reconfirm_due_at)) > Date.now()) || !arr(listing.images).includes(fileID)) throw backendError("NOT_FOUND", "Image was not found.");
  const owner = await getUserRow(str(listing.owner_id));
  if (!hasActiveMembership(owner)) throw backendError("NOT_FOUND", "Image was not found.");
  const file = await one("file_assets", "file_id", fileID);
  if (!file || file.active !== true || file.purpose !== "LISTING_IMAGE" || str(file.related_id) !== listingID || str(file.owner_id) !== str(listing.owner_id)) throw backendError("NOT_FOUND", "Image was not found.");
  const download = await supabaseAdmin().storage.from(str(file.bucket, APP_BUCKET)).download(str(file.storage_path));
  if (download.error || !download.data) throw backendError("NOT_FOUND", "Image was not found.");
  const bytes = Buffer.from(await download.data.arrayBuffer());
  if (bytes.byteLength > 2_700_000) throw backendError("INVALID_INPUT", "Stored image exceeds the file limit.");
  return { mimeType: str(file.mime_type), base64: bytes.toString("base64") };
}

async function dispatch(action: string, data: Data): Promise<unknown> {
  const client = supabaseAdmin();
  switch (action) {
    case "auth.register": {
      if (!validHash(data.passwordSalt, data.passwordHash)) throw backendError("INVALID_INPUT", "Password verifier is invalid.");
      const userID = newID("USR");
      await dbResult<string>(client.rpc("b2b_register_user", { p_data: {
        user_id: userID, profile_id: newID("BPF"), audit_id: newID("AUD"), full_name: str(data.fullName).trim(), mobile: str(data.mobile).trim(),
        email: str(data.email).trim().toLowerCase(), password_hash: str(data.passwordHash), password_salt: str(data.passwordSalt),
        agency_name: str(data.agencyName).trim(), whatsapp_number: str(data.whatsappNumber).trim(), city: str(data.city).trim(),
        preferred_localities: arr(data.preferredLocalities)
      } }));
      const user = await getPublicUser(userID);
      if (!user) throw new BackendError("The new account could not be loaded.", 502, "BACKEND_ERROR");
      return user;
    }
    case "auth.getByEmail": {
      const email = str(data.email).trim().toLowerCase();
      const row = await dbResult<Row | null>(client.from("users").select("user_id,email,password_hash,password_salt,role,account_status").eq("email", email).maybeSingle());
      return row ? { userID: str(row.user_id), email: str(row.email), passwordHash: str(row.password_hash), passwordSalt: str(row.password_salt), role: str(row.role), accountStatus: str(row.account_status) } : null;
    }
    case "auth.getById": return getPublicUser(str(data.userID));
    case "auth.getOwnCredentials": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      if (str(actor.user_id) !== str(data.userID)) throw backendError("FORBIDDEN", "You can only verify your own password.");
      return { passwordHash: str(actor.password_hash), passwordSalt: str(actor.password_salt) };
    }
    case "auth.loginSuccess": {
      const user = await getUserRow(str(data.userID));
      if (!user) throw backendError("UNAUTHENTICATED", "Account not found.");
      await updateOne("users", "user_id", user.user_id, { last_login_at: NOW(), updated_at: NOW() });
      const publicUser = await getPublicUser(str(user.user_id));
      if (!publicUser) throw backendError("UNAUTHENTICATED", "Account not found.");
      return publicUser;
    }
    case "auth.changePassword": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      if (str(actor.user_id) !== str(data.userID)) throw backendError("FORBIDDEN", "You can only change your own password.");
      if (!validHash(data.passwordSalt, data.passwordHash)) throw backendError("INVALID_INPUT", "Password verifier is invalid.");
      await updateOne("users", "user_id", actor.user_id, { password_hash: str(data.passwordHash), password_salt: str(data.passwordSalt), updated_at: NOW() });
      await audit(str(actor.user_id), "PASSWORD_CHANGED", "USER", str(actor.user_id));
      await securityLog(str(actor.user_id), "PASSWORD_CHANGED", str(actor.email), { ipHash: data.ipHash, userAgent: data.userAgent, details: { source: "settings" } });
      return { changed: true };
    }
    case "auth.reset.request": {
      const email = str(data.email).trim().toLowerCase();
      const user = await dbResult<Row | null>(client.from("users").select("user_id,email").eq("email", email).maybeSingle());
      if (!user) return { sent: true };
      const token = str(data.token), resetUrl = str(data.resetUrl);
      if (token.length < 24 || !/^https:\/\//.test(resetUrl)) throw backendError("INVALID_INPUT", "Reset link is not configured.");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await updateOne("users", "user_id", user.user_id, { password_reset_hash: tokenHash, password_reset_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), updated_at: NOW() });
      try {
        await sendResetEmail(str(user.email), resetUrl);
      } catch (error) {
        await updateOne("users", "user_id", user.user_id, { password_reset_hash: null, password_reset_expires_at: null, updated_at: NOW() }).catch(() => null);
        throw error;
      }
      await securityLog("", "PASSWORD_RESET_REQUESTED", email, { ipHash: data.ipHash, userAgent: data.userAgent });
      return { sent: true };
    }
    case "auth.reset.complete": {
      const token = str(data.token);
      if (token.length < 24 || !validHash(data.passwordSalt, data.passwordHash)) throw backendError("INVALID_INPUT", "Password reset details are invalid.");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await dbResult(client.rpc("b2b_password_reset_complete", { p_token_hash: tokenHash, p_password_hash: str(data.passwordHash), p_password_salt: str(data.passwordSalt) }));
      return { completed: true };
    }
    case "security.log": {
      const allowed = ["AUTH_FAILURE", "ACCOUNT_SUSPENDED_LOGIN", "PASSWORD_RESET_REQUESTED", "PASSWORD_RESET_COMPLETED", "PASSWORD_CHANGED", "RATE_LIMIT_SIGNAL"];
      const eventType = str(data.eventType).slice(0, 80);
      if (!allowed.includes(eventType)) throw backendError("INVALID_INPUT", "Invalid security event.");
      await securityLog(str(data.actorID), eventType, str(data.subject).slice(0, 160), data);
      return { logged: true };
    }
    case "developer.bootstrapStatus": {
      const [dev, state] = await Promise.all([
        dbResult<Row | null>(client.from("developers").select("developer_id").eq("status", "ACTIVE").limit(1).maybeSingle()),
        one("platform_config", "key", "developer_bootstrap_state")
      ]);
      const tokenAvailable = str(process.env.B2B_DEVELOPER_BOOTSTRAP_TOKEN).length >= 32;
      return { exists: !!dev, setupAvailable: tokenAvailable && !dev && str(state?.value) === "unused" };
    }
    case "developer.bootstrap": {
      const expected = process.env.B2B_DEVELOPER_BOOTSTRAP_TOKEN || "";
      const supplied = str(data.bootstrapToken);
      const expectedBytes = Buffer.from(expected), suppliedBytes = Buffer.from(supplied);
      if (expected.length < 32 || expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
        throw backendError("FORBIDDEN", "The one-time developer setup token is invalid or expired.");
      }
      if (!validHash(data.passwordSalt, data.passwordHash)) throw backendError("INVALID_INPUT", "Developer account details are invalid.");
      const userID = newID("USR");
      await dbResult<string>(client.rpc("b2b_bootstrap_developer", { p_data: {
        user_id: userID, profile_id: newID("BPF"), developer_id: newID("DEV"), audit_id: newID("AUD"),
        full_name: str(data.fullName).trim(), email: str(data.email).trim().toLowerCase(), mobile: str(data.mobile).trim(),
        password_hash: str(data.passwordHash), password_salt: str(data.passwordSalt)
      } }));
      const user = await getPublicUser(userID);
      if (!user) throw new BackendError("The developer account could not be loaded.", 502, "BACKEND_ERROR");
      return user;
    }
    case "settings.public": {
      const map = await getSettingMap();
      return { settings: publicSettingsFromMap(map) };
    }
    case "settings.paymentPage": {
      await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const map = await getSettingMap();
      return { settings: { ...publicSettingsFromMap(map), upiQrFileId: settingValue(map, "payment.upiQrFileId") } };
    }
    case "settings.admin": {
      await requireAdmin(str(data.actorID));
      const map = await getSettingMap();
      return { ...publicSettingsFromMap(map), upiQrFileId: settingValue(map, "payment.upiQrFileId") };
    }
    case "settings.updatePayment": {
      const actor = await requireAdmin(str(data.actorID));
      const values = data.settings || {};
      if (str(values.upiId).length > 120 || str(values.payeeName).length > 120 || str(values.paymentInstructions).length > 2000) throw backendError("INVALID_INPUT", "Payment settings are too long.");
      if (Number(values.monthlyPrice) !== 199 || Number(values.monthlyDurationDays) !== 30) throw backendError("INVALID_INPUT", "The monthly plan is fixed at ₹199 for 30 days.");
      const numeric = ["yearlyPrice", "yearlyDurationDays"];
      for (const key of numeric) if (!Number.isFinite(Number(values[key])) || Number(values[key]) < 1 || Number(values[key]) > 1_000_000) throw backendError("INVALID_INPUT", `Invalid setting: ${key}`);
      const qrID = str(values.upiQrFileId).trim();
      if (qrID) {
        const qr = await one("file_assets", "file_id", qrID);
        if (!qr || qr.purpose !== "QR_CODE" || qr.active !== true) throw backendError("INVALID_INPUT", "Configured QR image reference is invalid.");
      }
      const whatsapp = str(values.whatsappNumber).trim();
      if (whatsapp && !/^\+?[0-9][0-9\s().-]{7,19}$/.test(whatsapp)) throw backendError("INVALID_INPUT", "Enter a valid WhatsApp contact number.");
      const updates: Record<string, string | number> = {
        "payment.upiId": str(values.upiId).trim(), "payment.payeeName": str(values.payeeName).trim(), "payment.upiQrFileId": qrID,
        "payment.whatsappNumber": whatsapp, "payment.monthlyPrice": "199",
        "payment.yearlyPrice": String(Math.round(Number(values.yearlyPrice))), "payment.monthlyDurationDays": "30",
        "payment.yearlyDurationDays": String(Math.round(Number(values.yearlyDurationDays))), "payment.instructions": str(values.paymentInstructions).trim(),
        "payment.customerSupportMessage": str(values.customerSupportMessage).trim(), "support.email": str(values.supportEmail).trim(), "support.hours": str(values.supportHours).trim()
      };
      await updateSettings(str(actor.user_id), updates);
      await audit(str(actor.user_id), "PAYMENT_SETTINGS_UPDATED", "SETTINGS", "payment", updates);
      return publicSettingsFromMap({ ...await getSettingMap(), ...Object.fromEntries(Object.entries(updates).map(([key, value]) => [key, String(value)])) });
    }
    case "settings.ai": {
      await requireDeveloper(str(data.actorID));
      const map = await getSettingMap(["ai.provider", "ai.model"]);
      return { provider: settingValue(map, "ai.provider") || "rule-based", model: settingValue(map, "ai.model") };
    }
    case "settings.updateAI": {
      const actor = await requireDeveloper(str(data.actorID));
      const provider = str(data.provider, "rule-based"), model = str(data.model).trim();
      if (!["rule-based", "openai-compatible"].includes(provider)) throw backendError("INVALID_INPUT", "Choose a supported AI mode.");
      if (model.length > 120) throw backendError("INVALID_INPUT", "Model name is too long.");
      await updateSettings(str(actor.user_id), { "ai.provider": provider, "ai.model": model });
      await audit(str(actor.user_id), "AI_SETTINGS_UPDATED", "SETTINGS", "ai", { provider, model });
      return { provider, model };
    }
    case "settings.updateMaintenance": {
      const actor = await requireDeveloper(str(data.actorID));
      const enabled = !!data.enabled;
      await updateSettings(str(actor.user_id), { "platform.maintenanceMode": enabled });
      await audit(str(actor.user_id), "MAINTENANCE_MODE_CHANGED", "SETTINGS", "platform.maintenanceMode", { enabled });
      return { enabled };
    }
    case "user.updateProfile": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const targetID = str(data.userID);
      if (targetID !== str(actor.user_id) && !["ADMIN", "DEVELOPER"].includes(str(actor.role))) throw backendError("FORBIDDEN", "You can only edit your own profile.");
      const target = await getUserRow(targetID);
      if (!target) throw backendError("UNAUTHENTICATED", "Account not found.");
      const now = NOW();
      await updateOne("users", "user_id", targetID, {
        full_name: str(data.fullName).trim(), mobile: str(data.mobile).trim(), agency_name: str(data.agencyName).trim(),
        whatsapp_number: str(data.whatsappNumber).trim(), city: str(data.city).trim(), preferred_localities: arr(data.preferredLocalities), updated_at: now
      });
      const profile = await one("broker_profiles", "user_id", targetID);
      const profilePatch: Row = { bio: str(data.bio).trim(), languages: arr(data.languages), specialties: arr(data.specialties), updated_at: now };
      if (profile) await updateOne("broker_profiles", "user_id", targetID, profilePatch);
      else await insertOne("broker_profiles", { profile_id: newID("BPF"), user_id: targetID, ...profilePatch, is_verified: false, created_at: now });
      await audit(str(actor.user_id), "PROFILE_UPDATED", "USER", targetID);
      const updated = await getPublicUser(targetID);
      return updated;
    }
    case "user.dashboard": {
      const user = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const id = str(user.user_id);
      const [listings, requests, favourites, notifications, status] = await Promise.all([
        dbResult<Row[]>(client.from("listings").select("status,reconfirm_due_at").eq("owner_id", id).neq("status", "DELETED")),
        dbResult<Row[]>(client.from("payment_requests").select("*").eq("user_id", id).order("request_date", { ascending: false })),
        dbResult<Row[]>(client.from("favourites").select("favourite_id").eq("user_id", id)),
        dbResult<Row[]>(client.from("notifications").select("notification_id").eq("user_id", id).is("read_at", null)),
        membershipStatus(user)
      ]);
      const expiry = Date.parse(str(user.membership_expires_at));
      return {
        user: await publicUserFromRow(user),
        membership: { status, plan: str(user.current_plan, "FREE"), startAt: dateString(user.membership_start_at), expiresAt: dateString(user.membership_expires_at), daysRemaining: status === "ACTIVE" ? Math.max(0, Math.ceil((expiry - Date.now()) / 86400000)) : 0 },
        counts: {
          myListings: listings.length,
          activeListings: hasActiveMembership(user) ? listings.filter((listing) => listing.status === "ACTIVE" && Date.parse(str(listing.reconfirm_due_at)) > Date.now()).length : 0,
          savedProperties: favourites.length, unreadNotifications: notifications.length
        },
        latestPaymentRequest: requests[0] ? publicPaymentRequest(requests[0]) : null
      };
    }
    case "user.mySubscriptions": {
      const user = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const rows = await dbResult<Row[]>(client.from("subscriptions").select("*").eq("user_id", user.user_id).order("created_at", { ascending: false }));
      return rows.map((row) => ({ subscriptionID: str(row.subscription_id), plan: str(row.plan), amount: num(row.amount), durationDays: num(row.duration_days), status: str(row.status), startsAt: dateString(row.starts_at), expiresAt: dateString(row.expires_at), paymentID: str(row.payment_id), source: str(row.source, "PAYMENT") }));
    }
    case "user.notifications": {
      const user = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const page = clampPage(data.page, 1, 1_000_000), limit = clampPage(data.limit, 30, 50);
      const rows = await dbResult<Row[]>(client.from("notifications").select("*").eq("user_id", user.user_id).order("created_at", { ascending: false }));
      return { items: rows.slice((page - 1) * limit, page * limit).map((row) => ({ notificationID: str(row.notification_id), type: str(row.type), title: str(row.title), body: str(row.body), relatedID: str(row.related_id), readAt: dateString(row.read_at), createdAt: dateString(row.created_at) })), total: rows.length, page, limit };
    }
    case "user.markNotification": {
      const user = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const notification = await one("notifications", "notification_id", str(data.notificationID));
      if (!notification || str(notification.user_id) !== str(user.user_id)) throw backendError("NOT_FOUND", "Notification was not found.");
      if (!notification.read_at) await updateOne("notifications", "notification_id", notification.notification_id, { read_at: NOW() });
      return { updated: true };
    }
    case "payment.createRequest": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const utr = str(data.utr).trim().replace(/\s+/g, "").toUpperCase();
      if (utr.length < 6 || utr.length > 80 || !/^[A-Z0-9\-/.]+$/.test(utr)) throw backendError("INVALID_INPUT", "Enter a valid UPI transaction reference.");
      const paymentDate = str(data.paymentDate);
      const dateTime = Date.parse(`${paymentDate}T12:00:00Z`);
      if (!Number.isFinite(dateTime) || dateTime > Date.now() + 86400000 || dateTime < Date.now() - 180 * 86400000) throw backendError("INVALID_INPUT", "Payment date must be within the last 180 days and not in the future.");
      const result = await dbResult<Row>(client.rpc("b2b_create_payment_request", {
        p_actor_id: str(actor.user_id), p_request_id: newID("PAY"), p_utr: utr, p_payment_date: paymentDate,
        p_plan: str(data.plan), p_expected_amount: num(data.expectedAmount), p_screenshot_file_id: str(data.screenshotFileID)
      }));
      return publicPaymentRequest(result);
    }
    case "payment.myRequests": {
      const user = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const rows = await dbResult<Row[]>(client.from("payment_requests").select("*").eq("user_id", user.user_id).order("request_date", { ascending: false }));
      return rows.map(publicPaymentRequest);
    }
    case "admin.paymentRequests": {
      await requireAdmin(str(data.actorID));
      let rows = await selectAll("payment_requests");
      const status = str(data.status);
      if (status) rows = rows.filter((row) => str(row.status) === status);
      if (data.userID) rows = rows.filter((row) => str(row.user_id) === str(data.userID));
      rows.sort((a, b) => str(b.request_date).localeCompare(str(a.request_date)));
      const page = clampPage(data.page, 1, 1_000_000), limit = clampPage(data.limit, 30, 100);
      return { items: rows.slice((page - 1) * limit, page * limit).map(publicPaymentRequest), total: rows.length, page, limit };
    }
    case "admin.paymentDecision": {
      const actor = await requireAdmin(str(data.actorID));
      const action = str(data.action), notes = str(data.adminNotes).trim();
      if (!["APPROVE", "REJECT", "REQUEST_INFO"].includes(action)) throw backendError("INVALID_INPUT", "Choose a valid review action.");
      if (action !== "APPROVE" && !notes) throw backendError("INVALID_INPUT", "Add a reason or information request note.");
      if (action === "APPROVE" && data.actualCreditVerified !== true) throw backendError("FORBIDDEN", "Confirm that actual UPI credit was independently verified before approval.");
      const result = await dbResult<Row>(client.rpc("b2b_payment_decision", {
        p_actor_id: str(actor.user_id), p_request_id: str(data.requestID), p_action: action, p_notes: notes,
        p_actual_credit_verified: data.actualCreditVerified === true, p_payment_id: newID("PMT"), p_subscription_id: newID("SUB")
      }));
      if (result.request) return { request: publicPaymentRequest(result.request), ...(result.payment_id ? { paymentID: result.payment_id, subscriptionID: result.subscription_id, startsAt: dateString(result.starts_at), expiresAt: dateString(result.expires_at) } : {}) };
      return result;
    }
    case "listings.public": {
      const page = clampPage(data.page, 1, 100000), limit = 18;
      const q = str(data.q).trim().slice(0, 80);
      const city = str(data.city).trim().slice(0, 80);
      const bhk = str(data.bhk).trim().slice(0, 20);
      const transaction = str(data.transactionType).trim();
      if ((q && !/^[\p{L}\p{N} .'-]+$/u.test(q)) || (city && !/^[\p{L}\p{N} .'-]+$/u.test(city)) || (bhk && !/^[a-zA-Z0-9 ]+$/.test(bhk))) throw backendError("INVALID_INPUT", "Enter a valid search term.");
      let query = client.from("listings").select("listing_id,property_type,bhk,city,locality,transaction_type,price,rent,images,created_at,users!inner(account_status,membership_status,membership_expires_at)").eq("is_public", true).eq("status", "ACTIVE").gt("reconfirm_due_at", NOW()).eq("users.account_status", "ACTIVE").eq("users.membership_status", "ACTIVE").gt("users.membership_expires_at", NOW()).order("created_at", { ascending: false });
      if (q) query = query.ilike("locality", `%${q}%`);
      if (city) query = query.ilike("city", `%${city}%`);
      if (bhk) query = query.ilike("bhk", `%${bhk}%`);
      if (transaction) {
        if (!["RENT", "SALE", "RESALE", "HEAVY_DEPOSIT", "LEASE", "COMMERCIAL_RENT", "COMMERCIAL_SALE"].includes(transaction)) throw backendError("INVALID_INPUT", "Invalid transaction type.");
        query = query.eq("transaction_type", transaction);
      }
      const maxPrice = str(data.maxPrice);
      if (maxPrice) {
        const amount = Number(maxPrice);
        if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000000) throw backendError("INVALID_INPUT", "Enter a valid maximum price.");
        if (!transaction) query = query.or(`and(transaction_type.in.(RENT,COMMERCIAL_RENT),rent.lte.${amount}),and(transaction_type.not.in.(RENT,COMMERCIAL_RENT),price.lte.${amount})`);
        else query = query.lte(transaction === "RENT" || transaction === "COMMERCIAL_RENT" ? "rent" : "price", amount);
      }
      const rows = await dbResult<Row[]>(query.range((page-1)*limit, page*limit));
      return { items: rows.slice(0,limit).map(previewListing), page, hasMore: rows.length > limit };
    }
    case "files.public": return publicFile(str(data.listingID), str(data.fileID));
    case "push.rate": return { ok: true };
    case "enquiries.create": {
      const actor = await requireMember(str(data.actorID));
      const enquiryID = await dbResult<string>(client.rpc("b2b_create_enquiry", { p_actor_id: str(actor.user_id), p_listing_id: str(data.listingID), p_message: str(data.message) }));
      // Delivery is best-effort; the enquiry and in-app notification are already committed.
      try { await deliverQueuedPush(); } catch (error) { console.error("Push delivery failed", error instanceof Error ? error.message : "unknown"); }
      return { enquiryID };
    }
    case "enquiries.list": {
      const actor = await requireMember(str(data.actorID));
      const direction = data.direction === "sent" ? "sent" : "received";
      const column = direction === "sent" ? "sender_id" : "recipient_id";
      const page = clampPage(data.page, 1, 100000), limit = 20;
      const rows = await dbResult<Row[]>(client.from("enquiries").select("enquiry_id,listing_id,sender_id,recipient_id,message,created_at").eq(column, actor.user_id).order("created_at", { ascending: false }).range((page-1)*limit, page*limit));
      const visible = rows.slice(0,limit);
      const brokers = await brokerSummaries(visible.map(row => str(direction === "sent" ? row.recipient_id : row.sender_id)));
      const listingIDs = [...new Set(visible.map(row => str(row.listing_id)))];
      const listings = listingIDs.length ? await dbResult<Row[]>(client.from("listings").select("listing_id,title").in("listing_id", listingIDs)) : [];
      const titles = new Map(listings.map(row => [str(row.listing_id), str(row.title)]));
      return { items: visible.map(row => ({ enquiryID: str(row.enquiry_id), listingID: str(row.listing_id), listingTitle: titles.get(str(row.listing_id)) || "Property", message: str(row.message), createdAt: dateString(row.created_at), broker: brokers.get(str(direction === "sent" ? row.recipient_id : row.sender_id)) || null })), page, hasMore: rows.length > limit };
    }
    case "brokers.directory": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const canContact = (await membershipStatus(actor)) === "ACTIVE";
      const page = clampPage(data.page, 1, 100000), limit = 20;
      const city = str(data.city).trim().slice(0, 80);
      const fields = "user_id,full_name,agency_name,city" + (canContact ? ",whatsapp_number,mobile" : "");
      let query = client.from("users").select(fields).eq("account_status", "ACTIVE").eq("role", "USER").order("user_id");
      if (city) query = query.eq("city", city);
      const rows = await dbResult<Row[]>(query.range((page - 1) * limit, page * limit));
      const visible = rows.slice(0, limit);
      const profiles = visible.length ? await dbResult<Row[]>(client.from("broker_profiles").select("user_id,is_verified,bio").in("user_id", visible.map(row => row.user_id))) : [];
      const byUser = new Map(profiles.map(profile => [str(profile.user_id), profile]));
      return { items: visible.map(row => ({ userID: str(row.user_id), fullName: canContact ? str(row.full_name) : directoryPreviewField(row.full_name), agencyName: canContact ? str(row.agency_name) : directoryPreviewField(row.agency_name), city: canContact ? str(row.city) : directoryPreviewField(row.city), bio: canContact ? str(byUser.get(str(row.user_id))?.bio) : "", isVerified: byUser.get(str(row.user_id))?.is_verified === true, ...(canContact ? { mobile: str(row.mobile), whatsappNumber: str(row.whatsapp_number) } : {}) })), page, hasMore: rows.length > limit, canContact };
    }
    case "listings.create": {
      const user = await requireMember(str(data.actorID));
      const listing = listingData(data.listing || {});
      const listingID = newID("LST"), now = NOW();
      const row = await insertOne("listings", { listing_id: listingID, owner_id: str(user.user_id), ...listing, status: "DRAFT", availability_confirmed_at: null, reconfirm_due_at: null, created_at: now, updated_at: now });
      await audit(str(user.user_id), "LISTING_CREATED", "LISTING", listingID, { status: "DRAFT" });
      return publicListing(row);
    }
    case "listings.update": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const id = str(data.listingID), patch = data.patch || {};
      const isAdmin = ["ADMIN", "DEVELOPER"].includes(str(actor.role));
      const changesContent = Object.keys(patch).some(key => !["status", "confirmDuplicates"].includes(key));
      if (!isAdmin && (patch.status === "ACTIVE" || changesContent)) await requireMember(str(actor.user_id));
      const row = await one("listings", "listing_id", id);
      if (!row || row.status === "DELETED") throw backendError("NOT_FOUND", "Listing was not found.");
      if (str(row.owner_id) !== str(actor.user_id) && !isAdmin) throw backendError("FORBIDDEN", "You can only edit your own listing.");
      if (!isAdmin && row.status === "UNDER_REVIEW" && patch.status === "ACTIVE") throw backendError("FORBIDDEN", "Use the explicit availability reconfirmation action to restore a listing under review.");
      const askedStatus = str(patch.status || row.status);
      if (!isAdmin && patch.status && !["DRAFT", "ACTIVE", "SOLD", "RENTED", "UNAVAILABLE"].includes(askedStatus)) throw backendError("FORBIDDEN", "That listing status cannot be set by a member.");
      const existing = publicListingFields(row);
      const normalized = listingData({ ...existing, ...patch });
      await validateListingImages(normalized.images, str(row.owner_id), id);
      const allRows = await selectAll("listings");
      const duplicates = patch.status === "ACTIVE" ? duplicateCandidates(allRows, normalized, id) : [];
      if (duplicates.length && !data.confirmDuplicates) return { requiresConfirmation: true, duplicates };
      const now = NOW();
      // A member submission or edit to a published listing must be reviewed again.
      const finalStatus = !isAdmin && (askedStatus === "ACTIVE" || (row.status === "ACTIVE" && changesContent && !patch.status)) ? "PENDING_APPROVAL" : askedStatus;
      const update: Row = { ...normalized, status: finalStatus, updated_at: now };
      if (finalStatus === "ACTIVE" && !(await ownerHasActiveMembership(str(row.owner_id)))) throw backendError("MEMBERSHIP_REQUIRED", "The listing owner needs an active membership before this listing can be published.");
      if (finalStatus === "ACTIVE" && str(row.status) !== "ACTIVE") {
        update.availability_confirmed_at = now;
        update.reconfirm_due_at = new Date(Date.now() + 15 * 86400000).toISOString();
      }
      const updated = await dbResult<Row | null>(client.from("listings").update(update).eq("listing_id", id).eq("updated_at", row.updated_at).select("*").maybeSingle());
      if (!updated) throw backendError("CONFLICT", "The listing changed during review. Reload and try again.");
      await audit(str(actor.user_id), "LISTING_UPDATED", "LISTING", id, { status: finalStatus });
      return { listing: updated ? await publicListing(updated) : null, duplicates };
    }
    case "listings.delete": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const row = await one("listings", "listing_id", str(data.listingID));
      if (!row || row.status === "DELETED") throw backendError("NOT_FOUND", "Listing was not found.");
      if (str(row.owner_id) !== str(actor.user_id) && !["ADMIN", "DEVELOPER"].includes(str(actor.role))) throw backendError("FORBIDDEN", "You can only delete your own listing.");
      await updateOne("listings", "listing_id", row.listing_id, { status: "DELETED", updated_at: NOW() });
      await audit(str(actor.user_id), "LISTING_DELETED", "LISTING", str(row.listing_id));
      return { deleted: true };
    }
    case "listings.my": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const rows = await dbResult<Row[]>(client.from("listings").select("*").eq("owner_id", actor.user_id).neq("status", "DELETED").order("updated_at", { ascending: false }));
      return (await publicListings(rows)).map((listing) => ({ ...listing, needsReconfirmation: listing.status === "ACTIVE" && Date.parse(listing.reconfirmDueAt) <= Date.now() }));
    }
    case "listings.get": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const row = await one("listings", "listing_id", str(data.listingID));
      if (!row || row.status === "DELETED") throw backendError("NOT_FOUND", "Listing was not found.");
      const own = str(row.owner_id) === str(actor.user_id), privileged = ["ADMIN", "DEVELOPER"].includes(str(actor.role));
      if (!own && !privileged) await requireMember(str(actor.user_id));
      if (!own && !privileged && (row.status !== "ACTIVE" || !(Date.parse(str(row.reconfirm_due_at)) > Date.now()) || !(await ownerHasActiveMembership(str(row.owner_id))))) throw backendError("NOT_FOUND", "This listing is not currently available.");
      const listing = await publicListing(row);
      return { ...listing, needsReconfirmation: listing.status === "ACTIVE" && Date.parse(listing.reconfirmDueAt) <= Date.now() };
    }
    case "listings.search": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const privileged = ["ADMIN", "DEVELOPER"].includes(str(actor.role));
      if (!privileged) await requireMember(str(actor.user_id));
      const filters = data.filters || {}, page = clampPage(data.page, 1, 1_000_000), limit = clampPage(data.limit, 20, 50), q = str(filters.q).toLowerCase();
      const rows = await selectAll("listings");
      const activeOwners = privileged ? null : new Set((await selectAll("users", "user_id,account_status,membership_status,membership_expires_at")).filter(hasActiveMembership).map(owner => str(owner.user_id)));
      const filtered = rows.filter((row) => {
        const due = Date.parse(str(row.reconfirm_due_at));
        if (row.status === "DELETED") return false;
        if (!privileged && (row.status !== "ACTIVE" || !(due > Date.now()) || !activeOwners?.has(str(row.owner_id)))) return false;
        const matches = (key: string, column: string) => !filters[key] || str(row[column]).toLowerCase() === str(filters[key]).toLowerCase();
        if (!matches("city", "city") || !matches("locality", "locality") || !matches("transactionType", "transaction_type") || !matches("propertyType", "property_type") || !matches("bhk", "bhk") || !matches("furnishing", "furnishing")) return false;
        if (filters.availability && !str(row.availability).toLowerCase().includes(str(filters.availability).toLowerCase())) return false;
        const price = num(row.price), rent = num(row.rent), deposit = num(row.deposit), area = parseArea(row);
        if (filters.minPrice && price < Number(filters.minPrice)) return false;
        if (filters.maxPrice && price > Number(filters.maxPrice)) return false;
        if (filters.minRent && rent < Number(filters.minRent)) return false;
        if (filters.maxRent && rent > Number(filters.maxRent)) return false;
        if (filters.minDeposit && deposit < Number(filters.minDeposit)) return false;
        if (filters.maxDeposit && deposit > Number(filters.maxDeposit)) return false;
        if (filters.minArea && area < Number(filters.minArea)) return false;
        if (filters.maxArea && area > Number(filters.maxArea)) return false;
        if (q && ![row.title, row.city, row.locality, row.landmark, row.property_type, row.description].map((value) => str(value)).join(" ").toLowerCase().includes(q)) return false;
        return true;
      }).sort((a, b) => str(b.updated_at).localeCompare(str(a.updated_at)));
      const pageRows = filtered.slice((page - 1) * limit, page * limit);
      const listings = await publicListings(pageRows);
      return { items: listings.map((listing) => ({ ...listing, needsReconfirmation: listing.status === "ACTIVE" && Date.parse(listing.reconfirmDueAt) <= Date.now() })), total: filtered.length, page, limit };
    }
    case "listings.reconfirm": {
      const actor = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      const row = await one("listings", "listing_id", str(data.listingID));
      if (!row || (str(row.owner_id) !== str(actor.user_id) && !["ADMIN", "DEVELOPER"].includes(str(actor.role)))) throw backendError("NOT_FOUND", "Listing was not found.");
      const due = Date.parse(str(row.reconfirm_due_at));
      if (row.status !== "UNDER_REVIEW" && !(row.status === "ACTIVE" && due <= Date.now())) throw backendError("CONFLICT", "This listing is not due for reconfirmation.");
      if (actor.role === "USER") await requireMember(str(actor.user_id));
      const now = NOW();
      const status = actor.role === "USER" ? "PENDING_APPROVAL" : "ACTIVE";
      if (status === "ACTIVE" && !(await ownerHasActiveMembership(str(row.owner_id)))) throw backendError("MEMBERSHIP_REQUIRED", "The listing owner needs an active membership before this listing can be published.");
      const updated = await dbResult<Row | null>(client.from("listings").update({ status, availability_confirmed_at: now, reconfirm_due_at: status === "ACTIVE" ? new Date(Date.now() + 15 * 86400000).toISOString() : null, updated_at: now }).eq("listing_id", row.listing_id).eq("updated_at", row.updated_at).select("*").maybeSingle());
      if (!updated) throw backendError("CONFLICT", "The listing changed during review. Reload and try again.");
      await audit(str(actor.user_id), "LISTING_RECONFIRMED", "LISTING", str(row.listing_id));
      return updated ? publicListing(updated) : null;
    }
    case "admin.listings": {
      await requireAdmin(str(data.actorID));
      let rows = await selectAll("listings");
      rows = rows.filter((row) => row.status !== "DELETED");
      if (data.status) rows = rows.filter((row) => str(row.status) === str(data.status));
      rows.sort((a, b) => str(b.updated_at).localeCompare(str(a.updated_at)));
      const page = clampPage(data.page, 1, 1_000_000), limit = clampPage(data.limit, 30, 100);
      return { items: await publicListings(rows.slice((page - 1) * limit, page * limit)), total: rows.length, page, limit };
    }
    case "admin.listingDecision": {
      const actor = await requireAdmin(str(data.actorID));
      const row = await one("listings", "listing_id", str(data.listingID));
      if (!row) throw backendError("NOT_FOUND", "Listing was not found.");
      const status = str(data.status);
      if (!["ACTIVE", "DRAFT", "SOLD", "RENTED", "UNAVAILABLE", "UNDER_REVIEW", "DELETED"].includes(status)) throw backendError("INVALID_INPUT", "Invalid listing status.");
      const now = NOW(), patch: Row = { status, updated_at: now };
      if (status === "ACTIVE" && !(await ownerHasActiveMembership(str(row.owner_id)))) throw backendError("MEMBERSHIP_REQUIRED", "The listing owner needs an active membership before this listing can be published.");
      if (status === "ACTIVE") { patch.availability_confirmed_at = now; patch.reconfirm_due_at = new Date(Date.now() + 15 * 86400000).toISOString(); }
      const updated = await dbResult<Row | null>(client.from("listings").update(patch).eq("listing_id", row.listing_id).eq("updated_at", row.updated_at).select("*").maybeSingle());
      if (!updated) throw backendError("CONFLICT", "The listing changed during review. Reload and try again.");
      await audit(str(actor.user_id), "ADMIN_LISTING_STATUS", "LISTING", str(row.listing_id), { status });
      await notify(str(row.owner_id), "LISTING_REVIEW", "Listing reviewed", `An administrator updated the status of your listing ${str(row.title)}.`, str(row.listing_id));
      return updated ? publicListing(updated) : null;
    }
    case "categories.list": {
      const rows = await dbResult<Row[]>(client.from("categories").select("category_id,name,parent_id,kind,sort_order").eq("active", true).order("sort_order", { ascending: true }));
      return rows.map((row) => ({ categoryID: str(row.category_id), name: str(row.name), parentID: str(row.parent_id), kind: str(row.kind), sortOrder: num(row.sort_order) }));
    }
    case "categories.save": {
      const actor = await requireAdmin(str(data.actorID)), id = str(data.categoryID) || newID("CAT"), now = NOW();
      const old = await one("categories", "category_id", id);
      if (old) await updateOne("categories", "category_id", id, { name: str(data.name).trim(), parent_id: str(data.parentID), kind: str(data.kind), active: !!data.active, sort_order: num(data.sortOrder, 100), updated_at: now });
      else await insertOne("categories", { category_id: id, name: str(data.name).trim(), parent_id: str(data.parentID), kind: str(data.kind), active: !!data.active, sort_order: num(data.sortOrder, 100), created_at: now, updated_at: now });
      await audit(str(actor.user_id), "CATEGORY_SAVED", "CATEGORY", id);
      return dbResult<Row[]>(client.from("categories").select("category_id,name,parent_id,kind,sort_order").eq("active", true).order("sort_order", { ascending: true })).then((rows) => rows.map((row) => ({ categoryID: str(row.category_id), name: str(row.name), parentID: str(row.parent_id), kind: str(row.kind), sortOrder: num(row.sort_order) })));
    }
    case "categories.delete": {
      const actor = await requireAdmin(str(data.actorID)), id = str(data.categoryID), row = await one("categories", "category_id", id);
      if (!row) throw backendError("NOT_FOUND", "Category was not found.");
      await updateOne("categories", "category_id", id, { active: false, updated_at: NOW() });
      await audit(str(actor.user_id), "CATEGORY_ARCHIVED", "CATEGORY", id);
      return { deleted: true };
    }
    case "localities.list": {
      let rows = await dbResult<Row[]>(client.from("localities").select("locality_id,city,name,state").eq("active", true).order("city", { ascending: true }).order("name", { ascending: true }));
      const q = str(data.q).toLowerCase();
      if (q) rows = rows.filter((row) => `${row.name} ${row.city} ${row.state}`.toLowerCase().includes(q));
      return rows.slice(0, 200).map((row) => ({ localityID: str(row.locality_id), city: str(row.city), name: str(row.name), state: str(row.state) }));
    }
    case "localities.save": {
      const actor = await requireAdmin(str(data.actorID)), id = str(data.localityID) || newID("LOC"), now = NOW();
      const old = await one("localities", "locality_id", id);
      const values = { city: str(data.city).trim(), name: str(data.name).trim(), state: str(data.state, "Maharashtra").trim(), active: !!data.active, updated_at: now };
      if (old) await updateOne("localities", "locality_id", id, values);
      else await insertOne("localities", { locality_id: id, ...values, created_at: now });
      await audit(str(actor.user_id), "LOCALITY_SAVED", "LOCALITY", id);
      const rows = await dbResult<Row[]>(client.from("localities").select("locality_id,city,name,state").eq("active", true).order("city", { ascending: true }).order("name", { ascending: true }));
      return rows.slice(0, 200).map((row) => ({ localityID: str(row.locality_id), city: str(row.city), name: str(row.name), state: str(row.state) }));
    }
    case "localities.delete": {
      const actor = await requireAdmin(str(data.actorID)), id = str(data.localityID), row = await one("localities", "locality_id", id);
      if (!row) throw backendError("NOT_FOUND", "Locality was not found.");
      await updateOne("localities", "locality_id", id, { active: false, updated_at: NOW() });
      await audit(str(actor.user_id), "LOCALITY_ARCHIVED", "LOCALITY", id);
      return { deleted: true };
    }
    case "favourites.list": {
      const user = await requireMember(str(data.actorID));
      const favourites = await dbResult<Row[]>(client.from("favourites").select("listing_id").eq("user_id", user.user_id));
      const ids = favourites.map((row) => str(row.listing_id));
      if (!ids.length) return [];
      const listings = await dbResult<Row[]>(client.from("listings").select("*").in("listing_id", ids).eq("status", "ACTIVE"));
      const activeOwners = new Set((await selectAll("users", "user_id,account_status,membership_status,membership_expires_at")).filter(hasActiveMembership).map(owner => str(owner.user_id)));
      const visible = listings.filter((row) => Date.parse(str(row.reconfirm_due_at)) > Date.now() && activeOwners.has(str(row.owner_id)));
      return publicListings(visible);
    }
    case "favourites.add": {
      const user = await requireMember(str(data.actorID));
      const listing = await one("listings", "listing_id", str(data.listingID));
      if (!listing || listing.status !== "ACTIVE" || !(Date.parse(str(listing.reconfirm_due_at)) > Date.now()) || !(await ownerHasActiveMembership(str(listing.owner_id)))) throw backendError("NOT_FOUND", "This listing is not currently available.");
      await dbResult(supabaseAdmin().from("favourites").upsert({ favourite_id: newID("FAV"), user_id: user.user_id, listing_id: listing.listing_id, created_at: NOW() }, { onConflict: "user_id,listing_id", ignoreDuplicates: true }));
      return { saved: true };
    }
    case "favourites.remove": {
      const user = await requireRole(str(data.actorID), ["USER", "ADMIN", "DEVELOPER"]);
      await dbResult(supabaseAdmin().from("favourites").delete().eq("user_id", user.user_id).eq("listing_id", str(data.listingID)));
      return { removed: true };
    }
    case "reports.create": {
      const user = await requireMember(str(data.actorID));
      const listing = await one("listings", "listing_id", str(data.listingID));
      if (!listing || listing.status === "DELETED") throw backendError("NOT_FOUND", "Listing was not found.");
      const duplicates = await dbResult<Row[]>(client.from("reports").select("report_id").eq("reporter_id", user.user_id).eq("listing_id", listing.listing_id).in("status", ["OPEN", "UNDER_REVIEW"]));
      if (duplicates.length) throw backendError("CONFLICT", "You have already reported this listing.");
      const reportID = newID("RPT");
      await insertOne("reports", { report_id: reportID, listing_id: listing.listing_id, reporter_id: user.user_id, reason: str(data.reason, "OTHER"), details: str(data.details), status: "OPEN", admin_notes: "", created_at: NOW() });
      await audit(str(user.user_id), "LISTING_REPORTED", "REPORT", reportID, { listingID: listing.listing_id, reason: data.reason });
      return { reportID, status: "OPEN" };
    }
    case "admin.reports": {
      await requireAdmin(str(data.actorID));
      const status = str(data.status), all = await selectAll("reports");
      const listings = await selectAll("listings", "listing_id,title,status,city,locality");
      const listingByID = new Map(listings.map((row) => [str(row.listing_id), row]));
      const rows = all.filter((row) => !status || str(row.status) === status).sort((a, b) => str(b.created_at).localeCompare(str(a.created_at))).slice(0, 200);
      return rows.map((row) => {
        const listing = listingByID.get(str(row.listing_id));
        return { reportID: str(row.report_id), listingID: str(row.listing_id), reporterID: str(row.reporter_id), reason: str(row.reason), details: str(row.details), status: str(row.status), adminNotes: str(row.admin_notes), reviewedBy: str(row.reviewed_by), reviewedAt: dateString(row.reviewed_at), createdAt: dateString(row.created_at), listing: listing ? { listingID: str(listing.listing_id), title: str(listing.title), status: str(listing.status), city: str(listing.city), locality: str(listing.locality) } : null };
      });
    }
    case "admin.reportDecision": {
      const actor = await requireAdmin(str(data.actorID)), report = await one("reports", "report_id", str(data.reportID));
      if (!report) throw backendError("NOT_FOUND", "Report was not found.");
      const status = str(data.status);
      if (!["UNDER_REVIEW", "RESOLVED", "DISMISSED"].includes(status)) throw backendError("INVALID_INPUT", "Invalid report status.");
      await updateOne("reports", "report_id", report.report_id, { status, admin_notes: str(data.adminNotes), reviewed_by: actor.user_id, reviewed_at: NOW() });
      await audit(str(actor.user_id), "REPORT_REVIEWED", "REPORT", str(report.report_id), { status });
      return { updated: true };
    }
    case "admin.users": {
      await requireAdmin(str(data.actorID));
      const page = clampPage(data.page, 1, 1_000_000), limit = clampPage(data.limit, 30, 100), query = str(data.q).toLowerCase();
      const allUsers = await selectAll("users");
      const filtered = allUsers.filter((user) => !query || [user.full_name, user.email, user.mobile, user.agency_name, user.city].map((value) => str(value)).join(" ").toLowerCase().includes(query)).sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)));
      const items = filtered.slice((page - 1) * limit, page * limit);
      const ids = items.map((user) => str(user.user_id));
      let requests: Row[] = [], listings: Row[] = [], profiles: Row[] = [];
      if (ids.length) {
        [requests, listings, profiles] = await Promise.all([
          dbResult<Row[]>(client.from("payment_requests").select("user_id,status,request_date").in("user_id", ids).order("request_date", { ascending: false })),
          dbResult<Row[]>(client.from("listings").select("owner_id,status").in("owner_id", ids).neq("status", "DELETED")),
          dbResult<Row[]>(client.from("broker_profiles").select("user_id,profile_id,bio,languages,specialties,is_verified,verified_at").in("user_id", ids))
        ]);
      }
      const requestsByUser = groupRequestsByUser(requests);
      const profileByUser = new Map(profiles.map((profile) => [str(profile.user_id), profile]));
      const listingCounts = new Map<string, number>();
      for (const listing of listings) listingCounts.set(str(listing.owner_id), (listingCounts.get(str(listing.owner_id)) || 0) + 1);
      const settings = await getSettingMap(["platform.maintenanceMode"]);
      const maintenanceMode = settingValue(settings, "platform.maintenanceMode") === "true";
      return {
        items: items.map((user) => {
          const status = membershipStatusFromRows(user, requestsByUser.get(str(user.user_id)) || []);
          return { ...mapPublicUser(user, status, profileByUser.get(str(user.user_id)) || null, maintenanceMode), listingCount: listingCounts.get(str(user.user_id)) || 0, pendingPayments: (requestsByUser.get(str(user.user_id)) || []).filter(request => ["PENDING VERIFICATION", "MORE INFO REQUIRED"].includes(str(request.status))).length };
        }),
        total: filtered.length, page, limit
      };
    }
    case "admin.userAction": {
      const actor = await requireAdmin(str(data.actorID)), targetID = str(data.userID), target = await getUserRow(targetID);
      if (!target) throw backendError("UNAUTHENTICATED", "Account not found.");
      if (str(target.role) === "DEVELOPER") throw backendError("FORBIDDEN", "The developer account cannot be changed by an administrator.");
      const action = str(data.action);
      if (!["SUSPEND", "REACTIVATE", "VERIFY_BROKER", "UNVERIFY_BROKER"].includes(action)) throw backendError("FORBIDDEN", "Admin role changes are reserved for the developer.");
      const now = NOW();
      if (["SUSPEND", "REACTIVATE"].includes(action)) {
        await updateOne("users", "user_id", targetID, { account_status: action === "SUSPEND" ? "SUSPENDED" : "ACTIVE", updated_at: now });
        await notify(targetID, "ACCOUNT_STATUS", "Account status updated", action === "SUSPEND" ? "Your account has been suspended. Contact support for details." : "Your account has been reactivated.");
      } else {
        const profile = await one("broker_profiles", "user_id", targetID);
        if (profile) await updateOne("broker_profiles", "user_id", targetID, { is_verified: action === "VERIFY_BROKER", verified_by: actor.user_id, verified_at: action === "VERIFY_BROKER" ? now : null, updated_at: now });
        await notify(targetID, "BROKER_PROFILE", "Broker profile reviewed", action === "VERIFY_BROKER" ? "Your broker profile has been verified." : "Your broker verification was changed.");
      }
      await audit(str(actor.user_id), "ADMIN_USER_ACTION", "USER", targetID, { action, reason: str(data.reason) });
      return getPublicUser(targetID);
    }
    case "admin.announcement": {
      const actor = await requireAdmin(str(data.actorID)), title = str(data.title).trim(), body = str(data.body).trim(), audience = str(data.audience, "ALL");
      if (!title || !body) throw backendError("INVALID_INPUT", "Announcement title and body are required.");
      const users = await selectAll("users");
      const requestsByUser = groupRequestsByUser(await selectAll("payment_requests", "user_id,status,request_date"));
      const recipients = users.filter((user) => user.account_status === "ACTIVE" && (audience !== "ACTIVE_MEMBERS" || membershipStatusFromRows(user, requestsByUser.get(str(user.user_id)) || []) === "ACTIVE"));
      if (recipients.length > 5000) throw backendError("RATE_LIMITED", "Announcement audience exceeds the current batch limit.");
      for (let offset = 0; offset < recipients.length; offset += 500) {
        const rows = recipients.slice(offset, offset + 500).map((user) => ({ notification_id: newID("NTF"), user_id: user.user_id, type: "ANNOUNCEMENT", title, body, related_id: "", created_at: NOW() }));
        if (rows.length) await dbResult(client.from("notifications").insert(rows));
      }
      await audit(str(actor.user_id), "ANNOUNCEMENT_SENT", "NOTIFICATION", title, { audience, recipientCount: recipients.length });
      return { sent: true, recipientCount: recipients.length };
    }
    case "developer.grantMembership": {
      const actor = await requireDeveloper(str(data.actorID));
      return dbResult<Row>(client.rpc("b2b_grant_complimentary_membership", { p_actor_id:str(actor.user_id), p_user_id:str(data.userID), p_plan:str(data.plan), p_reason:str(data.reason).trim(), p_grant_id:str(data.grantID) }));
    }
    case "developer.userRole": {
      const actor = await requireDeveloper(str(data.actorID));
      const action = str(data.action);
      if (!["MAKE_ADMIN", "REMOVE_ADMIN"].includes(action)) throw backendError("INVALID_INPUT", "Invalid administrator action.");
      await dbResult<string>(client.rpc("b2b_set_admin_role", { p_actor_id: str(actor.user_id), p_user_id: str(data.userID), p_action: action, p_reason: str(data.reason) }));
      return getPublicUser(str(data.userID));
    }
    case "developer.securityLogs": {
      await requireDeveloper(str(data.actorID));
      const rows = await selectAll("security_logs");
      rows.sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)));
      const page = clampPage(data.page, 1, 1_000_000), limit = clampPage(data.limit, 30, 100);
      return { items: rows.slice((page - 1) * limit, page * limit).map((row) => ({ securityLogID: str(row.security_log_id), actorID: str(row.actor_id), eventType: str(row.event_type), subject: str(row.subject), ipHash: str(row.ip_hash), userAgent: str(row.user_agent), details: row.details || {}, createdAt: dateString(row.created_at) })), total: rows.length, page, limit };
    }
    case "developer.analytics": return analyticsForDeveloper(str(data.actorID));
    case "developer.exportData": {
      const summary = await analyticsForDeveloper(str(data.actorID));
      const payments = (await selectAll("payments")).filter((payment) => str(payment.status) === "APPROVED");
      const byPlan = ["MONTHLY", "YEARLY"].map((plan) => {
        const rows = payments.filter((payment) => str(payment.plan) === plan);
        return { plan, approvedPayments: rows.length, revenue: rows.reduce((sum, payment) => sum + num(payment.amount), 0) };
      });
      return { exportedAt: NOW(), summary, byPlan, monthlyTrend: summary.monthlyTrend };
    }
    case "developer.backup": {
      const actor = await requireDeveloper(str(data.actorID));
      return createBackup(str(actor.user_id));
    }
    case "developer.health": {
      await requireDeveloper(str(data.actorID));
      const tables = ["users", "broker_profiles", "listings", "payment_requests", "payments", "subscriptions", "categories", "localities", "favourites", "reports", "notifications", "admins", "developers", "settings", "audit_logs", "security_logs", "file_assets", "platform_config", "rate_limit_events", "database_backups", "enquiries", "push_subscriptions", "push_queue"];
      const checks = await Promise.all(tables.map(async (table) => {
        try { await dbResult(supabaseAdmin().from(table).select("*").limit(0)); return { table, ok: true }; }
        catch { return { table, ok: false }; }
      }));
      const [assets, backups, developer] = await Promise.all([
        client.storage.getBucket(APP_BUCKET), client.storage.getBucket(BACKUP_BUCKET),
        dbResult<Row | null>(client.from("developers").select("developer_id").eq("status", "ACTIVE").eq("user_id", str(data.actorID)).maybeSingle())
      ]);
      const missingTables = checks.filter((check) => !check.ok).map((check) => check.table);
      const storageConfigured = !assets.error && !backups.error;
      const errors = [...(missingTables.length ? [`Missing tables: ${missingTables.join(", ")}`] : []), ...(!storageConfigured ? ["One or more private Storage buckets are unavailable."] : [])];
      return {
        service: "Broker2Broker Supabase", version: "2.0.0", databaseConfigured: missingTables.length === 0,
        storageConfigured, missingTables, backupScheduled: !!process.env.CRON_SECRET, reconfirmationScheduled: !!process.env.CRON_SECRET,
        developerBootstrapped: !!developer, errors
      };
    }
    case "system.reconfirmListings": {
      const count = await dbResult<number>(client.rpc("b2b_reconfirm_due_listings"));
      return { updated: num(count) };
    }
    case "system.daily": {
      const count = await dbResult<number>(client.rpc("b2b_reconfirm_due_listings"));
      const reminders = await dbResult<number>(client.rpc("b2b_membership_reminders"));
      const backup = await createBackup("SYSTEM");
      let push = { configured: false, delivered: 0, failed: 0 };
      try { push = await deliverQueuedPush(); } catch (error) { console.error("Push delivery failed", error instanceof Error ? error.message : "unknown"); }
      return { reconfirmed: num(count), membershipReminders: num(reminders), backup, push };
    }
    case "files.upload": return uploadFile(str(data.actorID), data);
    case "files.get": return getFile(str(data.actorID), str(data.fileID));
    case "ai.context": {
      await requireMember(str(data.actorID));
      const map = await getSettingMap(["ai.provider", "ai.model"]);
      return { provider: settingValue(map, "ai.provider") || "rule-based", model: settingValue(map, "ai.model") };
    }
    default: throw backendError("NOT_FOUND", "Unknown backend action.");
  }
}

async function sendResetEmail(email: string, resetUrl: string) {
  const host = process.env.SMTP_HOST, from = process.env.EMAIL_FROM;
  const port = Number(process.env.SMTP_PORT || 587);
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw backendError("EMAIL_NOT_CONFIGURED", "Password reset email is not configured. Set SMTP_HOST, SMTP_PORT and EMAIL_FROM on the server.");
  }
  const auth = process.env.SMTP_USER && process.env.SMTP_PASSWORD ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined;
  const transport = nodemailer.createTransport({
    host, port, secure: process.env.SMTP_SECURE === "true" || port === 465, auth,
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 15_000
  });
  const safeUrl = resetUrl.replace(/&/g, "&amp;").replace(/"/g, "%22");
  try {
    await transport.sendMail({
      from, to: email, subject: "Reset your Broker2Broker password",
      text: `Use this one-time link to reset your password (valid for 30 minutes):\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Use this one-time link to reset your Broker2Broker password. It is valid for 30 minutes.</p><p><a href="${safeUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });
  } catch {
    throw backendError("EMAIL_NOT_CONFIGURED", "Password reset email could not be sent. Check the SMTP configuration and provider logs.");
  }
}

export async function backendRequest<T = unknown>(action: string, data: Data = {}): Promise<T> {
  // Create the server-only client before doing any work so an unconfigured app fails closed.
  supabaseAdmin();
  await rateLimit(action, data);
  try {
    return await dispatch(action, data) as T;
  } catch (error) {
    if (error instanceof BackendError) throw error;
    if (error && typeof error === "object" && "code" in error && "message" in error) throw mapDatabaseError(error as { code?: string; message?: string; details?: string | null; hint?: string | null });
    throw error;
  }
}
