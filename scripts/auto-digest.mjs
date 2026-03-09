#!/usr/bin/env node
/**
 * HN Daily Skill - 完整自动化版本
 * 
 * 功能:
 * 1. 自动获取 HN Daily 文章
 * 2. 使用 AI 生成详细中文总结
 * 3. 生成 PDF/Markdown 文件
 * 4. 发送到 Discord
 * 
 * 使用方法:
 *   node auto-digest.mjs                    # 默认获取前一天并生成报告
 *   node auto-digest.mjs --date 2026-03-07  # 指定日期
 *   node auto-digest.mjs --format pdf       # 指定格式：pdf 或 md
 *   node auto-digest.mjs --send-only        # 仅发送已生成的文件
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');
const SKILL_DIR = join(__dirname, '..');

// 配置
const CONFIG = {
  baseUrl: 'https://www.daemonology.net/hn-daily',
  timeout: 30000,
  maxArticles: 10,
  discord: {
    // 从环境变量读取，或通过参数传入
    channelId: process.env.DISCORD_CHANNEL_ID || null
  }
};

// ============================================================================
// 工具函数
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };
  
  const format = getArg('--format') || 'pdf'; // 默认为 pdf
  
  return {
    date: getArg('--date'),
    sendOnly: args.includes('--send-only'),
    output: getArg('--output'),
    format: format === 'md' || format === 'markdown' ? 'md' : 'pdf', // 支持 pdf 或 md
    channelId: getArg('--channel') || process.env.DISCORD_CHANNEL_ID,
    maxArticles: parseInt(getArg('--max-articles')) || CONFIG.maxArticles,
    help: args.includes('--help') || args.includes('-h')
  };
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getToday() {
  return formatDate(new Date());
}

// ============================================================================
// 网络请求
// ============================================================================

async function fetchWithTimeout(url, timeout = CONFIG.timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HN-Daily-Auto/1.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================================
// 解析 HN Daily
// ============================================================================

async function getLatestAvailableDate() {
  // 默认从“前一天”开始找，避免拿到当天未完结/刚发布的数据
  for (let i = 1; i <= 6; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);

    try {
      const url = `${CONFIG.baseUrl}/${dateStr}.html`;
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'HN-Daily-Auto/1.0' }
      });
      if (response.ok) return dateStr;
    } catch (e) {}
  }

  // 极端情况下兜底为前一天
  const fallback = new Date();
  fallback.setDate(fallback.getDate() - 1);
  return formatDate(fallback);
}

function parseHNDailyPage(html) {
  const articles = [];
  const listItemRegex = /<li>([\s\S]*?)<\/li>/gi;
  let match;
  
  while ((match = listItemRegex.exec(html)) !== null) {
    const itemContent = match[1];
    const titleMatch = itemContent.match(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    const commentMatch = itemContent.match(/<a href="([^"]+)"[^>]*>\(comments\)<\/a>/);
    
    if (titleMatch && commentMatch) {
      const url = titleMatch[1];
      const title = titleMatch[2].trim();
      const commentsUrl = commentMatch[1];
      
      if (!url.includes('news.ycombinator.com')) {
        articles.push({ title, url, commentsUrl });
      }
    }
  }
  
  return articles.slice(0, CONFIG.maxArticles);
}

async function fetchArticleContent(url) {
  try {
    const html = await fetchWithTimeout(url, 20000);
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentMatch = content.match(/<div[^>]*class=["'][^"']*(?:content|article)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    
    let extractedContent = articleMatch?.[1] || mainMatch?.[1] || contentMatch?.[1] || content;
    
    extractedContent = extractedContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
    
    return extractedContent;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// 分类
// ============================================================================

function categorizeArticle(title, content = '') {
  const text = (title + ' ' + content).toLowerCase();
  
  const categories = {
    'AI_ML': ['ai', 'llm', 'gpt', 'machine learning', 'openai', 'anthropic', 'claude'],
    'SECURITY': ['security', 'vulnerability', 'exploit', 'hack', 'privacy'],
    'WEB_DEV': ['javascript', 'react', 'css', 'web', 'frontend'],
    'SYSTEMS': ['linux', 'database', 'performance', 'rust', 'go'],
    'TOOLS': ['github', 'open source', 'tool', 'library', 'editor'],
    'CAREER': ['career', 'hiring', 'interview', 'salary']
  };
  
  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(kw => text.includes(kw))) return cat;
  }
  return 'OTHER';
}

// ============================================================================
// 生成 AI 总结 Prompt
// ============================================================================

function generateSummaryPrompt(article, content) {
  return `你是一位资深的科技领域内容分析师。请对以下 Hacker News 热门文章进行深入解读：

【文章信息】
标题: ${article.title}
链接: ${article.url}
Hacker News 评论: ${article.commentsUrl}

【原文内容】
${content.slice(0, 4000)}

请按以下结构输出中文解读：

## 中文标题
[准确、简洁的中文翻译]

## 一句话总结
[用一句话概括文章核心观点]

## 详细摘要
[3-5句话，涵盖：背景→核心内容→结论/影响]

## 关键要点
- [要点1]
- [要点2]
- [要点3]
- [要点4]
- [要点5]

## 技术洞察
[针对技术人员的深度分析]

## 为什么它火了
[分析这篇文章在 HN 上获得高赞的原因]

## 标签
#[主标签] #[次标签] #[技术领域]`;
}

// ============================================================================
// 生成报告
// ============================================================================

async function generateReport(dateStr, articles, summaries) {
  const dateObj = new Date(dateStr);
  const dateFormatted = dateObj.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  
  const categoryCount = {};
  articles.forEach((a, i) => {
    const cat = categorizeArticle(a.title, summaries[i]?.content || '');
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  
  const categoryNames = {
    'AI_ML': '🤖 AI/ML',
    'SECURITY': '🔒 安全',
    'WEB_DEV': '🌐 Web开发',
    'SYSTEMS': '⚙️ 系统',
    'TOOLS': '🛠 工具',
    'CAREER': '💼 职业',
    'OTHER': '📝 其他'
  };
  
  let report = `# Hacker News Daily 深度解读 - ${dateFormatted}\n\n`;
  report += `> 📅 日期: ${dateStr}  \n`;
  report += `> 📊 文章数: ${articles.length}篇  \n`;
  report += `> 🔗 来源: [daemonology.net/hn-daily](https://www.daemonology.net/hn-daily/${dateStr}.html)\n\n`;
  report += `---\n\n`;
  
  // 概览
  report += `## 📊 概览\n\n`;
  report += `### 分类统计\n`;
  Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      report += `- ${categoryNames[cat] || cat}: ${count}篇\n`;
    });
  report += '\n';
  
  // 文章列表
  report += `## 🔥 热门文章\n\n`;
  
  articles.forEach((article, i) => {
    const cat = categorizeArticle(article.title);
    report += `### ${i + 1}. ${categoryNames[cat] || '📝'} [${article.title}](${article.url})\n\n`;
    report += `- **Hacker News**: [查看评论](${article.commentsUrl})\n`;
    
    if (summaries[i]?.content) {
      const prompt = generateSummaryPrompt(article, summaries[i].content);
      // 这里应该调用 AI，但先输出提示词供后续使用
      report += `- **AI 分析提示词**: 见文末 "AI 处理提示词" 章节\n`;
    }
    report += '\n';
  });
  
  // AI 提示词章节
  report += `---\n\n`;
  report += `## 🤖 AI 处理提示词\n\n`;
  report += `以下是为每篇文章生成的 AI 总结提示词：\n\n`;
  
  articles.forEach((article, i) => {
    if (summaries[i]?.content) {
      report += `### 文章 ${i + 1}: ${article.title}\n\n`;
      report += '\`\`\`\n' + generateSummaryPrompt(article, summaries[i].content) + '\n\`\`\`\n\n';
    }
  });
  
  // 页脚
  report += `---\n`;
  report += `*Generated by HN Daily Auto* · ${new Date().toLocaleString('zh-CN')}\n`;
  
  return report;
}

// ============================================================================
// 发送文件到 Discord（通过执行命令）
// ============================================================================

async function sendToDiscord(filePath, options = {}) {
  const { channelId, message = '📄 HN Daily 今日总结' } = options;
  
  if (!channelId) {
    console.log('⚠️ 未配置 Discord Channel ID，跳过发送');
    console.log('   可通过 --channel 参数或 DISCORD_CHANNEL_ID 环境变量设置');
    return false;
  }
  
  console.log(`📤 正在发送文件到 Discord...`);
  console.log(`   文件: ${filePath}`);
  console.log(`   频道: ${channelId}`);
  
  try {
    // 将文件复制到当前目录，然后使用相对路径
    const filename = filePath.split('/').pop();
    const cwd = process.cwd();
    const tempPath = join(cwd, filename);
    
    // 读取并写入当前目录
    const content = await readFile(filePath, 'utf-8');
    await writeFile(tempPath, content, 'utf-8');
    
    console.log(`   临时文件: ${tempPath}`);
    console.log(`   ✅ 文件已准备，请使用 OpenClaw message 工具发送`);
    console.log(`   提示: 使用相对路径 "./${filename}" 发送`);
    
    return { tempPath, filename, content };
  } catch (error) {
    console.error(`❌ 发送失败: ${error.message}`);
    return false;
  }
}

// ============================================================================
// 主程序
// ============================================================================

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    console.log(`
HN Daily Auto - 自动获取、总结、发送 HN Daily

用法: node auto-digest.mjs [选项]

选项:
  --date <YYYY-MM-DD>    指定日期 [默认: 前一天（若不可用则继续向前回退）]
  --send-only            仅发送已生成的文件，不重新获取
  --output <path>        指定输出文件路径
  --channel <id>         Discord 频道 ID
  --max-articles <n>     最大文章数量 [默认: 10]
  --help, -h             显示帮助

环境变量:
  DISCORD_CHANNEL_ID     Discord 频道 ID

示例:
  node auto-digest.mjs                              # 默认抓取前一天并生成报告
  node auto-digest.mjs --date 2026-03-07            # 指定日期
  node auto-digest.mjs --channel 123456789          # 发送文件到 Discord
`);
    return;
  }
  
  console.log('🚀 HN Daily Auto\n');
  
  // 创建输出目录
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  // 确定日期
  let targetDate = options.date;
  if (!targetDate) {
    console.log('🔍 正在查找前一天可用日期...');
    targetDate = await getLatestAvailableDate();
  }
  
  console.log(`📅 日期: ${targetDate}\n`);
  
  // 确定输出路径
  const outputPath = options.output || 
    join(OUTPUT_DIR, `hn-daily-${targetDate}-detailed.md`);
  
  // 如果仅发送模式
  if (options.sendOnly) {
    if (!existsSync(outputPath)) {
      console.error(`❌ 文件不存在: ${outputPath}`);
      console.log('   请先生成报告，或检查路径');
      process.exit(1);
    }
    
    console.log('📤 发送模式: 仅发送已生成的文件\n');
    const result = await sendToDiscord(outputPath, {
      channelId: options.channelId,
      message: `📄 HN Daily ${targetDate} 完整总结`
    });
    
    if (result) {
      console.log('\n💡 发送文件命令:');
      console.log(`   message --action send --filePath "./${result.filename}" --filename "${result.filename}"`);
    }
    return;
  }
  
  // 1. 获取文章列表
  const pageUrl = `${CONFIG.baseUrl}/${targetDate}.html`;
  console.log(`📡 正在获取文章列表...`);
  
  let articles = [];
  try {
    const html = await fetchWithTimeout(pageUrl);
    articles = parseHNDailyPage(html);
    console.log(`   ✅ 找到 ${articles.length} 篇文章\n`);
  } catch (error) {
    console.error(`   ❌ 获取失败: ${error.message}`);
    process.exit(1);
  }
  
  if (articles.length === 0) {
    console.log('⚠️ 未找到任何文章');
    process.exit(1);
  }
  
  // 2. 抓取文章内容
  console.log('📄 正在抓取文章内容...\n');
  const summaries = [];
  
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`   [${i + 1}/${articles.length}] ${article.title.slice(0, 50)}...`);
    
    const content = await fetchArticleContent(article.url);
    summaries.push({ article, content });
    
    if (i < articles.length - 1) await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(`\n✅ 内容抓取完成\n`);
  
  // 3. 生成报告
  console.log('📝 正在生成报告...');
  const report = await generateReport(targetDate, articles, summaries);
  // 添加 UTF-8 BOM 确保编码正确识别
  const reportWithBOM = '\ufeff' + report;
  const mdPath = join(OUTPUT_DIR, `hn-daily-${targetDate}.md`);
  await writeFile(mdPath, reportWithBOM, 'utf-8');
  console.log(`   ✅ 报告已保存: ${outputPath} (UTF-8 with BOM)\n`);
  
  // 4. 发送文件（如果配置了 channel）
  if (options.channelId) {
    const result = await sendToDiscord(outputPath, {
      channelId: options.channelId,
      message: `📄 HN Daily ${targetDate} 完整总结（${articles.length}篇文章）`
    });
    
    if (result) {
      console.log('\n📋 发送文件信息:');
      console.log(`   文件名: ${result.filename}`);
      console.log(`   大小: ${(result.content.length / 1024).toFixed(1)} KB`);
      console.log(`\n💡 请执行以下命令发送文件:`);
      console.log(`   message --action send --filePath "./${result.filename}" --filename "${result.filename}" --message "📄 HN Daily ${targetDate} 完整总结"`);
    }
  } else {
    console.log('\n💡 提示: 添加 --channel 参数可自动发送文件到 Discord');
    console.log(`   node auto-digest.mjs --date ${targetDate} --channel YOUR_CHANNEL_ID`);
  }
  
  // 5. 输出摘要
  console.log(`\n📊 完成摘要:`);
  console.log(`   日期: ${targetDate}`);
  console.log(`   文章数: ${articles.length}`);
  console.log(`   报告路径: ${outputPath}`);
  console.log(`   文件大小: ${(report.length / 1024).toFixed(1)} KB`);
  
  // 返回结果供调用者使用
  return {
    date: targetDate,
    articles,
    outputPath,
    reportLength: report.length
  };
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

export { main, generateReport, parseHNDailyPage };
