import "server-only";
import * as webpush from "web-push";
import { dbResult, supabaseAdmin } from "./supabase";

// A strict allowlist prevents a submitted endpoint becoming a server-side request forgery.
export function validPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port && endpoint.length <= 2048 &&
      (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" || host === "web.push.apple.com" || host.endsWith(".push.apple.com") || host === "notify.windows.com" || host.endsWith(".notify.windows.com"));
  } catch { return false; }
}
export function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "";
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey) || !/^[A-Za-z0-9_-]{43}$/.test(privateKey) || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}
type Job = {queue_id:number;subscription_id:string;endpoint:string;p256dh:string;auth_key:string;attempts:number};
export async function deliverQueuedPush() {
  const config = pushConfiguration();
  if (!config) return { configured: false, delivered: 0, failed: 0 };
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const client = supabaseAdmin();
  const jobs = await dbResult<Job[]>(client.rpc("b2b_claim_push", {p_limit:50}));
  let delivered=0, failed=0;
  // The notification is intentionally generic: lock screens and shared devices may be visible to others.
  await Promise.all(jobs.map(async job => {
    try {
      if (!validPushEndpoint(job.endpoint)) throw Object.assign(new Error("Invalid push endpoint"), {statusCode:410});
      await webpush.sendNotification({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth_key}}, JSON.stringify({title:"Broker2Broker",body:"You have a new notification. Open the app to view it."}), {TTL:86400,timeout:8000});
      await dbResult(client.from("push_queue").delete().eq("queue_id",job.queue_id));
      delivered++;
    } catch (error) {
      failed++;
      const status = (error as {statusCode?:number})?.statusCode;
      if (status === 404 || status === 410) await dbResult(client.from("push_subscriptions").delete().eq("subscription_id",job.subscription_id));
      else if (job.attempts >= 5) await dbResult(client.from("push_queue").delete().eq("queue_id",job.queue_id));
    }
  }));
  return {configured:true, delivered, failed};
}
