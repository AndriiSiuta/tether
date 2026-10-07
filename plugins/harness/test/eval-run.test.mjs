import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { copyExcludes, costOf, parseResults, prepareWorktree, selectTasks, validateTask } from '../scripts/eval-run.mjs';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(PLUGIN, 'scripts', 'eval-run.mjs');
const CLOSED = 'http://127.0.0.1:1';
const TASKS_DIR = 'private/evals/tasks';
const RESULTS_DIR = 'private/evals/results';

let sandbox;
let repo;
let bin;
let base;
let scratch;
let log;

function git(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const task = (overrides = {}) => ({
  id: 't1',
  base,
  agent: 'web-implementer',
  brief: 'Write src/out.txt.',
  expectPaths: ['src/out.txt'],
  mustCatch: ['missing key'],
  ...overrides,
});

function writeTask(file, value) {
  writeFileSync(join(repo, TASKS_DIR, file), typeof value === 'string' ? value : JSON.stringify(value));
}

function cliEnv(env) {
  return {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CLAUDE_PROJECT_DIR: repo,
      HARNESS_OTEL_ENDPOINTS: JSON.stringify({ prometheus: CLOSED, tempo: CLOSED, loki: CLOSED }),
      FAKE_LOG: log,
      ...env,
  };
}

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [CLI, '--scratch', scratch, ...args], { cwd: repo, encoding: 'utf8', env: cliEnv(env) });
}

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const worktrees = () => git(repo, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).length;

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'harness-')));
  const home = join(sandbox, 'home');
  mkdirSync(home);
  process.env.HOME = home;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  process.env.GIT_AUTHOR_NAME = process.env.GIT_COMMITTER_NAME = 'Test';
  process.env.GIT_AUTHOR_EMAIL = process.env.GIT_COMMITTER_EMAIL = 'test@example.com';
  repo = join(sandbox, 'repo');
  mkdirSync(join(repo, 'src'), { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  writeFileSync(join(repo, 'src', 'a.txt'), 'one\n');
  git(repo, 'add', 'src/a.txt');
  git(repo, 'commit', '-q', '-m', 'first');
  base = git(repo, 'rev-parse', 'HEAD');
  writeFileSync(join(repo, 'src', 'a.txt'), 'two\n');
  git(repo, 'commit', '-q', '-am', 'second');
  writeFileSync(join(repo, '.git', 'info', 'exclude'), '.claude/\nprivate/\ndeps/\n');
  mkdirSync(join(repo, '.claude'));
  writeFileSync(join(repo, '.claude', 'harness.json'), JSON.stringify({
    localOnlyPaths: ['private', '.claude/harness.json', '.claude/missing'],
    verifyCommand: 'node -e "process.exit(0)" {base}',
    evals: { tasks: TASKS_DIR, results: RESULTS_DIR, smoke: 2, symlink: ['deps'] },
  }));
  mkdirSync(join(repo, 'deps'));
  writeFileSync(join(repo, 'deps', 'lib.js'), '');
  bin = join(sandbox, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'claude'), `#!${process.execPath}
const fs = require('node:fs');
const brief = fs.readFileSync(0, 'utf8');
fs.mkdirSync('src', { recursive: true });
fs.writeFileSync('src/out.txt', brief);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ args: process.argv.slice(2), brief, config: fs.existsSync('.claude/harness.json'), tasks: fs.existsSync('private/evals/tasks'), notes: fs.existsSync('private/notes.md'), deps: fs.existsSync('deps/lib.js'), projectDir: 'CLAUDE_PROJECT_DIR' in process.env }) + '\\n');
setTimeout(() => {
  process.stdout.write(JSON.stringify({ type: 'result', session_id: 's-1', result: 'Found the MISSING KEY in en-GB.', usage: { input_tokens: 1000, output_tokens: 500 }, duration_ms: 2000 }));
  process.exit(Number(process.env.FAKE_CLAUDE_EXIT ?? 0));
}, Number(process.env.FAKE_CLAUDE_SLEEP ?? 0));
`);
  chmodSync(join(bin, 'claude'), 0o755);
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

beforeEach(() => {
  rmSync(join(repo, 'private'), { recursive: true, force: true });
  mkdirSync(join(repo, TASKS_DIR), { recursive: true });
  scratch = join(sandbox, `scratch-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  log = join(sandbox, `log-${Date.now()}-${Math.random().toString(16).slice(2)}`);
});

test('validateTask accepts the schema and names each broken field', () => {
  assert.deepEqual(validateTask(task()), []);
  const errors = validateTask({ id: '', base: 'XYZ', agent: 'a', brief: 'b', expectPaths: 'src', mustCatch: [1] });
  assert.equal(errors.length, 4);
  assert.match(errors.join(';'), /id .*base .*expectPaths .*mustCatch/s);
  assert.deepEqual(validateTask([]), ['not a JSON object']);
});

test('selection takes the first smoke files by name, every file with --all, and filters by id and agent', () => {
  writeTask('01-a.json', task({ id: 'a' }));
  writeTask('02-b.json', task({ id: 'b', agent: 'code-reviewer' }));
  writeTask('03-c.json', task({ id: 'c' }));
  const dir = join(repo, TASKS_DIR);
  const quiet = () => {};
  assert.deepEqual(selectTasks(dir, {}, 2, quiet).map((t) => t.id), ['a', 'b']);
  assert.deepEqual(selectTasks(dir, { all: true }, 2, quiet).map((t) => t.id), ['a', 'b', 'c']);
  assert.deepEqual(selectTasks(dir, { tasks: ['c'] }, 2, quiet).map((t) => t.id), ['c']);
  assert.deepEqual(selectTasks(dir, { all: true, agent: 'web-implementer' }, 2, quiet).map((t) => t.id), ['a', 'c']);
});

test('costOf falls back to usage and duration when telemetry is down', async () => {
  const output = { session_id: 's', usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 1 }, duration_ms: 1500 };
  assert.deepEqual(await costOf(output, { up: false, totals: () => assert.fail('telemetry is down') }), { tokens: 116, wallMs: 1500 });
  assert.deepEqual(await costOf(output, { up: true, totals: async () => ({ tokens: 9, wallMs: 3 }) }), { tokens: 9, wallMs: 3 });
});

test('a run writes the results file and removes its worktree', () => {
  writeTask('01-t1.json', task());
  writeFileSync(join(repo, 'private', 'notes.md'), 'local\n');
  const result = runCli([]);
  assert.equal(result.status, 0, result.stderr);
  const file = join(repo, RESULTS_DIR, `${today()}.md`);
  const md = readFileSync(file, 'utf8');
  assert.match(md, /^\| Task \| Agent \| Pass \| Paths \| Caught \| Tokens \| Wall time \|$/m);
  assert.match(md, /^\| t1 \| web-implementer \| yes \| 1\/1 \| 1\/1 \| 1,500 \| 2 s \|$/m);
  assert.doesNotMatch(md, /## Change vs/);
  const [call] = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(call.args, ['-p', '--agent', 'web-implementer', '--output-format', 'json', '--permission-mode', 'acceptEdits']);
  assert.equal(call.brief, 'Write src/out.txt.');
  assert.equal(call.config, true);
  assert.equal(call.deps, true);
  assert.equal(call.tasks, false);
  assert.equal(call.notes, true);
  assert.equal(call.projectDir, false);
  assert.deepEqual(readdirSync(scratch), []);
  assert.equal(worktrees(), 1);
});

test('the worktree is removed when the agent exits 1', () => {
  writeTask('01-t1.json', task());
  const result = runCli([], { FAKE_CLAUDE_EXIT: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /the agent exited 1/);
  assert.deepEqual(readdirSync(scratch), []);
  assert.equal(worktrees(), 1);
});

test('a failing verify command marks the task as not passed', () => {
  writeTask('01-t1.json', task());
  const config = join(repo, '.claude', 'harness.json');
  const original = readFileSync(config, 'utf8');
  writeFileSync(config, JSON.stringify({ ...JSON.parse(original), verifyCommand: 'test {base} = nope' }));
  try {
    assert.equal(runCli([]).status, 0);
  } finally {
    writeFileSync(config, original);
  }
  assert.match(readFileSync(join(repo, RESULTS_DIR, `${today()}.md`), 'utf8'), /^\| t1 \| web-implementer \| no \|/m);
});

test('an invalid task is reported and skipped', () => {
  writeTask('01-t1.json', task());
  writeTask('02-bad.json', task({ id: 'bad', base: 'not-a-sha' }));
  writeTask('03-broken.json', '{');
  const result = runCli(['--all', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /invalid task 02-bad\.json: base must be/);
  assert.match(result.stderr, /invalid task 03-broken\.json/);
  assert.match(result.stdout, /^t1$/m);
  assert.doesNotMatch(result.stdout, /^bad$/m);
});

test('--dry-run prints worktree, agent and verify command and creates nothing', () => {
  writeTask('01-t1.json', task());
  const result = runCli(['--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`worktree ${scratch}/eval-t1-\\d+`));
  assert.match(result.stdout, /agent web-implementer/);
  assert.match(result.stdout, new RegExp(`verify node -e "process.exit\\(0\\)" ${base}`));
  assert.equal(existsSync(scratch), false);
  assert.equal(existsSync(join(repo, RESULTS_DIR)), false);
  assert.equal(existsSync(log), false);
  assert.equal(worktrees(), 1);
});

test('the change section compares against the previous results file', () => {
  writeTask('01-t1.json', task());
  writeTask('02-t2.json', task({ id: 't2' }));
  mkdirSync(join(repo, RESULTS_DIR), { recursive: true });
  writeFileSync(join(repo, RESULTS_DIR, '2000-01-01.md'), '# old\n\n| Task | Agent | Pass | Paths | Caught | Tokens | Wall time |\n|---|---|---|---|---|---|---|\n| t1 | web-implementer | no | 0/1 | 0/1 | 1,000 | 5 s |\n');
  writeFileSync(join(repo, RESULTS_DIR, '1999-01-01.md'), '| Task | Agent | Pass | Paths | Caught | Tokens | Wall time |\n|---|---|---|---|---|---|---|\n| t1 | web-implementer | yes | 1/1 | 1/1 | 9 | 1 s |\n');
  const result = runCli([]);
  assert.equal(result.status, 0, result.stderr);
  const md = readFileSync(join(repo, RESULTS_DIR, `${today()}.md`), 'utf8');
  assert.match(md, /^## Change vs 2000-01-01\.md$/m);
  assert.match(md, /^\| t1 \| no → yes \| \+50\.0 % \|$/m);
  assert.match(md, /^\| t2 \| new: yes \| – \|$/m);
  assert.equal(parseResults(md).get('t1').Tokens, '1,500');
});

test('costOf falls back per field when telemetry reports zero', async () => {
  const output = { session_id: 's', usage: { input_tokens: 10, output_tokens: 5 }, duration_ms: 1500 };
  assert.deepEqual(await costOf(output, { up: true, totals: async () => ({ tokens: 0, wallMs: 0 }) }), { tokens: 15, wallMs: 1500 });
  assert.deepEqual(await costOf(output, { up: true, totals: async () => ({ tokens: 42, wallMs: 0 }) }), { tokens: 42, wallMs: 1500 });
  assert.deepEqual(await costOf(output, { up: true, totals: async () => ({ tokens: 0, wallMs: 7 }) }), { tokens: 15, wallMs: 7 });
});

test('an agent that outlasts --timeout is killed, scored as failed with a note, and its worktree removed', () => {
  writeTask('01-t1.json', task());
  const started = Date.now();
  const result = runCli(['--timeout', '0.005'], { FAKE_CLAUDE_SLEEP: '20000' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Date.now() - started < 15000);
  assert.match(result.stderr, /agent timed out after 0\.005 min, killed/);
  assert.match(readFileSync(join(repo, RESULTS_DIR, `${today()}.md`), 'utf8'), /^\| t1 \| web-implementer \| no \(agent timed out after 0\.005 min\) \|/m);
  assert.deepEqual(readdirSync(scratch), []);
  assert.equal(worktrees(), 1);
});

test('a bad --timeout is a usage error', () => {
  assert.equal(runCli(['--timeout', '0']).status, 2);
});

test('SIGTERM while the agent runs removes the worktree and exits 143', async () => {
  writeTask('01-t1.json', task());
  const child = spawn(process.execPath, [CLI, '--scratch', scratch], { cwd: repo, env: cliEnv({ FAKE_CLAUDE_SLEEP: '30000' }), stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise((resolveExit) => child.on('close', (code, signal) => resolveExit({ code, signal })));
  for (let i = 0; i < 200 && !existsSync(log); i++) await delay(25);
  assert.ok(existsSync(log), 'the fake agent never started');
  assert.equal(readdirSync(scratch).length, 1);
  child.kill('SIGTERM');
  const { code } = await exited;
  assert.equal(code, 143);
  assert.deepEqual(readdirSync(scratch), []);
  assert.equal(worktrees(), 1);
  assert.equal(existsSync(join(repo, RESULTS_DIR)), false);
});

test('a run sweeps stale eval worktrees under the scratch dir and leaves others', () => {
  writeTask('01-t1.json', task());
  mkdirSync(scratch, { recursive: true });
  const stale = join(scratch, 'eval-old-1');
  const other = join(scratch, 'keep-1');
  git(repo, 'worktree', 'add', '-q', '--detach', stale, base);
  git(repo, 'worktree', 'add', '-q', '--detach', other, base);
  try {
    const result = runCli([]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /removed stale worktree .*eval-old-1/);
    assert.deepEqual(readdirSync(scratch), ['keep-1']);
    assert.equal(worktrees(), 2);
  } finally {
    git(repo, 'worktree', 'remove', '--force', other);
  }
});

test('/harness:eval pre-approves the dry run only', () => {
  const text = readFileSync(join(PLUGIN, 'commands', 'eval.md'), 'utf8');
  const line = text.split('\n').find((l) => l.startsWith('allowed-tools:'));
  assert.deepEqual(JSON.parse(line.slice('allowed-tools:'.length).trim()), ['Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/eval-run.mjs --dry-run:*)']);
  assert.match(text, /run_in_background/);
});

test('copyExcludes holds the tasks and results folders and evals.copyExclude', () => {
  assert.deepEqual(copyExcludes({ tasks: 'a/tasks/', results: 'a/results', copyExclude: ['a/secret'] }), ['a/tasks', 'a/results', 'a/secret']);
  assert.deepEqual(copyExcludes({ copyExclude: 'nope' }), []);
});

test('prepareWorktree leaves the eval tasks, results and copyExclude paths out of a copied local-only folder', () => {
  const root = join(sandbox, 'copy-root');
  const worktree = join(sandbox, 'copy-worktree');
  for (const dir of ['private/evals/tasks', 'private/evals/results', 'private/secret']) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'private/evals/tasks/t.json'), '{}');
  writeFileSync(join(root, 'private/evals/results/r.md'), '');
  writeFileSync(join(root, 'private/secret/s.txt'), '');
  writeFileSync(join(root, 'private/notes.md'), '');
  mkdirSync(join(root, 'top-secret'), { recursive: true });
  mkdirSync(worktree);
  prepareWorktree(root, worktree, {
    localOnlyPaths: ['private', 'top-secret'],
    exclude: copyExcludes({ tasks: 'private/evals/tasks', results: 'private/evals/results', copyExclude: ['private/secret', 'top-secret'] }),
  });
  assert.equal(existsSync(join(worktree, 'private/notes.md')), true);
  for (const path of ['private/evals/tasks', 'private/evals/results', 'private/secret', 'top-secret']) {
    assert.equal(existsSync(join(worktree, path)), false, path);
  }
});
