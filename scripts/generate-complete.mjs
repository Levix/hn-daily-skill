#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDailyArticles } from './auto-digest.mjs';
import { checkDocumentCompleteness } from './check-completeness.mjs';
import { convertMarkdownToPDF } from './md-to-pdf.mjs';
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

function serializeError(error) {
  return {
    message: error.message,
    name: error.name
  };
}

export async function main(overrides = {}) {
  const options = { ...parseArgs(), ...overrides };
  const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
  const collect = options.collectDailyArticles || collectDailyArticles;
  const generate = options.generateArticleSummaryWithRetry || generateArticleSummaryWithRetry;
  const convert = options.convertMarkdownToPDF || convertMarkdownToPDF;

  if (!options.date) {
    throw new Error('date is required');
  }

  await mkdir(outputDir, { recursive: true });

  const collected = await collect({ date: options.date });
  const articles = [];
  const attempts = [];

  for (let index = 0; index < collected.articles.length; index += 1) {
    const article = collected.articles[index];
    try {
      const summary = await generate({ article, content: article.content, retries: 2 });
      articles.push({ ...article, summary });
      attempts.push({ index, title: article.title, status: 'success' });
    } catch (error) {
      const runManifestPath = getPath(outputDir, collected.date, 'run.json');
      attempts.push({
        index,
        title: article.title,
        status: 'failed',
        error: serializeError(error)
      });
      await writeRunManifest(runManifestPath, {
        date: collected.date,
        articleCount: articles.length,
        status: 'failed',
        attempts,
        error: serializeError(error)
      });
      throw error;
    }
  }

  const markdown = renderCompleteReport({ date: collected.date, articles });
  const completeMarkdownPath = getPath(outputDir, collected.date, 'complete.md');
  const runManifestPath = getPath(outputDir, collected.date, 'run.json');

  await writeFile(completeMarkdownPath, markdown, 'utf8');
  const completeness = await checkDocumentCompleteness(completeMarkdownPath);

  if (!completeness.isComplete) {
    const error = new Error(`completeness check failed: ${completeness.issues.join('; ')}`);
    await writeRunManifest(runManifestPath, {
      date: collected.date,
      articleCount: articles.length,
      status: 'failed',
      attempts,
      completeness,
      error: serializeError(error)
    });
    throw error;
  }

  const completePdfPath = await convert(completeMarkdownPath, {
    title: `HN Daily Complete Report - ${collected.date}`
  });

  await writeRunManifest(runManifestPath, {
    date: collected.date,
    articleCount: articles.length,
    status: 'completed',
    attempts,
    completeness,
    completePdfPath
  });

  return {
    articleCount: articles.length,
    completeMarkdownPath,
    runManifestPath,
    completeness,
    completePdfPath
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`❌ generate-complete failed: ${error.message}`);
    process.exit(1);
  });
}
