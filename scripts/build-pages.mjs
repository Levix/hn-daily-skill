#!/usr/bin/env node
import { readdir, readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const outputDir = join(root, 'output');
const docsDataDir = join(root, 'docs', 'data');

function extractDate(name) {
  const m = name.match(/hn-daily-(\d{4}-\d{2}-\d{2})-complete\.md$/);
  return m ? m[1] : null;
}

async function main() {
  await mkdir(docsDataDir, { recursive: true });
  if (!existsSync(outputDir)) throw new Error('output 目录不存在');

  const files = await readdir(outputDir);
  const mdFiles = files.filter(f => f.endsWith('-complete.md')).sort().reverse();

  const items = [];
  for (const md of mdFiles) {
    const date = extractDate(md);
    if (!date) continue;
    const pdf = `hn-daily-${date}-complete.pdf`;
    if (!files.includes(pdf)) continue;

    const mdPath = join(outputDir, md);
    const pdfPath = join(outputDir, pdf);

    const text = await readFile(mdPath, 'utf-8');
    const articleCount = (text.match(/## \d+\./g) || []).length;

    await copyFile(mdPath, join(docsDataDir, md));
    await copyFile(pdfPath, join(docsDataDir, pdf));

    items.push({ date, md, pdf, articleCount });
  }

  await writeFile(
    join(docsDataDir, 'index.json'),
    JSON.stringify({ updatedAt: new Date().toISOString(), items }, null, 2),
    'utf-8'
  );

  console.log(`✅ Pages 数据已构建：${items.length} 条`);
}

main().catch(err => {
  console.error('❌ build-pages 失败:', err.message);
  process.exit(1);
});