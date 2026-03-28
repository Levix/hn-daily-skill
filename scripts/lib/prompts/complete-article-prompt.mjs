export function buildCompleteArticlePrompt(article, content) {
  return [
    '请基于以下文章内容输出结构化中文总结。',
    `标题: ${article.title}`,
    `原文链接: ${article.url || ''}`,
    '',
    '请严格按以下格式输出：',
    '中文标题: ...',
    '一句话总结: ...',
    '详细摘要: ...',
    '关键要点:',
    '- ...',
    '- ...',
    '- ...',
    '- ...',
    '- ...',
    '技术洞察: ...',
    '为什么它火了: ...',
    '标签: #标签1 #标签2',
    '',
    '文章内容：',
    content
  ].join('\n');
}
