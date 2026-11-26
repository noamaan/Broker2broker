import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/server/auth";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { backendRequest } from "@/lib/server/backend";
import { dbResult, supabaseAdmin } from "@/lib/server/supabase";
import { pushConfiguration, validPushEndpoint } from "@/lib/server/push";
export const runtime="nodejs";
const endpointSchema=z.string().url().max(2048).refine(validPushEndpoint,"Unsupported push service.");
const subscriptionSchema=z.object({endpoint:endpointSchema,keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)})});
export async function GET(){try{await requireUser();const config=pushConfiguration();return ok({configured:!!config,publicKey:config?.publicKey||""});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{
  enforceSameOrigin(request);const actor=await requireUser();const input=await readJson(request,subscriptionSchema);
  if(!pushConfiguration())throw new HttpError("Push notifications are not configured yet.",503,"PUSH_NOT_CONFIGURED");
  await backendRequest("push.rate",{actorID:actor.userID});
  const client=supabaseAdmin();
  const existing=await dbResult<{user_id:string}|null>(client.from("push_subscriptions").select("user_id").eq("endpoint",input.endpoint).maybeSingle());
  if(existing && existing.user_id!==actor.userID)throw new HttpError("This browser is linked to another account. Sign in to that account and turn off notifications first.",409,"CONFLICT");
  if(existing) await dbResult(client.from("push_subscriptions").update({p256dh:input.keys.p256dh,auth_key:input.keys.auth,updated_at:new Date().toISOString()}).eq("endpoint",input.endpoint).eq("user_id",actor.userID));
  else { const {count,error} = await client.from("push_subscriptions").select("subscription_id",{count:"exact",head:true}).eq("user_id",actor.userID); if(error) throw new Error("Could not check subscriptions."); if((count||0)>=10)throw new HttpError("Too many devices are registered. Turn off notifications on an old device first.",409,"CONFLICT"); await dbResult(client.from("push_subscriptions").insert({subscription_id:randomUUID(),user_id:actor.userID,endpoint:input.endpoint,p256dh:input.keys.p256dh,auth_key:input.keys.auth})); }
  return ok({enabled:true});
}catch(e){return apiError(e);}}
export async function DELETE(request:Request){try{enforceSameOrigin(request);const actor=await requireUser();const {endpoint}=await readJson(request,z.object({endpoint:endpointSchema}));await backendRequest("push.rate",{actorID:actor.userID});const client=supabaseAdmin();const existing=await dbResult<{user_id:string}|null>(client.from("push_subscriptions").select("user_id").eq("endpoint",endpoint).maybeSingle());if(existing&&existing.user_id!==actor.userID)throw new HttpError("This browser is linked to another account. Sign in to that account and turn off notifications first.",409,"CONFLICT");await dbResult(client.from("push_subscriptions").delete().eq("user_id",actor.userID).eq("endpoint",endpoint));return ok({enabled:false});}catch(e){return apiError(e);}}
