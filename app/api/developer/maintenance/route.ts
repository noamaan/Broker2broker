import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
export const runtime="nodejs";
export async function POST(request:Request){try{enforceSameOrigin(request);const actor=await requireUser(["DEVELOPER"]);const input=await readJson(request,z.object({enabled:z.boolean()}));return ok(await backendRequest("settings.updateMaintenance",{actorID:actor.userID,...input}));}catch(e){return apiError(e);}}
