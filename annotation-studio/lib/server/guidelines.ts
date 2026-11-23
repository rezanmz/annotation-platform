import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { getDatabase } from "./db";
import { guidelinesDir } from "./env";
import { ApiError } from "./validation";

export type GuidelineDomain = "legal" | "chemistry";
export const GUIDELINE_DOMAINS = ["legal", "chemistry"] as const;
const MAX_BYTES = 25 * 1024 * 1024;

export type GuidelineStatus = {
  domain: GuidelineDomain;
  exists: boolean;
  bytes: number;
  updatedAt: string | null;
  sha256: string | null;
};

type Row = { bytes: Uint8Array; sha256: string; updated_at: string };

export function isGuidelineDomain(value: string): value is GuidelineDomain {
  return value === "legal" || value === "chemistry";
}

function pathFor(domain: GuidelineDomain): string {
  return join(guidelinesDir(), `${domain}.pdf`);
}

/** Guidelines are stored in SQLite so Litestream and database snapshots cover them. */
export async function readGuideline(domain: GuidelineDomain): Promise<Uint8Array> {
  const db = getDatabase();
  const row = await db.prepare("SELECT bytes FROM guidelines WHERE domain = ?").bind(domain).first<{ bytes: Uint8Array }>();
  if (row?.bytes) return new Uint8Array(row.bytes);
  // A deleted supplied guide must not fall back to an older practice file.
  if (!await db.prepare("SELECT 1 FROM material_imports WHERE name = ?").bind(`guideline/${domain}`).first()) {
    try { return new Uint8Array(await readFile(pathFor(domain))); }
    catch { /* No legacy file is available. */ }
  }
  throw new ApiError(503, "The project guideline is not installed on this server yet.");
}

export async function guidelineStatus(domain: GuidelineDomain): Promise<GuidelineStatus> {
  const row = await getDatabase().prepare("SELECT bytes, sha256, updated_at FROM guidelines WHERE domain = ?").bind(domain).first<Row>();
  return row
    ? { domain, exists: true, bytes: row.bytes.byteLength, updatedAt: row.updated_at, sha256: row.sha256 }
    : { domain, exists: false, bytes: 0, updatedAt: null, sha256: null };
}

export async function saveGuideline(domain: GuidelineDomain, bytes: Uint8Array): Promise<GuidelineStatus> {
  if (bytes.byteLength === 0) throw new ApiError(400, "Choose a PDF file to upload.");
  if (bytes.byteLength > MAX_BYTES) throw new ApiError(413, "Guideline PDFs are limited to 25 MB.");
  if (bytes.byteLength < 5 || Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") throw new ApiError(400, "The uploaded file is not a PDF.");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const updatedAt = new Date().toISOString();
  await getDatabase().prepare("INSERT INTO guidelines (domain, bytes, sha256, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(domain) DO UPDATE SET bytes = excluded.bytes, sha256 = excluded.sha256, updated_at = excluded.updated_at")
    .bind(domain, bytes, sha256, updatedAt)
    .run();
  return { domain, exists: true, bytes: bytes.byteLength, updatedAt, sha256 };
}

export async function removeGuideline(domain: GuidelineDomain): Promise<void> {
  await getDatabase().prepare("DELETE FROM guidelines WHERE domain = ?").bind(domain).run();
  // Remove any legacy file so the fallback cannot resurrect a deleted guideline.
  await rm(pathFor(domain), { force: true });
}
