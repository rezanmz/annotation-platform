import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { assignmentName, type Language } from "../lib/languages.ts";
import { hashPassword, validatePassword } from "../lib/server/password.ts";

type Login = { email: string; password: string | null };
type Roster = Record<string, Login>;
type Assignment = { projectId: string; name: string; language: Language };

function readRoster(file: string): Roster {
  const stat = statSync(file, { throwIfNoEntry: false });
  if (!stat) return {};
  if (!stat.isFile()) throw new Error(`Expected a default annotator config file at ${file}.`);
  if (stat.mode & 0o077) chmodSync(file, 0o600);
  const contents = readFileSync(file, "utf8");
  try {
    const roster = JSON.parse(contents);
    if (!roster || typeof roster !== "object" || Array.isArray(roster)) throw new Error();
    for (const login of Object.values<Login>(roster)) {
      if (typeof login?.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login.email)) throw new Error();
      if (login.password !== null) validatePassword(login.password);
    }
    return roster;
  } catch {
    // JSON parse errors can quote passwords.
    throw new Error(`Invalid default annotator config at ${file}. Restore the JSON file and retry.`);
  }
}

function writeRoster(file: string, roster: Roster) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(roster, null, 2) + "\n", { flag: "wx", mode: 0o600, flush: true });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

// The caller holds a SQLite write transaction through publication of the config.
// A retry after a crash can therefore reuse the same initial passwords.
export async function seedDefaultAnnotators(db: DatabaseSync, file: string) {
  const roster = readRoster(file);
  const assignments = db.prepare(`SELECT p.id AS projectId, p.name, l.language FROM project_languages l
    JOIN projects p ON p.id = l.project_id ORDER BY p.id, l.language`).all() as Assignment[];
  const byId = db.prepare("SELECT email FROM local_accounts WHERE id = ?");
  const emailInUse = db.prepare(`SELECT 1 FROM local_accounts WHERE email = ? COLLATE NOCASE
    UNION ALL SELECT 1 FROM memberships WHERE email = ? COLLATE NOCASE LIMIT 1`);
  const createAccount = db.prepare(`INSERT INTO local_accounts
    (id, email, name, password_hash, role, active, must_change_password, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'annotator', 1, 0, ?, ?)`);
  const assign = db.prepare("INSERT INTO memberships (project_id, language, email, user_id, created_at) VALUES (?, ?, ?, ?, ?)");
  const now = new Date().toISOString();
  let created = 0;
  let missingPasswords = 0;
  for (const { projectId, name, language } of assignments) {
    const key = `${projectId}/${language}`;
    const id = `default-annotator:${projectId}:${language}`;
    const saved = roster[key];
    const existing = byId.get(id);
    if (existing) {
      // Retain password, status and assignment changes, including account erasure.
      if (!saved) {
        roster[key] = { email: String(existing.email), password: null };
        missingPasswords++;
      }
      continue;
    }
    const stem = `${projectId}-${language}`.toLowerCase();
    let email = saved?.email.toLowerCase() ?? `${stem}@annotators.invalid`;
    for (let suffix = 2; emailInUse.get(email, email); suffix++) {
      email = `${stem}-${suffix}@annotators.invalid`;
    }
    const password = saved?.password ?? randomBytes(24).toString("base64url");
    createAccount.run(id, email, assignmentName({ name, language }), await hashPassword(password), now, now);
    assign.run(projectId, language, email, id, now);
    roster[key] = { email, password };
    created++;
  }
  if (created || missingPasswords) writeRoster(file, roster);
  return { created, missingPasswords };
}
