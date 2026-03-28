import test from 'node:test';
import assert from 'node:assert/strict';
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
