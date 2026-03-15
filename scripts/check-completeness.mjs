#!/usr/bin/env node
/**
 * HN Daily 文档完整性检查器
 * 
 * 检查生成的 Markdown/PDF 文档是否包含完整内容
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 * 检查 Markdown 文档完整性
 */
export async function checkDocumentCompleteness(filePath) {
  const results = {
    filePath,
    isComplete: true,
    issues: [],
    stats: {}
  };

  if (!existsSync(filePath)) {
    results.isComplete = false;
    results.issues.push('文件不存在');
    return results;
  }

  const content = await readFile(filePath, 'utf-8');
  
  // 检查 1: 文件大小（完整版通常 > 10KB）
  const fileSize = content.length;
  results.stats.fileSize = fileSize;
  if (fileSize < 5000) {
    results.isComplete = false;
    results.issues.push(`文件太小 (${fileSize} 字符)，可能内容不完整`);
  }

  // 检查 2: 是否包含占位符
  const placeholderPatterns = [
    /AI 分析提示词.*见文末/i,
    /提示词.*章节/i,
    /TODO/i,
    /FIXME/i,
    /待补充/i,
    /\[.*\].*\[.*\]/,  // 空的链接

    // 旧模板（3/10）
    /本文围绕该主题给出关键信息与争议点/i,
    /文章介绍了事件背景与核心主张/i,
    /从工程实践看，重点在于可复现性、治理边界和长期维护成本/i,
    /社区讨论主要集中在可行性、风险敞口与真实落地难度/i,
    /整体结论是：短期看有实用价值，长期需要制度化与更明确的约束/i,
    /该话题同时覆盖技术、商业和治理三条主线/i,

    // 补录模板（3/12~3/14）
    /以下内容为服务中断期间的补录版本/i,
    /提供了可讨论的实践样本/i,
    /模型能力与工程约束.*平衡题/i,
    /建议动作\s*\d+[:：]/i,
    /条目\s*\d+\s*的议题类型为/i,
    /帮助团队更快判断投入优先级与落地边界/i
  ];
  
  for (const pattern of placeholderPatterns) {
    if (pattern.test(content)) {
      results.isComplete = false;
      results.issues.push(`发现占位符/模板内容: ${pattern.toString()}`);
    }
  }

  // 检查 2.1: 是否存在大量重复段落（模板化风险）
  const sentenceCounts = new Map();
  const normalizedLines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length >= 16 && !line.startsWith('#') && !line.startsWith('- **原文链接**') && !line.startsWith('- **HN 评论**'));

  for (const line of normalizedLines) {
    sentenceCounts.set(line, (sentenceCounts.get(line) || 0) + 1);
  }

  const repeatedLines = [...sentenceCounts.entries()]
    .filter(([, count]) => count >= 4)
    .sort((a, b) => b[1] - a[1]);

  if (repeatedLines.length > 0) {
    results.isComplete = false;
    results.issues.push(`发现重复模板段落 ${repeatedLines.length} 处（最高重复 ${repeatedLines[0][1]} 次）`);
    results.stats.repeatedTemplateLines = repeatedLines.slice(0, 5).map(([line, count]) => ({ line: line.slice(0, 60), count }));
  }

  // 检查 3: 是否包含完整的文章结构
  const requiredSections = [
    { name: '中文标题', pattern: /### 中文标题/ },
    { name: '一句话总结', pattern: /### 一句话总结/ },
    { name: '详细摘要', pattern: /### 详细摘要/ },
    { name: '关键要点', pattern: /### 关键要点/ },
    { name: '技术洞察', pattern: /### 技术洞察/ }
  ];

  results.stats.sectionsFound = 0;
  for (const section of requiredSections) {
    if (section.pattern.test(content)) {
      results.stats.sectionsFound++;
    } else {
      results.issues.push(`缺少必要章节: ${section.name}`);
    }
  }

  if (results.stats.sectionsFound < 3) {
    results.isComplete = false;
  }

  // 检查 3.1: 一句话总结质量（长度 + 去重）
  const oneLinerMatches = [...content.matchAll(/### 一句话总结\s*\n([^\n]+)/g)].map(m => m[1].trim());
  results.stats.oneLinerCount = oneLinerMatches.length;

  if (oneLinerMatches.length > 0) {
    const tooShort = oneLinerMatches.filter(s => s.length < 18).length;
    const uniqueCount = new Set(oneLinerMatches).size;

    if (tooShort > 0) {
      results.isComplete = false;
      results.issues.push(`一句话总结过短: ${tooShort} 条`);
    }

    if (uniqueCount / oneLinerMatches.length < 0.8) {
      results.isComplete = false;
      results.issues.push(`一句话总结重复度过高（唯一率 ${(uniqueCount / oneLinerMatches.length * 100).toFixed(0)}%）`);
    }
  }

  // 检查 4: 文章数量（通常 9-10 篇）
  const articleMatches = content.match(/## \d+\./g);
  results.stats.articleCount = articleMatches ? articleMatches.length : 0;
  if (results.stats.articleCount < 5) {
    results.isComplete = false;
    results.issues.push(`文章数量不足: 仅 ${results.stats.articleCount} 篇`);
  }

  // 检查 5: 是否包含 Markdown 原始语法（未正确渲染）
  const rawMarkdownPatterns = [
    /^## /m,  // 行首的 ##
    /^### /m  // 行首的 ###
  ];
  
  // 如果文档开头有 # 说明是标题，是正常的
  // 但如果在正文中发现大量 ## 可能是未渲染的 Markdown
  const headingCount = (content.match(/^## /gm) || []).length;
  if (headingCount > 20) {
    // 超过 20 个 ## 可能是正常的文档结构
    results.stats.headingCount = headingCount;
  }

  return results;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
HN Daily 文档完整性检查器

用法: node check-completeness.mjs <文件路径>

示例:
  node check-completeness.mjs output/hn-daily-2026-03-07.md
  node check-completeness.mjs output/hn-daily-2026-03-07.pdf

检查项:
  - 文件大小
  - 占位符检测
  - 必要章节完整性
  - 文章数量
`);
    process.exit(0);
  }

  const filePath = args[0];
  console.log(`🔍 正在检查: ${filePath}\n`);

  const result = await checkDocumentCompleteness(filePath);

  console.log('📊 检查结果:');
  console.log(`   文件大小: ${result.stats.fileSize} 字符`);
  console.log(`   文章数量: ${result.stats.articleCount} 篇`);
  console.log(`   章节完整性: ${result.stats.sectionsFound}/5`);
  
  if (result.stats.headingCount) {
    console.log(`   标题数量: ${result.stats.headingCount}`);
  }

  console.log('\n' + (result.isComplete ? '✅ 文档完整' : '❌ 文档不完整'));
  
  if (result.issues.length > 0) {
    console.log('\n⚠️ 发现的问题:');
    result.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ 所有检查通过');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
}

export default checkDocumentCompleteness;
