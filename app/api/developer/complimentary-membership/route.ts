import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
export const runtime = "nodejs";
const schema=z.object({userID:z.string().trim().min(3).max(100),plan:z.enum(["MONTHLY","YEARLY"]),reason:z.string().trim().min(5).max(500),grantID:z.string().uuid()});
export async function POST(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["DEVELOPER"]);const input=await readJson(request,schema);return ok(await backendRequest("developer.grantMembership",{actorID:actor.userID,...input}));}catch(e){return apiError(e);}}
