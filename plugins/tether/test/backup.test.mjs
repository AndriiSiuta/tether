import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupName, existingPaths, pickEncryptor, rotate } from '../scripts/backup.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'backup.mjs');
const LOCAL_ONLY = ['private/notes', 'private/rules', 'missing/dir', 'LOCAL.md'];
const FAKE = `#!${process.execPath}
const { createWriteStream } = require('node:fs');
const args = process.argv.slice(2);
process.stdin.pipe(createWriteStream(args[args.indexOf('--output') + 1]));
`;

let sandbox;
let tools;
let ageBin;
let gpgBin;
let counter = 0;

function fresh(name) {
  const dir = join(sandbox, `${name}-${counter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function fakeBin(name) {
  const dir = fresh(`${name}-bin`);
  writeFileSync(join(dir, name), FAKE);
  chmodSync(join(dir, name), 0o755);
  return dir;
}

function makeProject() {
  const root = fresh('project');
  mkdirSync(join(root, '.claude'));
  writeFileSync(join(root, '.claude', 'harness.json'), JSON.stringify({ localOnlyPaths: LOCAL_ONLY }));
  mkdirSync(join(root, 'private', 'notes'), { recursive: true });
  mkdirSync(join(root, 'private', 'rules'), { recursive: true });
  writeFileSync(join(root, 'private', 'notes', 'a.md'), 'a');
  writeFileSync(join(root, 'private', 'rules', 'b.md'), 'b');
  writeFileSync(join(root, 'LOCAL.md'), 'local');
  return root;
}

function runCli(args, pathDirs) {
  const env = { ...process.env, PATH: pathDirs.join(delimiter), HOME: fresh('home') };
  delete env.CLAUDE_PROJECT_DIR;
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env });
}

before(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'harness-'));
  tools = fresh('tools');
  for (const tool of ['tar', 'gzip']) {
    symlinkSync(execFileSync('which', [tool], { encoding: 'utf8' }).trim(), join(tools, tool));
  }
  ageBin = fakeBin('age');
  gpgBin = fakeBin('gpg');
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test('pickEncryptor prefers age, falls back to gpg, and finds neither on an empty PATH', () => {
  assert.equal(pickEncryptor([gpgBin, ageBin].join(delimiter)).command, 'age');
  assert.equal(pickEncryptor(gpgBin).command, 'gpg');
  assert.equal(pickEncryptor(tools), undefined);
  assert.equal(pickEncryptor(undefined), undefined);
});

test('existingPaths keeps only the localOnlyPaths present under the root', () => {
  assert.deepEqual(existingPaths(makeProject(), LOCAL_ONLY), ['private/notes', 'private/rules', 'LOCAL.md']);
  assert.deepEqual(existingPaths(makeProject(), undefined), []);
});

test('backupName dates the file by the local day and the encryptor', () => {
  assert.equal(backupName(new Date(2026, 0, 5, 23, 59), 'age'), 'harness-2026-01-05.tar.gz.age');
});

test('rotate keeps the newest 10 backups by name and leaves other files alone', () => {
  const dir = fresh('rotate');
  for (let day = 1; day <= 12; day += 1) writeFileSync(join(dir, `harness-2026-01-${String(day).padStart(2, '0')}.tar.gz.age`), '');
  writeFileSync(join(dir, 'notes.txt'), '');
  assert.deepEqual(rotate(dir), ['harness-2026-01-02.tar.gz.age', 'harness-2026-01-01.tar.gz.age']);
  const left = readdirSync(dir).toSorted();
  assert.equal(left.length, 11);
  assert.equal(left[0], 'harness-2026-01-03.tar.gz.age');
  assert.ok(left.includes('notes.txt'));
});

test('a run with age first on PATH writes a .age archive of the existing paths', () => {
  const root = makeProject();
  const dir = join(fresh('out'), 'backups');
  const result = runCli(['--dir', dir, '--project', root], [ageBin, gpgBin, tools]);
  assert.equal(result.status, 0, result.stderr);
  const files = readdirSync(dir);
  assert.equal(files.length, 1);
  assert.match(files[0], /^harness-\d{4}-\d{2}-\d{2}\.tar\.gz\.age$/);
  const listed = execFileSync('tar', ['-tzf', join(dir, files[0])], { encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.ok(listed.includes('private/notes/a.md'));
  assert.ok(listed.includes('private/rules/b.md'));
  assert.ok(listed.includes('LOCAL.md'));
  assert.ok(!listed.some((entry) => entry.startsWith('missing')));
});

test('a run without age falls back to gpg', () => {
  const dir = fresh('out');
  const result = runCli(['--dir', dir, '--project', makeProject()], [gpgBin, tools]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(readdirSync(dir)[0], /\.tar\.gz\.gpg$/);
});

test('a run with neither age nor gpg refuses and writes nothing', () => {
  const dir = join(fresh('out'), 'backups');
  const result = runCli(['--dir', dir, '--project', makeProject()], [tools]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /neither age nor gpg/);
  assert.throws(() => readdirSync(dir));
});

test('a run rotates the folder down to 10 backups', () => {
  const dir = fresh('out');
  for (let day = 1; day <= 10; day += 1) writeFileSync(join(dir, `harness-2000-01-${String(day).padStart(2, '0')}.tar.gz.age`), '');
  const result = runCli(['--dir', dir, '--project', makeProject()], [ageBin, tools]);
  assert.equal(result.status, 0, result.stderr);
  const left = readdirSync(dir);
  assert.equal(left.length, 10);
  assert.ok(!left.includes('harness-2000-01-01.tar.gz.age'));
});

test('a missing or empty --dir, or a project without harness.json, exits 1', () => {
  const missing = runCli(['--project', makeProject()], [ageBin, tools]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /pass the backup directory/);
  assert.equal(runCli(['--dir', '', '--project', makeProject()], [ageBin, tools]).status, 1);
  const bare = runCli(['--dir', fresh('out'), '--project', fresh('bare')], [ageBin, tools]);
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /no \.claude\/harness\.json/);
});
