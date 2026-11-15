import { clearSessionCookie } from "@/lib/server/auth";
import { apiError, enforceSameOrigin, ok } from "@/lib/server/http";
export async function POST(request: Request) { try { enforceSameOrigin(request); await clearSessionCookie(); return ok({ signedOut: true }); } catch (e) { return apiError(e); } }
