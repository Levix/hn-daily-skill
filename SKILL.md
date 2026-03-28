---
name: hn-daily-skill
description: 维护 HN Daily 报告生成与发布链路。当前能力分为草稿生成（`hn-daily-YYYY-MM-DD.*`）和 complete 发布（`hn-daily-YYYY-MM-DD-complete.*`），GitHub Pages 与同步脚本只认 complete 产物。
---

# HN Daily Skill

维护 Hacker News Daily 中文日报的草稿生成、complete 校验、Pages 构建和发布同步。

## 当前真实能力

### 1. 草稿生成

```bash
# 生成草稿 Markdown
node scripts/auto-digest.mjs --date 2026-03-07

# 生成草稿 PDF / Markdown / HTML
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format pdf
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format md
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format html
```

输出文件：

- `output/hn-daily-YYYY-MM-DD.md`
- `output/hn-daily-YYYY-MM-DD.pdf`
- `output/hn-daily-YYYY-MM-DD.html`

注意：这些文件是草稿或格式化产物，不会自动变成发布用的 complete 文件。

### 2. complete 校验

```bash
node scripts/check-completeness.mjs output/hn-daily-2026-03-07-complete.md
```

说明：

- 仅支持 Markdown
- 发现模板内容、章节缺失、文章数不足时会失败
- 直接传 PDF 会返回明确拒绝信息

### 3. Pages 构建

```bash
npm run build:pages
```

行为：

- 扫描 `output/*-complete.md`
- 复制对应 `*-complete.pdf` 到 `docs/data/`
- 生成 `docs/data/index.json`

### 4. 发布同步

```bash
node scripts/sync-pages-and-push.mjs --date 2026-03-07
```

前置条件：

- `output/hn-daily-YYYY-MM-DD-complete.md` 存在
- `output/hn-daily-YYYY-MM-DD-complete.pdf` 存在
- `check-completeness` 对对应 Markdown 通过

## 推荐维护流程

```bash
# 1. 生成或补全当天 complete 产物
# output/hn-daily-YYYY-MM-DD-complete.md
# output/hn-daily-YYYY-MM-DD-complete.pdf

# 2. 校验 complete Markdown
node scripts/check-completeness.mjs output/hn-daily-YYYY-MM-DD-complete.md

# 3. 构建 Pages 数据
npm run build:pages

# 4. 同步到仓库
node scripts/sync-pages-and-push.mjs --date YYYY-MM-DD
```

## 产物契约

- 草稿：`hn-daily-YYYY-MM-DD.*`
- 发布：`hn-daily-YYYY-MM-DD-complete.*`
- Pages 只消费发布产物
- 发布脚本只同步发布产物

## 已知限制

- 自动抓取脚本目前不会自动生成最终 complete 中文总结
- 如果要对外发布，必须准备 `*-complete.md` 和 `*-complete.pdf`
- `message` 发送文件时应使用相对路径，例如 `./hn-daily-2026-03-07.pdf`
