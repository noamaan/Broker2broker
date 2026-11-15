import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { reportSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function POST(request:Request){try{enforceSameOrigin(request);const user=await requireUser();const input=await readJson(request,reportSchema);return ok(await backendRequest("reports.create",{actorID:user.userID,...input}),201);}catch(e){return apiError(e);}}
