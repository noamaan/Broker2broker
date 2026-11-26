import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { enquirySchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try { const actor = await requireUser(); const url = new URL(request.url); return ok(await backendRequest("enquiries.list", { actorID: actor.userID, direction: url.searchParams.get("direction"), page: Number(url.searchParams.get("page") || 1) })); } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try { enforceSameOrigin(request); const actor = await requireUser(); const input = await readJson(request, enquirySchema); return ok(await backendRequest("enquiries.create", { actorID: actor.userID, ...input }), 201); } catch (error) { return apiError(error); }
}
