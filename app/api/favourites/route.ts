import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { favouriteSchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function GET(){try{const user=await requireUser();return ok({items:await backendRequest("favourites.list",{actorID:user.userID})});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{enforceSameOrigin(request);const user=await requireUser();const input=await readJson(request,favouriteSchema);return ok(await backendRequest("favourites.add",{actorID:user.userID,...input}));}catch(e){return apiError(e);}}
export async function DELETE(request:Request){try{enforceSameOrigin(request);const user=await requireUser();const input=await readJson(request,favouriteSchema);return ok(await backendRequest("favourites.remove",{actorID:user.userID,...input}));}catch(e){return apiError(e);}}
