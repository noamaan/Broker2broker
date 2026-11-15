import { requireUser, publicUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { profileSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export async function GET() { try { const user=await requireUser(); return ok({user:publicUser(user)}); } catch(e) { return apiError(e); } }
export async function PATCH(request:Request) { try { enforceSameOrigin(request); const actor=await requireUser(); const input=await readJson(request,profileSchema); const user=await backendRequest("user.updateProfile",{actorID:actor.userID,userID:actor.userID,...input}); return ok({user}); } catch(e) { return apiError(e); } }
