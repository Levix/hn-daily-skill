import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../scripts/generate-complete.mjs';

function makeArticle(index) {
  return {
    title: `Article ${index}`,
    url: `https://example.com/${index}`,
    commentsUrl: `https://news.ycombinator.com/item?id=${index}`,
    content: `Body ${index}`
  };
}

function makeSummary(index) {
  return {
    chineseTitle: `标题 ${index}`,
    oneLiner: `这是第 ${index} 篇文章的一句话总结，覆盖问题背景、关键方案与实际影响，长度足够通过质量检查。`,
    abstract: `这是第 ${index} 篇详细摘要内容，覆盖背景、实现方式、争议点与潜在影响。为了通过完整性检查，这里补充更多上下文描述，使每篇文章都包含足够长且彼此不同的正文内容。`,
    keyPoints: [
      `关键要点 ${index}-1：文章交代了问题来源、上下游约束与主要参与者。`,
      `关键要点 ${index}-2：作者提出了具体方案，并解释了为什么现有做法不够稳定。`,
      `关键要点 ${index}-3：社区讨论集中在性能、可靠性与迁移成本之间的取舍。`,
      `关键要点 ${index}-4：文中给出了若干实践案例，说明方案适用边界与失败模式。`,
      `关键要点 ${index}-5：从长期维护角度看，这个变化会影响团队协作与系统演进。`
    ],
    techInsight: `第 ${index} 篇技术洞察强调接口边界、失败恢复与可观测性，说明为什么工程实现不能只看功能是否可用，还要看后续维护成本和异常处理路径。`,
    whyHot: `第 ${index} 篇热度原因在于它同时涉及真实需求、工程权衡和可复用经验，既能引发技术讨论，也能帮助团队判断是否值得投入。`,
    tags: [`Tag${index}`]
  };
}

test('generate-complete writes complete markdown and run manifest when all articles succeed', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'hn-daily-generate-complete-'));

  try {
    const result = await main({
      date: '2099-05-01',
      outputDir,
      collectDailyArticles: async () => ({
        date: '2099-05-01',
        articles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(makeArticle)
      }),
      generateArticleSummaryWithRetry: async ({ article }) => makeSummary(article.title.split(' ').at(-1)),
      convertMarkdownToPDF: async () => join(outputDir, 'hn-daily-2099-05-01-complete.pdf')
    });

    assert.equal(result.articleCount, 10);
    assert.match(await readFile(result.completeMarkdownPath, 'utf8'), /### 中文标题/);
    assert.deepEqual(JSON.parse(await readFile(result.runManifestPath, 'utf8')).date, '2099-05-01');
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('generate-complete returns a passing completeness result for valid complete markdown', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'hn-daily-generate-complete-'));

  try {
    const result = await main({
      date: '2099-05-02',
      outputDir,
      collectDailyArticles: async () => ({
        date: '2099-05-02',
        articles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(makeArticle)
      }),
      generateArticleSummaryWithRetry: async ({ article }) => makeSummary(article.title.split(' ').at(-1)),
      convertMarkdownToPDF: async () => join(outputDir, 'hn-daily-2099-05-02-complete.pdf')
    });

    assert.equal(result.completeness.isComplete, true, result.completeness.issues?.join('\n'));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('generate-complete writes a failure manifest and stops when article generation exhausts retries', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'hn-daily-generate-complete-'));
  const completeMarkdownPath = join(outputDir, 'hn-daily-2099-05-03-complete.md');
  const runManifestPath = join(outputDir, 'hn-daily-2099-05-03-run.json');

  try {
    await assert.rejects(
      main({
        date: '2099-05-03',
        outputDir,
        collectDailyArticles: async () => ({
          date: '2099-05-03',
          articles: [makeArticle(1), makeArticle(2)]
        }),
        generateArticleSummaryWithRetry: async ({ article }) => {
          if (article.title === 'Article 2') {
            throw new Error('summary failed after retries');
          }

          return makeSummary(1);
        }
      }),
      /summary failed after retries/
    );

    const manifest = JSON.parse(await readFile(runManifestPath, 'utf8'));
    assert.equal(manifest.status, 'failed');
    assert.equal(manifest.attempts.length, 2);
    assert.equal(manifest.attempts[0].status, 'success');
    assert.equal(manifest.attempts[1].status, 'failed');
    assert.match(manifest.error.message, /summary failed after retries/);
    await assert.rejects(access(completeMarkdownPath, constants.F_OK));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('generate-complete renders a pdf artifact after completeness passes', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'hn-daily-generate-complete-'));
  const conversions = [];

  try {
    const result = await main({
      date: '2099-05-04',
      outputDir,
      collectDailyArticles: async () => ({
        date: '2099-05-04',
        articles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(makeArticle)
      }),
      generateArticleSummaryWithRetry: async ({ article }) => makeSummary(article.title.split(' ').at(-1)),
      convertMarkdownToPDF: async (markdownPath, options) => {
        conversions.push({ markdownPath, options });
        return join(outputDir, 'hn-daily-2099-05-04-complete.pdf');
      }
    });

    assert.equal(result.completePdfPath, join(outputDir, 'hn-daily-2099-05-04-complete.pdf'));
    assert.equal(conversions.length, 1);
    assert.equal(conversions[0].markdownPath, join(outputDir, 'hn-daily-2099-05-04-complete.md'));
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test('generate-complete refuses to render pdf when completeness checks fail', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'hn-daily-generate-complete-'));
  let conversionCount = 0;

  try {
    await assert.rejects(
      main({
        date: '2099-05-05',
        outputDir,
        collectDailyArticles: async () => ({
          date: '2099-05-05',
          articles: [makeArticle(1)]
        }),
        generateArticleSummaryWithRetry: async () => ({
          chineseTitle: '标题',
          oneLiner: '这是足够长的一句话总结。',
          abstract: '详细摘要内容足够长。',
          keyPoints: ['1', '2', '3', '4', '5'],
          techInsight: '技术洞察。',
          whyHot: '热度原因。',
          tags: ['A']
        }),
        convertMarkdownToPDF: async () => {
          conversionCount += 1;
          return join(outputDir, 'should-not-exist.pdf');
        }
      }),
      /completeness check failed/
    );

    assert.equal(conversionCount, 0);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
