import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, specPaths } from '../scripts/spec-cap.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'spec-cap.mjs');
const CONFIG = { spec: { dir: 'notes/specs', maxWords: 10, agent: 'spec-writer' } };
const TODAY = new Date().toISOString().slice(0, 10);
const OVER = `${'word '.repeat(11)}\n`;
const UNDER = `${'word '.repeat(10)}\n`;

let sandbox;

function makeProject(name, config = CONFIG) {
  const dir = join(sandbox, name);
  mkdirSync(join(dir, 'notes', 'specs'), { recursive: true });
  if (config !== null) {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'harness.json'), JSON.stringify(config));
  }
  return dir;
}

function writeSpec(dir, name, content) {
  writeFileSync(join(dir, 'notes', 'specs', name), content);
  return `notes/specs/${name}`;
}

function stop(message, cwd, agentType = 'spec-writer') {
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

test('a spec dated today under the cap passes', () => {
  const project = makeProject('under');
  const path = writeSpec(project, `${TODAY}-small.md`, UNDER);
  const result = runCli(JSON.stringify(stop(`Wrote ${path}.`, project)));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('a spec dated today over the cap exits 2 with one stderr paragraph', () => {
  const project = makeProject('over');
  const path = writeSpec(project, `${TODAY}-big.md`, OVER);
  const result = runCli(JSON.stringify(stop(`Wrote ${path} and ${path}.`, project)));
  assert.equal(result.status, 2);
  assert.equal(
    result.stderr,
    `Spec over the 10-word cap, tables included: ${path} (11 words). Cut it to the decisions ` +
      '(a plan carries the rest), or split a component wave into one spec per batch of at most six ' +
      'components, then report again.\n',
  );
});

test('an older-dated spec over the cap passes', () => {
  const project = makeProject('older');
  const path = writeSpec(project, '2000-01-01-old.md', OVER);
  assert.equal(evaluate(stop(`Amended ${path}.`, project), { root: project, config: CONFIG }, TODAY), null);
});

test('another agent passes', () => {
  const project = makeProject('other-agent');
  const path = writeSpec(project, `${TODAY}-big.md`, OVER);
  assert.equal(runCli(JSON.stringify(stop(`Wrote ${path}.`, project, 'planner'))).status, 0);
});

test('paths resolve against the config root, not the cwd', () => {
  const project = makeProject('root');
  const path = writeSpec(project, `${TODAY}-big.md`, OVER);
  assert.match(evaluate(stop(`Wrote ${path}.`, '/elsewhere'), { root: project, config: CONFIG }, TODAY), /11 words/);
});

test('the directory is matched literally', () => {
  assert.deepEqual(specPaths(`notesXspecs/${TODAY}-a.md notes/specs/${TODAY}-b.md`, 'notes.specs/', TODAY), []);
  assert.deepEqual(specPaths(`see notes/specs/${TODAY}-b.md`, 'notes/specs/', TODAY), [`notes/specs/${TODAY}-b.md`]);
});

test('a named spec that does not exist passes', () => {
  const project = makeProject('absent');
  assert.equal(runCli(JSON.stringify(stop(`Wrote notes/specs/${TODAY}-gone.md.`, project))).status, 0);
});

test('no harness.json exits 0', () => {
  const project = makeProject('no-config', null);
  const path = writeSpec(project, `${TODAY}-big.md`, OVER);
  const result = runCli(JSON.stringify(stop(`Wrote ${path}.`, project)));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('malformed stdin or a missing field exits 0 silently', () => {
  const project = makeProject('malformed');
  writeSpec(project, `${TODAY}-big.md`, OVER);
  const inputs = ['{ nope', '', '[]', 'null', JSON.stringify({ cwd: project, agent_type: 'spec-writer' })];
  for (const stdin of inputs) {
    const result = runCli(stdin);
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, '');
  }
});
