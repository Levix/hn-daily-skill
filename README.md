# hn-daily-skill

当前仓库分为两条链路：

1. 草稿生成链路：抓取 HN Daily，产出草稿 Markdown/PDF/HTML
2. 发布链路：只认 `output/hn-daily-YYYY-MM-DD-complete.{md,pdf}`，并同步到 `docs/` / GitHub Pages

仓库目前**不会**自动把草稿升级为完整中文总结。`*-complete.*` 仍然是发布源和唯一权威产物。

## 当前产物约定

- 草稿 Markdown：`output/hn-daily-YYYY-MM-DD.md`
- 草稿 PDF：`output/hn-daily-YYYY-MM-DD.pdf`
- 草稿 HTML：`output/hn-daily-YYYY-MM-DD.html`
- 最终发布 Markdown：`output/hn-daily-YYYY-MM-DD-complete.md`
- 最终发布 PDF：`output/hn-daily-YYYY-MM-DD-complete.pdf`

## 核心命令

```bash
# 生成草稿 Markdown
node scripts/auto-digest.mjs --date 2026-03-06

# 生成草稿 PDF / Markdown / HTML
node scripts/auto-digest-pdf.mjs --date 2026-03-06 --format pdf
node scripts/auto-digest-pdf.mjs --date 2026-03-06 --format md
node scripts/auto-digest-pdf.mjs --date 2026-03-06 --format html

# 检查 complete Markdown（仅支持 Markdown）
node scripts/check-completeness.mjs output/hn-daily-2026-03-06-complete.md

# 构建 GitHub Pages 数据（仅扫描 *-complete.md）
npm run build:pages

# 同步 complete 产物到 docs + git push
node scripts/sync-pages-and-push.mjs --date 2026-03-06
```

## 发布流程

```bash
# 1. 准备当天 complete 文件
ls output/hn-daily-2026-03-06-complete.md
ls output/hn-daily-2026-03-06-complete.pdf

# 2. 检查完整性
node scripts/check-completeness.mjs output/hn-daily-2026-03-06-complete.md

# 3. 构建并同步 Pages
npm run build:pages
node scripts/sync-pages-and-push.mjs --date 2026-03-06
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

- `auto-digest.mjs` / `auto-digest-pdf.mjs` 当前生成的是草稿，不是可发布的 complete 内容
- `check-completeness.mjs` 只支持检查 Markdown，不支持直接检查 PDF
- `sync-pages-and-push.mjs` 会拒绝缺少 complete 文件或完整性检查失败的日期
