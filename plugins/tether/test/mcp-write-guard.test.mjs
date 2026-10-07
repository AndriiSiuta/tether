import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { denyNames, evaluate } from '../scripts/mcp-write-guard.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'mcp-write-guard.mjs');
const CONFIG = {
  mcpWriteDeny: [
    { server: 'sonarqube', tools: ['change_sonar_issue_status', 'change_security_hotspot_status'], patterns: [] },
    {
      server: 'figma',
      tools: ['use_figma', 'create_new_file', 'upload_assets', 'add_code_connect_map', 'send_code_connect_mappings', 'generate_figma_design'],
      patterns: ['^(create|update)_(shader|generative_plugin)'],
    },
    { server: 'atlassian', tools: [], patterns: ['^(create|edit|add|transition|update)'] },
    {
      server: 'azure-devops',
      tools: [
        'wit_work_item_write',
        'wit_work_item_comment_write',
        'wit_work_item_link_write',
        'repo_pull_request_write',
        'repo_pull_request_thread_write',
        'repo_create_branch',
      ],
      patterns: [],
    },
  ],
};

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

function call(toolName, cwd) {
  return { hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: {}, cwd };
}

function runCli(stdin) {
  return spawnSync(process.execPath, [CLI], { input: stdin, encoding: 'utf8', env: process.env });
}

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'harness-')));
  delete process.env.CLAUDE_PROJECT_DIR;
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test('the CLI prints a PreToolUse deny and exits 0', () => {
  const project = makeProject('deny');
  const result = runCli(JSON.stringify(call('mcp__sonarqube__change_sonar_issue_status', project)));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'tether: mcp__sonarqube__change_sonar_issue_status is an MCP write (server sonarqube, matched change_sonar_issue_status); the deny list is in .claude/harness.json.',
    },
  });
});

const DENIED = [
  ['mcp__sonarqube__change_security_hotspot_status', 'sonarqube', 'change_security_hotspot_status'],
  ['mcp__figma__use_figma', 'figma', 'use_figma'],
  ['mcp__figma__create_shader', 'figma', '/^(create|update)_(shader|generative_plugin)/'],
  ['mcp__atlassian__createJiraIssue', 'atlassian', '/^(create|edit|add|transition|update)/'],
  ['mcp__azure-devops__repo_pull_request_write', 'azure-devops', 'repo_pull_request_write'],
  ['mcp__plugin_figma_figma__use_figma', 'figma', 'use_figma'],
  ['mcp__claude_ai_Figma__use_figma', 'figma', 'use_figma'],
  ['mcp__claude_ai_Atlassian__createJiraIssue', 'atlassian', '/^(create|edit|add|transition|update)/'],
];

for (const [toolName, server, matched] of DENIED) {
  test(`${toolName} is denied`, () => {
    const output = evaluate(call(toolName, '/x'), CONFIG);
    assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(
      output.hookSpecificOutput.permissionDecisionReason,
      `tether: ${toolName} is an MCP write (server ${server}, matched ${matched}); the deny list is in .claude/harness.json.`,
    );
  });
}

const ALLOWED = ['mcp__notfigma__use_figma', 'mcp__figma__get_metadata', 'mcp__sonarqube__search_my_sonarqube_projects', 'mcp__azure-devops__wit_get_work_item', 'Bash'];

for (const toolName of ALLOWED) {
  test(`${toolName} is allowed`, () => {
    assert.equal(evaluate(call(toolName, '/x'), CONFIG), null);
  });
}

test('an allowed tool prints nothing from the CLI', () => {
  const project = makeProject('allow');
  const result = runCli(JSON.stringify(call('mcp__figma__get_metadata', project)));
  assert.equal(result.status, 0);
  assert.equal(result.stdout + result.stderr, '');
});

test('a server that only contains the rule name is not matched', () => {
  assert.equal(evaluate(call('mcp__notfigma__use_figma', '/x'), CONFIG), null);
});

test('denyNames lists every tools entry in config order', () => {
  assert.deepEqual(denyNames(CONFIG), [
    'mcp__sonarqube__change_sonar_issue_status',
    'mcp__sonarqube__change_security_hotspot_status',
    'mcp__figma__use_figma',
    'mcp__figma__create_new_file',
    'mcp__figma__upload_assets',
    'mcp__figma__add_code_connect_map',
    'mcp__figma__send_code_connect_mappings',
    'mcp__figma__generate_figma_design',
    'mcp__azure-devops__wit_work_item_write',
    'mcp__azure-devops__wit_work_item_comment_write',
    'mcp__azure-devops__wit_work_item_link_write',
    'mcp__azure-devops__repo_pull_request_write',
    'mcp__azure-devops__repo_pull_request_thread_write',
    'mcp__azure-devops__repo_create_branch',
  ]);
  assert.deepEqual(denyNames({}), []);
});

test('CLAUDE_PROJECT_DIR naming a configured project still denies when the cwd is elsewhere', () => {
  const project = makeProject('env-project');
  const elsewhere = makeProject('env-elsewhere', null);
  const result = spawnSync(process.execPath, [CLI], {
    input: JSON.stringify(call('mcp__plugin_figma_figma__use_figma', elsewhere)),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('no harness.json exits 0 silently', () => {
  const project = makeProject('no-config', null);
  const result = runCli(JSON.stringify(call('mcp__figma__use_figma', project)));
  assert.equal(result.status, 0);
  assert.equal(result.stdout + result.stderr, '');
});

test('malformed stdin or a missing field exits 0 silently', () => {
  const project = makeProject('malformed');
  for (const stdin of ['{ nope', '', '[]', 'null', JSON.stringify({ cwd: project })]) {
    const result = runCli(stdin);
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, '');
  }
});
