import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET() { try { const user=await requireUser(); return ok(await backendRequest("user.dashboard",{actorID:user.userID})); } catch(e) { return apiError(e); } }
