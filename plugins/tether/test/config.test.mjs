import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findConfig, loadHookContext, loadSecurityContext } from '../scripts/lib/config.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'lib', 'config.mjs');
const CONFIG = {
  protectedBranches: ['main'],
  localOnlyPaths: ['docs/private', '.claude/agents'],
  spec: { dir: 'docs/specs', maxWords: 1500 },
};

let sandbox;

function git(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function makeRepo(name, config) {
  const dir = join(sandbox, name);
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'README'), 'x\n');
  git(dir, 'add', 'README');
  git(dir, 'commit', '-q', '-m', 'init');
  if (config !== undefined) writeConfig(dir, config);
  return dir;
}

function writeConfig(dir, content) {
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'harness.json'), typeof content === 'string' ? content : JSON.stringify(content));
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: process.env });
}

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'harness-')));
  const home = join(sandbox, 'home');
  mkdirSync(home);
  process.env.HOME = home;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GIT_AUTHOR_NAME = process.env.GIT_COMMITTER_NAME = 'Test';
  process.env.GIT_AUTHOR_EMAIL = process.env.GIT_COMMITTER_EMAIL = 'test@example.com';
  delete process.env.CLAUDE_PROJECT_DIR;
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test('finds the config at the git toplevel from a sub-directory', () => {
  const repo = makeRepo('toplevel', CONFIG);
  const sub = join(repo, 'a', 'b');
  mkdirSync(sub, { recursive: true });
  assert.deepEqual(findConfig(sub), { root: repo, config: CONFIG });
});

test('a linked worktree without its own config finds the main worktree file', () => {
  const repo = makeRepo('linked', CONFIG);
  const worktree = join(sandbox, 'linked-wt');
  git(repo, 'worktree', 'add', '-q', '-b', 'feature', worktree);
  assert.deepEqual(findConfig(worktree), { root: repo, config: CONFIG });
});

test('a linked worktree with its own config prefers it', () => {
  const repo = makeRepo('linked-own', CONFIG);
  const worktree = join(sandbox, 'linked-own-wt');
  git(repo, 'worktree', 'add', '-q', '-b', 'feature', worktree);
  writeConfig(worktree, { protectedBranches: ['trunk'] });
  assert.deepEqual(findConfig(worktree), { root: worktree, config: { protectedBranches: ['trunk'] } });
});

test('outside git the directory itself is checked', () => {
  const dir = join(sandbox, 'plain');
  writeConfig(dir, CONFIG);
  assert.deepEqual(findConfig(dir), { root: dir, config: CONFIG });
});

test('no config gives null', () => {
  const repo = makeRepo('none');
  assert.equal(findConfig(repo), null);
});

test('a malformed config gives null and one stderr line', () => {
  const repo = makeRepo('malformed', '{ not json');
  const script = `import { findConfig } from ${JSON.stringify(CLI)}; process.stdout.write(String(findConfig(${JSON.stringify(repo)})));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: process.env });
  assert.equal(result.stdout, 'null');
  assert.equal(result.stderr.trim().split('\n').length, 1);
  assert.match(result.stderr, /malformed/);
});

test('a config that is not an object gives null', () => {
  const repo = makeRepo('array', '[1, 2]');
  const result = runCli(['--get', 'protectedBranches'], repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /malformed/);
});

test('loadHookContext reads the cwd of the hook input', () => {
  const repo = makeRepo('hook', CONFIG);
  assert.deepEqual(loadHookContext({ cwd: repo }), { root: repo, config: CONFIG });
});

test('loadSecurityContext prefers CLAUDE_PROJECT_DIR over the hook cwd, else falls back to it', () => {
  const project = makeRepo('security-project', CONFIG);
  const other = makeRepo('security-other', { protectedBranches: ['trunk'] });
  const bare = makeRepo('security-bare');
  try {
    process.env.CLAUDE_PROJECT_DIR = project;
    assert.deepEqual(loadSecurityContext({ cwd: other }), { root: project, config: CONFIG });
    process.env.CLAUDE_PROJECT_DIR = bare;
    assert.deepEqual(loadSecurityContext({ cwd: other }), { root: other, config: { protectedBranches: ['trunk'] } });
    delete process.env.CLAUDE_PROJECT_DIR;
    assert.deepEqual(loadSecurityContext({ cwd: other }), { root: other, config: { protectedBranches: ['trunk'] } });
  } finally {
    delete process.env.CLAUDE_PROJECT_DIR;
  }
});

test('--get prints an array one entry per line', () => {
  const repo = makeRepo('cli-array', CONFIG);
  const result = runCli(['--get', 'localOnlyPaths'], repo);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'docs/private\n.claude/agents\n');
});

test('--get prints an object as JSON and follows dotted keys', () => {
  const repo = makeRepo('cli-object', CONFIG);
  assert.equal(runCli(['--get', 'spec'], repo).stdout, `${JSON.stringify(CONFIG.spec)}\n`);
  assert.equal(runCli(['--get', 'spec.maxWords'], repo).stdout, '1500\n');
});

test('--get honours --dir', () => {
  const repo = makeRepo('cli-dir', CONFIG);
  const result = runCli(['--get', 'protectedBranches', '--dir', repo], sandbox);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'main\n');
});

test('--get exits 1 without a config', () => {
  const repo = makeRepo('cli-none');
  const result = runCli(['--get', 'protectedBranches'], repo);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
});

test('--get exits 1 for a missing key', () => {
  const repo = makeRepo('cli-missing', CONFIG);
  assert.equal(runCli(['--get', 'nope'], repo).status, 1);
});

test('a project directory inside a larger repo is checked before the git toplevel', () => {
  const repo = makeRepo('nested', CONFIG);
  const project = join(repo, 'apps', 'web');
  writeConfig(project, { protectedBranches: ['develop'] });
  mkdirSync(join(project, 'src', 'app'), { recursive: true });
  mkdirSync(join(repo, 'apps', 'api'), { recursive: true });
  assert.deepEqual(findConfig(project), { root: project, config: { protectedBranches: ['develop'] } });
  assert.deepEqual(findConfig(join(project, 'src', 'app')), { root: project, config: { protectedBranches: ['develop'] } });
  assert.deepEqual(findConfig(join(repo, 'apps', 'api')), { root: repo, config: CONFIG });
});
