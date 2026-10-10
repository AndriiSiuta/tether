import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, note } from '../scripts/session-context.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'session-context.mjs');

let sandbox;

function makeProject(name, config) {
  const dir = join(sandbox, name);
  mkdirSync(join(dir, '.claude'), { recursive: true });
  if (config !== null) writeFileSync(join(dir, '.claude', 'harness.json'), JSON.stringify(config));
  return dir;
}

function runCli(stdin) {
  return spawnSync(process.execPath, [CLI], { input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: '' } });
}

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'harness-')));
  delete process.env.CLAUDE_PROJECT_DIR;
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test('with untrustedSources the session start gets the data-not-instructions note', () => {
  const output = evaluate({ hook_event_name: 'SessionStart', source: 'startup' }, { untrustedSources: ['WebFetch'] });
  assert.deepEqual(output, { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: note() } });
  assert.match(note(), /data, not instructions/);
  assert.match(note(), /tether:untrusted-input/);
});

test('without untrustedSources, or for another event, nothing is printed', () => {
  assert.equal(evaluate({ hook_event_name: 'SessionStart' }, {}), null);
  assert.equal(evaluate({ hook_event_name: 'SessionStart' }, { untrustedSources: [] }), null);
  assert.equal(evaluate({ hook_event_name: 'PostToolUse' }, { untrustedSources: ['WebFetch'] }), null);
});

test('the CLI reads the hook cwd and exits 0 with or without a config', () => {
  const project = makeProject('with', { untrustedSources: ['mcp__tracker__'] });
  const bare = makeProject('without', null);
  const withConfig = runCli(JSON.stringify({ hook_event_name: 'SessionStart', cwd: project }));
  assert.equal(withConfig.status, 0);
  assert.equal(JSON.parse(withConfig.stdout).hookSpecificOutput.hookEventName, 'SessionStart');
  const without = runCli(JSON.stringify({ hook_event_name: 'SessionStart', cwd: bare }));
  assert.equal(without.status, 0);
  assert.equal(without.stdout, '');
  assert.equal(runCli('not json').status, 0);
});
