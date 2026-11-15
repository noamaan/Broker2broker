import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError } from "@/lib/server/http";
export const runtime="nodejs";
type Context={params:Promise<{fileID:string}>};
export async function GET(_request:Request,context:Context){try{const actor=await requireUser();const {fileID}=await context.params;const file=await backendRequest<{fileName:string;mimeType:string;base64:string}>("files.get",{actorID:actor.userID,fileID});const body=Buffer.from(file.base64,"base64");if(body.byteLength>2_700_000)throw new Error("Stored image exceeds the file limit.");return new Response(body,{headers:{"Content-Type":file.mimeType,"Content-Length":String(body.byteLength),"Content-Disposition":"inline","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}catch(e){return apiError(e);}}
