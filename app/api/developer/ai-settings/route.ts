import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { aiSettingsSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function GET(){try{const actor=await requireUser(["DEVELOPER"]);const settings=await backendRequest<{provider:string;model:string}>("settings.ai",{actorID:actor.userID});return ok({...settings,credentialConfigured:!!process.env.AI_API_KEY,endpointConfigured:!!process.env.AI_BASE_URL});}catch(e){return apiError(e);}}
export async function PUT(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["DEVELOPER"]);const input=await readJson(request,aiSettingsSchema);return ok(await backendRequest("settings.updateAI",{actorID:actor.userID,...input}));}catch(e){return apiError(e);}}
