import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
const run = promisify(execFile);
async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), 'annotation-bootstrap-'));
  const database = join(dir, 'app.db');
  const file = database + '.annotators.json';
  const env = {
    ...process.env, DATABASE_PATH: database, GUIDELINES_DIR: dir, ANNOTATION_MATERIALS_DIR: dir,
    BOOTSTRAP_ADMIN_EMAIL: '', BOOTSTRAP_ADMIN_PASSWORD: '',
    QUALIFICATION_KEYS_JSON: '', QUALIFICATION_KEYS_FILE: '',
  };
  const script = (name) => run(process.execPath, ['--no-warnings', `scripts/${name}.ts`], {
    cwd: new URL('../', import.meta.url), env,
  });
  const db = new DatabaseSync(database);
  t.after(async () => { db.close(); await rm(dir, { recursive: true, force: true }); });
  await script('migrate');
  return { db, dir, file, bootstrap: () => script('bootstrap') };
}

test('supplied PDFs and corpus keys replace practice materials once and preserve qualification history', async (t) => {
  const { db, dir, bootstrap } = await workspace(t);
  db.exec(`DELETE FROM project_languages;
    INSERT INTO qualifications VALUES ('eurlex','old-reviewer','practice','2026-01-01');
    INSERT INTO answer_keys VALUES ('legal','practice','[]','old','2026-01-01');
    INSERT INTO answer_key_versions SELECT * FROM answer_keys;
    INSERT INTO guidelines VALUES ('legal',X'00','practice','2026-01-01');`);
  const pdf = domain => join(dir, domain + '_annotation_guidelines.pdf');
  await writeFile(pdf('legal'), '%PDF-1.7 legal fixture');
  await writeFile(pdf('chemistry'), '%PDF-1.7 chemistry fixture');
  const file = join(dir, 'qualification-answer-keys.json');
  const order = [2, 1, 3, 4, 5, 6, 7, 8, 9, 10];
  const legal = ['A', 'B', 'C', 'D', 'C', 'B', 'A', 'C', 'D', 'D'];
  const supplied = { question_order: order, eurlex: legal, un: legal, chemistry: Array(10).fill('B') };
  await writeFile(file, JSON.stringify(supplied));
  const active = domain => db.prepare('SELECT version, answers FROM answer_keys WHERE domain = ?').get(domain);
  const bytes = domain => db.prepare('SELECT bytes FROM guidelines WHERE domain = ?').get(domain)?.bytes;
  await bootstrap();
  assert.equal(Buffer.from(bytes('legal')).toString(), '%PDF-1.7 legal fixture');
  assert.equal(Buffer.from(bytes('chemistry')).toString(), '%PDF-1.7 chemistry fixture');
  assert.deepEqual(JSON.parse(active('legal').answers), [legal[1], legal[0], ...legal.slice(2)]);
  assert.deepEqual(JSON.parse(active('chemistry').answers), supplied.chemistry);
  assert.equal(db.prepare('SELECT version FROM qualifications').get().version, 'practice');
  assert.equal(db.prepare("SELECT count(*) AS n FROM answer_key_versions WHERE domain='legal'").get().n, 2);
  const chemistry = active('chemistry');
  db.exec("UPDATE answer_keys SET version='admin-revision' WHERE domain='legal'; DELETE FROM guidelines WHERE domain='legal'");
  await bootstrap();
  assert.equal(active('legal').version, 'admin-revision');
  assert.equal(bytes('legal'), undefined);
  assert.deepEqual(active('chemistry'), chemistry);
  supplied.chemistry[0] = 'C';
  await writeFile(file, JSON.stringify(supplied));
  await writeFile(pdf('legal'), 'invalid PDF');
  await assert.rejects(bootstrap(), /Invalid PDF/);
  assert.deepEqual(active('chemistry'), chemistry);
  await writeFile(pdf('legal'), '%PDF-1.7 revised legal fixture');
  await bootstrap();
  assert.equal(Buffer.from(bytes('legal')).toString(), '%PDF-1.7 revised legal fixture');
  assert.equal(active('legal').version, 'admin-revision');
  assert.equal(JSON.parse(active('chemistry').answers)[1], 'C');
  assert.notEqual(active('chemistry').version, chemistry.version);
  await writeFile(file, JSON.stringify({ ...supplied, un: Array(10).fill('D') }));
  await assert.rejects(bootstrap(), /matching EUR-Lex and UN/);
});

test('fresh and repeated startup leave annotator provisioning to administrators', async (t) => {
  const { db, file, bootstrap } = await workspace(t);
  await Promise.all([bootstrap(), bootstrap()]);
  const accounts = () => db.prepare('SELECT * FROM local_accounts ORDER BY id').all();
  const members = () => db.prepare('SELECT * FROM memberships ORDER BY email').all();
  assert.deepEqual(accounts(), []);
  assert.deepEqual(members(), []);
  assert.equal(db.prepare('SELECT count(*) AS n FROM project_languages').get().n, 17);
  await assert.rejects(stat(file), { code: 'ENOENT' });

  db.exec(`INSERT INTO local_accounts VALUES ('alex','alex@example.test','Alex','prior hash','annotator',1,0,'today','today');
    INSERT INTO memberships VALUES ('eurlex','fr','alex@example.test','alex','today');`);
  const beforeAccounts = accounts();
  const beforeMembers = members();
  await bootstrap();
  assert.deepEqual(accounts(), beforeAccounts);
  assert.deepEqual(members(), beforeMembers);
  await assert.rejects(stat(file), { code: 'ENOENT' });
});
