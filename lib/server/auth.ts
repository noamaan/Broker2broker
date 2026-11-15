import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { backendRequest } from "./backend";
import type { CurrentUser, Role } from "@/lib/types";
export type { CurrentUser, Role } from "@/lib/types";

export const SESSION_COOKIE = "b2b_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type TokenPayload = { sub: string; iat: number; exp: number; v: 1 };
export class HttpError extends Error {
  constructor(message: string, public status = 400, public code = "REQUEST_FAILED") { super(message); this.name = "HttpError"; }
}

function secret() {
  const value = process.env.B2B_SESSION_SECRET;
  if (!value || Buffer.byteLength(value) < 32) throw new HttpError("Secure sessions are not configured. Set B2B_SESSION_SECRET to at least 32 random bytes.", 503, "SESSION_NOT_CONFIGURED");
  return value;
}
function b64(value: string) { return Buffer.from(value).toString("base64url"); }
function signature(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }

export function createSessionToken(userID: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64(JSON.stringify({ sub: userID, iat: now, exp: now + SESSION_MAX_AGE, v: 1 } satisfies TokenPayload));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${signature(unsigned)}`;
}

export function verifySessionToken(token?: string): TokenPayload | null {
  if (!token || token.length > 4096) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = Buffer.from(signature(unsigned));
    const provided = Buffer.from(parts[2]);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as TokenPayload;
    if (header.alg !== "HS256" || payload.v !== 1 || typeof payload.sub !== "string" || !payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export async function setSessionCookie(userID: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(userID), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
}
export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}

export async function getSessionSubject(): Promise<string | null> {
  const jar = await cookies();
  const token = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  return token?.sub ?? null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userID = await getSessionSubject();
  if (!userID) return null;
  const user = await backendRequest<CurrentUser | null>("auth.getById", { userID });
  if (!user || user.accountStatus !== "ACTIVE") return null;
  return user;
}

export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const userID = await getSessionSubject();
  if (!userID) throw new HttpError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  const user = await backendRequest<CurrentUser | null>("auth.getById", { userID });
  if (!user || user.accountStatus !== "ACTIVE") throw new HttpError("Your session is no longer active. Please sign in again.", 401, "SESSION_INVALID");
  if (roles && !roles.includes(user.role)) throw new HttpError("You do not have permission to access this area.", 403, "FORBIDDEN");
  if (user.maintenanceMode && user.role === "USER") throw new HttpError("The platform is in scheduled maintenance. Please try again shortly.", 503, "MAINTENANCE_MODE");
  return user;
}

export function isMembershipActive(user: Pick<CurrentUser, "membershipStatus" | "membershipExpiresAt" | "accountStatus">) {
  return user.accountStatus === "ACTIVE" && user.membershipStatus === "ACTIVE" && !!user.membershipExpiresAt && Date.parse(user.membershipExpiresAt) > Date.now();
}

export function publicUser(user: CurrentUser) {
  const { userID, fullName, mobile, email, agencyName, whatsappNumber, city, preferredLocalities, role, accountStatus, membershipStatus, currentPlan, membershipStartAt, membershipExpiresAt, createdAt, brokerProfile, maintenanceMode } = user;
  return { userID, fullName, mobile, email, agencyName, whatsappNumber, city, preferredLocalities, role, accountStatus, membershipStatus, currentPlan, membershipStartAt, membershipExpiresAt, createdAt, brokerProfile, maintenanceMode };
}
