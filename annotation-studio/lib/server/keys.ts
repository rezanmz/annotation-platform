import { readFileSync } from "node:fs";
import { env } from "./env";

export type Domain = "legal" | "chemistry";
export type QualificationKeys = { version: string; answers: Record<Domain, string[]> };

let cached: { value: QualificationKeys | null; source: string } | null = null;

function parse(value: unknown): QualificationKeys | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const version = typeof record.version === "string" ? record.version : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(version)) return null;
  const answers = record.answers as Record<string, unknown> | undefined;
  if (!answers || typeof answers !== "object") return null;
  const legal = answers.legal, chemistry = answers.chemistry;
  const valid = (list: unknown): list is string[] => Array.isArray(list) && list.length === 10 && list.every((entry) => typeof entry === "string" && /^[A-D]$/.test(entry));
  if (!valid(legal) || !valid(chemistry)) return null;
  return { version, answers: { legal, chemistry } };
}

/** Qualification answers are deployment configuration, never source code. */
export function qualificationKeys(): QualificationKeys | null {
  const source = env.QUALIFICATION_KEYS_JSON?.trim() ?? "";
  if (cached && cached.source === source) return cached.value;
  let value: QualificationKeys | null = null;
  if (source) {
    try { value = parse(JSON.parse(source)); } catch { value = null; }
  }
  cached = { value, source };
  return value;
}

/** Only used by the one-time bootstrap; never exposed to the browser. */
export function qualificationKeysFromFile(path: string): QualificationKeys | null {
  try { return parse(JSON.parse(readFileSync(path, "utf8"))); } catch { return null; }
}
