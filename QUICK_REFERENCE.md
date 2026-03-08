# HN Daily Skill - 快速参考手册

## 🚀 快速开始

```bash
cd ~/.openclaw/workspace-discord/skills/hn-daily-skill

# 生成 PDF（推荐）
node scripts/auto-digest-pdf.mjs

# 指定日期
node scripts/auto-digest-pdf.mjs --date 2026-03-07

# 发送到 Discord
node scripts/auto-digest-pdf.mjs --channel YOUR_CHANNEL_ID
```

---

## ⚠️ 问题速查表

| 问题现象 | 快速解决 |
|---------|---------|
| 文件发送失败 | 使用 `./file.pdf` 相对路径 |
| 消息发送失败 | 分段发送或用文件附件 |
| 中文乱码 | 检查 UTF-8 BOM 处理 |
| 代码块黑底 | 修改 CSS: `background: #f5f5f5; color: #333;` |
| 表格异常 | 确保 Markdown 表格语法正确 |
| 显示 ## 符号 | 移除 BOM: `markdown.replace(/^\ufeff/, '')` |
| PDF 生成失败 | `npm install playwright` |

---

## 🔧 常用命令

### 文件操作
```bash
# 复制到当前目录（发送前必须）
cp output/hn-daily-YYYY-MM-DD.pdf ./hn-daily-YYYY-MM-DD.pdf

# 发送文件
message --action send \
  --filePath "./hn-daily-2026-03-07.pdf" \
  --filename "hn-daily-2026-03-07.pdf"
```

### 格式转换
```bash
# Markdown 转 PDF
node scripts/md-to-pdf.mjs report.md

# Markdown 转 HTML
node scripts/md-to-pdf.mjs report.md --format html
```

### 依赖安装
```bash
# 安装 PDF 生成依赖
cd ~/.openclaw/workspace-discord/skills/hn-daily-skill
npm install playwright
```

---

## 📋 检查清单

生成报告前检查：
- [ ] 日期格式正确 (YYYY-MM-DD)
- [ ] 文件路径使用相对路径
- [ ] 编码为 UTF-8 with BOM

发送文件前检查：
- [ ] 文件复制到当前目录
- [ ] 使用 `./filename` 相对路径
- [ ] 文件大小 < 8MB

PDF 样式检查：
- [ ] 白底黑字
- [ ] 表格有边框
- [ ] 代码块浅灰背景
- [ ] 无 Markdown 语法残留

---

## 📝 关键代码片段

### 1. 添加/移除 UTF-8 BOM
```javascript
// 生成 Markdown 时添加 BOM
const reportWithBOM = '\ufeff' + report;
await writeFile(outputPath, reportWithBOM, 'utf-8');

// PDF 转换时移除 BOM
markdown = markdown.replace(/^\ufeff/, '');
```

### 2. 表格解析
```javascript
function parseTable(tableLines) {
  const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h);
  const rows = tableLines.slice(2).map(line => 
    line.split('|').map(c => c.trim()).filter(c => c)
  );
  // 生成 HTML 表格...
}
```

### 3. 表格 CSS
```css
table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #ddd;
}
th {
  background: #f5f5f5;
  padding: 10px;
  border: 1px solid #ddd;
}
td {
  padding: 8px;
  border: 1px solid #ddd;
}
```

### 4. 白底黑字代码块
```css
pre {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #e0e0e0;
  padding: 12px;
  border-radius: 5px;
}
```

---

## 🐛 调试技巧

### 查看生成的 HTML
```bash
# 生成时会自动保存 debug HTML
cat output/hn-daily-2026-03-07-debug.html

# 在浏览器中打开查看效果
open output/hn-daily-2026-03-07-debug.html
```

### 检查 Markdown 内容
```bash
# 检查是否有占位符
grep -i "提示词\|TODO\|FIXME\|见文末" output/hn-daily-2026-03-07.md

# 检查文件编码
file output/hn-daily-2026-03-07.md

# 检查文件大小
ls -lh output/hn-daily-2026-03-07.pdf
```

---

## 📞 求助

如果以上方法都无法解决问题，请检查：
1. SKILL.md 中的"常见问题与解决方案"章节
2. 查看生成的 debug HTML 文件
3. 检查 OpenClaw 日志

---

*快速参考手册 v1.0* · HN Daily Skill
