import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { verifyPassword,hashPassword } from "@/lib/server/password";
import { apiError,enforceSameOrigin,ok,readJson } from "@/lib/server/http";
import { passwordChangeSchema } from "@/lib/server/schemas";
import { requestMetadata } from "@/lib/server/request-meta";
export const runtime="nodejs";
export async function POST(request:Request){try{enforceSameOrigin(request);const user=await requireUser();const input=await readJson(request,passwordChangeSchema);const credentials=await backendRequest<{passwordHash:string;passwordSalt:string}>("auth.getOwnCredentials",{actorID:user.userID,userID:user.userID});if(!(await verifyPassword(input.currentPassword,credentials.passwordSalt,credentials.passwordHash)))return Response.json({error:{code:"INVALID_PASSWORD",message:"Current password is incorrect."}},{status:401,headers:{"Cache-Control":"no-store"}});const next=await hashPassword(input.password);return ok(await backendRequest("auth.changePassword",{actorID:user.userID,userID:user.userID,...next,...requestMetadata(request,user.email)}));}catch(e){return apiError(e);}}
