import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCompleteReport } from '../scripts/lib/renderers/render-complete-report.mjs';

test('renderCompleteReport renders sections required by completeness checks', () => {
  const markdown = renderCompleteReport({
    date: '2099-05-01',
    articles: [{
      title: 'A',
      url: 'https://example.com/a',
      commentsUrl: 'https://news.ycombinator.com/item?id=1',
      summary: {
        chineseTitle: '标题',
        oneLiner: '这是足够长的一句话总结。',
        abstract: '这是一段足够长的详细摘要，用于通过检查。',
        keyPoints: ['要点一', '要点二', '要点三', '要点四', '要点五'],
        techInsight: '技术洞察内容。',
        whyHot: '讨论热度原因。',
        tags: ['A', 'B']
      }
    }]
  });

  assert.match(markdown, /^# Hacker News Daily 完整总结 - 2099-05-01/m);
  assert.match(markdown, /### 中文标题/);
  assert.match(markdown, /### 一句话总结/);
  assert.match(markdown, /### 详细摘要/);
  assert.match(markdown, /### 关键要点/);
  assert.match(markdown, /### 技术洞察/);
});
