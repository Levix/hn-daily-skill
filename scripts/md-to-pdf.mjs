#!/usr/bin/env node
/**
 * HN Daily PDF 生成器 - 完整版（支持表格）
 */

import { chromium } from 'playwright';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Markdown 表格转 HTML
 */
function parseTable(tableLines) {
  if (tableLines.length < 2) return null;
  
  // 解析表头
  const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h);
  
  // 跳过分隔线（第二行）
  // 解析数据行
  const rows = tableLines.slice(2).map(line => {
    return line.split('|').map(c => c.trim()).filter(c => c);
  }).filter(row => row.length > 0);
  
  // 生成 HTML
  let html = '<table>\n<thead>\n<tr>';
  headers.forEach(h => {
    html += `<th>${escapeHtml(h)}</th>`;
  });
  html += '</tr>\n</thead>\n<tbody>\n';
  
  rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => {
      html += `<td>${escapeHtml(cell)}</td>`;
    });
    html += '</tr>\n';
  });
  
  html += '</tbody>\n</table>\n';
  return html;
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Markdown 转 HTML（完整内容）
 */
function markdownToHTML(markdown) {
  // 移除 UTF-8 BOM
  markdown = markdown.replace(/^\ufeff/, '');
  const lines = markdown.split('\n');
  let html = '';
  let i = 0;
  let inList = false;
  let listType = '';
  let inCodeBlock = false;
  let codeContent = '';
  let tableLines = [];
  
  while (i < lines.length) {
    let line = lines[i];
    
    // 处理代码块
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre><code>${escapeHtml(codeContent.slice(0, -1))}</code></pre>\n`;
        codeContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      i++;
      continue;
    }
    
    if (inCodeBlock) {
      codeContent += line + '\n';
      i++;
      continue;
    }
    
    // 处理表格
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableLines.push(line);
      i++;
      // 检查下一行是否还是表格
      if (i >= lines.length || !lines[i].trim().startsWith('|')) {
        // 表格结束
        if (tableLines.length >= 2) {
          html += parseTable(tableLines);
        }
        tableLines = [];
      }
      continue;
    }
    
    // 处理标题
    if (line.startsWith('###### ')) {
      html += `<h6>${processInline(escapeHtml(line.slice(7)))}</h6>\n`;
    } else if (line.startsWith('##### ')) {
      html += `<h5>${processInline(escapeHtml(line.slice(6)))}</h5>\n`;
    } else if (line.startsWith('#### ')) {
      html += `<h4>${processInline(escapeHtml(line.slice(5)))}</h4>\n`;
    } else if (line.startsWith('### ')) {
      html += `<h3>${processInline(escapeHtml(line.slice(4)))}</h3>\n`;
    } else if (line.startsWith('## ')) {
      html += `<h2>${processInline(escapeHtml(line.slice(3)))}</h2>\n`;
    } else if (line.startsWith('# ')) {
      html += `<h1>${processInline(escapeHtml(line.slice(2)))}</h1>\n`;
    }
    // 处理分隔线
    else if (line.match(/^---+$/)) {
      html += '<hr>\n';
    }
    // 处理引用
    else if (line.startsWith('> ')) {
      html += `<blockquote>${processInline(escapeHtml(line.slice(2)))}</blockquote>\n`;
    }
    // 处理无序列表
    else if (line.match(/^\s*[-*+]\s+/)) {
      if (!inList || listType !== 'ul') {
        if (inList) html += `</${listType}>\n`;
        html += '<ul>\n';
        inList = true;
        listType = 'ul';
      }
      const content = line.replace(/^\s*[-*+]\s+/, '');
      html += `<li>${processInline(escapeHtml(content))}</li>\n`;
    }
    // 处理有序列表
    else if (line.match(/^\s*\d+\.\s+/)) {
      if (!inList || listType !== 'ol') {
        if (inList) html += `</${listType}>\n`;
        html += '<ol>\n';
        inList = true;
        listType = 'ol';
      }
      const content = line.replace(/^\s*\d+\.\s+/, '');
      html += `<li>${processInline(escapeHtml(content))}</li>\n`;
    }
    // 处理空行
    else if (line.trim() === '') {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = '';
      }
    }
    // 处理普通段落
    else {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
        listType = '';
      }
      html += `<p>${processInline(escapeHtml(line))}</p>\n`;
    }
    
    i++;
  }
  
  // 关闭未关闭的列表
  if (inList) {
    html += `</${listType}>\n`;
  }
  
  return html;
}

/**
 * 处理行内元素（粗体、斜体、代码、链接）
 */
function processInline(text) {
  return text
    // 代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 粗体+斜体
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * 生成完整 HTML
 */
function generateFullHTML(content, title) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { 
      size: A4; 
      margin: 2cm;
    }
    
    * { box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      background: #fff;
      margin: 0;
      padding: 20px;
    }
    
    h1 { 
      font-size: 22pt; 
      color: #1a1a1a; 
      border-bottom: 3px solid #ff6600; 
      padding-bottom: 10px; 
      margin-bottom: 20px;
      page-break-after: avoid;
    }
    
    h2 { 
      font-size: 16pt; 
      color: #2c2c2c; 
      border-left: 4px solid #ff6600; 
      padding-left: 12px; 
      margin-top: 25px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }
    
    h3 { 
      font-size: 13pt; 
      color: #3a3a3a; 
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    
    h4, h5, h6 { 
      font-size: 11pt; 
      color: #4a4a4a; 
      margin-top: 15px;
      margin-bottom: 8px;
    }
    
    p { 
      margin: 10px 0; 
      text-align: justify;
      orphans: 3;
      widows: 3;
    }
    
    a { color: #0066cc; text-decoration: none; }
    
    ul, ol { 
      margin: 10px 0; 
      padding-left: 25px;
      page-break-inside: avoid;
    }
    
    li { margin: 5px 0; }
    
    /* 表格样式 - 修复版 */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    
    thead {
      display: table-header-group;
    }
    
    th {
      background: #f5f5f5;
      color: #333;
      font-weight: 600;
      padding: 10px 8px;
      border: 1px solid #ddd;
      text-align: left;
    }
    
    td {
      padding: 8px;
      border: 1px solid #ddd;
      vertical-align: top;
    }
    
    tr:nth-child(even) {
      background: #fafafa;
    }
    
    tr:hover {
      background: #f0f0f0;
    }
    
    pre {
      background: #f5f5f5;
      color: #333;
      padding: 12px;
      border-radius: 5px;
      overflow-x: auto;
      border: 1px solid #e0e0e0;
      font-family: "SF Mono", Monaco, "Fira Code", monospace;
      font-size: 9pt;
      line-height: 1.4;
      page-break-inside: avoid;
      margin: 12px 0;
    }
    
    code {
      background: #f0f0f0;
      padding: 2px 5px;
      border-radius: 3px;
      font-family: "SF Mono", Monaco, "Fira Code", monospace;
      font-size: 9pt;
      color: #d73a49;
    }
    
    pre code {
      background: none;
      color: #333;
      padding: 0;
    }
    
    blockquote {
      border-left: 3px solid #ddd;
      margin: 12px 0;
      padding: 10px 15px;
      background: #f9f9f9;
      color: #555;
      page-break-inside: avoid;
    }
    
    hr { 
      border: none; 
      border-top: 1px solid #ddd; 
      margin: 25px 0; 
    }
    
    strong { font-weight: 600; }
    em { font-style: italic; }
    
    /* 打印优化 */
    @media print {
      body { padding: 0; }
      pre, blockquote, table { page-break-inside: avoid; }
      h1, h2, h3 { page-break-after: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>${content}</body>
</html>`;
}

/**
 * 主函数：Markdown 转 PDF
 */
export async function convertMarkdownToPDF(markdownPath, options = {}) {
  const { outputPath = null, title = 'HN Daily Report', format = 'pdf' } = options;
  
  console.log(`🔄 正在转换: ${markdownPath}`);
  
  // 读取 Markdown
  const markdown = await readFile(markdownPath, 'utf-8');
  console.log(`   原文长度: ${markdown.length} 字符`);
  
  // 转换为 HTML
  console.log('   正在解析 Markdown...');
  const htmlContent = markdownToHTML(markdown);
  const fullHTML = generateFullHTML(htmlContent, title);
  
  // 保存 HTML 用于调试
  const htmlDebugPath = markdownPath.replace('.md', '-debug.html');
  await writeFile(htmlDebugPath, fullHTML, 'utf-8');
  console.log(`   HTML 预览: ${htmlDebugPath}`);
  
  // 确定输出路径
  const basePath = markdownPath.replace(/\.md$/, '');
  const finalOutputPath = outputPath || (format === 'html' ? `${basePath}.html` : `${basePath}.pdf`);

  if (format === 'html') {
    await writeFile(finalOutputPath, fullHTML, 'utf-8');
    console.log(`   ✅ HTML 生成完成: ${finalOutputPath}`);
    return finalOutputPath;
  }
  
  // 使用 Playwright 生成 PDF
  console.log('   正在生成 PDF...');
  
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setContent(fullHTML, { waitUntil: 'networkidle' });
    
    await page.pdf({
      path: finalOutputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '2cm',
        right: '2cm',
        bottom: '2cm',
        left: '2cm'
      }
    });
    
    await browser.close();
    
    console.log(`   ✅ PDF 生成完成: ${finalOutputPath}`);
    return finalOutputPath;
    
  } catch (error) {
    console.error('   ❌ PDF 生成失败:', error.message);
    
    // 退回到生成 HTML
    const htmlPath = finalOutputPath.replace('.pdf', '.html');
    await writeFile(htmlPath, fullHTML, 'utf-8');
    console.log(`   ⚠️ 已生成 HTML: ${htmlPath}`);
    return htmlPath;
  }
}

// CLI 支持
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
HN Daily PDF 生成器 - 完整表格支持

用法: node md-to-pdf.mjs <markdown文件> [选项]

选项:
  --output <路径>   输出文件路径
  --title <标题>    文档标题

示例:
  node md-to-pdf.mjs report.md
  node md-to-pdf.mjs report.md --output ~/daily.pdf
`);
    process.exit(0);
  }
  
  const markdownPath = args[0];
  const outputIdx = args.indexOf('--output');
  const titleIdx = args.indexOf('--title');
  const formatIdx = args.indexOf('--format');
  
  const options = {
    outputPath: outputIdx !== -1 ? args[outputIdx + 1] : null,
    title: titleIdx !== -1 ? args[titleIdx + 1] : 'HN Daily Report',
    format: formatIdx !== -1 ? args[formatIdx + 1] : 'pdf'
  };
  
  convertMarkdownToPDF(markdownPath, options)
    .then(output => {
      console.log(`\n✅ 完成: ${output}`);
    })
    .catch(err => {
      console.error('❌ 错误:', err.message);
      process.exit(1);
    });
}

export default convertMarkdownToPDF;
