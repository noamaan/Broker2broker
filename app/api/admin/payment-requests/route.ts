import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, ok } from "@/lib/server/http";
export const runtime="nodejs";
export async function GET(request:Request){try{const actor=await requireUser(["ADMIN","DEVELOPER"]);const u=new URL(request.url);return ok(await backendRequest("admin.paymentRequests",{actorID:actor.userID,status:u.searchParams.get("status")||"",userID:(u.searchParams.get("userID")||"").slice(0,100),page:Number(u.searchParams.get("page")||1),limit:Number(u.searchParams.get("limit")||30)}));}catch(e){return apiError(e);}}
