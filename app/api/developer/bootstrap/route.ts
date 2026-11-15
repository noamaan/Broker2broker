import { backendRequest } from "@/lib/server/backend";
import { createSessionToken, publicUser, setSessionCookie, type CurrentUser } from "@/lib/server/auth";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/password";
import { developerBootstrapSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = await readJson(request, developerBootstrapSchema);
    createSessionToken("session-preflight");
    const passwordFields = await hashPassword(input.password);
    const user = await backendRequest<CurrentUser>("developer.bootstrap", { ...input, ...passwordFields });
    await setSessionCookie(user.userID);
    return ok({ user: publicUser(user) }, 201);
  } catch (e) { return apiError(e); }
}
