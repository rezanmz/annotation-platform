"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Download, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { apiJson } from "./types";

type GuidelineStatus = { domain: string; exists: boolean; bytes: number; updatedAt: string | null; sha256: string | null };

const LABELS: Record<string, string> = { legal: "Legal guideline (EUR-Lex and UN)", chemistry: "Chemistry guideline" };

export function GuidelineManager({ domain, actorId }: { domain: string; actorId: string }) {
  const [status, setStatus] = useState<GuidelineStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ guidelines: GuidelineStatus[] }>("/api/admin/guidelines");
      setStatus(data.guidelines.find((entry) => entry.domain === domain) ?? null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Guideline status could not be loaded.");
    }
  }, [domain]);

  useEffect(() => { void load(); }, [load]);

  async function upload(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/guidelines/${domain}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/pdf", "X-Annotation-Actor": actorId },
        body: file,
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Upload failed (${response.status}).`);
      setMessage(`${file.name} uploaded. Annotators get the new guideline on their next request.`);
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The guideline could not be uploaded."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (busy || !status?.exists) return;
    if (!window.confirm("Remove this guideline? Annotators will see a clear error until a replacement is uploaded.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/guidelines/${domain}`, { method: "DELETE", credentials: "same-origin", headers: { "X-Annotation-Actor": actorId } });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Delete failed (${response.status}).`);
      setMessage("Guideline removed.");
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The guideline could not be removed."); }
    finally { setBusy(false); }
  }

  return <section className="admin-card">
    <div className="admin-section-heading">
      <div><p className="admin-eyebrow">REFERENCE DOCUMENTS</p><h2>{LABELS[domain] ?? domain}</h2><p>Upload or replace the PDF annotators must read before the qualification test. Stored on the persistent volume and included in volume backups.</p></div>
      <BookOpen size={25} aria-hidden="true" />
    </div>
    <div className="admin-account-fields">
      <div>
        <span className="admin-field-label">Current file</span>
        <p>{status ? status.exists ? `${(status.bytes / 1024).toFixed(0)} KB · updated ${new Date(status.updatedAt ?? Date.now()).toLocaleString()}` : "Not installed — annotators cannot open this guideline." : "Checking…"}</p>
      </div>
      <div className="admin-guideline-actions">
        <a className="admin-button admin-secondary" href={`/api/admin/guidelines/${domain}`} target="_blank" rel="noreferrer" aria-disabled={!status?.exists}><Download size={15} />View PDF</a>
        <label className="admin-button admin-secondary" aria-disabled={busy}>
          <Upload size={15} />{busy ? "Working…" : status?.exists ? "Replace PDF" : "Upload PDF"}
          <input type="file" accept="application/pdf" hidden disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
        </label>
        <button type="button" className="admin-text-button admin-muted" disabled={busy || !status?.exists} onClick={() => void remove()}><Trash2 size={14} />Remove</button>
        <button type="button" className="admin-text-button" disabled={busy} onClick={() => void load()}><RefreshCw size={13} />Refresh</button>
      </div>
    </div>
    {error && <p className="admin-alert admin-error" role="alert">{error}</p>}
    {message && <p className="admin-alert admin-success" role="status">{message}</p>}
  </section>;
}
