#!/usr/bin/env node

import { main as generateCompleteMain } from './generate-complete.mjs';
import { main as syncPagesAndPushMain } from './sync-pages-and-push.mjs';

function parseArgs(argv = process.argv.slice(2)) {
  const getArg = (flag) => {
    const index = argv.indexOf(flag);
    return index !== -1 && index + 1 < argv.length ? argv[index + 1] : null;
  };

  return {
    date: getArg('--date'),
    help: argv.includes('--help') || argv.includes('-h')
  };
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function main(overrides = {}) {
  const options = { ...parseArgs(), ...overrides };
  const date = options.date || yesterday();
  const generateComplete = options.generateComplete || generateCompleteMain;
  const syncPagesAndPush = options.syncPagesAndPush || syncPagesAndPushMain;

  if (options.help) {
    console.log(`
HN Daily Daily Pipeline

用法: node run-daily-pipeline.mjs [选项]

选项:
  --date <YYYY-MM-DD>  指定日期（默认前一天）
  --help, -h           显示帮助
`);
    return null;
  }

  const result = await generateComplete({ date });
  const syncDate = result?.date || date;
  await syncPagesAndPush({ date: syncDate });
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`❌ daily pipeline failed: ${error.message}`);
    process.exit(1);
  });
}
