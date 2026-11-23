import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { hashPassword, validatePassword } from "../lib/server/password.ts";
import { installMaterials } from "./materials.ts";

const databasePath = resolve(process.env.DATABASE_PATH?.trim() || ".data/app.db");
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
const messages: string[] = [];

async function seedAdmin() {
  const admin = db.prepare("SELECT id FROM local_accounts WHERE role = 'admin' AND active = 1 LIMIT 1").get();
  if (admin) return;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Workspace administrator";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first administrator.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL is not a valid email address.");
  if (name.length > 120) throw new Error("BOOTSTRAP_ADMIN_NAME is too long.");
  validatePassword(password);
  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO local_accounts (id, email, name, password_hash, role, active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', 1, 0, ?, ?)")
    .run(crypto.randomUUID(), email, name, hash, now, now);
  messages.push(`Administrator ${email} created. Remove BOOTSTRAP_ADMIN_PASSWORD from the service variables now.`);
}

try {
  db.exec("PRAGMA busy_timeout = 30000");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("BEGIN IMMEDIATE");
  installMaterials(db, messages);
  await seedAdmin();
  db.exec("COMMIT");
  for (const message of messages) console.log(message);
} finally {
  // Closing also rolls back any uncommitted bootstrap work.
  db.close();
}
