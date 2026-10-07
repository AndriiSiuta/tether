// Fails when a committed file or a branch commit message carries a private term, a ticket reference or an unknown scope.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatFindings, listFiles, loadDenylist, scan, scanText } from './lib/neutrality.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DENYLIST = join(ROOT, '.neutrality-denylist');

test('A: no committed file carries a denylisted term', (t) => {
  const patterns = loadDenylist(DENYLIST);
  if (patterns === null) {
    t.skip('no .neutrality-denylist at the repo root: denylist check skipped');
    return;
  }
  const findings = scan({ root: ROOT, files: listFiles(ROOT), patterns }).filter((f) => f.check === 'denylist');
  assert.equal(findings.length, 0, formatFindings(findings));
});

test('B: no committed file carries a ticket reference or an unknown scope', () => {
  const findings = scan({ root: ROOT, files: listFiles(ROOT), patterns: null });
  assert.equal(findings.length, 0, formatFindings(findings));
});

test('C: branch commit messages carry no denylisted term or ticket reference', (t) => {
  const base = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'origin/main'], { cwd: ROOT });
  if (base.status !== 0) {
    t.skip('no origin/main: commit message check skipped');
    return;
  }
  const patterns = loadDenylist(DENYLIST);
  if (patterns === null) t.diagnostic('no .neutrality-denylist at the repo root: messages checked for tickets only');
  const log = execFileSync('git', ['log', '--format=%H%x00%B%x01', 'origin/main..HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const findings = log
    .split('\x01')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [sha, message] = entry.split('\0');
      return scanText(message, `commit ${sha.slice(0, 12)}`, patterns).filter((f) => f.check !== 'scope');
    });
  assert.equal(findings.length, 0, formatFindings(findings));
});
