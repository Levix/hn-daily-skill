---
name: hn-daily-skill
description: 获取并解读 Hacker News Daily 每日精选内容，支持生成 PDF/Markdown/HTML 报告并发送到 Discord。Use when user wants to (1) fetch daily top 10 Hacker News articles from hn-daily, (2) generate professional PDF reports, (3) automatically send reports to Discord on a schedule.
---

# HN Daily Skill - Hacker News 每日精选解读

自动获取 Hacker News Daily (daemonology.net/hn-daily) 的每日 Top 10 文章，生成专业的 PDF 或 Markdown 报告，支持自动发送到 Discord。

## 快速开始

### 默认生成 PDF（推荐）

```bash
cd /Users/leeeeeee/.openclaw/workspace-discord/skills/hn-daily-skill
node scripts/auto-digest-pdf.mjs
```

### 指定格式

```bash
# 生成 PDF（默认）
node scripts/auto-digest-pdf.mjs --format pdf

# 生成 Markdown
node scripts/auto-digest-pdf.mjs --format md

# 生成 HTML
node scripts/auto-digest-pdf.mjs --format html
```

### 发送到 Discord

```bash
node scripts/auto-digest-pdf.mjs --format pdf --channel YOUR_CHANNEL_ID
```

## 脚本说明

### 1. auto-digest-pdf.mjs - 推荐脚本（默认 PDF）⭐

增强版脚本，支持多种格式，**默认生成 PDF**。

```bash
# 基础用法 - 生成 PDF
node scripts/auto-digest-pdf.mjs

# 指定日期
node scripts/auto-digest-pdf.mjs --date 2026-03-07

# 指定格式
node scripts/auto-digest-pdf.mjs --format pdf   # PDF 格式（默认）
node scripts/auto-digest-pdf.mjs --format md    # Markdown 格式
node scripts/auto-digest-pdf.mjs --format html  # HTML 格式

# 发送到 Discord
node scripts/auto-digest-pdf.mjs --channel 1479860758488813609
```

### 2. fetch-daily.mjs - 基础 Markdown 获取

仅生成 Markdown 格式的基础报告。

```bash
node scripts/fetch-daily.mjs
node scripts/fetch-daily.mjs --date 2026-03-07
```

### 3. md-to-pdf.mjs - Markdown 转换工具

将 Markdown 文件转换为 PDF 或 HTML。

```bash
# Markdown 转 PDF
node scripts/md-to-pdf.mjs output/hn-daily-2026-03-07.md

# Markdown 转 HTML
node scripts/md-to-pdf.mjs output/hn-daily-2026-03-07.md --format html

# 指定输出路径
node scripts/md-to-pdf.mjs report.md --output ~/daily.pdf
```

### 参数说明

| 参数 | 说明 | 默认值 | 示例 |
|-----|------|-------|------|
| `--date` | 指定日期 | 自动获取最新 | `2026-03-07` |
| `--format` | 输出格式 | `pdf` | `pdf` / `md` / `html` |
| `--output` | 输出文件路径 | 自动生成 | `~/hn-daily.pdf` |
| `--channel` | Discord 频道 ID | - | `1479860758488813609` |

### 环境变量

```bash
export DISCORD_CHANNEL_ID=1479860758488813609
node scripts/auto-digest-pdf.mjs
```

## 输出格式对比

| 格式 | 扩展名 | 特点 | 适用场景 |
|-----|-------|------|---------|
| **PDF** ⭐ | `.pdf` | 专业排版，适合阅读打印 | 📄 **默认推荐** |
| Markdown | `.md` | 可编辑，源码可见 | 📝 需要二次编辑 |
| HTML | `.html` | 浏览器直接打开 | 🌐 网页查看 |

## 定时任务设置

### 每天自动发送 PDF 报告到 Discord

```bash
# 使用 OpenClaw Cron 设置每天早上 9:00 自动执行
openclaw cron add \
  --name "hn-daily-pdf-morning" \
  --schedule "0 9 * * *" \
  --command "cd /Users/leeeeeee/.openclaw/workspace-discord/skills/hn-daily-skill && node scripts/auto-digest-pdf.mjs --channel YOUR_CHANNEL_ID"
```

### 使用 Agent 任务（推荐）

已配置的定时任务每天早上 9:00 自动执行：

```json
{
  "name": "hn-daily-auto-digest",
  "schedule": "0 9 * * *",
  "command": "生成 HN Daily PDF 报告并发送到 Discord"
}
```

任务流程：
1. 获取最新 HN Daily 文章
2. 生成 Markdown 源文件
3. **转换为 PDF 格式**（默认）
4. 发送到 Discord 频道

## PDF 报告特点

### 专业排版
- A4 纸张，适合打印
- 清晰的层次结构
- 代码块语法高亮
- 表格美观呈现

### 中文优化
- UTF-8 编码支持
- 中文字体优化
- 中文标点正确处理

### 阅读友好
- 自动分页优化
- 标题不跨页
- 代码块不跨页
- 页边距适中

## 完整工作流程

### 手动执行流程

```bash
# Step 1: 进入技能目录
cd ~/.openclaw/workspace-discord/skills/hn-daily-skill

# Step 2: 生成 PDF 报告
node scripts/auto-digest-pdf.mjs --format pdf

# Step 3: 查看生成的文件
ls output/
# 会看到:
# - hn-daily-YYYY-MM-DD.md (Markdown 源文件)
# - hn-daily-YYYY-MM-DD.pdf (PDF 报告)

# Step 4: 发送 PDF 到 Discord
message --action send \
  --filePath "./hn-daily-2026-03-07.pdf" \
  --filename "hn-daily-2026-03-07.pdf" \
  --message "📄 HN Daily 今日总结（PDF）"
```

### 格式切换

```bash
# 今天想要 Markdown 格式？
node scripts/auto-digest-pdf.mjs --format md

# 想要 HTML 在浏览器查看？
node scripts/auto-digest-pdf.mjs --format html
```

## 依赖安装（可选）

PDF 生成功能依赖以下工具（自动尝试，无需手动安装）：

| 工具 | 用途 | 安装命令 |
|-----|------|---------|
| Playwright | 生成 PDF | `npm install playwright` |
| Puppeteer | 备选 PDF 方案 | `npm install puppeteer` |

如果未安装，脚本会自动退回到生成 HTML 格式。

---

## ❗ 常见问题与解决方案

### Q1: 发送文件时提示 "Local media path is not under an allowed directory"

**问题原因**: OpenClaw 对文件路径有 sandbox 限制，不能使用绝对路径。

**解决方案**: 使用相对路径 `./filename.pdf`

```bash
# ❌ 错误
message --filePath "/Users/xxx/output/file.pdf"

# ✅ 正确
message --filePath "./file.pdf"
```

**预防措施**: 发送前将文件复制到当前工作目录：
```bash
cp output/hn-daily-2026-03-07.pdf ./hn-daily-2026-03-07.pdf
message --filePath "./hn-daily-2026-03-07.pdf"
```

---

### Q2: 消息发送失败（Message failed）

**问题原因**: 文件太大或内容太长，超过 Discord 单条消息限制。

**解决方案**: 
1. **文件太大**: 分段发送或使用文件附件方式
2. **文本太长**: 将内容分段，每段不超过 2000 字符

```bash
# 直接发送文件（推荐）
message --action send \
  --filePath "./hn-daily-2026-03-07.pdf" \
  --filename "hn-daily-2026-03-07.pdf"
```

---

### Q3: PDF 中中文显示乱码

**问题原因**: 编码问题，通常是 UTF-8 BOM 或字体不支持中文。

**解决方案**:
1. **生成时添加 UTF-8 BOM**:
   ```javascript
   const reportWithBOM = '\ufeff' + report;
   await writeFile(outputPath, reportWithBOM, 'utf-8');
   ```

2. **PDF 生成时移除 BOM**:
   ```javascript
   markdown = markdown.replace(/^\ufeff/, '');
   ```

3. **使用支持中文的字体**:
   ```css
   font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", 
                "PingFang SC", "Microsoft YaHei", sans-serif;
   ```

---

### Q4: PDF 中代码块是黑底白字

**问题原因**: CSS 样式默认设置了深色背景。

**解决方案**: 修改 `md-to-pdf.mjs` 中的 CSS:

```css
/* ❌ 旧样式（深色） */
pre {
  background: #2d2d2d;
  color: #f8f8f2;
}

/* ✅ 新样式（白底黑字） */
pre {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #e0e0e0;
}
```

---

### Q5: PDF 中表格显示异常

**问题原因**: Markdown 表格未正确转换为 HTML。

**解决方案**: 
1. **添加表格解析器**:
   ```javascript
   function parseTable(tableLines) {
     // 解析表头
     const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h);
     // 解析数据行
     const rows = tableLines.slice(2).map(line => {
       return line.split('|').map(c => c.trim()).filter(c => c);
     });
     // 生成 HTML 表格...
   }
   ```

2. **添加表格 CSS**:
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

---

### Q6: PDF 中显示 Markdown 原始语法（如 ## 标题）

**问题原因**: UTF-8 BOM 字符导致正则匹配失败，`# 标题` 未被识别。

**解决方案**: 
1. **生成 Markdown 时**:
   ```javascript
   // 添加 BOM
   const reportWithBOM = '\ufeff' + report;
   await writeFile(outputPath, reportWithBOM, 'utf-8');
   ```

2. **PDF 转换时**:
   ```javascript
   // 移除 BOM
   markdown = markdown.replace(/^\ufeff/, '');
   ```

3. **确保标题正则正确**:
   ```javascript
   // 匹配标题时考虑空格
   if (line.startsWith('# ')) {
     html += `<h1>${processInline(escapeHtml(line.slice(2)))}</h1>\n`;
   }
   ```

---

### Q7: 报告中有 "AI 分析提示词" 等占位符

**问题原因**: 生成的 Markdown 包含待填充的模版内容。

**解决方案**: 
1. **确保文章内容完整抓取**
2. **移除占位符段落**:
   ```javascript
   // 过滤掉占位符内容
   const cleanContent = content
     .replace(/- \*\*AI 分析提示词\*\*:.*\n/g, '')
     .replace(/## 🤖 AI 处理提示词[\s\S]*$/, '');
   ```

3. **使用完整内容生成报告**（参考 `hn-daily-2026-03-07-detailed.md`）

---

### Q8: PDF 生成失败，退回到 HTML

**问题原因**: 未安装 Playwright 或 Puppeteer。

**解决方案**:
```bash
# 安装 Playwright
cd ~/.openclaw/workspace-discord/skills/hn-daily-skill
npm install playwright

# 或安装 Puppeteer 作为备选
npm install puppeteer
```

---

## 📁 文件结构

```
hn-daily-skill/
├── SKILL.md                         # 技能文档（含本经验沉淀）
├── scripts/
│   ├── fetch-daily.mjs             # 基础 Markdown 获取
│   ├── auto-digest.mjs             # 自动化脚本（Markdown）
│   ├── auto-digest-pdf.mjs         # ⭐ 推荐脚本（PDF 默认）
│   └── md-to-pdf.mjs               # PDF 转换工具（含所有修复）
└── output/                          # 输出目录
    ├── hn-daily-YYYY-MM-DD.md      # Markdown 源文件
    ├── hn-daily-YYYY-MM-DD.pdf     # ⭐ PDF 报告
    └── hn-daily-YYYY-MM-DD.html    # HTML 版本（可选）
```

## 更新日志

- v1.0 - 基础 Markdown 获取功能
- v1.1 - 添加自动化脚本
- v1.2 - 添加 Discord 文件发送支持
- v1.3 - **添加 PDF 生成功能**（默认格式）
- v1.4 - **经验沉淀**: 整理常见问题与解决方案
  - 修复文件路径限制问题
  - 修复中文编码乱码问题
  - 修复 PDF 样式问题（白底黑字）
  - 修复表格显示问题
  - 修复 Markdown 语法显示问题
  - 修复占位符问题

---

## 💡 最佳实践总结

1. **文件发送**: 始终使用相对路径 `./filename.pdf`
2. **编码处理**: 生成时加 BOM，转换时移除 BOM
3. **PDF 样式**: 白底黑字，代码块浅灰背景
4. **表格处理**: 完整解析 Markdown 表格语法
5. **内容完整**: 确保抓取完整文章内容，无占位符
6. **错误处理**: PDF 失败时自动退回 HTML

---

*Powered by HN Daily Skill* · 自动生成专业的 Hacker News 每日精选 PDF 报告
