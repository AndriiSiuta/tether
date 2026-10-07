import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandDir, evaluate, localOnlyPattern } from '../scripts/git-guard.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'git-guard.mjs');
const LOCAL_ONLY = ['docs/private', 'docs/adr', '.claude/agents', '.claude/settings.local.json', 'NOTES.local.md'];
const CONFIG = { protectedBranches: ['main'], localOnlyPaths: LOCAL_ONLY };

let sandbox;

function git(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function makeRepo(name, { config = CONFIG, branch = 'feature' } = {}) {
  const dir = join(sandbox, name);
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'README'), 'x\n');
  git(dir, 'add', 'README');
  git(dir, 'commit', '-q', '-m', 'init');
  if (branch !== 'main') git(dir, 'switch', '-q', '-c', branch);
  if (config !== null) {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'harness.json'), JSON.stringify(config));
  }
  return dir;
}

function hook(command, cwd) {
  return { tool_name: 'Bash', tool_input: { command }, cwd };
}

function runCli(stdin) {
  return spawnSync(process.execPath, [CLI], { input: stdin, encoding: 'utf8', env: process.env });
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

test('a commit on a protected branch exits 2 with one stderr paragraph', () => {
  const repo = makeRepo('on-main', { branch: 'main' });
  const result = runCli(JSON.stringify(hook('git commit -m "x"', repo)));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /is on main; make the branch first \(git switch -c <name> origin\/main\)/);
  assert.equal(result.stderr.trim().split('\n').length, 1);
});

test('a push on a protected branch is blocked', () => {
  const repo = makeRepo('push-main', { branch: 'main' });
  assert.match(evaluate(hook('git push', repo)), /is on main/);
});

test('every configured branch is protected', () => {
  const repo = makeRepo('on-trunk', { config: { protectedBranches: ['main', 'trunk'], localOnlyPaths: [] }, branch: 'trunk' });
  assert.match(evaluate(hook('git commit -m x', repo)), /is on trunk/);
});

for (const path of LOCAL_ONLY) {
  test(`a commit naming ${path} is blocked on a feature branch`, () => {
    const repo = makeRepo(`path-${path.replace(/\W/g, '-')}`);
    const message = evaluate(hook(`git commit --only -m "x" -- ${path}/file README`, repo));
    assert.match(message, /the commit names a local-only harness path \(/);
    for (const listed of LOCAL_ONLY) assert.ok(message.includes(listed));
  });
}

test('a local-only path after a quote or = is blocked', () => {
  const repo = makeRepo('quoted');
  assert.match(evaluate(hook('git commit -m "x" -- "docs/adr/one.md"', repo)), /local-only harness path/);
  assert.match(evaluate(hook('git commit --pathspec-from-file=NOTES.local.md', repo)), /local-only harness path/);
});

test('a commit naming only other paths on a feature branch passes', () => {
  const repo = makeRepo('clean');
  assert.equal(evaluate(hook('git commit --only -m "feat: x" -- src/a.ts mydocs/private/x', repo)), null);
});

test('a local-only path before the commit word is not judged as committed', () => {
  const repo = makeRepo('before-commit');
  assert.equal(evaluate(hook('cat docs/private/x | wc -l; git commit -m x -- src/a.ts', repo)), null);
});

test('cd <dir> && picks the directory of the command', () => {
  const onMain = makeRepo('cd-main', { branch: 'main' });
  const feature = makeRepo('cd-feature');
  assert.match(evaluate(hook(`cd ${onMain} && git commit -m x`, feature)), /is on main/);
  assert.equal(evaluate(hook(`cd ${feature} && git commit -m x`, onMain)), null);
});

test('git -C <dir> picks the directory of the command', () => {
  const onMain = makeRepo('dash-c-main', { branch: 'main' });
  const feature = makeRepo('dash-c-feature');
  assert.match(evaluate(hook(`git -C "${onMain}" commit -m x`, feature)), /is on main/);
  assert.equal(evaluate(hook(`git -C ${feature} commit -m x`, onMain)), null);
});

test('the config is read from the directory of the command', () => {
  const unguarded = makeRepo('unguarded', { config: null, branch: 'main' });
  const guarded = makeRepo('guarded', { branch: 'main' });
  assert.equal(evaluate(hook(`git -C ${unguarded} commit -m x`, guarded)), null);
  assert.match(evaluate(hook(`git -C ${guarded} commit -m x`, unguarded)), /is on main/);
});

test('a push without origin/<first protected branch> says fetch first', () => {
  const repo = makeRepo('no-origin');
  const result = runCli(JSON.stringify(hook('git push -u origin feature', repo)));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /origin\/main is not available to check the push range; fetch first/);
});

test('a push range carrying local-only files is blocked, a clean one passes', () => {
  const remote = join(sandbox, 'remote.git');
  git(sandbox, 'init', '-q', '--bare', '-b', 'main', remote);
  const repo = makeRepo('range');
  git(repo, 'remote', 'add', 'origin', remote);
  git(repo, 'push', '-q', 'origin', 'main');
  git(repo, 'fetch', '-q', 'origin');
  writeFileSync(join(repo, 'code.ts'), 'x\n');
  git(repo, 'add', 'code.ts');
  git(repo, 'commit', '-q', '-m', 'code');
  assert.equal(evaluate(hook('git push', repo)), null);
  mkdirSync(join(repo, 'docs', 'private'), { recursive: true });
  writeFileSync(join(repo, 'docs', 'private', 'leak.md'), 'x\n');
  git(repo, 'add', 'docs/private/leak.md');
  git(repo, 'commit', '-q', '-m', 'leak');
  assert.match(evaluate(hook('git push', repo)), /push range carries local-only files:\n.*docs\/private\/leak\.md/);
});

test('a non-git command exits 0', () => {
  const repo = makeRepo('non-git', { branch: 'main' });
  const result = runCli(JSON.stringify(hook('ls -la', repo)));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('malformed stdin exits 0 silently', () => {
  for (const stdin of ['{ nope', '', '[]', 'null']) {
    const result = runCli(stdin);
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, '');
  }
});

test('a missing command field exits 0', () => {
  const repo = makeRepo('no-field', { branch: 'main' });
  assert.equal(runCli(JSON.stringify({ cwd: repo })).status, 0);
});

test('no harness.json exits 0 even on main', () => {
  const repo = makeRepo('no-config', { config: null, branch: 'main' });
  const result = runCli(JSON.stringify(hook('git commit -m x -- docs/private/a', repo)));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

function runCliWithProject(stdin, projectDir) {
  return spawnSync(process.execPath, [CLI], { input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir } });
}

test('CLAUDE_PROJECT_DIR supplies the config while the branch is read in the command dir', () => {
  const project = makeRepo('env-project', { branch: 'feature' });
  const target = makeRepo('env-target-main', { config: null, branch: 'main' });
  const blocked = runCliWithProject(JSON.stringify(hook(`git -C ${target} commit -m x`, project)), project);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /is on main/);
});

test('CLAUDE_PROJECT_DIR on main does not block a commit in a command dir on a feature branch', () => {
  const project = makeRepo('env-project-main', { branch: 'main' });
  const target = makeRepo('env-target-feature', { config: null, branch: 'feature' });
  const result = runCliWithProject(JSON.stringify(hook(`git -C ${target} commit -m x`, project)), project);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('a directory outside git exits 0', () => {
  const dir = join(sandbox, 'not-a-repo');
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'harness.json'), JSON.stringify(CONFIG));
  assert.equal(evaluate(hook('git commit -m x', dir)), null);
});

test('commandDir resolves relative and home paths against the base', () => {
  assert.equal(commandDir('cd sub && git commit', '/base'), '/base/sub');
  assert.equal(commandDir('git -C ~/repo commit', '/base'), join(process.env.HOME, 'repo'));
  assert.equal(commandDir('git commit', '/base'), '/base');
});

test('localOnlyPattern escapes regex characters and has no pattern for an empty list', () => {
  assert.equal(localOnlyPattern([]), null);
  const pattern = localOnlyPattern(['a.b']);
  assert.ok(pattern.test(' a.b/x'));
  assert.ok(!pattern.test(' axb/x'));
});
