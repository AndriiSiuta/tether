import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, missingFields } from '../scripts/implementer-report.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'implementer-report.mjs');
const CONFIG = {
  implementerAgents: ['web-implementer', 'web-implementer-mechanical'],
  reportFields: ['Files:', 'Checks:', 'Deferred:', 'Plan edits:|Blocked:'],
};
const FULL = 'Done.\nFiles: a.ts\nChecks: ok\nDeferred: none\nPlan edits: none';

let sandbox;

function makeProject(name, config = CONFIG) {
  const dir = join(sandbox, name);
  mkdirSync(dir, { recursive: true });
  if (config !== null) {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'harness.json'), JSON.stringify(config));
  }
  return dir;
}

function stop(message, cwd, agentType = 'web-implementer') {
  return { hook_event_name: 'SubagentStop', agent_type: agentType, last_assistant_message: message, cwd, stop_hook_active: false };
}

function runCli(stdin) {
  return spawnSync(process.execPath, [CLI], { input: stdin, encoding: 'utf8', env: process.env });
}

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'harness-')));
  delete process.env.CLAUDE_PROJECT_DIR;
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test('a full report passes', () => {
  const project = makeProject('full');
  const result = runCli(JSON.stringify(stop(FULL, project)));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('a report missing fields exits 2 with one stderr paragraph naming them', () => {
  const project = makeProject('missing');
  const result = runCli(JSON.stringify(stop('Files: a.ts\nChecks: ok', project, 'web-implementer-mechanical')));
  assert.equal(result.status, 2);
  assert.equal(
    result.stderr,
    'Report is incomplete, missing Deferred:, Plan edits:. End with these lines: Files: <content>; Checks: <content>; ' +
      'Deferred: <content>; Plan edits: <content>. If you are stopping because you are blocked, write Blocked: <what you need> instead.\n',
  );
});

test('a line starting Blocked: passes', () => {
  assert.equal(evaluate(stop('Tried.\n  Blocked: need the folder name', '/x'), CONFIG), null);
});

test('Plan edits: absent but Blocked: present passes', () => {
  assert.equal(evaluate(stop('Files: a\nChecks: ok\nDeferred: none\nBlocked: the key is missing', '/x'), CONFIG), null);
});

test('an agent not in the list passes', () => {
  const project = makeProject('other-agent');
  assert.equal(runCli(JSON.stringify(stop('nothing', project, 'Explore'))).status, 0);
});

test('a field must start a line', () => {
  assert.deepEqual(missingFields('see Files: a\nChecks: ok', ['Files:', 'Checks:']), ['Files:']);
});

test('no harness.json exits 0', () => {
  const project = makeProject('no-config', null);
  const result = runCli(JSON.stringify(stop('nothing', project)));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('malformed stdin or a missing field exits 0 silently', () => {
  const project = makeProject('malformed');
  const inputs = ['{ nope', '', '[]', 'null', JSON.stringify({ cwd: project, agent_type: 'web-implementer' })];
  for (const stdin of inputs) {
    const result = runCli(stdin);
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, '');
  }
});

test('a continuation stop (stop_hook_active) is let through even with fields missing', () => {
  const project = makeProject('continued');
  const result = runCli(JSON.stringify({ ...stop('Files: a.ts', project), stop_hook_active: true }));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});
