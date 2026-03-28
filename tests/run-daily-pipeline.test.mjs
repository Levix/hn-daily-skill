import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../scripts/run-daily-pipeline.mjs';

test('run-daily-pipeline generates complete artifacts before syncing pages', async () => {
  const calls = [];

  const result = await main({
    date: '2099-05-08',
    generateComplete: async ({ date }) => {
      calls.push(['generate', date]);
      return {
        completeMarkdownPath: `/tmp/hn-daily-${date}-complete.md`,
        completePdfPath: `/tmp/hn-daily-${date}-complete.pdf`,
        runManifestPath: `/tmp/hn-daily-${date}-run.json`
      };
    },
    syncPagesAndPush: async ({ date }) => {
      calls.push(['sync', date]);
    }
  });

  assert.deepEqual(calls, [
    ['generate', '2099-05-08'],
    ['sync', '2099-05-08']
  ]);
  assert.equal(result.completeMarkdownPath, '/tmp/hn-daily-2099-05-08-complete.md');
});
