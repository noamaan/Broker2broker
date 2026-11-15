import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { notificationPatchSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function GET(request:Request){try{const user=await requireUser();const url=new URL(request.url);return ok(await backendRequest("user.notifications",{actorID:user.userID,page:Number(url.searchParams.get("page")||1),limit:Number(url.searchParams.get("limit")||30)}));}catch(e){return apiError(e);}}
export async function PATCH(request:Request){try{enforceSameOrigin(request);const user=await requireUser();const input=await readJson(request,notificationPatchSchema);return ok(await backendRequest("user.markNotification",{actorID:user.userID,...input}));}catch(e){return apiError(e);}}
