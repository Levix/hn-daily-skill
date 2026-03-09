#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const outputDir = join(root, 'output');

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const date = getArg('--date') || yesterday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`非法日期参数: ${date}（仅支持 YYYY-MM-DD）`);
  }
  const md = join(outputDir, `hn-daily-${date}-complete.md`);
  const pdf = join(outputDir, `hn-daily-${date}-complete.pdf`);

  console.log(`🔄 Sync daily report for ${date}`);

  if (!existsSync(md)) {
    throw new Error(`缺少完整版 Markdown: ${md}`);
  }
  if (!existsSync(pdf)) {
    throw new Error(`缺少完整版 PDF: ${pdf}`);
  }

  const { checkDocumentCompleteness } = await import('./check-completeness.mjs');
  const check = await checkDocumentCompleteness(md);
  if (!check.isComplete) {
    console.error('❌ 完整性检查未通过:');
    for (const issue of check.issues) console.error(` - ${issue}`);
    process.exit(1);
  }
  console.log('✅ 完整性检查通过');

  execSync('npm run build:pages', { stdio: 'inherit' });

  // 同步到仓库：complete 文档 + docs 页面数据
  // 注意：output/*.pdf 可能被 .gitignore 忽略，因此对 complete.pdf 强制 add
  execSync(`git add ${md} docs/data docs/index.html docs/app.js docs/styles.css scripts/build-pages.mjs`, { stdio: 'inherit' });
  execSync(`git add -f ${pdf}`, { stdio: 'inherit' });

  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (!status) {
    console.log('ℹ️ 没有变更需要提交');
    return;
  }

  execSync(`git commit -m "chore(daily): sync ${date} report to pages"`, { stdio: 'inherit' });
  execSync('git push origin main', { stdio: 'inherit' });

  console.log('🚀 已同步到 GitHub 并更新 docs（GitHub Pages）');
}

main().catch((err) => {
  console.error(`❌ sync failed: ${err.message}`);
  process.exit(1);
});
