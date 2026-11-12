import { getDatabase } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const row = await getDatabase().prepare("SELECT 1 AS ok").first<{ ok: number }>();
    if (row?.ok !== 1) throw new Error("Database did not answer");
    return Response.json({ status: "ok", database: "ok", latencyMs: Date.now() - started, uptimeSeconds: Math.round(process.uptime()) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", database: "error", latencyMs: Date.now() - started }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
