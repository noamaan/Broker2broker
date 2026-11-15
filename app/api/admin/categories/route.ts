import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { backendRequest } from "@/lib/server/backend";
import { apiError, enforceSameOrigin, ok, readJson } from "@/lib/server/http";
import { categorySchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireUser(["ADMIN", "DEVELOPER"]);
    return ok({ items: await backendRequest("categories.list", { actorID: actor.userID }) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireUser(["ADMIN", "DEVELOPER"]);
    const input = await readJson(request, categorySchema);
    return ok({ items: await backendRequest("categories.save", { actorID: actor.userID, ...input }) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireUser(["ADMIN", "DEVELOPER"]);
    const input = await readJson(request, z.object({ categoryID: z.string().trim().min(3).max(100) }));
    return ok(await backendRequest("categories.delete", { actorID: actor.userID, ...input }));
  } catch (error) {
    return apiError(error);
  }
}
