import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

type Journal = { entries: { idx: number; tag: string }[] };

const databasePath = resolve(process.env.DATABASE_PATH?.trim() || ".data/app.db");
const migrationsDir = resolve("drizzle");
const journal = JSON.parse(readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf8")) as Journal;

mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA busy_timeout = 30000");
db.exec("PRAGMA journal_mode = WAL");
db.exec("CREATE TABLE IF NOT EXISTS _omp_migrations (tag TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");

const applied = db.prepare("SELECT 1 FROM _omp_migrations WHERE tag = ?");
let count = 0;
for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
  db.exec("BEGIN IMMEDIATE");
  try {
    if (applied.get(entry.tag)) {
      db.exec("COMMIT");
      continue;
    }
    db.exec(readFileSync(join(migrationsDir, `${entry.tag}.sql`), "utf8"));
    db.prepare("INSERT INTO _omp_migrations (tag, applied_at) VALUES (?, ?)").run(entry.tag, new Date().toISOString());
    db.exec("COMMIT");
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* ignore */ }
    throw new Error(`Migration ${entry.tag} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  count += 1;
  console.log(`Applied migration ${entry.tag}`);
}
db.close();
console.log(count ? `Migrations complete (${count} applied).` : "Database schema is up to date.");
