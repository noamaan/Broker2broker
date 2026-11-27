import { z } from "zod";

const email = z.string().trim().email().max(254).transform((v) => v.toLowerCase());
const phone = z.string().trim().min(8).max(20).regex(/^\+?[0-9][0-9\s().-]*$/, "Enter a valid phone number");
const password = z.string().min(12, "Use at least 12 characters").max(128, "Password is too long");
const id = z.string().trim().min(3).max(100);
const safeText = (max: number) => z.string().trim().max(max);

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100), mobile: phone, email, password,
  agencyName: z.string().trim().min(2).max(120), whatsappNumber: phone,
  city: z.string().trim().min(2).max(80), preferredLocalities: z.array(z.string().trim().min(2).max(80)).max(20).default([])
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(128), scope: z.enum(["member", "developer"]).default("member") });
export const resetRequestSchema = z.object({ email });
export const resetCompleteSchema = z.object({ token: z.string().min(24).max(200), password });
export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1).max(128), password });
export const profileSchema = z.object({ fullName: z.string().trim().min(2).max(100), mobile: phone, agencyName: z.string().trim().min(2).max(120), whatsappNumber: phone, city: z.string().trim().min(2).max(80), preferredLocalities: z.array(z.string().trim().min(2).max(80)).max(20), bio: safeText(1000).optional(), languages: z.array(z.string().trim().max(40)).max(12).optional(), specialties: z.array(z.string().trim().max(60)).max(12).optional() });
export const paymentRequestSchema = z.object({ plan: z.enum(["MONTHLY", "YEARLY"]), expectedAmount: z.number().int().min(1).max(1000000), utr: z.string().trim().min(6).max(80).regex(/^[a-zA-Z0-9\-/. ]+$/, "Enter the UPI transaction reference only"), paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid payment date"), screenshotFileID: z.string().trim().max(120).optional().default("") });

export const listingSchema = z.object({
  title: z.string().trim().min(4).max(140), transactionType: z.enum(["RENT", "SALE", "RESALE", "HEAVY_DEPOSIT", "LEASE", "COMMERCIAL_RENT", "COMMERCIAL_SALE"]),
  propertyType: z.string().trim().min(2).max(80), bhk: safeText(20).optional().default(""), city: z.string().trim().min(2).max(80), locality: z.string().trim().min(2).max(100), landmark: safeText(120).optional().default(""),
  carpetArea: safeText(30).optional().default(""), builtUpArea: safeText(30).optional().default(""), furnishing: z.enum(["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED", "NOT_SPECIFIED"]).default("NOT_SPECIFIED"), floor: safeText(40).optional().default(""), amenities: z.array(z.string().trim().max(60)).max(30).default([]),
  price: safeText(20).optional().default(""), rent: safeText(20).optional().default(""), deposit: safeText(20).optional().default(""), availability: safeText(80).optional().default(""), tenantPreference: safeText(100).optional().default(""), contactNumbers: z.array(phone).max(10).default([]), description: safeText(3000).optional().default(""), originalText: safeText(12000).optional().default(""), images: z.array(z.string().trim().max(120)).max(10).default([])
});
export const listingPatchSchema = listingSchema.partial().extend({ status: z.enum(["DRAFT", "ACTIVE", "SOLD", "RENTED", "UNAVAILABLE", "UNDER_REVIEW"]).optional(), confirmDuplicates: z.boolean().optional() });
export const idSchema = z.object({ id });
export const settingsSchema = z.object({
  upiId: safeText(120).default(""), payeeName: safeText(120).default(""), upiQrFileId: safeText(120).default(""), whatsappNumber: z.union([phone, z.literal("")]).default(""),
  monthlyPrice: z.number().int().min(1).max(1000000), yearlyPrice: z.number().int().min(1).max(1000000), monthlyDurationDays: z.number().int().min(1).max(366), yearlyDurationDays: z.number().int().min(1).max(730),
  paymentInstructions: safeText(2000), customerSupportMessage: safeText(1000), supportEmail: z.union([email, z.literal("")]).default(""), supportHours: safeText(120).default("")
});
export const paymentDecisionSchema = z.object({ action: z.enum(["APPROVE", "REJECT", "REQUEST_INFO"]), adminNotes: safeText(1000).optional().default(""), actualCreditVerified: z.boolean().optional().default(false) }).superRefine((value, context) => { if (value.action === "APPROVE" && !value.actualCreditVerified) context.addIssue({ code: "custom", path: ["actualCreditVerified"], message: "Confirm that the actual UPI credit was independently verified." }); if (value.action !== "APPROVE" && !value.adminNotes.trim()) context.addIssue({ code: "custom", path: ["adminNotes"], message: "Add a reason or information request note." }); });
export const userAdminPatchSchema = z.object({ action: z.enum(["SUSPEND", "REACTIVATE", "VERIFY_BROKER", "UNVERIFY_BROKER", "MAKE_ADMIN", "REMOVE_ADMIN"]), reason: safeText(500).optional().default("") });
export const listingAdminDecisionSchema = z.object({ status: z.enum(["ACTIVE", "DRAFT", "SOLD", "RENTED", "UNAVAILABLE", "UNDER_REVIEW", "DELETED"]) });
export const aiSettingsSchema = z.object({ provider: z.enum(["rule-based", "openai-compatible"]), model: safeText(120).default("") });
export const favouriteSchema = z.object({ listingID: id });
export const reportSchema = z.object({ listingID: id, reason: z.enum(["INACCURATE", "DUPLICATE", "UNAVAILABLE", "MISLEADING", "SPAM", "OTHER"]), details: safeText(1000).optional().default("") });
export const reportDecisionSchema = z.object({ status: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]), adminNotes: safeText(1000).optional().default("") });
export const uploadSchema = z.object({ fileName: z.string().trim().min(1).max(180), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(1).max(4_200_000), purpose: z.enum(["LISTING_IMAGE", "PAYMENT_PROOF", "QR_CODE"]), relatedID: safeText(120).optional().default("") });
export const aiSchema = z.object({ text: z.string().trim().min(15).max(12000) });
export const developerBootstrapSchema = z.object({ bootstrapToken: z.string().min(24).max(200), fullName: z.string().trim().min(2).max(100), email, mobile: phone, password });
export const developerRoleSchema = z.object({ userID: id, action: z.enum(["MAKE_ADMIN", "REMOVE_ADMIN"]), reason: safeText(500).optional().default("") });
export const announcementSchema = z.object({ title: z.string().trim().min(3).max(100), body: z.string().trim().min(5).max(1000), audience: z.enum(["ALL", "ACTIVE_MEMBERS"]).default("ALL") });
export const categorySchema = z.object({ categoryID: z.string().trim().max(100).optional(), name: z.string().trim().min(2).max(80), parentID: safeText(100).optional().default(""), kind: z.enum(["PROPERTY", "TRANSACTION"]), active: z.boolean().default(true), sortOrder: z.number().int().min(0).max(10000).default(100) });
export const localitySchema = z.object({ localityID: z.string().trim().max(100).optional(), city: z.string().trim().min(2).max(80), name: z.string().trim().min(2).max(100), state: safeText(80).optional().default("Maharashtra"), active: z.boolean().default(true) });
export const notificationPatchSchema = z.object({ notificationID: id });
export type RegisterInput = z.infer<typeof registerSchema>;
export type ListingInput = z.infer<typeof listingSchema>;
