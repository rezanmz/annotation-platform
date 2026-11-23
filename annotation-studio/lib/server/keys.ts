import { readFileSync } from "node:fs";

export type Domain = "legal" | "chemistry";
export type QualificationKeys = { version: string | null; answers: Record<Domain, string[]> };

let cached: { value: QualificationKeys | null; source: string } | null = null;

function tenAnswers(value: unknown): value is string[] {
  return Array.isArray(value) && value.length === 10 && value.every(entry => typeof entry === "string" && /^[A-D]$/.test(entry));
}

function parseQualificationKeys(value: unknown): QualificationKeys | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const answers = record.answers as Record<string, unknown> | undefined;
  if (answers && typeof answers === "object") {
    const version = record.version;
    if (typeof version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(version)) return null;
    if (!tenAnswers(answers.legal) || !tenAnswers(answers.chemistry)) return null;
    return { version, answers: { legal: answers.legal, chemistry: answers.chemistry } };
  }

  const { question_order: order, eurlex, un, chemistry } = record;
  if (!Array.isArray(order) || order.length !== 10 || new Set(order).size !== 10 ||
      !order.every(id => Number.isInteger(id) && id >= 1 && id <= 10)) return null;
  if (!tenAnswers(eurlex) || !tenAnswers(un) || !tenAnswers(chemistry) || eurlex.some((answer, i) => answer !== un[i])) return null;
  const byQuestion = (list: string[]) => Array.from({ length: 10 }, (_, i) => list[order.indexOf(i + 1)]);
  return { version: null, answers: { legal: byQuestion(eurlex), chemistry: byQuestion(chemistry) } };
}

/** Qualification answers are deployment configuration, never source code. */
export function qualificationKeys(): QualificationKeys | null {
  const source = process.env.QUALIFICATION_KEYS_JSON?.trim() ?? "";
  if (cached && cached.source === source) return cached.value;
  let value: QualificationKeys | null = null;
  if (source) {
    try { value = parseQualificationKeys(JSON.parse(source)); } catch { value = null; }
  }
  cached = { value, source };
  return value;
}

/** Only used by the one-time bootstrap; never exposed to the browser. */
export function qualificationKeysFromFile(path: string): QualificationKeys | null {
  try { return parseQualificationKeys(JSON.parse(readFileSync(path, "utf8"))); } catch { return null; }
}
