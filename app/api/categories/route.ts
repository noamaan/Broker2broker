import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
import { requestMetadata } from "@/lib/server/request-meta";
export const runtime="nodejs";
export async function GET(request:Request){try{return ok({items:await backendRequest("categories.list",requestMetadata(request,"categories"))});}catch(e){return apiError(e);}}
