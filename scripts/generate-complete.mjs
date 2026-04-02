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

function shiftDate(dateString, deltaDays) {
  const base = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    throw new Error(`invalid date: ${dateString}`);
  }

  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

function isHttp404(error) {
  const message = String(error?.message || '');
  return /\b404\b/.test(message) || /HTTP\s*404/i.test(message);
}

async function collectDailyArticlesWithFallback({ date, collect, fallbackDays }) {
  let lastError;

  for (let offset = 0; offset <= fallbackDays; offset += 1) {
    const candidateDate = shiftDate(date, -offset);
    try {
      const collected = await collect({ date: candidateDate });
      return { collected, fallbackOffset: offset };
    } catch (error) {
      lastError = error;
      const canFallback = offset < fallbackDays && isHttp404(error);
      if (!canFallback) {
        throw error;
      }
    }
  }

  throw lastError || new Error('collect failed with unknown reason');
}

function normalizeGeneratedText(value) {
  return String(value || '')
    .replace(/待补充/g, '待完善')
    .replace(/TODO/gi, '后续完善')
    .replace(/FIXME/gi, '后续完善')
    .trim();
}

function normalizeSummary(summary) {
  return {
    ...summary,
    chineseTitle: normalizeGeneratedText(summary.chineseTitle),
    oneLiner: normalizeGeneratedText(summary.oneLiner),
    abstract: normalizeGeneratedText(summary.abstract),
    techInsight: normalizeGeneratedText(summary.techInsight),
    whyHot: normalizeGeneratedText(summary.whyHot),
    keyPoints: (summary.keyPoints || []).map(normalizeGeneratedText)
  };
}

export async function main(overrides = {}) {
  const options = { ...parseArgs(), ...overrides };
  const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
  const collect = options.collectDailyArticles || collectDailyArticles;
  const generate = options.generateArticleSummaryWithRetry || generateArticleSummaryWithRetry;
  const convert = options.convertMarkdownToPDF || convertMarkdownToPDF;
  const fallbackDays = Number.isInteger(options.fallbackDays) ? options.fallbackDays : 3;

  if (!options.date) {
    throw new Error('date is required');
  }

  await mkdir(outputDir, { recursive: true });

  const { collected, fallbackOffset } = await collectDailyArticlesWithFallback({
    date: options.date,
    collect,
    fallbackDays
  });
  const articles = [];
  const attempts = [];

  for (let index = 0; index < collected.articles.length; index += 1) {
    const article = collected.articles[index];
    try {
      const summary = await generate({ article, content: article.content, retries: 2 });
      const normalizedSummary = normalizeSummary(summary);
      articles.push({ ...article, summary: normalizedSummary });
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
    date: collected.date,
    requestedDate: options.date,
    fallbackOffset,
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
