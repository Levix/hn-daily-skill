import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const docsRoot = resolve('docs');

function contentTypeFor(filePath) {
  const ext = extname(filePath);

  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.pdf') return 'application/pdf';

  return 'application/octet-stream';
}

async function withDocsServer(run) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const filePath = normalize(join(docsRoot, relativePath));

    if (!filePath.startsWith(docsRoot)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }

    try {
      const body = await readFile(filePath);
      res.writeHead(200, { 'content-type': contentTypeFor(filePath) });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });

  await new Promise(resolvePromise => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise(resolvePromise => server.close(resolvePromise));
  }
}

test('desktop layout keeps sidebar fixed while content scrolls independently', async () => {
  await withDocsServer(async baseUrl => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await page.addInitScript(() => {
      window.marked = { parse: input => input };
      window.DOMPurify = { sanitize: input => input };
    });

    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.waitForSelector('#list button');
      await page.waitForFunction(() => document.getElementById('content').textContent !== '加载中...');

      const before = await page.evaluate(() => {
        const header = document.querySelector('header');
        const main = document.querySelector('main');
        const aside = document.querySelector('aside');
        const section = document.querySelector('section');

        return {
          windowScrollY: window.scrollY,
          mainHeight: getComputedStyle(main).height,
          asideTop: aside.getBoundingClientRect().top,
          headerBottom: header.getBoundingClientRect().bottom,
          sectionClientHeight: section.clientHeight,
          sectionScrollHeight: section.scrollHeight,
          sectionScrollTop: section.scrollTop
        };
      });

      await page.evaluate(() => {
        const section = document.querySelector('section');
        section.scrollTop = 400;
      });

      const after = await page.evaluate(() => {
        const aside = document.querySelector('aside');
        const section = document.querySelector('section');

        return {
          windowScrollY: window.scrollY,
          asideTop: aside.getBoundingClientRect().top,
          asideScrollTop: aside.scrollTop,
          sectionScrollTop: section.scrollTop
        };
      });

      assert.ok(before.sectionScrollHeight > before.sectionClientHeight, 'section should be scrollable on desktop');
      assert.equal(before.windowScrollY, 0);
      assert.ok(Math.abs(before.asideTop - before.headerBottom) <= 1, 'sidebar should sit directly below header');
      assert.equal(after.windowScrollY, 0, 'desktop content scroll should not move the document');
      assert.equal(after.asideScrollTop, 0, 'content scrolling should not scroll the sidebar');
      assert.equal(after.asideTop, before.asideTop, 'sidebar top should stay fixed while content scrolls');
      assert.ok(after.sectionScrollTop > before.sectionScrollTop, 'content section should maintain its own scroll position');
      assert.notEqual(before.mainHeight, 'auto');
    } finally {
      await page.close();
      await browser.close();
    }
  });
});

test('mobile layout keeps a single column with horizontal date cards', async () => {
  await withDocsServer(async baseUrl => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    await page.addInitScript(() => {
      window.marked = { parse: input => input };
      window.DOMPurify = { sanitize: input => input };
    });

    try {
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.waitForSelector('#list button');

      const mobileLayout = await page.evaluate(() => {
        const main = document.querySelector('main');
        const list = document.getElementById('list');

        return {
          bodyOverflow: getComputedStyle(document.body).overflow,
          mainColumns: getComputedStyle(main).gridTemplateColumns,
          listDisplay: getComputedStyle(list).display,
          listOverflowX: getComputedStyle(list).overflowX
        };
      });

      assert.equal(mobileLayout.bodyOverflow, 'visible');
      assert.equal(mobileLayout.mainColumns, '390px');
      assert.equal(mobileLayout.listDisplay, 'flex');
      assert.equal(mobileLayout.listOverflowX, 'auto');
    } finally {
      await page.close();
      await browser.close();
    }
  });
});
