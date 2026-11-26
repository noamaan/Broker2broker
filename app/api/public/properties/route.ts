import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
import { requestMetadata } from "@/lib/server/request-meta";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return ok(await backendRequest("listings.public", { ...requestMetadata(request), q: url.searchParams.get("q") || "", city: url.searchParams.get("city") || "", bhk: url.searchParams.get("bhk") || "", transactionType: url.searchParams.get("transactionType") || "", maxPrice: url.searchParams.get("maxPrice") || "", page: Number(url.searchParams.get("page") || 1) }));
  } catch (error) { return apiError(error); }
}
