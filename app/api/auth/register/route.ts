import { backendRequest } from "@/lib/server/backend";
import { createSessionToken, publicUser, setSessionCookie, type CurrentUser } from "@/lib/server/auth";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { requestMetadata } from "@/lib/server/request-meta";
import { hashPassword } from "@/lib/server/password";
import { registerSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = await readJson(request, registerSchema);
    createSessionToken("session-preflight");
    const passwordFields = await hashPassword(input.password);
    const user = await backendRequest<CurrentUser>("auth.register", { ...input, ...passwordFields, ...requestMetadata(request, input.email) });
    await setSessionCookie(user.userID);
    return ok({ user: publicUser(user) }, 201);
  } catch (e) { return apiError(e); }
}
