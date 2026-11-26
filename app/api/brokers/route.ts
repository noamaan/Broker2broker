import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    return ok(await backendRequest("brokers.directory", { actorID: user.userID, city: url.searchParams.get("city") || "", page: Number(url.searchParams.get("page") || 1) }));
  } catch (error) { return apiError(error); }
}
