# hn-daily-skill 安全与隐私检查（2026-03-09）

## 结论（TL;DR）
- 当前仓库 **未发现明文 Token/密钥**（已做模式扫描）
- 存在 3 个需要修复的中风险问题，已完成修复：
  1. Git bundle 文件被跟踪（可能包含历史敏感对象）
  2. Pages 端 Markdown 渲染未做 HTML 清洗（XSS 风险）
  3. `sync-pages-and-push` 日期参数未校验（命令注入面）

---

## 检查范围
- 代码与脚本：`scripts/*.mjs`
- 页面前端：`docs/*`
- 已跟踪文件清单：`git ls-files`
- 敏感信息扫描关键字：`github_pat_` / `ghp_` / `AKIA...` / `PRIVATE KEY` / `token` 等

---

## 发现与处置

### 1) Git bundle 文件被跟踪（中风险）
**问题**
- `hn-daily-skill.bundle` 曾被纳入仓库跟踪。
- bundle 可能携带历史对象，存在间接泄露风险与仓库膨胀风险。

**处置**
- 从 Git 跟踪移除 bundle 文件。
- `.gitignore` 新增：`*.bundle`。

---

### 2) Pages Markdown 渲染未清洗（中风险）
**问题**
- `docs/app.js` 使用 `marked.parse(md)` 直接注入 `innerHTML`。
- 若 Markdown 内容中含恶意 HTML，可能触发 XSS（Pages 访问者风险）。

**处置**
- `docs/index.html` 引入 DOMPurify。
- `docs/app.js` 改为：`DOMPurify.sanitize(marked.parse(md))` 后再注入。

---

### 3) 同步脚本日期参数未校验（中风险）
**问题**
- `scripts/sync-pages-and-push.mjs` 的 `--date` 参数直接拼接到 shell 命令上下文。
- 在恶意输入场景存在注入面。

**处置**
- 增加白名单校验：仅允许 `YYYY-MM-DD`。
- 不符合格式则立即失败退出。

---

## 隐私/合规提醒（非代码漏洞）
- 报告中含外链与摘要，通常可接受；但若未来引入“整段原文拷贝”，需注意版权合规风险。
- 建议保持“摘要化输出”策略，并保留来源链接。

---

## 建议的持续防护
1. 增加 pre-commit secret scan（如 gitleaks）
2. PR/CI 增加安全检查步骤：
   - secret pattern scan
   - docs 渲染安全检查（必须带 DOMPurify）
3. 继续执行“complete 文档硬门禁”后再发布

---

## 修复状态
- [x] bundle 文件去跟踪 + ignore
- [x] Pages 渲染加 DOMPurify
- [x] 日期参数格式校验
- [ ]（可选）CI 加 gitleaks / trivy secret 扫描
