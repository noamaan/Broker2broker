import "server-only";
import { createHmac } from "node:crypto";

export function requestMetadata(request: Request, subject = "") {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const secret = process.env.B2B_SESSION_SECRET || "broker2broker-unconfigured";
  const ipHash = createHmac("sha256", secret).update(ip).digest("hex").slice(0, 40);
  const rateKey = createHmac("sha256", secret).update(`${ip}|${subject.toLowerCase()}`).digest("hex").slice(0, 40);
  return { ipHash, rateKey, userAgent: (request.headers.get("user-agent") || "").slice(0, 300) };
}
