import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { getDatabase } from "@/lib/server/db";
import { ApiError } from "@/lib/server/validation";
import { handle } from "@/lib/server/http";

export const dynamic = "force-dynamic";

function tokenMatches(header: string | null, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const actual = createHash("sha256").update(header.slice(7)).digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actual, wanted);
}

// Consistent SQLite snapshot for off-box backups. Requires a long random
// BACKUP_TOKEN; the response is the database file, never cached.
export async function GET(request: Request) {
  return handle(async () => {
    const expected = process.env.BACKUP_TOKEN?.trim() ?? "";
    if (expected.length < 32) throw new ApiError(404, "Backup export is not configured.");
    if (!tokenMatches(request.headers.get("authorization"), expected)) throw new ApiError(401, "A valid backup token is required.");
    const dir = process.env.BACKUP_DIR?.trim() || "/data/backups";
    await mkdir(dir, { recursive: true });
    // Remove abandoned snapshots from failed responses.
    for (const name of await readdir(dir)) {
      const file = join(dir, name);
      try { if ((await stat(file)).mtimeMs < Date.now() - 60 * 60 * 1000) await rm(file, { force: true }); } catch { /* ignore */ }
    }
    const name = `annotation-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
    const file = join(dir, name);
    await getDatabase().prepare(`VACUUM INTO '${file.replaceAll("'", "''")}'`).run();
    const bytes = await readFile(file);
    await rm(file, { force: true });
    const digest = createHash("sha256").update(bytes).digest("hex");
    console.log(JSON.stringify({ level: "info", message: "backup.export", bytes: bytes.length, sha256: digest }));
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
        "X-Backup-Sha256": digest,
      },
    });
  });
}
