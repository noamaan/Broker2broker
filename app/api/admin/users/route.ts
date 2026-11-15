import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { userAdminPatchSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function GET(request:Request){try{const actor=await requireUser(["ADMIN","DEVELOPER"]);const u=new URL(request.url);return ok(await backendRequest("admin.users",{actorID:actor.userID,q:(u.searchParams.get("q")||"").slice(0,100),page:Number(u.searchParams.get("page")||1),limit:Number(u.searchParams.get("limit")||30)}));}catch(e){return apiError(e);}}
export async function PATCH(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["ADMIN","DEVELOPER"]);const body=await readJson(request,z.object({userID:z.string().min(3).max(100),action:userAdminPatchSchema.shape.action,reason:userAdminPatchSchema.shape.reason}));return ok(await backendRequest("admin.userAction",{actorID:actor.userID,...body}));}catch(e){return apiError(e);}}
