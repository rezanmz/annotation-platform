import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { databasePath } from "./env";

export type RunResult = { meta: { changes: number } };
export type SqlStatement = {
  bind(...values: unknown[]): SqlStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<RunResult>;
};
export type Database = {
  prepare(sql: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<RunResult[]>;
  withSession(session?: string): Database;
};

type SqlValue = null | number | bigint | string | Uint8Array;

function bound(values: unknown[]): SqlValue[] {
  return values.map((value) => {
    if (value === undefined) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Uint8Array) return value;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value;
    return String(value);
  });
}

class NodeStatement implements SqlStatement {
  private values: unknown[] = [];
  constructor(private readonly database: DatabaseSync, private readonly sql: string) {}
  bind(...values: unknown[]): SqlStatement { this.values = values; return this; }
  async first<T>(): Promise<T | null> {
    const row = this.database.prepare(this.sql).get(...bound(this.values)) as T | undefined;
    return row ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.database.prepare(this.sql).all(...bound(this.values)) as T[] };
  }
  async run(): Promise<RunResult> {
    const result = this.database.prepare(this.sql).run(...bound(this.values));
    return { meta: { changes: Number(result.changes) } };
  }
}

class NodeDatabase implements Database {
  constructor(private readonly database: DatabaseSync) {}
  prepare(sql: string): SqlStatement { return new NodeStatement(this.database, sql); }
  // D1 batches are atomic; mirror that with an immediate write transaction.
  async batch(statements: SqlStatement[]): Promise<RunResult[]> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results: RunResult[] = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      try { this.database.exec("ROLLBACK"); } catch { /* nothing to roll back */ }
      throw error;
    }
  }
  // D1's session API is a no-op on a single-writer local database.
  withSession(): Database { return this; }
}

let instance: Database | null = null;
let instancePath: string | null = null;

export function getDatabase(): Database {
  const path = resolve(databasePath());
  if (instance && instancePath === path) return instance;
  if (instance && instancePath !== path) throw new Error("The database path changed after startup.");
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = NORMAL");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA wal_autocheckpoint = 1000");
  instance = new NodeDatabase(database);
  instancePath = path;
  return instance;
}

export function closeDatabase(): void {
  instance = null;
  instancePath = null;
}
