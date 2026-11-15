import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BackendError, backendError } from "./errors";

let adminClient: SupabaseClient | null = null;

type SupabaseErrorLike = { message?: string; code?: string; details?: string | null; hint?: string | null };

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  INVALID_TOKEN: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  MEMBERSHIP_REQUIRED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENT_NOT_CONFIGURED: 503,
  BACKEND_NOT_CONFIGURED: 503,
  EMAIL_NOT_CONFIGURED: 503
};

export function mapDatabaseError(error: SupabaseErrorLike | null | undefined): BackendError {
  const message = String(error?.message || "The database request failed.");
  const prefixed = message.match(/^([A-Z_]+):\s*(.*)$/s);
  if (prefixed && STATUS_BY_CODE[prefixed[1]]) {
    return new BackendError(prefixed[2] || message, STATUS_BY_CODE[prefixed[1]], prefixed[1]);
  }
  const code = String(error?.code || "");
  if (code === "23505") return backendError("CONFLICT", "A record with those details already exists.");
  if (code === "23503" || code === "23514" || code === "22P02" || code === "22007") return backendError("INVALID_INPUT", "The submitted details are not valid.");
  if (code === "42501") return backendError("FORBIDDEN", "You do not have permission to perform this action.");
  if (code === "57014" || code === "53300" || code === "08006" || code === "08001") return backendError("BACKEND_TIMEOUT", "The database is temporarily unavailable. Please try again.");
  return new BackendError("The database could not complete the request.", 502, "BACKEND_ERROR");
}

export function supabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !key) {
    throw new BackendError("Supabase is not configured. Set SUPABASE_URL and the server-only SUPABASE_SERVICE_ROLE_KEY.", 503, "BACKEND_NOT_CONFIGURED");
  }
  let url: URL;
  try { url = new URL(rawUrl); } catch {
    throw new BackendError("SUPABASE_URL is not a valid URL.", 503, "BACKEND_CONFIGURATION_ERROR");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new BackendError("SUPABASE_URL must use HTTPS.", 503, "BACKEND_CONFIGURATION_ERROR");
  }
  if (key.length < 20) throw new BackendError("SUPABASE_SERVICE_ROLE_KEY is invalid.", 503, "BACKEND_CONFIGURATION_ERROR");
  adminClient = createClient(url.origin, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "broker2broker-next-server" } }
  });
  return adminClient;
}

export async function dbResult<T>(query: PromiseLike<{ data: T | null; error: SupabaseErrorLike | null }>): Promise<T> {
  let result: { data: T | null; error: SupabaseErrorLike | null };
  try { result = await query; } catch (error) { throw mapDatabaseError({ message: error instanceof Error ? error.message : "Database request failed." }); }
  if (result.error) throw mapDatabaseError(result.error);
  return result.data as T;
}

export async function selectAll(table: string, select = "*") {
  const client = supabaseAdmin();
  const primaryKeys: Record<string, string> = {
    users: "user_id", broker_profiles: "profile_id", listings: "listing_id", payment_requests: "request_id", payments: "payment_id",
    subscriptions: "subscription_id", categories: "category_id", localities: "locality_id", favourites: "favourite_id", reports: "report_id",
    notifications: "notification_id", admins: "admin_id", developers: "developer_id", settings: "setting_id", audit_logs: "audit_id",
    security_logs: "security_log_id", file_assets: "file_id", platform_config: "key", database_backups: "backup_id",
    rate_limit_events: "event_id", request_nonces: "nonce"
  };
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 1000) {
    let builder = (client.from(table) as any).select(select);
    if (primaryKeys[table]) builder = builder.order(primaryKeys[table], { ascending: true });
    const page = await dbResult<Record<string, any>[]>(builder.range(offset, offset + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
