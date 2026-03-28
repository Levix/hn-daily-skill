import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeRunManifest } from '../scripts/lib/run-manifest.mjs';

test('writeRunManifest persists JSON manifest to disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hn-daily-run-manifest-'));
  const path = join(dir, 'run.json');
  const manifest = { date: '2099-05-01', attempts: [{ index: 1, status: 'ok' }] };

  try {
    await writeRunManifest(path, manifest);
    const saved = JSON.parse(await readFile(path, 'utf8'));
    assert.deepEqual(saved, manifest);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
