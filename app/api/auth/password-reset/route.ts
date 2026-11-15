import { randomResetToken } from "@/lib/server/password";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { requestMetadata } from "@/lib/server/request-meta";
import { resetRequestSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = await readJson(request, resetRequestSchema);
    const token = randomResetToken();
    const base = process.env.APP_BASE_URL;
    if (!base) throw new Error("APP_BASE_URL is not configured.");
    let origin: URL;
    try { origin = new URL(base); } catch { throw new Error("APP_BASE_URL is invalid."); }
    if (origin.protocol !== "https:" && origin.hostname !== "localhost") throw new Error("APP_BASE_URL must use HTTPS.");
    await backendRequest("auth.reset.request", { email: input.email, token, resetUrl: `${origin.origin}/reset-password?token=${encodeURIComponent(token)}`, ...requestMetadata(request, input.email) });
    return ok({ sent: true, message: "If the account exists, a reset link will be sent to its email address." });
  } catch (e) { return apiError(e); }
}
