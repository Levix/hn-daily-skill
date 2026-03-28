#!/usr/bin/env node
/**
 * HN Daily 完整报告包装脚本
 *
 * 统一调用 generate-complete，供 cron 直接使用。
 */

import { copyFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { main as generateComplete } from './generate-complete.mjs';
import { convertMarkdownToPDF } from './md-to-pdf.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  return {
    date: getArg('--date'),
    format: getArg('--format') || 'pdf',
    channel: getArg('--channel'),
    skipCheck: args.includes('--skip-check'),
    help: args.includes('--help') || args.includes('-h')
  };
}

function getDefaultDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function resolveOutputPath(result, options) {
  if (options.format === 'md') {
    return result.completeMarkdownPath;
  }

  if (options.format === 'html') {
    return convertMarkdownToPDF(result.completeMarkdownPath, {
      format: 'html',
      title: `HN Daily ${options.date}`
    });
  }

  if (!result.completePdfPath) {
    throw new Error('complete pdf artifact is missing');
  }

  return result.completePdfPath;
}

async function maybeCopyForChannel(outputPath, options) {
  if (!options.channel) {
    return;
  }

  const filename = basename(outputPath);
  await copyFile(outputPath, `./${filename}`);

  console.log('\n💡 请执行以下命令发送文件:');
  console.log(`   message --action send --filePath "./${filename}" --filename "${filename}" --message "📄 HN Daily ${options.date} 完整总结"`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    console.log(`
HN Daily Auto - 完整报告包装脚本

用法: node auto-digest-pdf.mjs [选项]

选项:
  --date <YYYY-MM-DD>     指定日期（默认前一天）
  --format <pdf|md|html>  输出格式 [默认: pdf]
  --channel <id>          Discord 频道 ID
  --skip-check            保留兼容参数，当前无效果
  --help, -h              显示帮助
`);
    return;
  }

  const date = options.date || getDefaultDate();
  options.date = date;

  console.log('🚀 HN Daily Auto (Complete Edition)\n');
  console.log(`📅 日期: ${date}（默认前一天）`);
  console.log(`📄 输出格式: ${options.format.toUpperCase()}`);
  if (options.skipCheck) {
    console.log('ℹ️  generate-complete 始终执行完整性检查，--skip-check 当前无效果');
  }

  const result = await generateComplete({ date });
  const outputPath = await resolveOutputPath(result, options);

  console.log(`\n✅ 完成: ${outputPath}`);

  await maybeCopyForChannel(outputPath, options);

  console.log('\n✅ 流程完成');
}

main().catch((error) => {
  console.error(`❌ 流程失败: ${error.message}`);
  process.exit(1);
});
