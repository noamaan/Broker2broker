import { backendRequest } from "@/lib/server/backend";
import { apiError } from "@/lib/server/http";
import { requestMetadata } from "@/lib/server/request-meta";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{listingID: string; fileID: string}> }) {
  try {
    const {listingID, fileID} = await context.params;
    if (listingID.length > 100 || fileID.length > 100) throw new Error("Invalid image reference");
    const file = await backendRequest<{mimeType:string;base64:string}>("files.public", { ...requestMetadata(request), listingID, fileID });
    return new Response(Buffer.from(file.base64, "base64"), { headers: { "Content-Type": file.mimeType, "Content-Disposition": "inline", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
