// Pull a consistent SQLite snapshot from a running deployment.
//   BACKUP_URL=https://…/api/admin/backup BACKUP_TOKEN=… node scripts/backup-pull.mjs
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.BACKUP_URL;
const token = process.env.BACKUP_TOKEN;
if (!url || !token) { console.error("Set BACKUP_URL and BACKUP_TOKEN."); process.exit(2); }
const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, "cache-control": "no-store" } });
if (!response.ok) { console.error(`Backup failed: HTTP ${response.status} ${await response.text()}`); process.exit(1); }
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.subarray(0, 16).toString("utf8") !== "SQLite format 3\u0000") { console.error("Response is not a SQLite database."); process.exit(1); }
const dir = process.env.BACKUP_DIR ?? "backups";
mkdirSync(dir, { recursive: true });
const name = `annotation-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
const file = join(dir, name);
writeFileSync(file, bytes, { mode: 0o600 });
console.log(JSON.stringify({ file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }, null, 2));
