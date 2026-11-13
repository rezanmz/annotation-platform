// Live concurrency test. Creates temporary annotators, submits concurrently, then cleans up.
//   BASE_URL=https://… ADMIN_EMAIL=… ADMIN_PASSWORD=… ANSWERS='["C","A",...]' [USERS=15] [PROJECT_ID=eurlex] node scripts/load-test.mjs
const base = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const answers = JSON.parse(process.env.ANSWERS ?? "[]");
const projectId = process.env.PROJECT_ID ?? "eurlex";
const users = Math.max(2, Number(process.env.USERS ?? 15) || 15);
const password = process.env.USER_PASSWORD ?? "Load test password 2026!";
if (!base || !adminEmail || !adminPassword || answers.length !== 10) {
  console.error("Set BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, and ANSWERS (10 values).");
  process.exit(2);
}
const stamp = Date.now().toString(36);
const documentId = `load-${stamp}`;
const criteria = ["grounding", "precision", "numerical_fidelity", "search_realism", "standalone_clarity", "information_value", "focus_formulation", "linguistic_quality"];
const ratings = criteria.map((criterionId) => ({ criterionId, score: 4, comment: "" }));

async function post(path, body, cookie) {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
function fail(step, detail) { console.error(JSON.stringify({ ok: false, step, detail })); process.exit(1); }

const admin = await post("/api/auth/login", { email: adminEmail, password: adminPassword });
if (admin.status !== 200) fail("admin-login", admin.status);
const imported = await post("/api/admin", { action: "importDocuments", projectId, documents: [{ id: documentId, title: `Load test ${stamp}`, source: `Concurrent load-test source ${stamp}.`, question: `Is this load test ${stamp}?`, answer: `Yes, ${stamp}.` }] }, admin.cookie);
if (imported.status !== 200) fail("import", imported.data);

const created = await Promise.all(Array.from({ length: users }, (_, index) => post("/api/admin", {
  action: "createAnnotator", projectId, name: `Load ${index}`, email: `load-${stamp}-${index}@example.test`, password,
}, admin.cookie)));
const creationFailures = created.filter((entry) => entry.status !== 200 && entry.status !== 409);
if (creationFailures.length) fail("create-users", creationFailures.map((entry) => entry.status));

const results = await Promise.all(Array.from({ length: users }, async (_, index) => {
  const started = Date.now();
  const login = await post("/api/auth/login", { email: `load-${stamp}-${index}@example.test`, password });
  if (login.status !== 200) return { index, stage: "login", status: login.status };
  const cookie = login.cookie;
  const acknowledgement = await post(`/api/projects/${projectId}/guideline/acknowledge`, { acknowledged: true }, cookie);
  if (acknowledgement.status !== 200) return { index, stage: "acknowledge", status: acknowledgement.status, detail: acknowledgement.data };
  const qualification = await post(`/api/projects/${projectId}/qualify`, { answers: Object.fromEntries(answers.map((answer, position) => [String(position + 1), answer])) }, cookie);
  if (qualification.status !== 200 || !qualification.data.passed) return { index, stage: "qualify", status: qualification.status, detail: qualification.data };
  const submission = await post(`/api/projects/${projectId}/documents/${documentId}/submit`, { requestId: `load-${stamp}-${index}`, ratings, comment: "" }, cookie);
  return { index, stage: "submit", status: submission.status, id: submission.data?.id, ms: Date.now() - started };
}));

for (let index = 0; index < users; index += 1) {
  await post("/api/admin", { action: "eraseAccount", email: `load-${stamp}-${index}@example.test` }, admin.cookie);
}
await post("/api/admin", { action: "deleteLoadTestDocument", projectId, documentId }, admin.cookie);

const failed = results.filter((entry) => entry.status !== 200);
const latencies = results.map((entry) => entry.ms ?? 0).sort((a, b) => a - b);
const summary = {
  ok: failed.length === 0,
  users,
  submissions: results.filter((entry) => entry.stage === "submit" && entry.status === 200).length,
  uniqueReceipts: new Set(results.map((entry) => entry.id).filter(Boolean)).size,
  failures: failed,
  p50Ms: latencies[Math.floor(latencies.length * 0.5)] ?? null,
  p95Ms: latencies[Math.floor(latencies.length * 0.95)] ?? null,
  maxMs: latencies.at(-1) ?? null,
};
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
