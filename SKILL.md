---
name: hn-daily-skill
description: 维护 HN Daily 报告生成与发布链路。当前能力分为草稿生成（`hn-daily-YYYY-MM-DD.md`）和 complete 发布（`hn-daily-YYYY-MM-DD-complete.*`），GitHub Pages 与同步脚本只认 complete 产物。
---

# HN Daily Skill

维护 Hacker News Daily 中文日报的草稿生成、complete 校验、Pages 构建和发布同步。

## 当前真实能力

### 1. 草稿生成

```bash
# 生成草稿 Markdown
node scripts/auto-digest.mjs --date 2026-03-07

# 生成 complete PDF / Markdown / HTML
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format pdf
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format md
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format html

# 直接生成 complete 产物
node scripts/generate-complete.mjs --date 2026-03-07

# 一次跑完整生成 + 发布
node scripts/run-daily-pipeline.mjs --date 2026-03-07
```

输出文件：

- `output/hn-daily-YYYY-MM-DD.md`
- `output/hn-daily-YYYY-MM-DD-complete.md`
- `output/hn-daily-YYYY-MM-DD-complete.pdf`
- `output/hn-daily-YYYY-MM-DD-run.json`

说明：

- `auto-digest.mjs` 只生成草稿 Markdown
- `auto-digest-pdf.mjs` 是 complete 包装脚本，内部调用 `generate-complete.mjs`
- `generate-complete.mjs` 才是完整中文总结的主入口

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
- `output/hn-daily-YYYY-MM-DD-run.json` 存在且状态为 `completed`
- `check-completeness` 对对应 Markdown 通过

## 推荐维护流程

```bash
# 1. 生成 complete 产物
node scripts/generate-complete.mjs --date YYYY-MM-DD

# 2. 同步到仓库
node scripts/sync-pages-and-push.mjs --date YYYY-MM-DD

# 或直接跑完整 pipeline
node scripts/run-daily-pipeline.mjs --date YYYY-MM-DD
```

## 产物契约

- 草稿：`hn-daily-YYYY-MM-DD.*`
- 发布：`hn-daily-YYYY-MM-DD-complete.*`
- 运行记录：`hn-daily-YYYY-MM-DD-run.json`
- Pages 只消费发布产物
- 发布脚本只同步发布产物

## 已知限制

- 如果 `openclaw agent --json` 不可用，`generate-complete.mjs` 无法产出 complete 成稿
- 发布前必须存在 `*-complete.md`、`*-complete.pdf` 和 `*-run.json`
- `message` 发送文件时应使用相对路径，例如 `./hn-daily-2026-03-07.pdf`
