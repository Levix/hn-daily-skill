import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../scripts/generate-complete.mjs';

test('generate-complete writes complete markdown and run manifest when all articles succeed', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'hn-daily-generate-complete-'));

  try {
    const result = await main({
      date: '2099-05-01',
      outputDir,
      collectDailyArticles: async () => ({
        date: '2099-05-01',
        articles: [{
          title: 'A',
          url: 'https://example.com/a',
          commentsUrl: 'https://news.ycombinator.com/item?id=1',
          content: 'Body'
        }]
      }),
      generateArticleSummaryWithRetry: async () => ({
        chineseTitle: '标题',
        oneLiner: '这是足够长的一句话总结。',
        abstract: '详细摘要内容足够长。',
        keyPoints: ['1', '2', '3', '4', '5'],
        techInsight: '技术洞察。',
        whyHot: '热度原因。',
        tags: ['A']
      })
    });

    assert.equal(result.articleCount, 1);
    assert.match(await readFile(result.completeMarkdownPath, 'utf8'), /### 中文标题/);
    assert.deepEqual(JSON.parse(await readFile(result.runManifestPath, 'utf8')).date, '2099-05-01');
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
