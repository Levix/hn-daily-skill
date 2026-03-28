import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { writeFile, rm } from 'node:fs/promises';
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
