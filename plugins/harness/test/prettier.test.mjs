import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(PLUGIN_ROOT, 'scripts', 'prettier.sh');
const CONFIG = { formatSkip: ['docs/', '.claude/', 'NOTES.local.md'] };

let sandbox;
let fakeBin;
let log;

function makeProject(name, config = CONFIG) {
  const dir = join(sandbox, name);
  mkdirSync(dir, { recursive: true });
  if (config !== null) {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'harness.json'), JSON.stringify(config));
  }
  return dir;
}

function touch(dir, rel) {
  const path = join(dir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, 'x\n');
  return path;
}

function run(stdin, projectDir) {
  if (existsSync(log)) rmSync(log);
  return spawnSync('bash', [SCRIPT], {
    input: stdin,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fakeBin}:${dirname(process.execPath)}:${process.env.PATH}`,
      CLAUDE_PROJECT_DIR: projectDir,
      CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
    },
  });
}

function edit(path) {
  return JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path } });
}

function formatted() {
  return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
}

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'harness-')));
  fakeBin = join(sandbox, 'bin');
  log = join(sandbox, 'npx.log');
  mkdirSync(fakeBin);
  writeFileSync(join(fakeBin, 'npx'), `#!/usr/bin/env bash\necho "$*" >> "${log}"\n`);
  chmodSync(join(fakeBin, 'npx'), 0o755);
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test('a file inside the root is formatted', () => {
  const project = makeProject('allow');
  const file = touch(project, 'src/a.ts');
  const result = run(edit(file), project);
  assert.equal(result.status, 0);
  assert.deepEqual(formatted(), [`prettier --write --ignore-unknown --log-level warn ${file}`]);
});

test('a path under a prefix entry is never formatted', () => {
  const project = makeProject('prefix');
  for (const rel of ['docs/plan.md', '.claude/agents/x.md']) {
    assert.equal(run(edit(touch(project, rel)), project).status, 0);
    assert.deepEqual(formatted(), []);
  }
});

test('an exact entry matches the path only, not a prefix of it', () => {
  const project = makeProject('exact');
  assert.equal(run(edit(touch(project, 'NOTES.local.md')), project).status, 0);
  assert.deepEqual(formatted(), []);
  const other = touch(project, 'NOTES.local.md.bak/a.md');
  run(edit(other), project);
  assert.equal(formatted().length, 1);
  const lookalike = touch(project, 'mydocs/a.md');
  run(edit(lookalike), project);
  assert.equal(formatted().length, 1);
});

test('a file outside the root is never formatted', () => {
  const project = makeProject('outside');
  const file = touch(sandbox, 'elsewhere/a.ts');
  assert.equal(run(edit(file), project).status, 0);
  assert.deepEqual(formatted(), []);
});

test('no harness.json formats nothing and exits 0', () => {
  const project = makeProject('no-config', null);
  const result = run(edit(touch(project, 'src/a.ts')), project);
  assert.equal(result.status, 0);
  assert.deepEqual(formatted(), []);
});

test('an empty formatSkip formats every file inside the root', () => {
  const project = makeProject('empty-skip', { formatSkip: [] });
  run(edit(touch(project, 'docs/a.md')), project);
  assert.equal(formatted().length, 1);
});

test('malformed stdin, a missing field or a missing file exits 0 without formatting', () => {
  const project = makeProject('malformed');
  for (const stdin of ['{ nope', '', '[]', '{}', edit(join(project, 'missing.ts'))]) {
    const result = run(stdin, project);
    assert.equal(result.status, 0);
    assert.deepEqual(formatted(), []);
  }
});
