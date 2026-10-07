import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, taskFromTranscript } from '../scripts/fix-round-cap.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'fix-round-cap.mjs');
const CONFIG = { implementerAgents: ['web-implementer', 'web-implementer-mechanical'], fixRoundCap: 2 };
const BLOCKED = '2 fix rounds used on Task 3; stop and escalate to Andrii with the failing check.\n';

let sandbox;
let counter = 0;

function fresh(name) {
  const dir = join(sandbox, `${name}-${counter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeProject(config = CONFIG) {
  const dir = fresh('project');
  mkdirSync(join(dir, '.claude'), { recursive: true });
  writeFileSync(join(dir, '.claude', 'harness.json'), JSON.stringify(config));
  return dir;
}

function makeTranscript(content) {
  const file = join(fresh('transcript'), 'agent.jsonl');
  const entries = [
    { type: 'system', content: '# Task 99 not a user entry' },
    { type: 'user', message: { role: 'user', content } },
    { type: 'user', message: { role: 'user', content: '### Task 42 later entry' } },
  ];
  writeFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
  return file;
}

function stop(cwd, transcript, overrides = {}) {
  return {
    hook_event_name: 'SubagentStop',
    session_id: 'session-a',
    cwd,
    agent_type: 'web-implementer',
    agent_id: 'agent-1',
    agent_transcript_path: transcript,
    stop_hook_active: false,
    last_assistant_message: 'Files: a',
    ...overrides,
  };
}

function runCli(input, dataDir) {
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: dataDir };
  return spawnSync(process.execPath, [CLI], { input: JSON.stringify(input), encoding: 'utf8', env });
}

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'harness-')));
  delete process.env.CLAUDE_PROJECT_DIR;
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test('the task id comes from the first user entry, string or text blocks', () => {
  const line = (content) => JSON.stringify({ type: 'user', message: { content } });
  assert.equal(taskFromTranscript(line('Intro\n## Task 3: Cap the rounds\nbody')), 'Task 3');
  assert.equal(taskFromTranscript(line([{ type: 'image' }, { type: 'text', text: '### Task 7.1 Something' }])), 'Task 7.1');
  assert.equal(taskFromTranscript(`${line('no heading here')}\n${line('# Task 5')}`), null);
  assert.equal(taskFromTranscript('not json\n'), null);
});

test('the fourth stop of a task is blocked with the cap message', () => {
  const project = makeProject();
  const data = fresh('data');
  const transcript = makeTranscript('# Plan\n\n### Task 3: Fix-round cap\n');
  const results = [1, 2, 3, 4].map(() => runCli(stop(project, transcript), data));
  assert.deepEqual(results.map((r) => r.status), [0, 0, 0, 2]);
  assert.equal(results[3].stderr, BLOCKED);
  assert.equal(results.slice(0, 3).map((r) => r.stdout + r.stderr).join(''), '');
  assert.deepEqual(JSON.parse(readFileSync(join(data, 'rounds.json'), 'utf8')), { 'session-a|Task 3': 4 });
});

test('a continuation stop (stop_hook_active) is not counted', () => {
  const project = makeProject();
  const data = fresh('data');
  const transcript = makeTranscript('### Task 3');
  for (let i = 0; i < 3; i += 1) assert.equal(runCli(stop(project, transcript), data).status, 0);
  const continued = runCli(stop(project, transcript, { stop_hook_active: true }), data);
  assert.equal(continued.status, 0);
  assert.equal(continued.stderr, '');
  assert.deepEqual(JSON.parse(readFileSync(join(data, 'rounds.json'), 'utf8')), { 'session-a|Task 3': 3 });
  assert.equal(runCli(stop(project, transcript), data).status, 2);
});

test('an agent outside implementerAgents is ignored', () => {
  const data = fresh('data');
  const transcript = makeTranscript('### Task 3');
  for (let i = 0; i < 5; i += 1) assert.equal(evaluate(stop('/x', transcript, { agent_type: 'Explore' }), CONFIG, data), null);
  assert.throws(() => readFileSync(join(data, 'rounds.json')));
});

test('sessions are counted apart', () => {
  const data = fresh('data');
  const transcript = makeTranscript('### Task 3');
  for (let i = 0; i < 3; i += 1) assert.equal(evaluate(stop('/x', transcript), CONFIG, data), null);
  for (let i = 0; i < 3; i += 1) assert.equal(evaluate(stop('/x', transcript, { session_id: 'session-b' }), CONFIG, data), null);
  assert.equal(evaluate(stop('/x', transcript, { session_id: 'session-b' }), CONFIG, data), BLOCKED.trimEnd());
});

test('a missing transcript, no task heading or no data dir exits 0 without counting', () => {
  const project = makeProject();
  const data = fresh('data');
  const missing = runCli(stop(project, join(sandbox, 'nope.jsonl')), data);
  assert.equal(missing.status, 0);
  assert.equal(missing.stdout + missing.stderr, '');
  assert.equal(evaluate(stop(project, makeTranscript('no heading')), CONFIG, data), null);
  assert.throws(() => readFileSync(join(data, 'rounds.json')));
  const transcript = makeTranscript('### Task 3');
  const env = { ...process.env };
  delete env.CLAUDE_PLUGIN_DATA;
  for (let i = 0; i < 5; i += 1) {
    const result = spawnSync(process.execPath, [CLI], { input: JSON.stringify(stop(project, transcript)), encoding: 'utf8', env });
    assert.equal(result.status, 0);
  }
});

test('malformed stdin, no harness.json or a malformed rounds file fail open', () => {
  const data = fresh('data');
  for (const stdin of ['{ nope', '', '[]', 'null']) {
    const result = spawnSync(process.execPath, [CLI], { input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_DATA: data } });
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, '');
  }
  const transcript = makeTranscript('### Task 3');
  assert.equal(runCli(stop(fresh('no-config'), transcript), data).status, 0);
  writeFileSync(join(data, 'rounds.json'), '{ broken');
  assert.equal(evaluate(stop('/x', transcript), CONFIG, data), null);
  assert.deepEqual(JSON.parse(readFileSync(join(data, 'rounds.json'), 'utf8')), { 'session-a|Task 3': 1 });
});
