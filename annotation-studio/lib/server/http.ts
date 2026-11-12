import { headers } from "next/headers";
import { AnnotationService } from "./service";
import { ApiError } from "./validation";
import { AuthService, AuthError, readSessionToken, assertExpectedActor, type AuthActor } from "./auth";
import { getDatabase, type Database } from "./db";
import { trustProxy } from "./env";

const noCache = { "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" };

export function authMode(): "local" | "chatgpt" { return "local"; }
function database(): Database { return getDatabase(); }
export function localAuth() { return new AuthService(database()); }
export async function configured() { return localAuth().configured(); }
export async function actor(): Promise<AuthActor | null> {
  return localAuth().actor(readSessionToken((await headers()).get("cookie")));
}
export async function service() {
  const user = await actor();
  if (!user) throw new ApiError(401, "Sign in to continue.");
  assertExpectedActor((await headers()).get("X-Annotation-Actor"), user);
  const instance = new AnnotationService(database(), user);
  await instance.claimInvitations();
  return instance;
}
export function json(value: unknown, status = 200, headers?: Record<string, string>) { return Response.json(value, { status, headers: { ...noCache, ...headers } }); }

/** Client address for login throttling. Only trusted behind our own proxy. */
export function clientKey(request: Request): string {
  if (!trustProxy()) return "direct";
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return first || real || "unknown";
}

async function requestId(): Promise<string> {
  try {
    const current = (await headers()).get("x-request-id");
    if (current && /^[A-Za-z0-9._:-]{8,80}$/.test(current)) return current;
  } catch { /* outside a request scope */ }
  return crypto.randomUUID();
}

export async function handle(work: () => Promise<unknown>): Promise<Response> {
  try { const result = await work(); return result instanceof Response ? result : json(result); }
  catch (error) {
    if (error instanceof ApiError) return json({ error: error.message, ...(error instanceof AuthError && error.code ? { code: error.code } : {}) }, error.status, error instanceof AuthError && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined);
    const id = await requestId();
    console.error(JSON.stringify({
      level: "error",
      message: "annotation_api_failed",
      requestId: id,
      name: error instanceof Error ? error.name : "UnknownError",
      detail: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
    return json({ error: "The server could not complete this request. If you were submitting, keep this page open and retry; your existing saved annotations are unchanged.", requestId: id }, 503, { "X-Request-Id": id });
  }
}
export async function readJson(request: Request): Promise<unknown> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "Cross-origin requests are not permitted.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403, "Cross-site requests are not permitted.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415, "Send JSON with Content-Type application/json.");
  const limit = 12 * 1024 * 1024;
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit) throw new ApiError(413, "This import is too large. Use a smaller batch.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new ApiError(413, "This request is too large. Use a smaller batch."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ApiError(400, "The request body must be valid JSON."); }
}
export function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(bytes as BodyInit, { headers: { ...noCache, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"` } });
}
