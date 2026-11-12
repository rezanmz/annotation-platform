import { authResponse, readSessionToken, sessionCookie } from "@/lib/server/auth";
import { handle, json, localAuth, readJson } from "@/lib/server/http";
import { ApiError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request) as { currentPassword?: unknown; newPassword?: unknown };
    const actor = await localAuth().actor(readSessionToken(request.headers.get("cookie")));
    if (!actor) throw new ApiError(401, "Sign in again to change your password.");
    const result = await localAuth().changePassword(actor.id, body.currentPassword, body.newPassword);
    return json(authResponse(result), 200, { "Set-Cookie": sessionCookie(result.token, request.url, result.expiresAt) });
  });
}
