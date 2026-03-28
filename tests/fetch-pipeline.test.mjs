import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDailyArticles } from '../scripts/auto-digest.mjs';

function makeResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return body;
    }
  };
}

test('collectDailyArticles returns parsed articles with fetched content', async () => {
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async (url) => {
    calls += 1;

    if (String(url).endsWith('/2099-05-01.html')) {
      return makeResponse('<li><a href="https://example.com/a">A</a> <a href="https://news.ycombinator.com/item?id=1">(comments)</a></li>');
    }

    if (String(url) === 'https://example.com/a') {
      return makeResponse('<article>Hello world</article>');
    }

    throw new Error(`unexpected fetch: ${url}`);
  };

  try {
    const result = await collectDailyArticles({ date: '2099-05-01', maxArticles: 10 });

    assert.equal(result.articles.length, 1);
    assert.equal(result.articles[0].title, 'A');
    assert.equal(result.articles[0].content, 'Hello world');
    assert.equal(calls >= 2, true);
  } finally {
    global.fetch = originalFetch;
  }
});
