import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
import { requestMetadata } from "@/lib/server/request-meta";
export const runtime="nodejs";
export async function GET(request:Request){try{const q=new URL(request.url).searchParams.get("q")||"";return ok({items:await backendRequest("localities.list",{q:q.slice(0,100),...requestMetadata(request,"localities")})});}catch(e){return apiError(e);}}
