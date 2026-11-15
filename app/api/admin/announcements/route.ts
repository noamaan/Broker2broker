import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { announcementSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function POST(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["ADMIN","DEVELOPER"]);const input=await readJson(request,announcementSchema);return ok(await backendRequest("admin.announcement",{actorID:actor.userID,...input}));}catch(e){return apiError(e);}}
