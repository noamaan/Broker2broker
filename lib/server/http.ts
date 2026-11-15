import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { BackendError } from "./errors";
import { HttpError } from "./auth";

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let value: unknown;
  try { value = await request.json(); } catch { throw new HttpError("Send a valid JSON request body.", 400, "INVALID_JSON"); }
  try { return schema.parse(value); } catch (error) {
    if (error instanceof ZodError) throw new HttpError(error.issues.map((i) => `${i.path.join(".") || "Field"}: ${i.message}`).join(" "), 400, "VALIDATION_ERROR");
    throw error;
  }
}

export function apiError(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  if (error instanceof BackendError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  console.error("API request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }, { status: 500 });
}

export function ok(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
export function enforceSameOrigin(request: Request) {
  if (!isSameOrigin(request)) throw new HttpError("Cross-site requests are not allowed.", 403, "CSRF_BLOCKED");
}
