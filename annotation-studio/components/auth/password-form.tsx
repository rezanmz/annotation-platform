'use client';

import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import AuthShell from './auth-shell';
import { authRequest, type AuthResult } from './client';

export default function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    setPending(true);
    try {
      await authRequest<AuthResult>('/api/auth/change-password', { currentPassword: current, newPassword: next });
      setDone(true);
      setTimeout(() => window.location.replace('/'), 1200);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The password could not be changed. Please try again.');
    } finally { setPending(false); }
  }

  return <AuthShell><div className="auth-form-card">
    <span className="auth-form-symbol"><KeyRound size={23} strokeWidth={1.5} /></span>
    <span className="eyebrow">ACCOUNT SECURITY</span>
    <h2>Change your password.</h2>
    <p className="auth-form-intro">Use at least 12 characters. Changing your password signs out every other session, including other devices.</p>
    {done ? <div className="notice notice-success" role="status"><CheckCircle2 size={18} /><div><strong>Password updated</strong><p>Your other sessions were signed out. Returning to your workspace…</p></div></div> : <form className="auth-form" onSubmit={submit}>
      <label className="admin-field-label" htmlFor="current-password">Current password
        <div className="admin-password-input">
          <input id="current-password" type={visible ? 'text' : 'password'} value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required disabled={pending} />
        </div>
      </label>
      <label className="admin-field-label" htmlFor="new-password">New password
        <div className="admin-password-input">
          <input id="new-password" type={visible ? 'text' : 'password'} value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required disabled={pending} placeholder="At least 12 characters" />
          <button type="button" className="admin-icon-button" aria-label={visible ? 'Hide passwords' : 'Show passwords'} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </label>
      <label className="admin-field-label" htmlFor="confirm-password">Confirm new password
        <div className="admin-password-input">
          <input id="confirm-password" type={visible ? 'text' : 'password'} value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={12} maxLength={128} required disabled={pending} />
        </div>
      </label>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <button className="button auth-submit" type="submit" disabled={pending || !current || next.length < 12 || !confirm}>{pending ? <><Loader2 size={16} className="spin" />Updating…</> : 'Update password'}</button>
      <a className="auth-back" href="/"><ArrowLeft size={14} />Back to workspace</a>
    </form>}
  </div></AuthShell>;
}
