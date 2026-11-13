"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import type { AdminAction, AnnotatorAccount } from "./types";

function newPassword() {
  return `Adm!${Array.from(crypto.getRandomValues(new Uint8Array(12)), (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function WorkspaceAdmin({ accounts, action, refresh }: { accounts: AnnotatorAccount[]; action: AdminAction; refresh: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const admins = accounts.filter((account) => account.role === "admin");

  async function submit() {
    if (busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await action({ action: "createAdmin", name: name.trim(), email: email.trim().toLowerCase(), password });
      setSuccess(`${email.trim().toLowerCase()} can now administer the workspace. Share the assigned password securely.`);
      setName(""); setEmail(""); setPassword("");
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The administrator could not be created."); }
    finally { setBusy(false); }
  }

  return <section className="admin-card">
    <div className="admin-section-heading"><div><p className="admin-eyebrow">WORKSPACE ADMINISTRATORS</p><h2>Administrators</h2><p>Administrators manage all projects, accounts, keys, imports, exports, and guidelines. Keep at least two so the workspace is not dependent on one person.</p></div><ShieldCheck size={25} aria-hidden="true" /></div>
    <div className="admin-members-list"><div className="admin-list-header"><span>ADMINISTRATOR</span><span>ROLE</span></div>
      {admins.map((account) => <div className="admin-member-row" key={account.id}><div><strong>{account.name}</strong><small>{account.email}</small></div><span className="admin-badge"><ShieldCheck size={12} />Administrator</span></div>)}
    </div>
    <form className="admin-account-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div className="admin-account-fields">
        <label className="admin-field-label" htmlFor="admin-name">Full name<input id="admin-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="off" disabled={busy} /></label>
        <label className="admin-field-label" htmlFor="admin-email">Email address<input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="off" disabled={busy} /></label>
      </div>
      <label className="admin-field-label" htmlFor="admin-password">Assigned password<div className="admin-password-input"><input id="admin-password" type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy} placeholder="At least 12 characters" /><button type="button" className="admin-icon-button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      <div className="admin-account-form-footer"><button type="button" className="admin-text-button" disabled={busy} onClick={() => { setPassword(newPassword()); setVisible(true); }}><RefreshCw size={13} />Generate password</button><button className="admin-button admin-primary" type="submit" disabled={busy || !name.trim() || !email.trim() || password.length < 12}><UserPlus size={16} />{busy ? "Creating…" : "Create administrator"}</button></div>
    </form>
    {error && <p className="admin-alert admin-error" role="alert">{error}</p>}
    {success && <p className="admin-alert admin-success" role="status"><Check size={17} />{success}</p>}
  </section>;
}
