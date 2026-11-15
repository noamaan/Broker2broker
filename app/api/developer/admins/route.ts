import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { developerRoleSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function GET(){try{const actor=await requireUser(["DEVELOPER"]);const list=await backendRequest<{items:Record<string,unknown>[];total:number}>("admin.users",{actorID:actor.userID,page:1,limit:100});return ok({items:list.items.filter((u)=>u.role==="ADMIN"||u.role==="DEVELOPER"),total:list.total});}catch(e){return apiError(e);}}
export async function PATCH(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["DEVELOPER"]);const input=await readJson(request,developerRoleSchema);return ok(await backendRequest("developer.userRole",{actorID:actor.userID,...input}));}catch(e){return apiError(e);}}
