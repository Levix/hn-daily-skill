#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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

function getExecErrorDetails(error) {
  return [error?.stdout, error?.stderr, error?.message]
    .filter(Boolean)
    .join('\n');
}

function isNonFastForwardError(details) {
  return /non-fast-forward|fetch first|rejected/i.test(details);
}

function isTransientPushError(details) {
  return /SSL_ERROR_SYSCALL|Connection timed out|Could not resolve host|Failed to connect|Connection reset|Connection refused|remote end hung up unexpectedly|unexpected disconnect|RPC failed|HTTP\/2 stream .* was not closed cleanly|Operation timed out/i.test(details);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function main(overrides = {}) {
  const date = overrides.date || getArg('--date') || yesterday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`非法日期参数: ${date}（仅支持 YYYY-MM-DD）`);
  }
  const md = join(outputDir, `hn-daily-${date}-complete.md`);
  const pdf = join(outputDir, `hn-daily-${date}-complete.pdf`);
  const runManifestPath = join(outputDir, `hn-daily-${date}-run.json`);

  console.log(`🔄 Sync daily report for ${date}`);

  if (!existsSync(md)) {
    throw new Error(`缺少完整版 Markdown: ${md}`);
  }
  if (!existsSync(pdf)) {
    throw new Error(`缺少完整版 PDF: ${pdf}`);
  }
  if (!existsSync(runManifestPath)) {
    throw new Error(`缺少 run manifest: ${runManifestPath}`);
  }

  const runManifest = JSON.parse(await readFile(runManifestPath, 'utf8'));
  if (runManifest.status !== 'completed') {
    throw new Error(`run manifest 状态不是 completed: ${runManifest.status || 'unknown'}`);
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
  execSync(`git add ${md} ${runManifestPath} docs/data docs/index.html docs/app.js docs/styles.css scripts/build-pages.mjs`, { stdio: 'inherit' });
  execSync(`git add -f ${pdf}`, { stdio: 'inherit' });

  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (!status) {
    console.log('ℹ️ 没有变更需要提交');
    return;
  }

  execSync(`git commit -m "chore(daily): sync ${date} report to pages"`, { stdio: 'inherit' });

  const maxPushAttempts = 3;
  let attempt = 1;

  while (attempt <= maxPushAttempts) {
    try {
      execSync('git push origin main', { stdio: 'pipe', encoding: 'utf8' });
      break;
    } catch (pushError) {
      const pushDetails = getExecErrorDetails(pushError);

      if (isNonFastForwardError(pushDetails)) {
        console.log('⚠️ push 被拒绝（远端领先），尝试先同步远端再重试...');
        try {
          execSync('git pull --rebase origin main', { stdio: 'inherit' });
        } catch (rebaseError) {
          try {
            execSync('git rebase --abort', { stdio: 'inherit' });
          } catch {
            // ignore abort failure when no rebase is active
          }
          throw new Error(`同步远端并 rebase 失败，请手动处理冲突后重试：${rebaseError.message}`);
        }

        continue;
      }

      if (!isTransientPushError(pushDetails) || attempt === maxPushAttempts) {
        throw pushError;
      }

      console.log(`⚠️ git push 遇到瞬时网络错误，准备重试（${attempt}/${maxPushAttempts - 1}）...`);
      await sleep(attempt * 1000);
      attempt += 1;
    }
  }

  console.log('🚀 已同步到 GitHub 并更新 docs（GitHub Pages）');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`❌ sync failed: ${err.message}`);
    process.exit(1);
  });
}
