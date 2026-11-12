import { env } from "./env";

export type DemoKeys = { answers: string[] };

/** The sample workspace is opt-in. It must never expose live guidelines or keys. */
export function demoEnabled(): boolean {
  return env.DEMO_ENABLED === "1";
}

export function demoKeys(): DemoKeys | null {
  const raw = env.DEMO_QUALIFICATION_KEYS_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { answers?: unknown };
    const answers = parsed.answers;
    if (!Array.isArray(answers) || answers.length !== 10 || answers.some((entry) => typeof entry !== "string" || !/^[A-D]$/.test(entry))) return null;
    return { answers };
  } catch { return null; }
}
