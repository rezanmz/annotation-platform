"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Beaker, BookOpen, Check, ChevronRight, Download, FileText, FolderKanban, Globe2, History, Layers3, LockKeyhole, RefreshCw, Scale, Settings2, ShieldCheck, Users } from "lucide-react";
import { AnswerKeyReview } from "@/components/admin/answer-keys";
import { DocumentImport } from "@/components/admin/document-import";
import { DocumentsList } from "@/components/admin/documents";
import { Members } from "@/components/admin/members";
import { GuidelineManager } from "@/components/admin/guidelines";
import { ProjectsAdmin } from "@/components/admin/projects";
import { AuditLog } from "@/components/admin/audit";
import { WorkspaceAdmin } from "@/components/admin/workspace-admin";
import SignOutButton from "@/components/auth/sign-out-button";
import { assignmentName, languageNames, type Language } from "@/lib/languages";
import { apiJson, type AdminAssignment, type AdminData, type AdminSession } from "@/components/admin/types";
import "./admin.css";

type Tab = "documents" | "projects" | "annotators" | "administrators" | "guidelines" | "qualification" | "activity";
const projectIcons = { eurlex: Scale, un: Globe2, chemistry: Beaker };

export default function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [selection, setSelection] = useState({ projectId: "", language: "" });
  const [tab, setTab] = useState<Tab>("documents");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(async () => {
    const result = await apiJson<AdminData>("/api/admin");
    setData(result);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const current = await apiJson<AdminSession>("/api/session");
      setSession(current);
      if (current.isAdmin) await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Administration could not be loaded."); }
    finally { setLoading(false); }
  }, [refresh]);

  useEffect(() => { void load(); }, [load]);

  async function action(payload: Record<string, unknown>) {
    return apiJson<Record<string, unknown>>("/api/admin", { method: "POST", headers: { "Content-Type": "application/json", "X-Annotation-Actor": session?.user?.id ?? "" }, body: JSON.stringify(payload) });
  }

  async function exportAnnotations(language: Language | null) {
    if (!project) return;
    setExporting(true); setError("");
    try {
      const params = new URLSearchParams({ projectId: project.id });
      if (language) params.set("language", language);
      const response = await fetch(`/api/admin/export?${params}`, { cache: "no-store", credentials: "same-origin", headers: { "X-Annotation-Actor": session?.user?.id ?? "" } });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string | { message?: string } };
        throw new Error(typeof result.error === "string" ? result.error : result.error?.message ?? "The export could not be created.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = [project.id, language, `annotations-${new Date().toISOString().slice(0, 10)}.json`].filter(Boolean).join("-");
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err instanceof Error ? err.message : "The export could not be created."); }
    finally { setExporting(false); }
  }

  const project = data?.projects.find((item) => item.id === selection.projectId) ?? data?.projects[0];
  const languageChoice = project?.id === selection.projectId ? selection.language : "";
  const selectedLanguage = project?.languages.find((item) => item.code === languageChoice);
  const unlabeledDocuments = project ? project.total - project.languages.reduce((sum, item) => sum + item.total, 0) : 0;
  const unlabeledMembers = project ? project.members - project.languages.reduce((sum, item) => sum + item.members, 0) : 0;
  const hasUnlabeled = !!project?.languages.length && (unlabeledDocuments > 0 || unlabeledMembers > 0);
  const viewingUnlabeled = hasUnlabeled && languageChoice === "unlabeled";
  const language = selectedLanguage?.code ?? null;
  const assignment: AdminAssignment | null = project && (!project.languages.length || selectedLanguage || viewingUnlabeled) ? {
    projectId: project.id, language,
    label: viewingUnlabeled ? `${project.name} · Unlabeled` : assignmentName({ name: project.name, language }),
    total: selectedLanguage?.total ?? unlabeledDocuments,
    members: selectedLanguage?.members ?? unlabeledMembers,
  } : null;
  const assignmentKey = assignment ? JSON.stringify([assignment.projectId, assignment.language]) : "";
  const answerKey = data?.answerKeys.find((key) => key.domain === project?.domain);
  const allConfirmed = !!data && data.answerKeys.every((key) => key.confirmed);

  return <main className="admin-shell">
    <header className="admin-header"><a href="/" className="admin-brand"><span><Layers3 size={23} /></span><span className="admin-wordmark">annotation<small>STUDIO</small></span><span className="admin-brand-divider" /> <small>Administration</small></a><div className="admin-header-end"><a href="/" className="admin-back"><ArrowLeft size={16} /> Annotation workspace</a>{session?.user && <><a href="/account/password" className="admin-text-button">Password</a><SignOutButton authMode={session.authMode} className="admin-text-button">Sign out</SignOutButton><span className="admin-header-avatar" title={session.user.email}>{(session.user.name || session.user.email).slice(0, 2).toUpperCase()}</span></>}</div></header>
    {loading ? <div className="admin-loading" role="status"><RefreshCw size={24} className="admin-spin" /><p>Loading project administration…</p></div> : !session?.isAdmin ? <div className="admin-access"><span className="admin-access-icon"><LockKeyhole size={30} /></span><p className="admin-eyebrow">ADMINISTRATION</p><h1>{session?.configured ? "Administrator sign-in required" : "Set up your administrator account"}</h1><p>{session?.configured ? "Sign in with an administrator account to manage projects, accounts, keys, imports, exports, and guidelines." : "The platform owner must create the administrator account before datasets and annotators can be managed."}</p>{!session?.configured && <div className="admin-setup-steps"><div><span>1</span><p>{session?.authMode === "chatgpt" ? <>Configure <code>ADMIN_EMAILS</code> or <code>ADMIN_USER_IDS</code> in the server environment.</> : <>Set <code>BOOTSTRAP_ADMIN_EMAIL</code> and <code>BOOTSTRAP_ADMIN_PASSWORD</code> for the first deployment; the container creates the administrator on boot.</>}</p></div><div><span>2</span><p>Sign in with the administrator account to prepare projects and create annotator accounts.</p></div></div>}{session?.user && <p className="admin-signed-in">Signed in as <strong>{session.user.email}</strong>. This account does not have administrator access.</p>}{error && <p className="admin-alert admin-error" role="alert">{error}</p>}<div className="admin-access-actions">{session?.user ? <SignOutButton authMode={session.authMode} className="admin-button admin-primary">Sign out and switch account</SignOutButton> : <a className="admin-button admin-primary" href={session?.authMode === "chatgpt" ? "/signin-with-chatgpt?return_to=%2Fadmin" : "/login"}>Sign in<ArrowUpRight size={16} /></a>}<button className="admin-button admin-secondary" onClick={() => void load()}>Refresh access</button></div><a className="admin-back" href="/"><ArrowLeft size={15} /> Back to the annotation workspace</a></div> : <div className="admin-content">
      <div className="admin-page-heading"><div><p className="admin-eyebrow">WORKSPACE MANAGEMENT</p><h1>A good study starts here.</h1><p>Prepare your datasets, give the right people access, and set the standard.</p></div><span className="admin-admin-label"><ShieldCheck size={15} />Administrator</span></div>
      {error && <div className="admin-alert admin-error" role="alert">{error}<button className="admin-text-button" onClick={() => void load()}>Try again</button></div>}
      {data && <>
        <div className="admin-overview"><div><span className="admin-overview-icon"><Layers3 size={20} /></span><div><span>Projects</span><strong>{data.projects.length}</strong></div></div><div><span className="admin-overview-icon"><FileText size={20} /></span><div><span>Source documents</span><strong>{data.projects.reduce((sum, item) => sum + item.total, 0).toLocaleString()}</strong></div></div><div><span className="admin-overview-icon"><Users size={20} /></span><div><span>Assigned annotators</span><strong>{new Set(data.memberships.map((member) => member.email)).size}</strong></div></div><div><span className={`admin-overview-icon ${allConfirmed ? "" : "admin-pending-icon"}`}><BookOpen size={20} /></span><div><span>Qualification keys</span><strong>{data.answerKeys.filter((key) => key.confirmed).length}<small> / {data.answerKeys.length} confirmed</small></strong></div></div></div>
        {!data.projects.length && <div className="admin-empty"><FolderKanban size={28} /><h3>No projects yet</h3><p>Create the first project below, then import its dataset and assign annotators.</p></div>}
        <div className="admin-project-heading"><h2>Your projects</h2><span>Choose a project to manage</span></div>
        <div className="admin-projects">{data.projects.map((item) => { const Icon = projectIcons[item.id as keyof typeof projectIcons] ?? FileText; const key = data.answerKeys.find((entry) => entry.domain === item.domain); return <button key={item.id} className={`admin-project ${project?.id === item.id ? "admin-project-selected" : ""}`} onClick={() => { if (item.id !== project?.id) setSelection({ projectId: item.id, language: "" }); setError(""); }} aria-pressed={project?.id === item.id}><span className={`admin-project-icon admin-project-${item.id}`}><Icon size={23} /></span><div><span className="admin-project-domain">{item.domain === "legal" ? "LEGAL" : "CHEMISTRY"}</span><h3>{item.name}</h3><p>{item.total} documents <span>·</span> {item.members} annotators</p><span className={`admin-project-status ${key?.confirmed ? "admin-status-ready" : ""}`}>{key?.confirmed ? <><Check size={12} /> Qualification ready</> : <><span className="admin-status-dot" /> Answer key needs review</>}</span></div><ChevronRight size={17} className="admin-project-arrow" /></button>; })}</div>
        {!project && <div className="admin-project-workspace"><div className="admin-main-panel"><ProjectsAdmin projects={data.projects} action={action} refresh={refresh} /></div></div>}
        {project && <div className="admin-project-workspace">
          <div className="admin-assignment-controls">
            {project.languages.length > 0 && <label className="admin-field-label" htmlFor="project-language">Document language
              <select id="project-language" value={languageChoice} onChange={(event) => { setSelection({ projectId: project.id, language: event.target.value }); setError(""); }}>
                <option value="">Choose a language</option>
                {project.languages.map(({ code }) => <option key={code} value={code}>{languageNames[code]}</option>)}
                {hasUnlabeled && <option value="unlabeled">Unlabeled (existing work)</option>}
              </select>
            </label>}
            {assignment && <span className="admin-footnote">{assignment.total} documents · {assignment.members} annotators</span>}
            <div className="admin-assignment-exports">
              {language && <button className="admin-button admin-secondary" onClick={() => void exportAnnotations(language)} disabled={exporting}><Download size={15} />Export {languageNames[language]}</button>}
              <button className="admin-button admin-secondary" onClick={() => void exportAnnotations(null)} disabled={exporting}><Download size={15} />{exporting ? "Preparing export…" : "Export whole project"}</button>
            </div>
          </div>
          <div className="admin-workspace-bar"><nav className="admin-tabs" aria-label="Project administration">{([{ id: "documents", label: "Documents", icon: FileText }, { id: "projects", label: "Projects", icon: FolderKanban }, { id: "annotators", label: "Annotators", icon: Users }, { id: "administrators", label: "Administrators", icon: ShieldCheck }, { id: "guidelines", label: "Guidelines", icon: BookOpen }, { id: "qualification", label: "Qualification", icon: ShieldCheck }, { id: "activity", label: "Activity", icon: History }] as const).map((item) => <button key={item.id} className={tab === item.id ? "admin-tab-active" : ""} onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined}><item.icon size={16} />{item.label}</button>)}</nav></div>
          <div className="admin-workspace-layout"><div className="admin-main-panel">
            {!assignment && (tab === "documents" || tab === "annotators") && <section className="admin-card"><p>Choose a document language above to manage {tab} for {project.name}.</p></section>}
            {tab === "documents" && assignment && <div className="admin-assignment-documents" key={assignmentKey}>
              {!viewingUnlabeled && <DocumentImport assignment={assignment} action={action} refresh={refresh} />}
              <DocumentsList assignment={assignment} action={action} refresh={refresh} />
            </div>}
            {tab === "projects" && <ProjectsAdmin projects={data.projects} action={action} refresh={refresh} />}{tab === "annotators" && assignment && <Members key={assignmentKey} assignment={assignment} allowNewAssignments={!viewingUnlabeled} memberships={data.memberships} accounts={data.accounts} action={action} refresh={refresh} />}{tab === "administrators" && <WorkspaceAdmin accounts={data.accounts} action={action} refresh={refresh} />}{tab === "guidelines" && <><GuidelineManager domain="legal" actorId={session?.user?.id ?? ""} /><GuidelineManager domain="chemistry" actorId={session?.user?.id ?? ""} /></>}{tab === "qualification" && answerKey && <AnswerKeyReview key={`${answerKey.domain}-${answerKey.version}`} answerKey={answerKey} questions={data.questions} action={action} refresh={refresh} />}{tab === "activity" && <AuditLog />}</div><aside className="admin-sidebar"><section className="admin-side-card"><span className="admin-side-icon"><Settings2 size={19} /></span><h3>Ready for annotation?</h3><p>Complete these three steps for {assignment?.label ?? project.name}.</p><ol className="admin-readiness"><li className={(assignment?.total ?? project.total) ? "admin-complete" : ""}><span>{(assignment?.total ?? project.total) ? <Check size={12} /> : "1"}</span><button onClick={() => setTab("documents")}>Import source documents</button></li><li className={(assignment?.members ?? project.members) ? "admin-complete" : ""}><span>{(assignment?.members ?? project.members) ? <Check size={12} /> : "2"}</span><button onClick={() => setTab("annotators")}>Assign your annotators</button></li><li className={answerKey?.confirmed ? "admin-complete" : ""}><span>{answerKey?.confirmed ? <Check size={12} /> : "3"}</span><button onClick={() => setTab("qualification")}>Confirm the answer key</button></li></ol></section><section className="admin-side-note"><ShieldCheck size={21} /><h3>Independent by design</h3><p>Each annotator sees the documents in their assignment and their own reviews. Administrators manage all projects and can export submitted annotations without an annotator assignment.</p><p>Every document is saved when the annotator presses Submit.</p></section></aside></div>
        </div>}
      </>}
      <footer className="admin-footer"><span><LockKeyhole size={13} /> Restricted administrator workspace</span><span>Annotation Studio</span></footer>
    </div>}
  </main>;
}
