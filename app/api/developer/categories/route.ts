import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { categorySchema } from "@/lib/server/schemas";
export const runtime="nodejs";
export async function GET(){try{const user=await requireUser(["DEVELOPER"]);return ok({items:await backendRequest("categories.list",{actorID:user.userID})});}catch(e){return apiError(e);}}
export async function POST(request:Request){try{enforceSameOrigin(request);const user=await requireUser(["DEVELOPER"]);const input=await readJson(request,categorySchema);return ok({items:await backendRequest("categories.save",{actorID:user.userID,...input})});}catch(e){return apiError(e);}}
export async function DELETE(request:Request){try{enforceSameOrigin(request);const user=await requireUser(["DEVELOPER"]);const input=await readJson(request,z.object({categoryID:z.string().min(3).max(100)}));return ok(await backendRequest("categories.delete",{actorID:user.userID,...input}));}catch(e){return apiError(e);}}
