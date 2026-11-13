"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, FileText, RefreshCw, Trash2 } from "lucide-react";
import { apiJson, type AdminAction, type AdminProject } from "./types";

type DocumentRow = { id: string; title: string; createdAt: string; submitted: number };

export function DocumentsList({ project, action, refresh }: { project: AdminProject; action: AdminAction; refresh: () => Promise<void> }) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiJson<{ documents: DocumentRow[] }>(`/api/admin/documents?projectId=${encodeURIComponent(project.id)}`);
      setDocuments(data.documents);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Documents could not be loaded."); }
  }, [project.id]);

  useEffect(() => { void load(); }, [load]);

  async function change(payload: Record<string, unknown>, message: string) {
    if (busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await action(payload);
      setSuccess(message);
      await load();
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The document change could not be saved."); }
    finally { setBusy(false); }
  }

  const submitted = documents.filter((document) => document.submitted > 0).length;
  return <section className="admin-card">
    <div className="admin-section-heading"><div><p className="admin-eyebrow">DATASET CONTENTS</p><h2>Imported documents</h2><p>{documents.length} documents · {submitted} with saved submissions. Documents with submissions cannot be deleted.</p></div><FileText size={25} aria-hidden="true" /></div>
    {documents.length > 0 && <div className="admin-account-form-footer"><button type="button" className="admin-text-button" disabled={busy} onClick={() => void load()}><RefreshCw size={13} />Refresh</button><button type="button" className="admin-text-button admin-muted" disabled={busy || documents.length === submitted} onClick={() => { if (window.confirm(`Remove all ${documents.length - submitted} documents without submissions from ${project.name}? This cannot be undone.`)) void change({ action: "deleteUnsubmittedDocuments", projectId: project.id }, "Documents without submissions were removed."); }}><Trash2 size={13} />Remove unsubmitted</button></div>}
    {documents.length === 0 ? <div className="admin-empty"><FileText size={26} /><h3>No documents imported</h3><p>Import a CSV above to add documents to {project.name}.</p></div> : <div className="admin-members-list"><div className="admin-list-header"><span>DOCUMENT</span><span>SUBMISSIONS</span></div>
      {documents.map((document) => <div className="admin-member-row" key={document.id}><div><strong>{document.title}</strong><small>{document.id} · added {new Date(document.createdAt).toLocaleDateString()}</small></div><div className="admin-member-actions"><span className={`admin-badge ${document.submitted ? "" : "admin-badge-pending"}`}>{document.submitted} submitted</span><button type="button" className="admin-text-button admin-muted" disabled={busy || document.submitted > 0} title={document.submitted ? "Documents with submissions cannot be deleted" : undefined} onClick={() => { if (window.confirm(`Delete ${document.title}? It has no submissions.`)) void change({ action: "deleteDocument", projectId: project.id, documentId: document.id }, `${document.title} was deleted.`); }}><Trash2 size={13} />Delete</button></div></div>)}
    </div>}
    {error && <p className="admin-alert admin-error" role="alert"><AlertCircle size={17} />{error}</p>}
    {success && <p className="admin-alert admin-success" role="status"><Check size={17} />{success}</p>}
  </section>;
}
