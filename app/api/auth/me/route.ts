import { getCurrentUser, publicUser, HttpError } from "@/lib/server/auth";
import { apiError, ok } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    // Match the dashboard's session and account-status check, without caching user data.
    const user = await getCurrentUser();
    if (!user) throw new HttpError("Please sign in to continue.", 401, "UNAUTHENTICATED");
    return ok({ user: publicUser(user) });
  } catch (e) {
    const response = apiError(e);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
