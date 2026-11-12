import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { hashPassword, validatePassword } from "../lib/server/password.ts";

type Keys = { version: string; answers: { legal: string[]; chemistry: string[] } };

function parsedKeys(): Keys | null {
  const inline = process.env.QUALIFICATION_KEYS_JSON?.trim();
  const file = process.env.QUALIFICATION_KEYS_FILE?.trim();
  let value: unknown = null;
  try {
    if (inline) value = JSON.parse(inline);
    else if (file) value = JSON.parse(readFileSync(resolve(file), "utf8"));
  } catch {
    throw new Error("QUALIFICATION_KEYS_JSON / QUALIFICATION_KEYS_FILE is not valid JSON.");
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const version = record.version;
  const answers = record.answers as Record<string, unknown> | undefined;
  const valid = (list: unknown): list is string[] => Array.isArray(list) && list.length === 10 && list.every((entry) => typeof entry === "string" && /^[A-D]$/.test(entry));
  if (typeof version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(version) || !answers || !valid(answers.legal) || !valid(answers.chemistry)) {
    throw new Error("Qualification keys must contain a version and ten A-D answers for legal and chemistry.");
  }
  return { version, answers: { legal: answers.legal, chemistry: answers.chemistry } };
}

const databasePath = resolve(process.env.DATABASE_PATH?.trim() || ".data/app.db");
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA busy_timeout = 5000");

const keys = parsedKeys();
if (keys) {
  const current = db.prepare("SELECT version FROM answer_keys WHERE domain = ?");
  const now = new Date().toISOString();
  for (const domain of ["legal", "chemistry"] as const) {
    if (current.get(domain)) continue;
    const answers = JSON.stringify(keys.answers[domain]);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("INSERT OR IGNORE INTO answer_key_versions (domain, version, answers, confirmed_by, confirmed_at) VALUES (?, ?, ?, ?, ?)").run(domain, keys.version, answers, "system:bootstrap", now);
      db.prepare("INSERT INTO answer_keys (domain, version, answers, confirmed_by, confirmed_at) VALUES (?, ?, ?, ?, ?)").run(domain, keys.version, answers, "system:bootstrap", now);
      db.exec("COMMIT");
      console.log(`Seeded ${domain} qualification key ${keys.version}.`);
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* ignore */ }
      throw error;
    }
  }
}

const admin = db.prepare("SELECT id FROM local_accounts WHERE role = 'admin' AND active = 1 LIMIT 1").get();
if (admin) {
  console.log("Administrator account already exists; nothing to bootstrap.");
  db.close();
  process.exit(0);
}

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Workspace administrator";
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!email || !password) {
  console.warn("No active administrator and BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD are unset; skipping administrator creation.");
  db.close();
  process.exit(0);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL is not a valid email address.");
if (name.length > 120) throw new Error("BOOTSTRAP_ADMIN_NAME is too long.");
validatePassword(password);
const hash = await hashPassword(password);
const now = new Date().toISOString();
db.prepare("INSERT INTO local_accounts (id, email, name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', 1, 0, ?, ?)")
  .run(crypto.randomUUID(), email, name, hash, now, now);
db.close();
console.log(`Administrator ${email} created. Remove BOOTSTRAP_ADMIN_PASSWORD from the service variables now.`);
