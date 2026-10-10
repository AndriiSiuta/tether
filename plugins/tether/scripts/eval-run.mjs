// CLI: node eval-run.mjs [--tasks <id>[,<id>…]] [--agent <name>] [--all] [--dry-run] [--scratch <dir>] [--timeout <min>]; frozen tasks in throwaway worktrees.
// Writes <evals.results>/<YYYY-MM-DD>.md; HARNESS_OTEL_ENDPOINTS (JSON) overrides the telemetry endpoints.
// Exit 0 when the tasks ran or were listed, 1 without harness.json or a runnable task, 2 on usage, 130/143 on SIGINT/SIGTERM.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findConfig } from './lib/config.mjs';
import { sessionTotals, telemetryUp } from './lib/otel.mjs';
import { endpointsFromEnv } from './ledger-from-otel.mjs';

const BASE_RE = /^[0-9a-f]{7,40}$/;
const HEADER = ['Task', 'Agent', 'Pass', 'Paths', 'Caught', 'Tokens', 'Wall time'];
const MAX_BUFFER = 256 * 1024 * 1024;
const DEFAULT_TIMEOUT_MIN = 30;
const KILL_GRACE_MS = 5000;
const SIGNAL_EXIT = { SIGINT: 130, SIGTERM: 143 };
const active = { child: undefined, worktree: undefined, root: undefined };

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function validateTask(task) {
  if (task === null || typeof task !== 'object' || Array.isArray(task)) return ['not a JSON object'];
  const errors = [];
  for (const key of ['id', 'agent', 'brief']) {
    if (typeof task[key] !== 'string' || task[key].trim() === '') errors.push(`${key} must be a non-empty string`);
  }
  if (typeof task.base !== 'string' || !BASE_RE.test(task.base)) errors.push('base must be 7 to 40 lowercase hex characters');
  for (const key of ['expectPaths', 'mustCatch']) {
    if (!isStringArray(task[key])) errors.push(`${key} must be an array of strings`);
  }
  return errors;
}

export function parseArgs(argv) {
  const args = { tasks: undefined, agent: undefined, all: false, dryRun: false, scratch: join(tmpdir(), 'harness-evals'), timeoutMin: DEFAULT_TIMEOUT_MIN };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    if (arg === '--tasks') args.tasks = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--agent') args.agent = next();
    else if (arg === '--all') args.all = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--scratch') args.scratch = resolve(next());
    else if (arg === '--timeout') {
      const minutes = Number(next());
      if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('--timeout needs a positive number of minutes');
      args.timeoutMin = minutes;
    }
    else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

export function selectTasks(tasksDir, { tasks: ids, agent, all }, smoke, report = (line) => process.stderr.write(`${line}\n`)) {
  const files = existsSync(tasksDir) ? readdirSync(tasksDir).filter((name) => name.endsWith('.json')).sort() : [];
  const chosen = all || ids !== undefined ? files : files.slice(0, smoke);
  const valid = [];
  for (const file of chosen) {
    let task;
    try {
      task = JSON.parse(readFileSync(join(tasksDir, file), 'utf8'));
    } catch (error) {
      report(`invalid task ${file}: ${error.message}`);
      continue;
    }
    const errors = validateTask(task);
    if (errors.length > 0) report(`invalid task ${file}: ${errors.join('; ')}`);
    else valid.push({ ...task, file });
  }
  let selected = valid;
  if (ids !== undefined) {
    for (const id of ids) if (!valid.some((task) => task.id === id)) report(`unknown task ${id}`);
    selected = selected.filter((task) => ids.includes(task.id));
  }
  if (agent !== undefined) selected = selected.filter((task) => task.agent === agent);
  return selected;
}

export function worktreePath(scratch, id, epoch) {
  return join(scratch, `eval-${id.replace(/[^A-Za-z0-9._-]/g, '-')}-${epoch}`);
}

export function verifyCommandFor(config, base) {
  return String(config.verifyCommand ?? '').replaceAll('{base}', base);
}

function run(cmd, args, options) {
  return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER, ...options });
}

function git(cwd, args) {
  const result = run('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${(result.stderr ?? '').trim()}`);
  return result.stdout;
}

export function runAsync(cmd, args, { cwd, input, env = process.env, timeoutMs } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    active.child = child;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killer;
    const timer = timeoutMs === undefined ? undefined : setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killer = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS);
    }, timeoutMs);
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
    const finish = (status, error) => {
      clearTimeout(timer);
      clearTimeout(killer);
      if (active.child === child) active.child = undefined;
      resolvePromise({ status, stdout, stderr, timedOut, error });
    };
    child.on('error', (error) => finish(null, error));
    child.on('close', (status) => finish(status, undefined));
  });
}

// A memory plugin would store the fixture run as project history and feed it back to later sessions.
export const EVAL_CHILD_ENV = { CLAUDE_MEM_DISABLE_OBSERVATION: '1', CLAUDE_MEM_DISABLE_TOOL_HOOKS: '1' };

export function childEnv(env = process.env) {
  const { CLAUDE_PROJECT_DIR, ...rest } = env;
  return { ...rest, ...EVAL_CHILD_ENV };
}

function removeWorktree(root, worktree) {
  return run('git', ['worktree', 'remove', '--force', worktree], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
}

const realOrSelf = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

export function sweepStale(root, scratch) {
  const prefix = realOrSelf(scratch) + sep;
  const listed = git(root, ['worktree', 'list', '--porcelain']).split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length));
  const stale = listed.filter((path) => realOrSelf(path).startsWith(prefix) && basename(path).startsWith('eval-'));
  for (const path of stale) {
    const removed = removeWorktree(root, path);
    if (removed.status !== 0) process.stderr.write(`could not remove stale ${path}: ${(removed.stderr ?? '').trim()}\n`);
  }
  git(root, ['worktree', 'prune']);
  return stale;
}

export function onSignal(signal) {
  if (active.child !== undefined) active.child.kill('SIGKILL');
  if (active.worktree !== undefined) removeWorktree(active.root, active.worktree);
  process.stderr.write(`${signal}: removed ${active.worktree ?? 'no worktree'}\n`);
  process.exit(SIGNAL_EXIT[signal] ?? 1);
}

const covers = (entry, path) => path === entry || path.startsWith(`${entry.replace(/\/$/, '')}/`);

export function copyExcludes(evals = {}) {
  const entries = [evals.tasks, evals.results, ...(isStringArray(evals.copyExclude) ? evals.copyExclude : [])];
  return entries.filter((entry) => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.replace(/\/+$/, ''));
}

export function prepareWorktree(root, worktree, { localOnlyPaths = [], symlink = [], exclude = [] }) {
  const excluded = (path) => exclude.some((entry) => covers(entry, path));
  for (const entry of localOnlyPaths) {
    const source = join(root, entry);
    if (!existsSync(source) || excluded(entry.replace(/\/+$/, ''))) continue;
    mkdirSync(dirname(join(worktree, entry)), { recursive: true });
    cpSync(source, join(worktree, entry), { recursive: true, filter: (src) => !excluded(relative(root, src).split(sep).join('/')) });
  }
  for (const entry of symlink) {
    const source = join(root, entry);
    const target = join(worktree, entry);
    if (!existsSync(source) || existsSync(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(source, target, 'dir');
  }
}

export function changedPaths(worktree, base, ignored) {
  const tracked = git(worktree, ['diff', '--name-only', base]).split('\n');
  const untracked = git(worktree, ['ls-files', '--others', '--exclude-standard']).split('\n');
  const paths = new Set([...tracked, ...untracked].map((p) => p.trim()).filter(Boolean));
  return [...paths].filter((path) => !ignored.some((entry) => covers(entry, path))).sort();
}

export function parseAgentOutput(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function score(task, changed, result) {
  const text = String(result ?? '').toLowerCase();
  return {
    pathsHit: task.expectPaths.filter((path) => changed.includes(path)).length,
    caught: task.mustCatch.filter((entry) => text.includes(entry.toLowerCase())).length,
  };
}

function usageTokens(usage) {
  if (usage === null || typeof usage !== 'object') return undefined;
  const keys = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];
  return keys.reduce((sum, key) => sum + (Number(usage[key]) || 0), 0);
}

export async function costOf(output, { up, totals }) {
  const duration = Number(output.duration_ms);
  const fallback = { tokens: usageTokens(output.usage), wallMs: Number.isFinite(duration) ? duration : undefined };
  if (up && typeof output.session_id === 'string') {
    try {
      const fromOtel = await totals(output.session_id);
      if (fromOtel) return {
        tokens: fromOtel.tokens > 0 ? fromOtel.tokens : fallback.tokens,
        wallMs: fromOtel.wallMs > 0 ? fromOtel.wallMs : fallback.wallMs,
      };
    } catch {}
  }
  return fallback;
}

export async function runTask(task, { root, config, scratch, epoch, up, totals, claude = 'claude', timeoutMin = DEFAULT_TIMEOUT_MIN }) {
  const evals = config.evals ?? {};
  const worktree = worktreePath(scratch, task.id, epoch);
  const ignored = [...(config.localOnlyPaths ?? []), ...(evals.symlink ?? [])];
  const row = { id: task.id, agent: task.agent, pass: false, paths: `0/${task.expectPaths.length}`, caught: `0/${task.mustCatch.length}`, tokens: undefined, wallMs: undefined };
  let created = false;
  try {
    git(root, ['worktree', 'add', '--detach', worktree, task.base]);
    created = true;
    Object.assign(active, { worktree, root });
    prepareWorktree(root, worktree, { localOnlyPaths: config.localOnlyPaths ?? [], symlink: evals.symlink ?? [], exclude: copyExcludes(evals) });
    const agentRun = await runAsync(claude, ['-p', '--agent', task.agent, '--output-format', 'json', '--permission-mode', 'acceptEdits'], {
      cwd: worktree,
      input: task.brief,
      env: childEnv(),
      timeoutMs: timeoutMin * 60_000,
    });
    if (agentRun.timedOut) row.note = `agent timed out after ${timeoutMin} min`;
    if (agentRun.error) process.stderr.write(`task ${task.id}: ${agentRun.error.message}\n`);
    else if (agentRun.timedOut) process.stderr.write(`task ${task.id}: ${row.note}, killed\n`);
    else if (agentRun.status !== 0) process.stderr.write(`task ${task.id}: the agent exited ${agentRun.status}\n`);
    const output = parseAgentOutput(agentRun.stdout);
    if (!agentRun.timedOut) {
      const verify = await runAsync('bash', ['-c', verifyCommandFor(config, task.base)], { cwd: worktree });
      row.pass = verify.status === 0;
    }
    const changed = changedPaths(worktree, task.base, ignored);
    const { pathsHit, caught } = score(task, changed, output.result);
    row.paths = `${pathsHit}/${task.expectPaths.length}`;
    row.caught = `${caught}/${task.mustCatch.length}`;
    Object.assign(row, await costOf(output, { up, totals }));
  } catch (error) {
    row.error = error.message;
    process.stderr.write(`task ${task.id}: ${error.message}\n`);
  } finally {
    Object.assign(active, { worktree: undefined, root: undefined });
    if (created) {
      const removed = removeWorktree(root, worktree);
      if (removed.status !== 0) process.stderr.write(`task ${task.id}: could not remove ${worktree}: ${(removed.stderr ?? '').trim()}\n`);
    }
  }
  return row;
}

const passLabel = (row) => {
  if (row.error) return 'error';
  if (row.note) return `no (${row.note})`;
  return row.pass ? 'yes' : 'no';
};

const cell = (value) => String(value).replaceAll('|', '\\|');
const tableLine = (cells) => `| ${cells.map(cell).join(' | ')} |`;

export function renderRows(rows) {
  const lines = [tableLine(HEADER), `|${HEADER.map(() => '---').join('|')}|`];
  for (const row of rows) {
    lines.push(tableLine([
      row.id,
      row.agent,
      passLabel(row),
      row.paths,
      row.caught,
      row.tokens === undefined ? '–' : fmt(row.tokens),
      row.wallMs === undefined ? '–' : `${fmt(row.wallMs / 1000)} s`,
    ]));
  }
  return lines;
}

export function parseResults(md) {
  const rows = new Map();
  let header;
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) {
      if (header) break;
      continue;
    }
    if (!line.startsWith('|')) continue;
    const cells = line.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replaceAll('\\|', '|'));
    if (header === undefined) {
      if (cells[0] === 'Task') header = cells;
      continue;
    }
    if (cells.every((c) => /^-+$/.test(c))) continue;
    const row = Object.fromEntries(header.map((name, i) => [name, cells[i]]));
    rows.set(row.Task, row);
  }
  return rows;
}

const tokenNumber = (text) => {
  const n = Number(String(text ?? '').replaceAll(',', ''));
  return text === undefined || text === '–' || !Number.isFinite(n) ? undefined : n;
};

export function renderChange(rows, previousName, previousMd) {
  const previous = parseResults(previousMd);
  const lines = [`## Change vs ${previousName}`, '', '| Task | Pass | Tokens |', '|---|---|---|'];
  for (const row of rows) {
    const before = previous.get(row.id);
    const passNow = passLabel(row);
    if (before === undefined) {
      lines.push(tableLine([row.id, `new: ${passNow}`, '–']));
      continue;
    }
    const pass = before.Pass === passNow ? passNow : `${before.Pass} → ${passNow}`;
    const was = tokenNumber(before.Tokens);
    let delta = '–';
    if (was !== undefined && was > 0 && row.tokens !== undefined) {
      const pct = ((row.tokens - was) / was) * 100;
      delta = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)} %`;
    }
    lines.push(tableLine([row.id, pass, delta]));
  }
  return lines;
}

export function previousResults(resultsDir, fileName) {
  if (!existsSync(resultsDir)) return undefined;
  const older = readdirSync(resultsDir).filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name) && name < fileName).sort();
  return older.at(-1);
}

export function writeResults(resultsDir, date, rows) {
  const fileName = `${date}.md`;
  const previous = previousResults(resultsDir, fileName);
  const lines = [`# Eval results ${date}`, '', ...renderRows(rows)];
  if (previous !== undefined) lines.push('', ...renderChange(rows, previous, readFileSync(join(resultsDir, previous), 'utf8')));
  mkdirSync(resultsDir, { recursive: true });
  const file = join(resultsDir, fileName);
  writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
}

const today = (now) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\nusage: node eval-run.mjs [--tasks <id>[,<id>…]] [--agent <name>] [--all] [--dry-run] [--scratch <dir>] [--timeout <min>]\n`);
    return 2;
  }
  const found = findConfig(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  if (found === null) {
    process.stderr.write('no .claude/harness.json for this project\n');
    return 1;
  }
  const { root, config } = found;
  const evals = config.evals ?? {};
  if (typeof evals.tasks !== 'string' || typeof evals.results !== 'string') {
    process.stderr.write('harness.json needs evals.tasks and evals.results\n');
    return 1;
  }
  const tasks = selectTasks(join(root, evals.tasks), args, Number(evals.smoke) || 0);
  if (tasks.length === 0) {
    process.stderr.write('no runnable task selected\n');
    return 1;
  }
  const epoch = Date.now();
  if (args.dryRun) {
    for (const task of tasks) {
      process.stdout.write(`${task.id}\n  worktree ${worktreePath(args.scratch, task.id, epoch)}\n  agent ${task.agent}\n  verify ${verifyCommandFor(config, task.base)}\n`);
    }
    return 0;
  }
  mkdirSync(args.scratch, { recursive: true });
  for (const path of sweepStale(root, args.scratch)) process.stderr.write(`removed stale worktree ${path}\n`);
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  let endpoints;
  try {
    endpoints = endpointsFromEnv();
  } catch {
    process.stderr.write('HARNESS_OTEL_ENDPOINTS is not valid JSON\n');
    return 1;
  }
  const up = await telemetryUp(endpoints);
  const totals = (sessionId) => sessionTotals(sessionId, endpoints);
  const rows = [];
  for (const task of tasks) {
    process.stderr.write(`running ${task.id} (${task.agent})\n`);
    rows.push(await runTask(task, { root, config, scratch: args.scratch, epoch, up, totals, timeoutMin: args.timeoutMin }));
  }
  const file = writeResults(join(root, evals.results), today(new Date()), rows);
  process.stdout.write(`${renderRows(rows).join('\n')}\n\nresults: ${file}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
