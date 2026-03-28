function renderArticle(article, index) {
  const { summary } = article;
  return [
    `## ${index + 1}. ${article.title}`,
    '',
    `- **原文链接**: ${article.url}`,
    `- **HN 评论**: ${article.commentsUrl}`,
    '',
    '### 中文标题',
    summary.chineseTitle,
    '',
    '### 一句话总结',
    summary.oneLiner,
    '',
    '### 详细摘要',
    summary.abstract,
    '',
    '### 关键要点',
    ...summary.keyPoints.map(point => `- ${point}`),
    '',
    '### 技术洞察',
    summary.techInsight,
    '',
    '### 为什么它火了',
    summary.whyHot,
    '',
    '### 标签',
    summary.tags.map(tag => `#${tag}`).join(' '),
    '',
    '---',
    ''
  ].join('\n');
}

export function renderCompleteReport({ date, articles }) {
  const header = [
    `# Hacker News Daily 完整总结 - ${date}`,
    '',
    `> 📅 日期: ${date}`,
    `> 📊 文章数: ${articles.length} 篇`,
    '',
    '---',
    ''
  ].join('\n');

  return header + articles.map(renderArticle).join('');
}
