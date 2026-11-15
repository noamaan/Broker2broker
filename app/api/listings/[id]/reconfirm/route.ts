import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok } from "@/lib/server/http";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function POST(request:Request,context:Context){try{enforceSameOrigin(request);const user=await requireUser();const {id}=await context.params;return ok({listing:await backendRequest("listings.reconfirm",{actorID:user.userID,listingID:id})});}catch(e){return apiError(e);}}
