import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
import { requestMetadata } from "@/lib/server/request-meta";
export const runtime = "nodejs";
export async function GET(request:Request) { try { return ok(await backendRequest("developer.bootstrapStatus",requestMetadata(request,"developer-bootstrap-status"))); } catch (e) { return apiError(e); } }
