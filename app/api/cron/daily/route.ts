import { timingSafeEqual } from "node:crypto";
import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
import { BackendError } from "@/lib/server/errors";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  const provided = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return secret.length >= 32 && a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) throw new BackendError("Unauthorized scheduled task.", 401, "UNAUTHENTICATED");
    return ok(await backendRequest("system.daily"));
  } catch (error) { return apiError(error); }
}
