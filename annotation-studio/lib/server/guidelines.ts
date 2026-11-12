import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { guidelinesDir } from "./env";
import { ApiError } from "./validation";

export type GuidelineDomain = "legal" | "chemistry";

const cache = new Map<string, { mtimeMs: number; bytes: Uint8Array }>();

/** Guidelines live on the persistent volume, not in the public repository. */
export async function readGuideline(domain: GuidelineDomain): Promise<Uint8Array> {
  const file = join(guidelinesDir(), `${domain}.pdf`);
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
