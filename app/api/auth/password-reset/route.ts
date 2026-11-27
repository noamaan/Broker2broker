import { enforceSameOrigin, apiError, ok } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    return ok({ sent: false, message: "Please contact an administrator for a password reset link." });
  } catch (error) { return apiError(error); }
}
