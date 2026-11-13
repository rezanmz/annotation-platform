"use client";

import { useState } from "react";
import { Check, FolderKanban, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { AdminAction, AdminProject } from "./types";

type Draft = { id: string; name: string; domain: "legal" | "chemistry"; description: string };
const empty: Draft = { id: "", name: "", domain: "legal", description: "" };

export function ProjectsAdmin({ projects, action, refresh }: { projects: AdminProject[]; action: AdminAction; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<AdminProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function run(payload: Record<string, unknown>, message: string, after?: () => void) {
    if (busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await action(payload);
      after?.();
      setSuccess(message);
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The project change could not be saved."); }
    finally { setBusy(false); }
  }

  return <section className="admin-card">
    <div className="admin-section-heading"><div><p className="admin-eyebrow">WORKSPACE STRUCTURE</p><h2>Projects</h2><p>Create projects, choose the guideline domain they use, and edit or remove projects that have no data.</p></div><FolderKanban size={25} aria-hidden="true" /></div>
    <div className="admin-members-list">
      <div className="admin-list-header"><span>PROJECT</span><span>DOMAIN & DATA</span></div>
      {projects.map((project) => <div className="admin-account-row" key={project.id}>
        <div className="admin-member">
          <div className="admin-member-identity"><span className="admin-avatar">{project.name.slice(0, 2).toUpperCase()}</span><div><strong>{project.name}</strong><span>{project.id}</span><span>{project.description || "No description"}</span></div></div>
          <div className="admin-member-actions">
            <span className="admin-badge">{project.domain === "chemistry" ? "Chemistry" : "Legal"}</span>
            <span className="admin-footnote">{project.total} documents · {project.members} members</span>
            <button type="button" className="admin-text-button" disabled={busy} onClick={() => { setEditing(project); setError(""); setSuccess(""); }}><Pencil size={13} />Edit</button>
            <button type="button" className="admin-text-button admin-muted" disabled={busy} onClick={() => { if (window.confirm(`Delete ${project.name}? Only projects with no documents, submissions, or members can be deleted.`)) void run({ action: "deleteProject", projectId: project.id }, `${project.name} was deleted.`); }}><Trash2 size={13} />Delete</button>
          </div>
        </div>
        {editing?.id === project.id && <form className="admin-account-form" onSubmit={(event) => { event.preventDefault(); void run({ action: "updateProject", projectId: project.id, name: editing.name, description: editing.description }, `${editing.name} was updated.`, () => setEditing(null)); }}>
          <div className="admin-account-fields">
            <label className="admin-field-label" htmlFor={`project-name-${project.id}`}>Name<input id={`project-name-${project.id}`} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required maxLength={120} disabled={busy} /></label>
            <label className="admin-field-label" htmlFor={`project-description-${project.id}`}>Description<input id={`project-description-${project.id}`} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} maxLength={500} disabled={busy} /></label>
          </div>
          <div className="admin-account-form-footer"><button type="button" className="admin-text-button" disabled={busy} onClick={() => setEditing(null)}><X size={13} />Cancel</button><button className="admin-button admin-primary" type="submit" disabled={busy || !editing.name.trim()}><Check size={15} />Save changes</button></div>
        </form>}
      </div>)}
    </div>
    <form className="admin-account-form" onSubmit={(event) => { event.preventDefault(); void run({ action: "createProject", ...draft, id: draft.id.trim(), name: draft.name.trim(), description: draft.description.trim() }, `${draft.name.trim()} was created.`, () => setDraft(empty)); }}>
      <div className="admin-section-heading"><div><p className="admin-eyebrow">NEW PROJECT</p><h3>Add a project</h3></div><Plus size={20} /></div>
      <div className="admin-account-fields">
        <label className="admin-field-label" htmlFor="new-project-id">Identifier<input id="new-project-id" value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} required maxLength={120} pattern="[A-Za-z0-9][A-Za-z0-9._:-]*" placeholder="e.g. contracts-2026" disabled={busy} /></label>
        <label className="admin-field-label" htmlFor="new-project-name">Name<input id="new-project-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required maxLength={120} placeholder="Project name" disabled={busy} /></label>
      </div>
      <div className="admin-account-fields">
        <label className="admin-field-label" htmlFor="new-project-domain">Guideline domain<select id="new-project-domain" value={draft.domain} onChange={(event) => setDraft({ ...draft, domain: event.target.value as Draft["domain"] })} disabled={busy}><option value="legal">Legal (EUR-Lex / UN guideline)</option><option value="chemistry">Chemistry</option></select></label>
        <label className="admin-field-label" htmlFor="new-project-description">Description<input id="new-project-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={500} placeholder="Optional" disabled={busy} /></label>
      </div>
      <div className="admin-account-form-footer"><button type="button" className="admin-text-button" disabled={busy} onClick={() => setDraft(empty)}><RefreshCw size={13} />Reset</button><button className="admin-button admin-primary" type="submit" disabled={busy || !draft.id.trim() || !draft.name.trim()}><Plus size={16} />{busy ? "Saving…" : "Create project"}</button></div>
    </form>
    {error && <p className="admin-alert admin-error" role="alert">{error}</p>}
    {success && <p className="admin-alert admin-success" role="status"><Check size={17} />{success}</p>}
  </section>;
}
