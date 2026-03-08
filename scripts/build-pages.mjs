#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outputDir = join(root, 'output');
const docsDir = join(root, 'docs');
const dataDir = join(docsDir, 'data');

function extractMeta(md, fallbackFile) {
  const title = (md.match(/^#\s+(.+)$/m)?.[1] || fallbackFile).trim();
  const date = md.match(/日期[:：]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/)?.[1] ||
    (fallbackFile.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? 'unknown');
  const articleCount = Number(md.match(/文章数[:：]\s*(\d+)篇/)?.[1] || 0);
  return { title, date, articleCount };
}

async function main() {
  if (!existsSync(outputDir)) {
    throw new Error('output 目录不存在');
  }

  await mkdir(dataDir, { recursive: true });

  // 清理旧数据（仅清 data）
  const old = await readdir(dataDir).catch(() => []);
  await Promise.all(old.map(f => rm(join(dataDir, f), { force: true })));

  const files = await readdir(outputDir);
  const mdFiles = files
    .filter(f => f.endsWith('-complete.md'))
    .sort();

  const items = [];

  for (const f of mdFiles) {
    const full = join(outputDir, f);
    const md = await readFile(full, 'utf8');
    const meta = extractMeta(md, f);

    const slug = meta.date;
    const outMd = `${slug}.md`;
    await writeFile(join(dataDir, outMd), md, 'utf8');

    const pdfSrc = join(outputDir, f.replace(/\.md$/, '.pdf'));
    let pdf = null;
    if (existsSync(pdfSrc)) {
      const outPdf = `${slug}.pdf`;
      await copyFile(pdfSrc, join(dataDir, outPdf));
      pdf = `data/${outPdf}`;
    }

    items.push({
      date: meta.date,
      title: meta.title,
      articleCount: meta.articleCount,
      md: `data/${outMd}`,
      pdf
    });
  }

  items.sort((a,b)=> (a.date < b.date ? 1 : -1));

  await writeFile(join(dataDir, 'index.json'), JSON.stringify({ items, generatedAt: new Date().toISOString() }, null, 2), 'utf8');

  console.log(`✅ pages data built: ${items.length} day(s)`);
}

main().catch(err => {
  console.error('❌ build-pages failed:', err.message);
  process.exit(1);
});
