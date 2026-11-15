import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { paymentRequestSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export async function GET() { try { const actor=await requireUser(); return ok({requests:await backendRequest("payment.myRequests",{actorID:actor.userID})}); } catch(e) { return apiError(e); } }
export async function POST(request:Request) { try { enforceSameOrigin(request); const actor=await requireUser(); const input=await readJson(request,paymentRequestSchema); const result=await backendRequest("payment.createRequest",{actorID:actor.userID,...input}); return ok({request:result},201); } catch(e) { return apiError(e); } }
