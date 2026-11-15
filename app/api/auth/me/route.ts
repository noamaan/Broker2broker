import { requireUser, publicUser } from "@/lib/server/auth";
import { apiError, ok } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET() { try { const user = await requireUser(); return ok({ user: publicUser(user) }); } catch (e) { return apiError(e); } }
