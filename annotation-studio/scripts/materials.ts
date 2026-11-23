import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { qualificationKeys, qualificationKeysFromFile } from "../lib/server/keys.ts";

const domains = ["legal", "chemistry"] as const;
const digest = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

// The import marker and the corresponding data commit in the same bootstrap transaction.
function newRevision(db: DatabaseSync, name: string, sha256: string) {
  return db.prepare(`INSERT INTO material_imports (name, sha256) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET sha256 = excluded.sha256 WHERE sha256 <> excluded.sha256`).run(name, sha256).changes > 0;
}

function installKeys(db: DatabaseSync, directory: string, messages: string[]) {
  const supplied = join(directory, "qualification-answer-keys.json");
  const hasSupplied = existsSync(supplied);
  const inline = process.env.QUALIFICATION_KEYS_JSON?.trim();
  const fallbackFile = inline ? undefined : process.env.QUALIFICATION_KEYS_FILE?.trim();
  const file = hasSupplied ? supplied : fallbackFile;
  if (!file && !inline) return;
  const keys = file ? qualificationKeysFromFile(file) : qualificationKeys();
  if (!keys) throw new Error("Invalid qualification keys. Supply ten A–D answers per corpus in question_order (1–10), with matching EUR-Lex and UN keys, or a versioned legal/chemistry key.");
  // Public version identifiers must be independent of the private answers.
  const version = keys.version ?? `supplied-${randomUUID()}`;
  const now = new Date().toISOString();
  for (const domain of domains) {
    const answers = JSON.stringify(keys.answers[domain]);
    const current = db.prepare("SELECT version, answers FROM answer_keys WHERE domain = ?").get(domain);
    if (hasSupplied || keys.version === null) {
      if (!newRevision(db, `key/${domain}`, digest(JSON.stringify([keys.version, keys.answers[domain]])))) continue;
      if (current?.answers === answers && (!keys.version || current.version === version)) continue;
    } else if (current) continue;
    const prior = db.prepare("SELECT answers FROM answer_key_versions WHERE domain = ? AND version = ?").get(domain, version);
    if (prior && prior.answers !== answers) throw new Error(`The ${domain} key changed under an existing version. Give the revised key a new version.`);
    db.prepare("INSERT OR IGNORE INTO answer_key_versions (domain, version, answers, confirmed_by, confirmed_at) VALUES (?, ?, ?, 'system:bootstrap', ?)").run(domain, version, answers, now);
    db.prepare(`INSERT INTO answer_keys (domain, version, answers, confirmed_by, confirmed_at) VALUES (?, ?, ?, 'system:bootstrap', ?)
      ON CONFLICT(domain) DO UPDATE SET version = excluded.version, answers = excluded.answers, confirmed_by = excluded.confirmed_by, confirmed_at = excluded.confirmed_at`)
      .run(domain, version, answers, now);
    messages.push(`Installed the ${domain} qualification key.`);
  }
}

export function installMaterials(db: DatabaseSync, messages: string[]) {
  const directory = resolve(process.env.ANNOTATION_MATERIALS_DIR?.trim() || "..");
  const legacy = resolve(process.env.GUIDELINES_DIR?.trim() || "/data/guidelines");
  installKeys(db, directory, messages);
  for (const domain of domains) {
    const name = `guideline/${domain}`;
    const supplied = join(directory, `${domain}_annotation_guidelines.pdf`);
    const hasSupplied = existsSync(supplied);
    const file = hasSupplied ? supplied : join(legacy, `${domain}.pdf`);
    if (!hasSupplied) {
      if (!existsSync(file)) continue;
      const installed = db.prepare(`SELECT 1 FROM guidelines WHERE domain = ?
        UNION ALL SELECT 1 FROM material_imports WHERE name = ?`).get(domain, name);
      if (installed) continue;
    }
    if (statSync(file).size > 25 * 1024 * 1024) throw new Error(`The ${domain} guideline exceeds 25 MB.`);
    const bytes = readFileSync(file);
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
      if (hasSupplied) throw new Error(`Invalid PDF at ${file}.`);
      continue;
    }
    const sha256 = digest(bytes);
    if (hasSupplied && !newRevision(db, name, sha256)) continue;
    db.prepare(`INSERT INTO guidelines (domain, bytes, sha256, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(domain) DO UPDATE SET bytes = excluded.bytes, sha256 = excluded.sha256, updated_at = excluded.updated_at
      WHERE guidelines.sha256 <> excluded.sha256`).run(domain, bytes, sha256, new Date().toISOString());
    messages.push(`Installed the ${domain} guideline PDF.`);
  }
}
