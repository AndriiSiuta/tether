import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMetrics, ledgerMetrics, median, monthRange, parseArgs, percentile, policyCommand, prMetrics, run } from '../scripts/ado-metrics.mjs';
import { renderLedger } from '../scripts/lib/ledger.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'scripts', 'ado-metrics.mjs');
const TOKEN = 'tok-SECRET-0123456789';
const ADO = { org: 'example-org', project: 'Example Project', repo: 'example-repo' };
const HEADER = ['#', 'Agent', 'Model', 'Task', 'Tokens', 'Tool uses', 'Wall time', 'Findings changed code', 'Findings refuted'];

function project() {
  const root = mkdtempSync(join(tmpdir(), 'harness-'));
  mkdirSync(join(root, '.claude'));
  mkdirSync(join(root, 'reports'));
  writeFileSync(join(root, '.claude', 'harness.json'), JSON.stringify({ ado: ADO, reports: 'reports' }));
  return root;
}

function report(rows) {
  const md = renderLedger(HEADER, rows.map((cells) => Object.fromEntries(HEADER.map((h, i) => [h, cells[i]])))).join('\n');
  return `# Run\n\n${md}\n\nend\n`;
}

function fakeAz(calls, { policies = [] } = {}) {
  return (args) => {
    calls.push(args);
    const cmd = args.slice(0, 3).join(' ');
    if (cmd === 'account get-access-token --resource') return `${TOKEN}\n`;
    if (cmd.startsWith('boards query')) return JSON.stringify([{ id: 1 }, { id: 2 }]);
    if (cmd.startsWith('repos show')) return 'repo-guid-1\n';
    if (cmd === 'repos policy list') return JSON.stringify(policies);
    throw new Error(`unexpected az ${args.join(' ')}`);
  };
}

const PRS = [
  { title: 'feat: a', creationDate: '2026-10-01T00:00:00Z', closedDate: '2026-10-01T10:00:00Z' },
  { title: 'Revert "feat: a"', creationDate: '2026-10-02T00:00:00Z', closedDate: '2026-10-02T02:00:00Z' },
  { title: 'fix: b', creationDate: '2026-09-28T00:00:00Z', closedDate: '2026-10-03T00:00:00Z' },
  { title: 'old', creationDate: '2026-09-01T00:00:00Z', closedDate: '2026-09-30T23:00:00Z' },
];
const BUILDS = [{ result: 'succeeded' }, { result: 'succeeded' }, { result: 'partiallySucceeded' }, { result: 'failed' }, { result: 'canceled' }];

function fakeHttp(calls) {
  return async (url, token) => {
    calls.push({ url, token });
    if (url.includes('/pullrequests?')) return { value: PRS };
    if (url.includes('/build/builds?')) return { value: BUILDS };
    throw new Error(`unexpected GET ${url}`);
  };
}

test('median and p90', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), undefined);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  assert.equal(percentile([7], 90), 7);
  assert.equal(percentile([], 90), undefined);
});

test('PR metrics count the month only, with lead time and reverts', () => {
  const m = prMetrics(PRS, monthRange('2026-10'));
  assert.equal(m.count, 3);
  assert.equal(m.reverts, 1);
  assert.equal(m.medianHours, 10);
  assert.equal(m.p90Hours, 120);
});

test('build fail rate ignores canceled builds', () => {
  const m = buildMetrics(BUILDS);
  assert.equal(m.total, 4);
  assert.equal(m.failRate, 0.25);
  assert.equal(buildMetrics([{ result: 'canceled' }]).failRate, undefined);
});

test('fix rounds and reviewer yield come from the ledger', () => {
  const md = report([
    ['1', 'web-implementer', 'opus', 'Task 1', '100,000', '10', '5m', '0', '0'],
    ['2', 'code-reviewer', 'opus', 'Task 1', '50,000', '5', '2m', '2', '1'],
    ['3', 'web-implementer', 'opus', 'Task 1 fix round 1', '20,000', '3', '1m', '0', '0'],
    ['4', 'conventions-reviewer', 'sonnet', 'Task 1', '200,000', '5', '2m', '1', '0'],
    ['5', 'code-reviewer', 'opus', 'Task 2 Fix Round 2', '150,000', '5', '2m', '1', '0'],
    ['total', '', '', '', '520,000', '', '', '', ''],
  ]);
  const m = ledgerMetrics([{ name: 'a', md }, { name: 'b', md: 'no ledger' }]);
  assert.equal(m.fixRounds, 2);
  assert.deepEqual(
    m.reviewers.map((r) => [r.agent, r.runs, r.tokens, r.changed, r.per100k]),
    [
      ['code-reviewer', 2, 200_000, 3, 1.5],
      ['conventions-reviewer', 1, 200_000, 1, 0.5],
    ],
  );
});

test('parseArgs validates the month and rejects unknown flags', () => {
  assert.deepEqual(parseArgs(['--month', '2026-10', '--project', 'x']), { policyPlan: false, month: '2026-10', project: 'x' });
  assert.ok(parseArgs(['--month', '2026-13']).error);
  assert.ok(parseArgs(['--bogus']).error);
});

test('run writes the month file from injected az and HTTP, and never shows the token', async () => {
  const root = project();
  writeFileSync(join(root, 'reports', '2026-10-05-x-run-report.md'), report([['1', 'code-reviewer', 'opus', 'Task 1 fix round 1', '100,000', '1', '1m', '1', '0']]));
  writeFileSync(join(root, 'reports', '2026-09-30-y-run-report.md'), report([['1', 'code-reviewer', 'opus', 'fix round', '1', '1', '1m', '9', '0']]));
  const azCalls = [];
  const httpCalls = [];
  const result = await run(['--month', '2026-10'], { cwd: root, az: fakeAz(azCalls), http: fakeHttp(httpCalls) });
  assert.equal(result.code, 0, result.err.join('\n'));
  const md = readFileSync(join(root, 'reports', '2026-10-metrics.md'), 'utf8');
  assert.match(md, /Completed PRs into main \| 3 \|/);
  assert.match(md, /Build fail rate \| 25\.0 % \|/);
  assert.match(md, /`ai-escape` bugs created \| 2 \|/);
  assert.match(md, /Fix rounds: 1\n/);
  assert.match(md, /\| code-reviewer \| 1 \| 100,000 \| 1 \| 1\.00 \|/);
  assert.match(md, /team decision/);
  assert.ok(httpCalls.every((c) => c.token === TOKEN));
  assert.ok(httpCalls.every((c) => c.url.startsWith('https://dev.azure.com/example-org/Example%20Project/') && c.url.includes('api-version=7.1')));
  for (const text of [md, ...result.out, ...result.err]) assert.ok(!text.includes(TOKEN));
  const wiql = azCalls.find((a) => a[0] === 'boards')[3];
  assert.match(wiql, /'ai-escape'.*>= '2026-10-01'.*< '2026-11-01'/);
});

test('a failed GET reports without the token', async () => {
  const root = project();
  const http = async () => {
    throw new Error('GET https://dev.azure.com/example-org returned 401');
  };
  const result = await run(['--month', '2026-10'], { cwd: root, az: fakeAz([]), http });
  assert.equal(result.code, 1);
  assert.ok(![...result.out, ...result.err].join('\n').includes(TOKEN));
});

test('--policy-plan prints types and the create command, runs no create and writes nothing', async () => {
  const root = project();
  const calls = [];
  const policies = [{ type: { displayName: 'Build' } }, { type: { displayName: 'Comment requirements' } }, { type: { displayName: 'Build' } }];
  const result = await run(['--policy-plan'], { cwd: root, az: fakeAz(calls, { policies }), http: () => assert.fail('no HTTP in a policy plan') });
  assert.equal(result.code, 0, result.err.join('\n'));
  assert.ok(calls.every((args) => !args.includes('create')));
  assert.deepEqual(calls.map((a) => a.slice(0, 3).join(' ')), ['repos show --repository', 'repos policy list']);
  assert.ok(result.out.includes('  Build') && result.out.includes('  Comment requirements'));
  assert.equal(result.out.at(-1), policyCommand(ADO, 'repo-guid-1'));
  assert.equal(
    result.out.at(-1),
    'az repos policy approver-count create --minimum-approver-count 1 --creator-vote-counts false --reset-on-source-push true --allow-downvotes false --blocking true --enabled true --branch main --repository-id repo-guid-1 --org https://dev.azure.com/example-org --project "Example Project"',
  );
  assert.deepEqual(readFileSync(join(root, '.claude', 'harness.json'), 'utf8'), JSON.stringify({ ado: ADO, reports: 'reports' }));
  assert.equal(spawnSync('ls', [join(root, 'reports')], { encoding: 'utf8' }).stdout, '');
});

test('the CLI exits 1 without a harness.json and 2 on a bad month', () => {
  const empty = mkdtempSync(join(tmpdir(), 'harness-'));
  assert.equal(spawnSync(process.execPath, [CLI, '--project', empty], { encoding: 'utf8', cwd: empty }).status, 1);
  assert.equal(spawnSync(process.execPath, [CLI, '--month', 'oct'], { encoding: 'utf8', cwd: empty }).status, 2);
});

test('metrics command pre-approves the script only and passes $ARGUMENTS through', () => {
  const text = readFileSync(join(HERE, '..', 'commands', 'metrics.md'), 'utf8');
  const line = text.split('\n').find((l) => l.startsWith('allowed-tools:'));
  assert.deepEqual(JSON.parse(line.slice('allowed-tools:'.length).trim()), ['Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/ado-metrics.mjs:*)']);
  assert.match(text, /ado-metrics\.mjs \$ARGUMENTS/);
});
