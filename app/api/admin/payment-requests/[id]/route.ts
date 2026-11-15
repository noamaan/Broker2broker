import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { paymentDecisionSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function POST(request:Request,context:Context){try{enforceSameOrigin(request);const actor=await requireUser(["ADMIN","DEVELOPER"]);const {id}=await context.params;const input=await readJson(request,paymentDecisionSchema);return ok(await backendRequest("admin.paymentDecision",{actorID:actor.userID,requestID:id,...input}));}catch(e){return apiError(e);}}
