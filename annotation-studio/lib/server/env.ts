// Runtime configuration for the self-hosted Node build.
// Every value is read from the process environment; there is no platform binding.
export type AppEnvironment = NodeJS.ProcessEnv & {
  DATABASE_PATH?: string;
  GUIDELINES_DIR?: string;
  QUALIFICATION_KEYS_JSON?: string;
  TRUST_PROXY?: string;
  AUTH_MODE?: string;
};

export const env: AppEnvironment = process.env;

export function databasePath(): string {
  return env.DATABASE_PATH?.trim() || ".data/app.db";
}

export function guidelinesDir(): string {
  return env.GUIDELINES_DIR?.trim() || "guidelines";
}

/** True when requests are known to arrive through a trusted reverse proxy. */
export function trustProxy(): boolean {
  return env.TRUST_PROXY !== "0";
}
