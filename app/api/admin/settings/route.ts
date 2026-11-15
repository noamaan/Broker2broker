import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { settingsSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function GET(){try{const actor=await requireUser(["ADMIN","DEVELOPER"]);return ok({settings:await backendRequest("settings.admin",{actorID:actor.userID})});}catch(e){return apiError(e);}}
export async function PUT(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["ADMIN","DEVELOPER"]);const settings=await readJson(request,settingsSchema);return ok({settings:await backendRequest("settings.updatePayment",{actorID:actor.userID,settings})});}catch(e){return apiError(e);}}
