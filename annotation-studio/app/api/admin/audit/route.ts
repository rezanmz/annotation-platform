import { handle, service } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const before = url.searchParams.get("before") ?? undefined;
    return (await service()).auditTrail(limit, before);
  });
}
