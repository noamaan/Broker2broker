import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { reportDecisionSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function GET(request:Request){try{const actor=await requireUser(["ADMIN","DEVELOPER"]);const status=new URL(request.url).searchParams.get("status")||"";return ok({items:await backendRequest("admin.reports",{actorID:actor.userID,status})});}catch(e){return apiError(e);}}
export async function PATCH(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["ADMIN","DEVELOPER"]);const body=await readJson(request,z.object({reportID:z.string().min(3).max(100),status:reportDecisionSchema.shape.status,adminNotes:reportDecisionSchema.shape.adminNotes}));return ok(await backendRequest("admin.reportDecision",{actorID:actor.userID,...body}));}catch(e){return apiError(e);}}
