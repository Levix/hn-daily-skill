import { chromium } from 'playwright';
import { readFile } from 'fs/promises';

async function generatePDF() {
  const markdown = await readFile('./output/hn-daily-2026-03-07-detailed.md', 'utf-8');
  
  // 简单的 Markdown 转 HTML
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^###### (.*$)/gm, '<h6>$1</h6>')
    .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
    .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^\s*[-*]\s+(.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n)+/g, '<ul>$\u0026</ul>')
    .replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n)+/g, '<ol>$\u0026</ol>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>');

  const fullHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>HN Daily 2026-03-07</title>
  <style>
    @page { size: A4; margin: 2cm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      background: #fff;
      margin: 0;
      padding: 20px;
    }
    h1 { font-size: 24pt; color: #1a1a1a; border-bottom: 3px solid #ff6600; padding-bottom: 10px; }
    h2 { font-size: 18pt; color: #2c2c2c; border-left: 4px solid #ff6600; padding-left: 12px; margin-top: 30px; }
    h3 { font-size: 14pt; color: #3a3a3a; margin-top: 25px; }
    p { margin: 10px 0; text-align: justify; }
    a { color: #0066cc; text-decoration: none; }
    ul, ol { margin: 10px 0; padding-left: 25px; }
    li { margin: 5px 0; }
    pre {
      background: #f5f5f5;
      color: #333;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      border: 1px solid #e0e0e0;
      font-family: "SF Mono", Monaco, monospace;
      font-size: 10pt;
    }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: "SF Mono", Monaco, monospace;
      font-size: 10pt;
      color: #d73a49;
    }
    hr { border: none; border-top: 2px solid #eee; margin: 30px 0; }
  </style>
</head>
<body>${html}</body>
</html>`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(fullHTML, { waitUntil: 'networkidle' });
  await page.pdf({
    path: './hn-daily-2026-03-07-final.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' }
  });
  await browser.close();
  console.log('✅ PDF 生成完成: hn-daily-2026-03-07-final.pdf');
}

generatePDF().catch(console.error);
