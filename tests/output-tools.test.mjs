import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { convertMarkdownToPDF } from '../scripts/md-to-pdf.mjs';
import { checkDocumentCompleteness } from '../scripts/check-completeness.mjs';

test('convertMarkdownToPDF honors format=html without generating a pdf', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'hn-daily-output-tools-'));
  const markdownPath = join(tempRoot, 'sample.md');
  const htmlPath = join(tempRoot, 'sample.html');
  const pdfPath = join(tempRoot, 'sample.pdf');

  await writeFile(markdownPath, '# Sample\n\nhello\n', 'utf8');

  try {
    const outputPath = await convertMarkdownToPDF(markdownPath, { format: 'html', title: 'Sample HTML' });

    assert.equal(outputPath, htmlPath);
    assert.equal(existsSync(htmlPath), true);
    assert.equal(existsSync(pdfPath), false);
    assert.match(await readFile(htmlPath, 'utf8'), /<h1>Sample<\/h1>/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('checkDocumentCompleteness rejects pdf input with a clear message', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'hn-daily-output-tools-'));
  const pdfPath = join(tempRoot, 'sample.pdf');

  await writeFile(pdfPath, Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff]));

  try {
    const result = await checkDocumentCompleteness(pdfPath);

    assert.equal(result.isComplete, false);
    assert.match(result.issues.join('\n'), /PDF/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
