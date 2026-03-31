import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function createSyncFixture({ date, manifest }) {
  const tempRoot = await mkdtemp(join(tmpdir(), 'hn-daily-sync-pages-'));
  const remoteRoot = await mkdtemp(join(tmpdir(), 'hn-daily-sync-remote-'));
  const binDir = join(tempRoot, 'bin');
  const scriptsDir = join(tempRoot, 'scripts');
  const outputDir = join(tempRoot, 'output');
  const docsDataDir = join(tempRoot, 'docs', 'data');
  const remoteRepo = join(remoteRoot, 'origin.git');
  const sourceScript = await readFile(join(process.cwd(), 'scripts', 'sync-pages-and-push.mjs'), 'utf8');
  const realGit = spawnSync('/bin/zsh', ['-lc', 'command -v git'], {
    encoding: 'utf8'
  }).stdout.trim();

  await mkdir(binDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(docsDataDir, { recursive: true });

  await writeFile(join(scriptsDir, 'sync-pages-and-push.mjs'), sourceScript, 'utf8');
  await writeFile(join(scriptsDir, 'check-completeness.mjs'), `
export async function checkDocumentCompleteness() {
  return { isComplete: true, issues: [], stats: { articleCount: 10, sectionsFound: 5 } };
}
`, 'utf8');
  await writeFile(join(tempRoot, 'package.json'), JSON.stringify({ scripts: { 'build:pages': 'node scripts/build-pages.mjs' } }), 'utf8');
  await writeFile(join(scriptsDir, 'build-pages.mjs'), `
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

await mkdir(join(process.cwd(), 'docs', 'data'), { recursive: true });
await writeFile(join(process.cwd(), 'docs', 'data', 'index.json'), '[]', 'utf8');
await writeFile(join(process.cwd(), 'docs', 'index.html'), '<html></html>', 'utf8');
await writeFile(join(process.cwd(), 'docs', 'app.js'), 'console.log(\"ok\")', 'utf8');
await writeFile(join(process.cwd(), 'docs', 'styles.css'), 'body{}', 'utf8');
`, 'utf8');
  await writeFile(join(binDir, 'git'), `#!/bin/sh
REAL_GIT="${realGit}"
FIRST_PUSH_MARKER="${join(tempRoot, '.first-push-failed')}"

if [ "$SYNC_PAGES_FAIL_FIRST_PUSH" = "1" ] && [ "$1" = "push" ] && [ "$2" = "origin" ] && [ "$3" = "main" ]; then
  if [ ! -f "$FIRST_PUSH_MARKER" ]; then
    : > "$FIRST_PUSH_MARKER"
    echo "fatal: unable to access 'https://github.com/Levix/hn-daily-skill.git/': LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443 " >&2
    exit 128
  fi
fi

exec "$REAL_GIT" "$@"
`, 'utf8');
  spawnSync('chmod', ['+x', join(binDir, 'git')], { cwd: tempRoot, encoding: 'utf8' });

  spawnSync('git', ['init', '-b', 'main'], { cwd: tempRoot, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot, encoding: 'utf8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot, encoding: 'utf8' });
  spawnSync('git', ['init', '--bare', remoteRepo], { cwd: tempRoot, encoding: 'utf8' });
  spawnSync('git', ['remote', 'add', 'origin', remoteRepo], { cwd: tempRoot, encoding: 'utf8' });
  spawnSync('git', ['add', '.'], { cwd: tempRoot, encoding: 'utf8' });
  spawnSync('git', ['commit', '-m', 'init'], { cwd: tempRoot, encoding: 'utf8' });
  spawnSync('git', ['push', '-u', 'origin', 'main'], { cwd: tempRoot, encoding: 'utf8' });

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, `hn-daily-${date}-complete.md`), '# complete\n', 'utf8');
  await writeFile(join(outputDir, `hn-daily-${date}-complete.pdf`), Buffer.from([0x25, 0x50, 0x44, 0x46]));
  await writeFile(join(outputDir, `hn-daily-${date}-run.json`), JSON.stringify(manifest), 'utf8');

  return { tempRoot, remoteRoot, binDir };
}

test('sync-pages-and-push refuses reports whose run manifest is not completed', async () => {
  const date = '2099-05-06';
  const { tempRoot, remoteRoot } = await createSyncFixture({
    date,
    manifest: {
      date,
      status: 'failed',
      error: { message: 'summary failed after retries' }
    }
  });

  try {
    const result = spawnSync(process.execPath, ['scripts/sync-pages-and-push.mjs', '--date', date], {
      cwd: tempRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr + result.stdout, /run manifest/i);
    assert.match(result.stderr + result.stdout, /failed/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(remoteRoot, { recursive: true, force: true });
  }
});

test('sync-pages-and-push stages the completed run manifest alongside report artifacts', async () => {
  const date = '2099-05-07';
  const { tempRoot, remoteRoot } = await createSyncFixture({
    date,
    manifest: {
      date,
      status: 'completed'
    }
  });

  try {
    const result = spawnSync(process.execPath, ['scripts/sync-pages-and-push.mjs', '--date', date], {
      cwd: tempRoot,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr + result.stdout);
    const lastCommitFiles = spawnSync('git', ['show', '--name-only', '--pretty=format:'], {
      cwd: tempRoot,
      encoding: 'utf8'
    });
    assert.match(lastCommitFiles.stdout, new RegExp(`output/hn-daily-${date}-run.json`));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(remoteRoot, { recursive: true, force: true });
  }
});

test('sync-pages-and-push retries transient git push failures and eventually succeeds', async () => {
  const date = '2099-05-08';
  const { tempRoot, remoteRoot, binDir } = await createSyncFixture({
    date,
    manifest: {
      date,
      status: 'completed'
    }
  });

  try {
    const result = spawnSync(process.execPath, ['scripts/sync-pages-and-push.mjs', '--date', date], {
      cwd: tempRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        SYNC_PAGES_FAIL_FIRST_PUSH: '1'
      }
    });

    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout + result.stderr, /网络|push/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(remoteRoot, { recursive: true, force: true });
  }
});
