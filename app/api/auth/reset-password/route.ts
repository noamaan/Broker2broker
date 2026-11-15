import { hashPassword } from "@/lib/server/password";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { resetCompleteSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const input = await readJson(request, resetCompleteSchema);
    const passwordFields = await hashPassword(input.password);
    await backendRequest("auth.reset.complete", { token: input.token, ...passwordFields });
    return ok({ completed: true });
  } catch (e) { return apiError(e); }
}
