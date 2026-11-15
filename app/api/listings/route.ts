import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { listingSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export async function GET(request:Request) { try { const actor=await requireUser(); const url=new URL(request.url); const filters:Record<string,string>={}; ["q","city","locality","transactionType","propertyType","bhk","furnishing","availability","minPrice","maxPrice","minRent","maxRent","minDeposit","maxDeposit","minArea","maxArea"].forEach(k=>{const v=url.searchParams.get(k);if(v)filters[k]=v.slice(0,120);}); return ok(await backendRequest("listings.search",{actorID:actor.userID,filters,page:Number(url.searchParams.get("page")||1),limit:Number(url.searchParams.get("limit")||20)})); } catch(e) { return apiError(e); } }
export async function POST(request:Request) { try { enforceSameOrigin(request); const actor=await requireUser(); const input=await readJson(request,listingSchema); return ok({listing:await backendRequest("listings.create",{actorID:actor.userID,listing:input})},201); } catch(e) { return apiError(e); } }
