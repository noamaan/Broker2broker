import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
import { requestMetadata } from "@/lib/server/request-meta";
export const runtime = "nodejs";
export async function GET(request:Request) { try { return ok(await backendRequest("settings.public",requestMetadata(request,"public-settings"))); } catch (e) { return apiError(e); } }
