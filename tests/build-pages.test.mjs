import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const buildPagesScript = resolve('scripts/build-pages.mjs');

async function setupWorkspace(files) {
  const root = await mkdtemp(join(tmpdir(), 'hn-daily-build-pages-'));
  const outputDir = join(root, 'output');
  const docsDir = join(root, 'docs');

  await mkdir(outputDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });

  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(outputDir, name), content, 'utf8');
  }

  await execFileAsync(process.execPath, [buildPagesScript], { cwd: root });

  const index = JSON.parse(await readFile(join(root, 'docs', 'data', 'index.json'), 'utf8'));
  return { root, index };
}

test('build-pages extracts title from BOM-prefixed complete markdown', async () => {
  const { index } = await setupWorkspace({
    'hn-daily-2026-03-16-complete.md': [
      '\ufeff# Hacker News Daily 完整总结 - 2026-03-16',
      '',
      '> 📅 日期: 2026-03-16',
      '> 📊 文章数: 10 篇',
      '',
      '## 1. Example',
      '',
      '### 中文标题',
      '示例标题'
    ].join('\n')
  });

  assert.equal(index.items[0].title, 'Hacker News Daily 完整总结 - 2026-03-16');
});

test('build-pages extracts article count when markdown uses a space before 篇', async () => {
  const { index } = await setupWorkspace({
    'hn-daily-2026-03-25-complete.md': [
      '# Hacker News Daily 完整总结 - 2026-03-25',
      '',
      '> 📅 日期: 2026-03-25',
      '> 📊 文章数: 10 篇',
      '',
      '## 1. Example',
      '',
      '### 中文标题',
      '示例标题'
    ].join('\n')
  });

  assert.equal(index.items[0].articleCount, 10);
});
