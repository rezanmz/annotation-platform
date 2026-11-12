import type { Database } from "./db";

type AuditDatabase = Pick<Database, "prepare">;

export type AuditEntry = {
  id: string;
  actorId: string;
  action: string;
  target: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function recordAudit(
  db: AuditDatabase,
  actorId: string,
  action: string,
  target: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db.prepare("INSERT INTO audit_log (id, actor_id, action, target, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), actorId, action, target, JSON.stringify(metadata), new Date().toISOString())
    .run();
}
