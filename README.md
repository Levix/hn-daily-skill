# hn-daily-skill

自动获取 HN Daily 内容，生成完整中文总结，并输出 PDF/MD/HTML。

## 核心命令

```bash
# 生成日报（默认 PDF）
node scripts/auto-digest-pdf.mjs --date 2026-03-06

# 完整性检查
node scripts/check-completeness.mjs output/hn-daily-2026-03-06-complete.md

# 构建 GitHub Pages 数据
npm run build:pages
```

## GitHub Pages 快速展示

本仓库已内置 `docs/` 站点：

- `docs/index.html`：浏览器页面
- `docs/data/index.json`：报告索引
- `docs/data/*.md|*.pdf`：日报文件

### 启用方式

1. 打开仓库 `Settings` → `Pages`
2. `Source` 选择 **Deploy from a branch**
3. Branch 选 **main**，Folder 选 **/docs**
4. 保存后等待部署

页面地址将为：

`https://levix.github.io/hn-daily-skill/`

## 发布流程（建议）

1. 生成当天 complete 报告：`output/hn-daily-YYYY-MM-DD-complete.md/pdf`
2. 执行 `npm run build:pages`
3. `git add . && git commit && git push`

这样 GitHub Pages 会自动展示最新日报。
