import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok } from "@/lib/server/http";
export const runtime="nodejs";
export async function POST(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["DEVELOPER"]);return ok(await backendRequest("developer.backup",{actorID:actor.userID}));}catch(e){return apiError(e);}}
