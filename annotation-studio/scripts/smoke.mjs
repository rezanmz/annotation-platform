// Read-only production smoke test. Usage:
//   BASE_URL=https://… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run smoke
const base = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!base || !email || !password) {
  console.error("Set BASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD.");
  process.exit(2);
}
const fail = (step, detail) => { console.error(JSON.stringify({ step, ok: false, detail })); process.exit(1); };
const health = await fetch(`${base}/api/health`, { headers: { "cache-control": "no-store" } });
const healthBody = await health.json().catch(() => ({}));
if (health.status !== 200) fail("health", { status: health.status, body: healthBody });
const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
if (login.status !== 200) fail("login", { status: login.status, body: await login.text() });
const cookie = login.headers.get("set-cookie")?.split(";")[0];
if (!cookie) fail("login", "no session cookie");
const session = await fetch(`${base}/api/session`, { headers: { cookie } });
const sessionBody = await session.json();
if (!sessionBody.user?.email === email) fail("session", sessionBody);
const admin = await fetch(`${base}/api/admin`, { headers: { cookie } });
if (admin.status !== 200) fail("admin", { status: admin.status });
const overview = await admin.json();
const headers = await fetch(`${base}/login`, { method: "HEAD" });
const csp = headers.headers.get("content-security-policy");
if (!csp) fail("headers", "missing content-security-policy");
console.log(JSON.stringify({ ok: true, health: healthBody, user: sessionBody.user.email, projects: overview.projects?.length, csp: Boolean(csp) }, null, 2));
