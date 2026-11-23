import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { hashPassword, verifyPassword } from '../lib/server/password.ts';
import { seedDefaultAnnotators } from '../scripts/default-annotators.ts';

const run = promisify(execFile);
const pairs = {
  eurlex: ['en', 'fr', 'de', 'es'],
  un: ['ar', 'zh', 'en', 'fr', 'ru', 'es'],
  chemistry: ['zh', 'en', 'fr', 'de', 'ja', 'ru', 'es'],
};

async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), 'annotation-bootstrap-'));
  const database = join(dir, 'app.db');
  const file = database + '.annotators.json';
  const env = {
    ...process.env, DATABASE_PATH: database, GUIDELINES_DIR: dir,
    BOOTSTRAP_ADMIN_EMAIL: '', BOOTSTRAP_ADMIN_PASSWORD: '',
    QUALIFICATION_KEYS_JSON: '', QUALIFICATION_KEYS_FILE: '',
  };
  const script = (name) => run(process.execPath, ['--no-warnings', `scripts/${name}.ts`], {
    cwd: new URL('../', import.meta.url), env,
  });
  const db = new DatabaseSync(database);
  t.after(async () => { db.close(); await rm(dir, { recursive: true, force: true }); });
  await script('migrate');
  return { db, file, bootstrap: () => script('bootstrap'), read: async () => JSON.parse(await readFile(file, 'utf8')) };
}

test('concurrent first boots create exactly one usable login per corpus and language without an admin', async (t) => {
  const { db, file, bootstrap, read } = await workspace(t);
  const boots = await Promise.all([bootstrap(), bootstrap()]);
  const roster = await read();
  const expected = Object.entries(pairs).flatMap(([project, languages]) => languages.map(language => `${project}/${language}`));
  assert.deepEqual(Object.keys(roster).sort(), expected.sort());
  const accounts = db.prepare(`SELECT a.*, m.project_id, m.language FROM local_accounts a
    JOIN memberships m ON m.user_id = a.id AND m.email = a.email`).all();
  assert.equal(accounts.length, 17);
  assert.equal(new Set(Object.values(roster).map(login => login.password)).size, 17);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const logs = boots.map(boot => boot.stdout + boot.stderr).join('');
  for (const account of accounts) {
    const { email, password } = roster[`${account.project_id}/${account.language}`];
    assert.equal(account.email, email);
    assert.equal(account.role, 'annotator');
    assert.equal(account.active, 1);
    assert.ok(await verifyPassword(password, account.password_hash));
    assert.ok(!logs.includes(password));
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM qualifications').get().n, 0);
});

test('startup preserves other reviewers, reserved addresses, and subsequent administrator changes', async (t) => {
  const { db, file, bootstrap, read } = await workspace(t);
  db.exec(`DELETE FROM project_languages WHERE language <> 'fr' OR project_id = 'chemistry';
    INSERT INTO local_accounts VALUES ('admin','admin@example.test','Admin','prior hash','admin',1,0,'today','today');
    INSERT INTO local_accounts VALUES ('alex','eurlex-fr@annotators.invalid','Alex','prior hash','annotator',1,0,'today','today');
    INSERT INTO memberships VALUES ('eurlex','fr','eurlex-fr@annotators.invalid','alex','today');
    INSERT INTO memberships VALUES ('un','fr','un-fr@annotators.invalid',NULL,'today');`);
  await bootstrap();
  const roster = await read();
  assert.equal(roster['eurlex/fr'].email, 'eurlex-fr-2@annotators.invalid');
  assert.equal(roster['un/fr'].email, 'un-fr-2@annotators.invalid');
  assert.equal(db.prepare("SELECT count(*) AS n FROM memberships WHERE project_id = 'eurlex' AND language = 'fr'").get().n, 2);
  assert.equal(db.prepare("SELECT password_hash FROM local_accounts WHERE id = 'alex'").get().password_hash, 'prior hash');
  const reset = await hashPassword('Password changed by the annotator');
  db.prepare('UPDATE local_accounts SET password_hash = ?, active = 0 WHERE email = ?').run(reset, roster['eurlex/fr'].email);
  db.prepare('DELETE FROM memberships WHERE email = ?').run(roster['eurlex/fr'].email);
  db.prepare("UPDATE memberships SET project_id = 'eurlex' WHERE email = ?").run(roster['un/fr'].email);
  const snapshot = () => ({
    accounts: db.prepare('SELECT * FROM local_accounts ORDER BY id').all(),
    members: db.prepare('SELECT * FROM memberships ORDER BY email').all(),
  });
  const before = snapshot();
  const contents = await readFile(file, 'utf8');
  await bootstrap();
  assert.deepEqual(snapshot(), before);
  assert.equal(await readFile(file, 'utf8'), contents);
});

test('a retry reuses the published credentials and a database-only restore preserves live passwords', async (t) => {
  const { db, file, bootstrap, read } = await workspace(t);
  db.exec("DELETE FROM project_languages WHERE project_id <> 'eurlex' OR language <> 'fr'");
  await writeFile(file, 'malformed-config-containing-an-example-password');
  await assert.rejects(bootstrap(), error => {
    assert.match(error.stderr, /Invalid default annotator config/);
    assert.doesNotMatch(error.stderr, /containing-an-example-password/);
    return true;
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM local_accounts').get().n, 0);
  await rm(file);
  db.exec('BEGIN IMMEDIATE');
  await seedDefaultAnnotators(db, file);
  db.exec('ROLLBACK'); // Simulate process exit after publishing the file but before commit.
  const original = (await read())['eurlex/fr'];
  await bootstrap();
  const french = () => db.prepare('SELECT * FROM local_accounts WHERE email = ?').get(original.email);
  const account = french();
  assert.ok(await verifyPassword(original.password, account.password_hash));
  assert.deepEqual((await read())['eurlex/fr'], original);
  await rm(file);
  db.exec("INSERT INTO project_languages VALUES ('eurlex','es')");
  await bootstrap();
  assert.deepEqual(french(), account);
  const restored = await read();
  assert.deepEqual(restored['eurlex/fr'], { email: original.email, password: null });
  const spanish = db.prepare('SELECT password_hash FROM local_accounts WHERE email = ?').get(restored['eurlex/es'].email);
  assert.ok(await verifyPassword(restored['eurlex/es'].password, spanish.password_hash));
});
