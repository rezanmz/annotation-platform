"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { apiJson } from "./types";

type Entry = { id: string; actorId: string; action: string; target: string; metadata: Record<string, unknown>; createdAt: string };

const LABELS: Record<string, string> = {
  "account.create": "Annotator created",
  "account.role": "Role changed",
  "account.setActive": "Account status changed",
  "account.erase": "Account erased",
  "admin.create": "Administrator created",
  "password.reset": "Password reset",
  "password.change": "Password changed",
  "membership.add": "Project assigned",
  "membership.remove": "Project access removed",
  "project.create": "Project created",
  "project.update": "Project updated",
  "project.delete": "Project deleted",
  "document.delete": "Document deleted",
  "documents.deleteUnsubmitted": "Unsubmitted documents deleted",
  "documents.import": "Documents imported",
  "answerKey.confirm": "Qualification key confirmed",
  "guideline.upload": "Guideline uploaded",
  "guideline.delete": "Guideline removed",
  "loadtest.delete": "Load-test data removed",
};

export function AuditLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { setEntries((await apiJson<{ entries: Entry[] }>("/api/admin/audit?limit=50")).entries); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Activity could not be loaded."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <section className="admin-card">
    <div className="admin-section-heading"><div><p className="admin-eyebrow">AUDIT TRAIL</p><h2>Recent activity</h2><p>Administrator and security actions, newest first. Times are shown in your local timezone.</p></div><History size={25} aria-hidden="true" /></div>
    <div className="admin-account-form-footer"><button type="button" className="admin-text-button" disabled={busy} onClick={() => void load()}><RefreshCw size={13} />Refresh</button></div>
    {error && <p className="admin-alert admin-error" role="alert">{error}</p>}
    {entries.length === 0 ? <div className="admin-empty"><History size={26} /><h3>No activity recorded yet</h3><p>Account, project, guideline, and qualification changes appear here.</p></div> : <div className="admin-members-list"><div className="admin-list-header"><span>ACTION</span><span>WHEN</span></div>
      {entries.map((entry) => <div className="admin-member-row" key={entry.id}><div><strong>{LABELS[entry.action] ?? entry.action}</strong><small>{entry.target}</small></div><span className="admin-footnote">{new Date(entry.createdAt).toLocaleString()}</span></div>)}
    </div>}
  </section>;
}
