import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateArticleSummaryWithRetry } from '../scripts/lib/providers/openclaw-agent.mjs';

test('generateArticleSummaryWithRetry retries twice before succeeding', async () => {
  let attempts = 0;
  const runner = async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new Error('temporary');
    }

    return [
      '中文标题: 标题',
      '一句话总结: 这是足够长的一句话总结。',
      '详细摘要: 这是详细摘要，长度足够，能够通过基础校验。',
      '关键要点:',
      '- 要点一',
      '- 要点二',
      '- 要点三',
      '- 要点四',
      '- 要点五',
      '技术洞察: 技术洞察内容。',
      '为什么它火了: 社区讨论充分。',
      '标签: #AI #Infra'
    ].join('\n');
  };

  const result = await generateArticleSummaryWithRetry({
    runner,
    article: { title: 'A' },
    content: 'Body',
    retries: 2
  });

  assert.equal(attempts, 3);
  assert.equal(result.chineseTitle, '标题');
  assert.equal(result.tags.length, 2);
  assert.equal(result.keyPoints.length, 5);
});

test('generateArticleSummaryWithRetry fails when parsed output misses required fields', async () => {
  await assert.rejects(
    () => generateArticleSummaryWithRetry({
      runner: async () => [
        '中文标题: 标题',
        '一句话总结: 这是足够长的一句话总结。',
        '关键要点:',
        '- 要点一',
        '- 要点二',
        '- 要点三',
        '- 要点四',
        '- 要点五',
        '标签: #AI'
      ].join('\n'),
      article: { title: 'B' },
      content: 'Body',
      retries: 0
    }),
    /summary fields missing/
  );
});

test('runOpenClawAgent forwards explicit agent routing to openclaw CLI', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'hn-daily-openclaw-route-'));
  const argsPath = join(tempRoot, 'args.txt');
  const binDir = join(tempRoot, 'bin');
  const openclawPath = join(binDir, 'openclaw');

  try {
    await mkdir(binDir, { recursive: true });
    await writeFile(openclawPath, `#!/bin/zsh
echo "$@" > "${argsPath}"
cat <<'JSON'
{"output_text":"中文标题: 标题\\n一句话总结: 这是足够长的一句话总结。\\n详细摘要: 这是详细摘要，长度足够，能够通过基础校验。\\n关键要点:\\n- 要点一\\n- 要点二\\n- 要点三\\n- 要点四\\n- 要点五\\n技术洞察: 技术洞察内容。\\n为什么它火了: 社区讨论充分。\\n标签: #AI #Infra"}
JSON
`, { mode: 0o755 });

    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { runOpenClawAgent } from './scripts/lib/providers/openclaw-agent.mjs';
      const text = await runOpenClawAgent(
        { title: 'Story', url: 'https://example.com/story', commentsUrl: 'https://news.ycombinator.com/item?id=1' },
        'Body',
        { agentId: 'product' }
      );
      console.log(text);
    `], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const cliArgs = await readFile(argsPath, 'utf8');
    assert.match(cliArgs, /--agent product/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runOpenClawAgent accepts JSON output written to stderr when stdout is empty', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'hn-daily-openclaw-stderr-'));
  const binDir = join(tempRoot, 'bin');
  const openclawPath = join(binDir, 'openclaw');

  try {
    await mkdir(binDir, { recursive: true });
    await writeFile(openclawPath, `#!/bin/zsh
cat >&2 <<'JSON'
{"output_text":"中文标题: 标题\\n一句话总结: 这是足够长的一句话总结。\\n详细摘要: 这是详细摘要，长度足够，能够通过基础校验。\\n关键要点:\\n- 要点一\\n- 要点二\\n- 要点三\\n- 要点四\\n- 要点五\\n技术洞察: 技术洞察内容。\\n为什么它火了: 社区讨论充分。\\n标签: #AI #Infra"}
JSON
`, { mode: 0o755 });

    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { runOpenClawAgent } from './scripts/lib/providers/openclaw-agent.mjs';
      const text = await runOpenClawAgent(
        { title: 'Story', url: 'https://example.com/story', commentsUrl: 'https://news.ycombinator.com/item?id=1' },
        'Body',
        { agentId: 'product' }
      );
      console.log(text);
    `], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /中文标题: 标题/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
