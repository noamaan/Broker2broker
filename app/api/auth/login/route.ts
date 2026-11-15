import { backendRequest } from "@/lib/server/backend";
import { publicUser, setSessionCookie, type CurrentUser } from "@/lib/server/auth";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { requestMetadata } from "@/lib/server/request-meta";
import { verifyPassword } from "@/lib/server/password";
import { loginSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
type AuthRecord = { userID: string; email: string; passwordHash: string; passwordSalt: string; role: string; accountStatus: string };
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = await readJson(request, loginSchema);
    const meta = requestMetadata(request, input.email);
    const record = await backendRequest<AuthRecord | null>("auth.getByEmail", { email: input.email, ...meta });
    const passwordMatches = record ? await verifyPassword(input.password, record.passwordSalt, record.passwordHash) : false;
    if (!record || !passwordMatches) {
      await backendRequest("security.log", { eventType: "AUTH_FAILURE", subject: input.email, ...meta, details: { scope: input.scope } }).catch(() => null);
      return Response.json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (record.accountStatus !== "ACTIVE") {
      await backendRequest("security.log", { eventType: "ACCOUNT_SUSPENDED_LOGIN", subject: input.email, ...meta, details: { scope: input.scope } }).catch(() => null);
      return Response.json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (input.scope === "developer" && record.role !== "DEVELOPER") {
      await backendRequest("security.log", { eventType: "AUTH_FAILURE", subject: input.email, ...meta, details: { scope: "developer" } }).catch(() => null);
      return Response.json({ error: { code: "FORBIDDEN", message: "Developer access is not available for this account." } }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    const user = await backendRequest<CurrentUser>("auth.loginSuccess", { userID: record.userID });
    await setSessionCookie(user.userID);
    return ok({ user: publicUser(user) });
  } catch (e) { return apiError(e); }
}
