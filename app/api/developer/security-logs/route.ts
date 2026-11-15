import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";

export const runtime = "nodejs";

type Context = {
  page: number;
  limit: number;
};

export async function GET(request: Request) {
  try {
    const actor = await requireUser(["DEVELOPER"]);
    const url = new URL(request.url);
    const pageInput = Number(url.searchParams.get("page") || 1);
    const limitInput = Number(url.searchParams.get("limit") || 30);
    const page = Number.isInteger(pageInput) && pageInput > 0 ? Math.min(pageInput, 10000) : 1;
    const limit = Number.isInteger(limitInput) && limitInput > 0 ? Math.min(limitInput, 100) : 30;
    const pagination: Context = { page, limit };
    return ok(await backendRequest("developer.securityLogs", { actorID: actor.userID, ...pagination }));
  } catch (error) {
    return apiError(error);
  }
}
