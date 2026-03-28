# HN Daily Skill - 快速参考

## 产物分类

- 草稿 Markdown：`output/hn-daily-YYYY-MM-DD.md`
- 发布 Markdown：`output/hn-daily-YYYY-MM-DD-complete.md`
- 发布 PDF：`output/hn-daily-YYYY-MM-DD-complete.pdf`
- 运行记录：`output/hn-daily-YYYY-MM-DD-run.json`

## 常用命令

```bash
cd ~/.openclaw/workspace-discord/skills/hn-daily-skill

# 草稿生成
node scripts/auto-digest.mjs --date 2026-03-07

# complete 生成 / 包装
node scripts/generate-complete.mjs --date 2026-03-07
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format pdf
node scripts/auto-digest-pdf.mjs --date 2026-03-07 --format html

# 一次跑完整生成 + 发布
npm run daily:pipeline -- --date 2026-03-07
```

## 关键规则

- `build-pages` 只读取 `output/*-complete.md`
- `sync-pages-and-push` 只发布 `*-complete.md`、`*-complete.pdf` 和 `*-run.json`
- `check-completeness` 不支持 PDF 输入
- `auto-digest.mjs` 只生成草稿
- `auto-digest-pdf.mjs` 现在直接包装 complete 生成链路

## 问题速查

| 现象 | 处理方式 |
|---|---|
| Pages 文章数显示为 0 | 重新运行 `npm run build:pages`，确认 `docs/data/index.json` 已更新 |
| `send-only` 找不到文件 | 检查是否存在 `output/hn-daily-YYYY-MM-DD.md` |
| PDF 发送后文件损坏 | 使用当前脚本重新生成，发送分支已改为二进制复制 |
| `check-completeness` 检查 PDF 失败 | 改为检查对应的 `*-complete.md` |
| `sync-pages-and-push` 失败 | 检查 complete Markdown/PDF/run.json 是否都存在，且完整性检查通过 |

## 手动发布最短路径

```bash
npm run daily:pipeline -- --date 2026-03-07
```
