#!/usr/bin/env node
/**
 * HN Daily Skill - Hacker News 每日精选解读
 * 
 * 使用方法:
 *   node fetch-daily.mjs                    # 获取最新一期
 *   node fetch-daily.mjs --date 2026-03-07  # 获取指定日期
 *   node fetch-daily.mjs --output ~/hn.md   # 指定输出路径
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output');

// 配置
const CONFIG = {
  baseUrl: 'https://www.daemonology.net/hn-daily',
  timeout: 30000,
  maxArticles: 10
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
  
  return {
    date: getArg('--date'),
    output: getArg('--output'),
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

// 尝试获取最新可用日期
async function getLatestAvailableDate() {
  const today = getToday();
  // 尝试今天和前几天
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    
    try {
      const url = `${CONFIG.baseUrl}/${dateStr}.html`;
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: { 'User-Agent': 'HN-Daily-Skill/1.0' }
      });
      if (response.ok) return dateStr;
    } catch (e) {
      // 继续尝试前一天
    }
  }
  return today;
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
        'User-Agent': 'HN-Daily-Skill/1.0 (Content Fetcher)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================================
// 解析 HN Daily 页面
// ============================================================================

function parseHNDailyPage(html, dateStr) {
  const articles = [];
  
  // 查找日期标题
  const datePattern = new RegExp(`Daily Hacker News for ${dateStr.replace(/-/g, '-')}`, 'i');
  
  // 提取文章列表 - 查找所有 listitem
  const listItemRegex = /<li>([\s\S]*?)<\/li>/gi;
  let match;
  
  while ((match = listItemRegex.exec(html)) !== null) {
    const itemContent = match[1];
    
    // 提取文章链接
    const titleMatch = itemContent.match(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    // 提取评论链接
    const commentMatch = itemContent.match(/<a href="([^"]+)"[^>]*>\(comments\)<\/a>/);
    
    if (titleMatch && commentMatch) {
      const url = titleMatch[1];
      const title = titleMatch[2].trim();
      const commentsUrl = commentMatch[1];
      
      // 跳过 HN 自己的链接
      if (url.includes('news.ycombinator.com')) continue;
      
      articles.push({
        title,
        url,
        commentsUrl,
        hnId: commentsUrl.match(/id=(\d+)/)?.[1] || null
      });
    }
  }
  
  return articles.slice(0, CONFIG.maxArticles);
}

// ============================================================================
// 抓取文章内容
// ============================================================================

async function fetchArticleContent(url) {
  try {
    const html = await fetchWithTimeout(url, 20000);
    
    // 尝试提取主要内容
    // 1. 移除 script 和 style
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // 2. 尝试提取 article 或 main 内容
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentMatch = content.match(/<div[^>]*class=["'][^"']*(?:content|article|post)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    
    let extractedContent = articleMatch?.[1] || mainMatch?.[1] || contentMatch?.[1] || content;
    
    // 3. 移除 HTML 标签，保留文本
    extractedContent = extractedContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 4. 限制长度
    return extractedContent.slice(0, 8000);
  } catch (error) {
    console.error(`  ❌ Failed to fetch ${url}: ${error.message}`);
    return null;
  }
}

// ============================================================================
// 生成分类
// ============================================================================

function categorizeArticle(title, content = '') {
  const text = (title + ' ' + content).toLowerCase();
  
  const categories = {
    'AI_ML': ['ai', 'llm', 'gpt', 'machine learning', 'neural', 'openai', 'anthropic', 'claude', '模型', '人工智能'],
    'SECURITY': ['security', 'vulnerability', 'exploit', 'hack', 'privacy', 'encryption', '漏洞', '黑客', '安全'],
    'WEB_DEV': ['javascript', 'typescript', 'react', 'vue', 'css', 'html', 'web', 'frontend', 'browser'],
    'SYSTEMS': ['linux', 'kernel', 'database', 'performance', 'rust', 'go', '系统'],
    'TOOLS': ['github', 'open source', 'tool', 'library', 'framework', '工具', '开源'],
    'DESIGN': ['design', 'ui', 'ux', 'interface', '设计'],
    'CAREER': ['career', 'hiring', 'interview', 'salary', '职业', '面试', '招聘']
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
${content.slice(0, 6000)}

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
[针对技术人员的深度分析，包括：技术原理、实现难度、创新点、行业影响]

## 为什么它火了
[分析这篇文章在 Hacker News 上获得高赞的原因]

## 相关讨论
[基于 Hacker News 评论区的典型观点总结]

## 标签
#[主标签] #[次标签] #[技术领域] #[应用场景]`;
}

// ============================================================================
// 生成报告
// ============================================================================

function generateReport(dateStr, articles, summaries) {
  const dateObj = new Date(dateStr);
  const dateFormatted = dateObj.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // 统计分类
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
    'DESIGN': '🎨 设计',
    'CAREER': '💼 职业',
    'OTHER': '📝 其他'
  };
  
  let report = `# Hacker News Daily - ${dateFormatted}\n\n`;
  report += `> 每日 Top 10 精选文章深度解读\n`;
  report += `> 来源: [daemonology.net/hn-daily](https://www.daemonology.net/hn-daily/)\n\n`;
  
  // 概览
  report += `## 📊 概览\n\n`;
  report += `- **文章总数**: ${articles.length}\n`;
  report += `- **来源**: daemonology.net/hn-daily\n`;
  report += `- **日期**: ${dateStr}\n\n`;
  
  // 分类统计
  report += `### 分类统计\n\n`;
  Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      report += `- ${categoryNames[cat] || cat}: ${count}篇\n`;
    });
  report += '\n';
  
  // 热门文章列表
  report += `## 🔥 热门文章\n\n`;
  
  articles.forEach((article, i) => {
    const summary = summaries[i];
    const cat = categorizeArticle(article.title, summary?.content || '');
    
    report += `### ${i + 1}. ${categoryNames[cat] || '📝'} [${article.title}](${article.url})\n\n`;
    report += `- **Hacker News**: [查看评论](${article.commentsUrl})\n`;
    
    if (summary) {
      if (summary.chineseTitle) {
        report += `- **中文标题**: ${summary.chineseTitle}\n`;
      }
      if (summary.oneLiner) {
        report += `- **一句话**: ${summary.oneLiner}\n`;
      }
      if (summary.abstract) {
        report += `- **摘要**: ${summary.abstract}\n`;
      }
      if (summary.keyPoints && summary.keyPoints.length > 0) {
        report += `- **关键要点**:\n`;
        summary.keyPoints.forEach(point => {
          report += `  - ${point}\n`;
        });
      }
      if (summary.techInsight) {
        report += `- **技术洞察**: ${summary.techInsight}\n`;
      }
      if (summary.whyHot) {
        report += `- **为什么火了**: ${summary.whyHot}\n`;
      }
      if (summary.tags && summary.tags.length > 0) {
        report += `- **标签**: ${summary.tags.map(t => `#${t}`).join(' ')}\n`;
      }
    }
    
    report += '\n';
  });
  
  // AI 分析提示词
  report += `---\n\n`;
  report += `## 🤖 AI 分析提示词\n\n`;
  report += `以下是用于生成每篇文章详细解读的提示词模板：\n\n`;
  report += '```\n' + generateSummaryPrompt(articles[0], '【文章内容】') + '\n```\n\n';
  
  // 页脚
  report += `---\n`;
  report += `*Generated by HN Daily Skill* · ${new Date().toLocaleString('zh-CN')}\n`;
  
  return report;
}

// ============================================================================
// 主程序
// ============================================================================

async function main() {
  const options = parseArgs();
  
  if (options.help) {
    console.log(`
HN Daily Skill - Hacker News 每日精选解读

用法: node fetch-daily.mjs [选项]

选项:
  --date <YYYY-MM-DD>   指定日期 [默认: 自动获取最新]
  --output <path>       输出文件路径
  --max-articles <n>    最大文章数量 [默认: 10]
  --help, -h           显示帮助

示例:
  node fetch-daily.mjs
  node fetch-daily.mjs --date 2026-03-07
  node fetch-daily.mjs --output ~/hn-daily.md
`);
    return;
  }
  
  // 确定日期
  let targetDate = options.date;
  if (!targetDate) {
    console.log('🔍 正在查找最新可用日期...');
    targetDate = await getLatestAvailableDate();
  }
  
  console.log(`\n🚀 HN Daily Skill`);
  console.log(`   日期: ${targetDate}`);
  console.log(`   最大文章数: ${options.maxArticles}\n`);
  
  // 创建输出目录
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  // 1. 获取文章列表
  const pageUrl = `${CONFIG.baseUrl}/${targetDate}.html`;
  console.log(`📡 正在获取文章列表: ${pageUrl}`);
  
  let articles = [];
  try {
    const html = await fetchWithTimeout(pageUrl);
    articles = parseHNDailyPage(html, targetDate);
    console.log(`   ✅ 找到 ${articles.length} 篇文章\n`);
  } catch (error) {
    console.error(`   ❌ 获取失败: ${error.message}`);
    console.log(`\n💡 尝试访问主页获取最新日期...`);
    
    // 尝试从主页获取
    try {
      const homeHtml = await fetchWithTimeout(CONFIG.baseUrl + '/');
      // 提取最近日期
      const dateMatch = homeHtml.match(/Daily Hacker News for (\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        targetDate = dateMatch[1];
        console.log(`   找到最新日期: ${targetDate}`);
        const html = await fetchWithTimeout(`${CONFIG.baseUrl}/${targetDate}.html`);
        articles = parseHNDailyPage(html, targetDate);
        console.log(`   ✅ 找到 ${articles.length} 篇文章\n`);
      }
    } catch (e) {
      console.error(`   ❌ 获取失败: ${e.message}`);
      process.exit(1);
    }
  }
  
  if (articles.length === 0) {
    console.log('⚠️ 未找到任何文章');
    process.exit(1);
  }
  
  // 2. 抓取每篇文章内容
  console.log('📄 正在抓取文章内容...\n');
  const summaries = [];
  
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`   [${i + 1}/${articles.length}] ${article.title.slice(0, 60)}...`);
    
    const content = await fetchArticleContent(article.url);
    
    if (content) {
      const prompt = generateSummaryPrompt(article, content);
      summaries.push({
        article,
        content,
        prompt,
        // 基础信息（等待 AI 填充详细内容）
        chineseTitle: '',
        oneLiner: '',
        abstract: '',
        keyPoints: [],
        techInsight: '',
        whyHot: '',
        tags: []
      });
    } else {
      summaries.push({
        article,
        content: null,
        prompt: null,
        error: 'Failed to fetch content'
      });
    }
    
    // 小延迟避免过载
    if (i < articles.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log(`\n✅ 内容抓取完成\n`);
  
  // 3. 生成报告
  console.log('📝 正在生成报告...');
  
  // 创建包含 AI 提示词的扩展报告
  let fullReport = generateReport(targetDate, articles, summaries);
  
  // 添加 AI 处理章节
  fullReport += `\n## 🤖 AI 处理提示词\n\n`;
  fullReport += `以下是为每篇文章生成的 AI 总结提示词。你可以将这些提示词发送给 AI 助手获取详细的中文解读。\n\n`;
  
  summaries.forEach((summary, i) => {
    if (summary.prompt) {
      fullReport += `### 文章 ${i + 1}: ${articles[i].title}\n\n`;
      fullReport += '```\n' + summary.prompt + '\n```\n\n';
    }
  });
  
  // 4. 保存报告
  const outputPath = options.output || join(OUTPUT_DIR, `hn-daily-${targetDate}.md`);
  // 添加 UTF-8 BOM 确保编码正确识别
  const fullReportWithBOM = '\ufeff' + fullReport;
  await writeFile(outputPath, fullReportWithBOM, 'utf-8');
  
  console.log(`\n✅ 报告已保存: ${outputPath}`);
  console.log(`   文章数: ${articles.length}`);
  console.log(`   成功抓取: ${summaries.filter(s => s.content).length}`);
  console.log(`   失败: ${summaries.filter(s => !s.content).length}`);
  
  // 5. 输出摘要
  console.log(`\n📋 文章列表:`);
  articles.forEach((a, i) => {
    const status = summaries[i]?.content ? '✅' : '❌';
    console.log(`   ${status} ${i + 1}. ${a.title.slice(0, 70)}${a.title.length > 70 ? '...' : ''}`);
  });
  
  console.log(`\n💡 提示: 报告中的 "AI 处理提示词" 章节包含了用于生成详细中文解读的提示词。`);
  console.log(`   你可以将这些提示词发送给我，我会为你生成每篇文章的详细解读。`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
