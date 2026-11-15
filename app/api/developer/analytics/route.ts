import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
export const runtime="nodejs";
export async function GET(){try{const actor=await requireUser(["DEVELOPER"]);return ok(await backendRequest("developer.analytics",{actorID:actor.userID}));}catch(e){return apiError(e);}}
