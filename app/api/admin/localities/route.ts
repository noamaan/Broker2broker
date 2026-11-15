import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { localitySchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireUser(["ADMIN", "DEVELOPER"]);
    return ok({ items: await backendRequest("localities.list", { actorID: actor.userID }) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireUser(["ADMIN", "DEVELOPER"]);
    const input = await readJson(request, localitySchema);
    return ok({ items: await backendRequest("localities.save", { actorID: actor.userID, ...input }) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireUser(["ADMIN", "DEVELOPER"]);
    const input = await readJson(request, z.object({ localityID: z.string().trim().min(3).max(100) }));
    return ok(await backendRequest("localities.delete", { actorID: actor.userID, ...input }));
  } catch (error) {
    return apiError(error);
  }
}
