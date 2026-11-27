import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { randomResetToken } from "@/lib/server/password";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { adminPasswordResetSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireUser(["ADMIN", "DEVELOPER"]);
    const { userID } = await readJson(request, adminPasswordResetSchema);
    const base = new URL(process.env.APP_BASE_URL || "");
    if (base.protocol !== "https:" && base.hostname !== "localhost") throw new Error("APP_BASE_URL must use HTTPS.");
    const token = randomResetToken();
    await backendRequest("admin.issuePasswordReset", { actorID: actor.userID, userID, token });
    return ok({ resetUrl: `${base.origin}/reset-password?token=${encodeURIComponent(token)}` });
  } catch (error) { return apiError(error); }
}
