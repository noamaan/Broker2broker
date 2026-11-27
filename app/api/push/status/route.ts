import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { backendRequest } from "@/lib/server/backend";
import { dbResult, supabaseAdmin } from "@/lib/server/supabase";
import { validPushEndpoint } from "@/lib/server/push";
export const runtime="nodejs";
export async function POST(request:Request){try{enforceSameOrigin(request);const actor=await requireUser();const {endpoint}=await readJson(request,z.object({endpoint:z.string().max(2048).refine(validPushEndpoint)}));await backendRequest("push.rate",{actorID:actor.userID});const row=await dbResult<{user_id:string}|null>(supabaseAdmin().from("push_subscriptions").select("user_id").eq("endpoint",endpoint).maybeSingle());return ok({enabled:row?.user_id===actor.userID});}catch(e){return apiError(e);}}
