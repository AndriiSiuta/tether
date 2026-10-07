import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { listFiles, loadDenylist, scan } from './lib/neutrality.mjs';

const NAME = 'Jane' + ' Example';

function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'tether-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function scanRepo(root, patterns) {
  return scan({ root, files: listFiles(root), patterns });
}

test('a denylisted term is reported with its path and line', () => {
  const root = repo({ 'docs/a.md': 'first\nthe Acme portal\n', '.denylist': '# comment\n\nacme\n' });
  const findings = scanRepo(root, loadDenylist(join(root, '.denylist'))).filter((f) => f.path === 'docs/a.md');
  assert.deepEqual(findings, [{ path: 'docs/a.md', line: 2, check: 'denylist', match: 'Acme' }]);
});

test('manifest names and a LICENSE copyright line are exempt, the same name elsewhere is not', () => {
  const root = repo({
    '.claude-plugin/marketplace.json': JSON.stringify({ name: 'm', owner: { name: NAME } }, null, 2),
    'plugins/p/.claude-plugin/plugin.json': JSON.stringify({ name: 'p', author: { name: NAME } }, null, 2),
    'LICENSE': `MIT License\n\nCopyright (c) 2026 ${NAME}\n`,
    'README.md': `Written by ${NAME}\n`,
  });
  const findings = scanRepo(root, [new RegExp('jane', 'iu')]);
  assert.deepEqual(findings.map((f) => `${f.path}:${f.line}`), ['README.md:1']);
});

test('five digits after a hash are a ticket, an HTML entity and six digits are not', () => {
  const ticket = '#' + '12345';
  const root = repo({ 'a.md': `see ${ticket}\nentity &${'#'}12345;\nlong ${'#'}123456\n` });
  const findings = scanRepo(root, null);
  assert.deepEqual(findings, [{ path: 'a.md', line: 1, check: 'ticket', match: ticket }]);
});

test('an unknown scope is a finding and an allowed one is not', () => {
  const unknown = '@' + 'acme/';
  const root = repo({ 'a.ts': `import '${unknown}x';\nimport '${'@'}angular/core';\n` });
  const findings = scanRepo(root, null);
  assert.deepEqual(findings, [{ path: 'a.ts', line: 1, check: 'scope', match: unknown }]);
});

test('an untracked file is scanned and an ignored one is not', () => {
  const root = repo({ '.gitignore': 'secret.md\n', 'new.md': 'acme\n', 'secret.md': 'acme\n' });
  const paths = scanRepo(root, [/acme/iu]).map((f) => f.path);
  assert.deepEqual(paths, ['new.md']);
});

test('a binary file is skipped', () => {
  const root = repo({ 'bin.dat': Buffer.from([0x61, 0x63, 0x6d, 0x65, 0x00, 0x01]), 'a.md': 'ok\n' });
  assert.deepEqual(listFiles(root), ['a.md']);
});

test('a missing denylist gives null', () => {
  const root = mkdtempSync(join(tmpdir(), 'tether-'));
  assert.equal(loadDenylist(join(root, '.neutrality-denylist')), null);
});
