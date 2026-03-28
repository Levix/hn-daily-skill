import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { writeFile, rm, readFile, mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { main } from '../scripts/auto-digest.mjs';

const root = process.cwd();
const outputDir = resolve('output');

function makeResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return body;
    }
  };
}

async function removeIfExists(path) {
  await rm(path, { force: true });
}

async function createAutoDigestPdfFixture({ date, pdfBytes }) {
  const tempRoot = await mkdtemp(join(tmpdir(), 'hn-daily-auto-digest-pdf-'));
  const scriptsDir = join(tempRoot, 'scripts');
  const outputDir = join(tempRoot, 'output');
  const sourceScript = await readFile(resolve('scripts/auto-digest-pdf.mjs'), 'utf8');

  await mkdir(scriptsDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  await writeFile(join(scriptsDir, 'auto-digest-pdf.mjs'), sourceScript, 'utf8');
  await writeFile(join(scriptsDir, 'generate-complete.mjs'), `
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
export async function main(overrides = {}) {
  const date = overrides.date || '${date}';
  await mkdir(OUTPUT_DIR, { recursive: true });

  const completeMarkdownPath = join(OUTPUT_DIR, \`hn-daily-\${date}-complete.md\`);
  const completePdfPath = join(OUTPUT_DIR, \`hn-daily-\${date}-complete.pdf\`);
  const runManifestPath = join(OUTPUT_DIR, \`hn-daily-\${date}-run.json\`);

  await writeFile(completeMarkdownPath, '# stub\\n', 'utf8');
  await writeFile(completePdfPath, Buffer.from([${Array.from(pdfBytes).join(', ')}]));
  await writeFile(runManifestPath, JSON.stringify({ date, status: 'completed' }), 'utf8');

  return {
    articleCount: 10,
    completeMarkdownPath,
    completePdfPath,
    runManifestPath,
    completeness: { isComplete: true, issues: [], stats: { articleCount: 10, sectionsFound: 5 } }
  };
}
`, 'utf8');
  await writeFile(join(scriptsDir, 'md-to-pdf.mjs'), `
import { writeFile } from 'node:fs/promises';

export async function convertMarkdownToPDF(markdownPath, options = {}) {
  const outputPath = markdownPath.replace(/\\.md$/, options.format === 'html' ? '.html' : '.pdf');
  await writeFile(outputPath, Buffer.from([${Array.from(pdfBytes).join(', ')}]));
  return outputPath;
}
`, 'utf8');

  return tempRoot;
}

test('main returns the same default markdown path that it writes', async () => {
  const date = '2099-04-01';
  const expectedPath = join(outputDir, `hn-daily-${date}.md`);
  const wrongPath = join(outputDir, `hn-daily-${date}-detailed.md`);
  const originalArgv = process.argv;
  const originalFetch = global.fetch;

  await removeIfExists(expectedPath);
  await removeIfExists(wrongPath);

  global.fetch = async (url) => {
    if (String(url).endsWith(`/${date}.html`)) {
      return makeResponse('<li><a href="https://example.com/story">Example Story</a> <a href="https://news.ycombinator.com/item?id=1">(comments)</a></li>');
    }

    if (String(url) === 'https://example.com/story') {
      return makeResponse('<article>Hello from the example article.</article>');
    }

    throw new Error(`unexpected fetch: ${url}`);
  };

  process.argv = ['node', 'scripts/auto-digest.mjs', '--date', date];

  try {
    const result = await main();
    assert.equal(result.outputPath, expectedPath);
    assert.equal(existsSync(expectedPath), true);
  } finally {
    process.argv = originalArgv;
    global.fetch = originalFetch;
    await removeIfExists(expectedPath);
    await removeIfExists(wrongPath);
  }
});

test('send-only uses the default generated markdown path', async () => {
  const date = '2099-04-02';
  const generatedPath = join(outputDir, `hn-daily-${date}.md`);
  const copiedPath = join(root, `hn-daily-${date}.md`);

  await writeFile(generatedPath, '# test\n', 'utf8');
  await removeIfExists(copiedPath);

  try {
    const result = spawnSync(process.execPath, ['scripts/auto-digest.mjs', '--date', date, '--send-only', '--channel', 'test-channel'], {
      cwd: root,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /message --action send/);
  } finally {
    await removeIfExists(generatedPath);
    await removeIfExists(copiedPath);
  }
});

test('auto-digest-pdf preserves generated markdown and pdf artifacts', async () => {
  const date = '2099-04-03';
  const tempRoot = await createAutoDigestPdfFixture({
    date,
    pdfBytes: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x0a])
  });
  const markdownPath = join(tempRoot, 'output', `hn-daily-${date}-complete.md`);
  const pdfPath = join(tempRoot, 'output', `hn-daily-${date}-complete.pdf`);

  try {
    const result = spawnSync(process.execPath, ['scripts/auto-digest-pdf.mjs', '--date', date, '--format', 'pdf', '--skip-check'], {
      cwd: tempRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(markdownPath), true);
    assert.equal(existsSync(pdfPath), true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('auto-digest-pdf copies pdf attachments without corrupting binary content', async () => {
  const date = '2099-04-04';
  const expectedPdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x00, 0x80]);
  const tempRoot = await createAutoDigestPdfFixture({ date, pdfBytes: expectedPdf });
  const copiedPath = join(tempRoot, `hn-daily-${date}-complete.pdf`);

  try {
    const result = spawnSync(process.execPath, ['scripts/auto-digest-pdf.mjs', '--date', date, '--format', 'pdf', '--skip-check', '--channel', 'demo'], {
      cwd: tempRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(copiedPath), true, result.stdout);
    assert.deepEqual(await readFile(copiedPath), expectedPdf);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('auto-digest-pdf delegates to generate-complete artifacts for cron runs', async () => {
  const date = '2099-04-05';
  const expectedPdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x00, 0x80]);
  const tempRoot = await createAutoDigestPdfFixture({ date, pdfBytes: expectedPdf });
  const completeMarkdownPath = join(tempRoot, 'output', `hn-daily-${date}-complete.md`);
  const completePdfPath = join(tempRoot, 'output', `hn-daily-${date}-complete.pdf`);
  const copiedPath = join(tempRoot, `hn-daily-${date}-complete.pdf`);

  try {
    const result = spawnSync(process.execPath, ['scripts/auto-digest-pdf.mjs', '--date', date, '--format', 'pdf', '--channel', 'demo'], {
      cwd: tempRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(completeMarkdownPath), true);
    assert.equal(existsSync(completePdfPath), true);
    assert.equal(existsSync(copiedPath), true);
    assert.deepEqual(await readFile(copiedPath), expectedPdf);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
