# HN Daily Skill - 上库指南

## 📦 本地仓库已准备就绪

本地 Git 仓库位于：
```
/Users/leeeeeee/.openclaw/workspace-discord/skills/hn-daily-skill
```

## 🚀 手动推送到 GitHub

由于 Token 权限限制，请执行以下命令手动上库：

### 方法 1: 使用 HTTPS + Token

```bash
cd /Users/leeeeeee/.openclaw/workspace-discord/skills/hn-daily-skill

# 配置远程仓库（使用你的 Token）
# 请将 YOUR_TOKEN 替换为你的实际 Token
git remote add origin https://YOUR_TOKEN@github.com/Levix/hn-daily-skill.git

# 推送到 GitHub
git push -u origin main
```

### 方法 2: 使用 SSH（推荐）

如果你已配置 SSH 密钥：

```bash
cd /Users/leeeeeee/.openclaw/workspace-discord/skills/hn-daily-skill

# 配置远程仓库
git remote add origin git@github.com:Levix/hn-daily-skill.git

# 推送到 GitHub
git push -u origin main
```

### 方法 3: GitHub Desktop / VSCode

1. 打开 GitHub Desktop 或 VSCode
2. 添加本地仓库：`/Users/leeeeeee/.openclaw/workspace-discord/skills/hn-daily-skill`
3. 配置远程仓库：`https://github.com/Levix/hn-daily-skill`
4. 点击 "Push"

---

## 📋 仓库内容

推送后，GitHub 仓库将包含：

```
hn-daily-skill/
├── .gitignore              # Git 忽略配置
├── SKILL.md                # 技能主文档（含经验沉淀）
├── QUICK_REFERENCE.md      # 快速参考手册
├── package.json            # Node.js 依赖配置
├── scripts/
│   ├── auto-digest-pdf.mjs     # ⭐ 推荐脚本（PDF 默认）
│   ├── auto-digest.mjs         # 自动化脚本
│   ├── fetch-daily.mjs         # 基础获取脚本
│   └── md-to-pdf.mjs           # PDF 转换工具
└── README.md               # GitHub 首页说明（待创建）
```

---

## 🔧 推送后配置

### 1. 添加 README.md

推送后，建议在 GitHub 上添加 README.md：

```markdown
# HN Daily Skill

自动获取 Hacker News Daily 每日精选，生成专业的 PDF 报告。

## 功能

- 🔥 自动获取 HN Daily Top 10 文章
- 📄 生成 PDF/Markdown/HTML 报告
- 🤖 支持定时自动推送
- 💬 完整的中文内容总结

## 快速开始

```bash
cd ~/.openclaw/workspace-discord/skills/hn-daily-skill
node scripts/auto-digest-pdf.mjs
```

## 文档

- [SKILL.md](./SKILL.md) - 完整使用文档
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - 快速参考

## License

MIT
```

### 2. 配置 GitHub Actions（可选）

可以配置 GitHub Actions 自动生成每日报告：

```yaml
# .github/workflows/daily.yml
name: HN Daily

on:
  schedule:
    - cron: '0 9 * * *'  # 每天早上 9:00

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node scripts/auto-digest-pdf.mjs
```

---

## ⚠️ 注意事项

1. **Token 安全**: 提供的 Token 仅在本次使用，建议推送后删除或刷新
2. **依赖安装**: 首次使用前需要运行 `npm install`
3. **定时任务**: 定时任务配置在 OpenClaw 中，不在 GitHub 上

---

## 📞 后续更新

后续所有更新（包括内容生成）都需要：

1. 在本地生成新内容
2. 提交到 Git 仓库
3. 推送到 GitHub

```bash
cd ~/.openclaw/workspace-discord/skills/hn-daily-skill

# 生成新内容
node scripts/auto-digest-pdf.mjs --date $(date +%Y-%m-%d)

# 提交到 Git
git add .
git commit -m "Update: $(date +%Y-%m-%d) daily report"

# 推送到 GitHub
git push origin main
```

---

*上库指南 v1.0* · HN Daily Skill
