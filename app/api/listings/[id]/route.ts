import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { listingPatchSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,context:Context) { try { const actor=await requireUser(); const {id}=await context.params; return ok({listing:await backendRequest("listings.get",{actorID:actor.userID,listingID:id})}); } catch(e) { return apiError(e); } }
export async function PATCH(request:Request,context:Context) { try { enforceSameOrigin(request); const actor=await requireUser(); const {id}=await context.params; const patch=await readJson(request,listingPatchSchema); return ok(await backendRequest("listings.update",{actorID:actor.userID,listingID:id,patch,confirmDuplicates:patch.confirmDuplicates})); } catch(e) { return apiError(e); } }
export async function DELETE(request:Request,context:Context) { try { enforceSameOrigin(request); const actor=await requireUser(); const {id}=await context.params; return ok(await backendRequest("listings.delete",{actorID:actor.userID,listingID:id})); } catch(e) { return apiError(e); } }
