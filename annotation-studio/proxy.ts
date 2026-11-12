import { NextResponse } from "next/server";

// Correlates client-visible errors with server logs without touching the body.
export function proxy(request: Request) {
  const incoming = request.headers.get("x-request-id");
  const id = incoming && /^[A-Za-z0-9._:-]{8,80}$/.test(incoming) ? incoming : crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", id);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", id);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
