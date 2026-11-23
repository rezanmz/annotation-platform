import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'esbuild';
import { PDFDocument, PDFPageLeaf } from 'pdf-lib';

const dir = await mkdtemp(join(tmpdir(), 'annotation-guidelines-'));
after(() => rm(dir, { recursive: true, force: true }));
process.env.DATABASE_PATH = join(dir, 'app.db');
process.env.GUIDELINES_DIR = dir;
await promisify(execFile)(process.execPath, ['--no-warnings', 'scripts/migrate.ts'], { cwd: new URL('../', import.meta.url) });
const bundle = join(dir, 'guidelines.cjs');
await build({ entryPoints: [new URL('../lib/server/guidelines.ts', import.meta.url).pathname], outfile: bundle, bundle: true, platform: 'node', format: 'cjs' });
const { readGuideline, readAnnotatorGuideline, saveGuideline, removeGuideline } = createRequire(import.meta.url)(bundle);

async function fixture(widths) {
  const pdf = await PDFDocument.create();
  for (const [i, width] of widths.entries()) {
    pdf.addPage([width, 600]).drawText(i === widths.length - 1 ? 'Qualification test' : 'Reading page ' + (i + 1));
  }
  return pdf.save();
}

async function checkReadingPages(bytes, widths) {
  const pdf = await PDFDocument.load(bytes);
  assert.deepEqual(pdf.getPages().map(page => page.getWidth()), widths);
  // Simply hiding the last page in the page tree would leave its PDF objects in the download.
  const pageObjects = pdf.context.enumerateIndirectObjects().filter(([, object]) => object instanceof PDFPageLeaf);
  assert.equal(pageObjects.length, widths.length);
}

test('annotator PDF contains only the instruction pages in order, including after replacement', async () => {
  const original = await fixture([310, 320, 330, 340]);
  await saveGuideline('legal', original);
  await checkReadingPages(await readAnnotatorGuideline('legal'), [310, 320, 330]);
  assert.deepEqual(await readGuideline('legal'), original);

  const replacement = await fixture([400, 500]);
  await saveGuideline('legal', replacement);
  await checkReadingPages(await readAnnotatorGuideline('legal'), [400]);
  await assert.rejects(saveGuideline('legal', await fixture([500])), error => error.status === 400);
  assert.deepEqual(await readGuideline('legal'), replacement);
  await removeGuideline('legal');
  await assert.rejects(readAnnotatorGuideline('legal'), error => error.status === 503);
});

test('legacy PDFs use the same reader and a test-only or unreadable source never supplies a reading copy', async () => {
  const file = join(dir, 'chemistry.pdf');
  await writeFile(file, await fixture([270, 280, 290]));
  await checkReadingPages(await readAnnotatorGuideline('chemistry'), [270, 280]);
  await writeFile(file, await fixture([290]));
  await assert.rejects(readAnnotatorGuideline('chemistry'), error => error.status === 503);
  await writeFile(file, 'Unreadable PDF');
  await assert.rejects(readAnnotatorGuideline('chemistry'), error => error.status === 503);
});
