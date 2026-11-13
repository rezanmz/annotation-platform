import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

const cache = new Map<string, { mtimeMs: number; bytes: Uint8Array }>();

export function isGuidelineDomain(value: string): value is GuidelineDomain {
  return value === "legal" || value === "chemistry";
}

function pathFor(domain: GuidelineDomain): string {
  return join(guidelinesDir(), `${domain}.pdf`);
}

/** Guidelines live on the persistent volume, not in the public repository. */
export async function readGuideline(domain: GuidelineDomain): Promise<Uint8Array> {
  const file = pathFor(domain);
  try {
    const info = await stat(file);
    const hit = cache.get(file);
    if (hit && hit.mtimeMs === info.mtimeMs) return hit.bytes;
    const bytes = new Uint8Array(await readFile(file));
    cache.set(file, { mtimeMs: info.mtimeMs, bytes });
    return bytes;
  } catch {
    throw new ApiError(503, "The project guideline is not installed on this server yet.");
  }
}

export async function guidelineStatus(domain: GuidelineDomain): Promise<GuidelineStatus> {
  const file = pathFor(domain);
  try {
    const info = await stat(file);
    const bytes = await readFile(file);
    return { domain, exists: true, bytes: bytes.byteLength, updatedAt: info.mtime.toISOString(), sha256: createHash("sha256").update(bytes).digest("hex") };
  } catch {
    return { domain, exists: false, bytes: 0, updatedAt: null, sha256: null };
  }
}

export async function saveGuideline(domain: GuidelineDomain, bytes: Uint8Array): Promise<GuidelineStatus> {
  if (bytes.byteLength === 0) throw new ApiError(400, "Choose a PDF file to upload.");
  if (bytes.byteLength > MAX_BYTES) throw new ApiError(413, "Guideline PDFs are limited to 25 MB.");
  if (bytes.byteLength < 5 || Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") throw new ApiError(400, "The uploaded file is not a PDF.");
  const file = pathFor(domain);
  await mkdir(guidelinesDir(), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, file);
  cache.delete(file);
  return guidelineStatus(domain);
}

export async function removeGuideline(domain: GuidelineDomain): Promise<void> {
  const file = pathFor(domain);
  await rm(file, { force: true });
  cache.delete(file);
}
