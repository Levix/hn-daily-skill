#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDailyArticles } from './auto-digest.mjs';
import { checkDocumentCompleteness } from './check-completeness.mjs';
import { generateArticleSummaryWithRetry } from './lib/providers/openclaw-agent.mjs';
import { renderCompleteReport } from './lib/renderers/render-complete-report.mjs';
import { writeRunManifest } from './lib/run-manifest.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = join(__dirname, '..', 'output');

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

function getPath(outputDir, date, suffix) {
  return join(outputDir, `hn-daily-${date}-${suffix}`);
}

export async function main(overrides = {}) {
  const options = { ...parseArgs(), ...overrides };
  const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
  const collect = options.collectDailyArticles || collectDailyArticles;
  const generate = options.generateArticleSummaryWithRetry || generateArticleSummaryWithRetry;

  if (!options.date) {
    throw new Error('date is required');
  }

  await mkdir(outputDir, { recursive: true });

  const collected = await collect({ date: options.date });
  const articles = [];
  const attempts = [];

  for (let index = 0; index < collected.articles.length; index += 1) {
    const article = collected.articles[index];
    const summary = await generate({ article, content: article.content, retries: 2 });
    articles.push({ ...article, summary });
    attempts.push({ index, title: article.title, status: 'success' });
  }

  const markdown = renderCompleteReport({ date: collected.date, articles });
  const completeMarkdownPath = getPath(outputDir, collected.date, 'complete.md');
  const runManifestPath = getPath(outputDir, collected.date, 'run.json');

  await writeFile(completeMarkdownPath, markdown, 'utf8');
  const completeness = await checkDocumentCompleteness(completeMarkdownPath);
  await writeRunManifest(runManifestPath, {
    date: collected.date,
    articleCount: articles.length,
    attempts,
    completeness
  });

  return {
    articleCount: articles.length,
    completeMarkdownPath,
    runManifestPath,
    completeness
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`❌ generate-complete failed: ${error.message}`);
    process.exit(1);
  });
}
