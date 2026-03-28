function readField(lines, label) {
  const line = lines.find(item => item.startsWith(`${label}:`));
  return line ? line.slice(label.length + 1).trim() : '';
}

export function parseArticleSummary(raw) {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  const chineseTitle = readField(lines, '中文标题');
  const oneLiner = readField(lines, '一句话总结');
  const abstract = readField(lines, '详细摘要');
  const techInsight = readField(lines, '技术洞察');
  const whyHot = readField(lines, '为什么它火了');
  const tagsLine = readField(lines, '标签');
  const keyPointsIndex = lines.findIndex(line => line === '关键要点:');
  const keyPoints = keyPointsIndex === -1
    ? []
    : lines.slice(keyPointsIndex + 1).filter(line => line.startsWith('- ')).map(line => line.slice(2).trim());
  const tags = tagsLine.split(/\s+/).filter(Boolean).map(tag => tag.replace(/^#/, '')).filter(Boolean);

  if (!chineseTitle || !oneLiner || !abstract || !techInsight || !whyHot) {
    throw new Error('summary fields missing');
  }

  if (keyPoints.length < 5) {
    throw new Error('not enough key points');
  }

  if (tags.length === 0) {
    throw new Error('tags missing');
  }

  return {
    chineseTitle,
    oneLiner,
    abstract,
    keyPoints,
    techInsight,
    whyHot,
    tags
  };
}
