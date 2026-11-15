import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { listingAdminDecisionSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function GET(request:Request){try{const actor=await requireUser(["ADMIN","DEVELOPER"]);const u=new URL(request.url);return ok(await backendRequest("admin.listings",{actorID:actor.userID,status:u.searchParams.get("status")||"",page:Number(u.searchParams.get("page")||1),limit:Number(u.searchParams.get("limit")||30)}));}catch(e){return apiError(e);}}
export async function PATCH(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["ADMIN","DEVELOPER"]);const body=await readJson(request,z.object({listingID:z.string().min(3).max(100),status:listingAdminDecisionSchema.shape.status}));return ok(await backendRequest("admin.listingDecision",{actorID:actor.userID,...body}));}catch(e){return apiError(e);}}
