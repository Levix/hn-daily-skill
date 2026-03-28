# HN Daily Skill - 快速参考

## 产物分类

- 草稿 Markdown：`output/hn-daily-YYYY-MM-DD.md`
- 草稿 PDF：`output/hn-daily-YYYY-MM-DD.pdf`
- 草稿 HTML：`output/hn-daily-YYYY-MM-DD.html`
- 发布 Markdown：`output/hn-daily-YYYY-MM-DD-complete.md`
- 发布 PDF：`output/hn-daily-YYYY-MM-DD-complete.pdf`

## 常用命令

```bash
cd ~/.openclaw/workspace-discord/skills/hn-daily-skill

# 草稿生成
node scripts/auto-digest.mjs --date 2026-03-07
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format pdf
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format html

# 完整性检查（仅 Markdown）
node scripts/check-completeness.mjs output/hn-daily-2026-03-07-complete.md

# Pages 构建
npm run build:pages

# 发布同步
node scripts/sync-pages-and-push.mjs --date 2026-03-07
```

## 关键规则

- `build-pages` 只读取 `output/*-complete.md`
- `sync-pages-and-push` 只发布 `*-complete.md` 和 `*-complete.pdf`
- `check-completeness` 不支持 PDF 输入
- `auto-digest*` 目前生成草稿，不等于 complete 成稿

## 问题速查

| 现象 | 处理方式 |
|---|---|
| Pages 文章数显示为 0 | 重新运行 `npm run build:pages`，确认 `docs/data/index.json` 已更新 |
| `send-only` 找不到文件 | 检查是否存在 `output/hn-daily-YYYY-MM-DD.md` |
| PDF 发送后文件损坏 | 使用当前脚本重新生成，发送分支已改为二进制复制 |
| `check-completeness` 检查 PDF 失败 | 改为检查对应的 `*-complete.md` |
| `sync-pages-and-push` 失败 | 检查 complete Markdown/PDF 是否都存在，且完整性检查通过 |

## 手动发布最短路径

```bash
node scripts/check-completeness.mjs output/hn-daily-2026-03-07-complete.md
npm run build:pages
node scripts/sync-pages-and-push.mjs --date 2026-03-07
```
