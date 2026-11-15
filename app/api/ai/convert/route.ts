import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { convertPropertyText } from "@/lib/server/ai";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { aiSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function POST(request:Request){try{enforceSameOrigin(request);const user=await requireUser();const input=await readJson(request,aiSchema);const config=await backendRequest<{provider:string;model:string}>("ai.context",{actorID:user.userID});return ok(await convertPropertyText(input.text,config));}catch(e){return apiError(e);}}
