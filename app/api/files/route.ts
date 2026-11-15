import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { uploadSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function POST(request:Request){try{enforceSameOrigin(request);const actor=await requireUser();const input=await readJson(request,uploadSchema);const bytes=Buffer.from(input.base64,"base64");if(bytes.byteLength>2_600_000)throw new Error("Image size must be 2.5 MB or less.");return ok(await backendRequest("files.upload",{actorID:actor.userID,...input}),201);}catch(e){return apiError(e);}}
