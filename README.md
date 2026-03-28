# hn-daily-skill

当前仓库分为两条链路：

1. 草稿链路：`auto-digest.mjs` 抓取 HN Daily，产出草稿 Markdown
2. complete 链路：`generate-complete.mjs` 逐篇调用 OpenClaw agent 生成完整中文总结，产出 `*-complete.md`、`*-complete.pdf` 和 `*-run.json`

发布源和唯一权威产物是 `output/hn-daily-YYYY-MM-DD-complete.{md,pdf}`。

## 当前产物约定

- 草稿 Markdown：`output/hn-daily-YYYY-MM-DD.md`
- 最终发布 Markdown：`output/hn-daily-YYYY-MM-DD-complete.md`
- 最终发布 PDF：`output/hn-daily-YYYY-MM-DD-complete.pdf`
- 运行记录：`output/hn-daily-YYYY-MM-DD-run.json`

## 核心命令

```bash
# 生成草稿 Markdown
node scripts/auto-digest.mjs --date 2026-03-06

# 生成完整发布产物
node scripts/generate-complete.mjs --date 2026-03-06

# 兼容包装脚本：输出 complete PDF / Markdown / HTML
node scripts/auto-digest-pdf.mjs --date 2026-03-06 --format pdf
node scripts/auto-digest-pdf.mjs --date 2026-03-06 --format md
node scripts/auto-digest-pdf.mjs --date 2026-03-06 --format html

# 一次跑完整生成 + Pages 同步
npm run daily:pipeline -- --date 2026-03-06

# 检查 complete Markdown（仅支持 Markdown）
node scripts/check-completeness.mjs output/hn-daily-2026-03-06-complete.md

# 构建 GitHub Pages 数据（仅扫描 *-complete.md）
npm run build:pages

# 同步 complete 产物到 docs + git push
node scripts/sync-pages-and-push.mjs --date 2026-03-06
```

## 发布流程

```bash
# 1. 生成当天 complete 产物
node scripts/generate-complete.mjs --date 2026-03-06

# 2. 构建并同步 Pages
node scripts/sync-pages-and-push.mjs --date 2026-03-06

# 或者直接一步完成
npm run daily:pipeline -- --date 2026-03-06
```

## GitHub Pages

`docs/` 为静态站点目录：

- `docs/index.html`：浏览器入口
- `docs/data/index.json`：报告索引
- `docs/data/*.md|*.pdf`：从 `output/*-complete.*` 构建出的发布文件

Pages 配置方式：

1. 打开仓库 `Settings` → `Pages`
2. `Source` 选择 `Deploy from a branch`
3. Branch 选择 `main`，Folder 选择 `/docs`

默认页面地址：`https://levix.github.io/hn-daily-skill/`

## 已知限制

- `auto-digest.mjs` 仍然是草稿链路，不参与发布
- `auto-digest-pdf.mjs` 现在是 complete 包装器，内部直接调用 `generate-complete.mjs`
- `check-completeness.mjs` 只支持检查 Markdown，不支持直接检查 PDF
- `sync-pages-and-push.mjs` 会拒绝缺少 complete 文件、完整性检查失败或 `run.json` 状态不是 `completed` 的日期
