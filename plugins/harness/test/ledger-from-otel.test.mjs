import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillLedger, parseHeaderLines } from '../scripts/ledger-from-otel.mjs';
import { DEFAULT_ENDPOINTS, agentTotals, sessionTotals, telemetryUp } from '../scripts/lib/otel.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'ledger-from-otel.mjs');
const MS = 1_000_000n;
const T0 = 1_700_000_000_000n * MS;
const queries = { tempo: [], loki: [], prometheus: [] };
const servers = [];
let endpoints;
let sandbox;

const int = (key, value) => ({ key, value: { intValue: String(value) } });
const str = (key, value) => ({ key, value: { stringValue: value } });
const span = (spanID, name, startMs, durationMs, attributes) => ({
  spanID,
  name,
  startTimeUnixNano: String(T0 + BigInt(startMs) * MS),
  durationNanos: String(BigInt(durationMs) * MS),
  attributes,
});

const AGENT_SPANS = [
  span('a1', 'claude_code.llm_request', 0, 2000, [int('input_tokens', 1000), int('output_tokens', 200), int('cache_read_tokens', 50_000), int('cache_creation_tokens', 3000)]),
  span('a2', 'claude_code.tool', 2000, 500, [str('tool_use_id', 'toolu_1')]),
  span('a3', 'claude_code.tool', 2600, 400, [str('tool_use_id', 'toolu_2')]),
  span('a4', 'claude_code.llm_request', 3000, 62_000, [int('input_tokens', 10), int('output_tokens', 20), int('cache_read_tokens', 30), int('cache_creation_tokens', 40)]),
];

function json(res, body) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const handlers = {
  prometheus(url, res) {
    if (url.pathname === '/-/ready') return res.end('ready');
    queries.prometheus.push(url.searchParams.get('query'));
    json(res, { status: 'success', data: { resultType: 'vector', result: [{ metric: {}, value: [1, '99000'] }] } });
  },
  tempo(url, res) {
    if (url.pathname === '/ready') return res.end('ready');
    const q = url.searchParams.get('q');
    queries.tempo.push(q);
    const match = q.includes('span.agent_id = "agent-a"') || !q.includes('agent_id');
    json(res, { traces: match ? [{ traceID: 't1', spanSets: [{ spans: AGENT_SPANS.slice(0, 2) }, { spans: AGENT_SPANS.slice(1) }] }] : [] });
  },
  loki(url, res) {
    if (url.pathname === '/ready') return res.end('ready');
    const query = url.searchParams.get('query');
    queries.loki.push(query);
    if (url.pathname.endsWith('/query')) return json(res, { status: 'success', data: { resultType: 'vector', result: query.includes('agent_id') ? [{ metric: {}, value: [1, '2'] }] : [{ metric: {}, value: [1, '5'] }] } });
    json(res, {
      status: 'success',
      data: {
        resultType: 'streams',
        result: [
          { stream: { tool_use_id: 'toolu_2' }, values: [['1', 'tool_decision']] },
          { stream: { tool_use_id: 'toolu_other' }, values: [['2', 'tool_decision'], ['3', 'tool_decision']] },
        ],
      },
    });
  },
};

function listen(handler) {
  return new Promise((done) => {
    const server = createServer((req, res) => handler(new URL(req.url, 'http://x'), res));
    servers.push(server);
    server.listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${server.address().port}`));
  });
}

function closedPort() {
  return new Promise((done) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(`http://127.0.0.1:${port}`));
    });
  });
}

function runCli(args, env) {
  return new Promise((done) => {
    execFile(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, ...env } }, (error, stdout, stderr) => done({ status: error ? error.code : 0, stdout, stderr }));
  });
}

const REPORT = `# Run report

Sessions: sess-0, sess-1
Agent ids: 1=agent-a, 2=agent-unknown

| # | Agent | Model | Task | Tokens | Tool uses | Wall time | Findings changed code | Findings refuted |
|---|---|---|---|---|---|---|---|---|
| 1 | web-implementer | opus | Task 1 | 0 | 0 | 0 s | – | – |
| 2 | code-reviewer | opus | Task 1 review | 51,536 | 14 | 104 s | 0 | 0 |
| 3 | planner | opus | plan | 272,466 | 42 | 1,339 s | – | – |

After.
`;

function writeReport(name) {
  const file = join(sandbox, name);
  writeFileSync(file, REPORT);
  return file;
}

before(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'harness-'));
  endpoints = { prometheus: await listen(handlers.prometheus), tempo: await listen(handlers.tempo), loki: await listen(handlers.loki) };
});

after(() => {
  for (const server of servers) server.close();
});

test('DEFAULT_ENDPOINTS match the telemetry stack', () => {
  assert.deepEqual({ ...DEFAULT_ENDPOINTS }, { prometheus: 'http://127.0.0.1:9090', tempo: 'http://127.0.0.1:3200', loki: 'http://127.0.0.1:3100' });
});

test('telemetryUp is true with all three up and false when one is down', async () => {
  assert.equal(await telemetryUp(endpoints), true);
  assert.equal(await telemetryUp({ ...endpoints, loki: await closedPort() }), false);
});

test('agentTotals sums the agent spans, counts failures and joins hook rejects on tool_use_id', async () => {
  const totals = await agentTotals('sess-1', 'agent-a', endpoints);
  assert.deepEqual(totals, { tokens: 54_300, toolUses: 2, wallMs: 65_000, toolFailures: 2, hookBlocks: 1 });
  assert.ok(queries.tempo.some((q) => q.includes('.session.id = "sess-1"') && q.includes('span.agent_id = "agent-a"')));
  assert.ok(queries.loki.some((q) => q.includes('event_name="tool_result"') && q.includes('agent_id="agent-a"') && q.includes('success="false"')));
  assert.ok(queries.loki.some((q) => q.includes('event_name="tool_decision"') && q.includes('decision="reject"') && q.includes('source="hook"')));
  assert.equal(await agentTotals('sess-1', 'agent-unknown', endpoints), null);
});

test('sessionTotals takes tokens from Prometheus and counts every hook reject', async () => {
  const totals = await sessionTotals('sess-1', endpoints);
  assert.deepEqual(totals, { tokens: 99_000, toolUses: 2, wallMs: 65_000, toolFailures: 5, hookBlocks: 3 });
  assert.ok(queries.prometheus.includes('sum({__name__=~"claude_code_token_usage(_tokens)?(_total)?", session_id="sess-1"})'));
});

test('parseHeaderLines reads the sessions and the row-to-agent map', () => {
  const { sessions, agentIds } = parseHeaderLines(REPORT);
  assert.deepEqual(sessions, ['sess-0', 'sess-1']);
  assert.deepEqual([...agentIds], [['1', 'agent-a'], ['2', 'agent-unknown']]);
});

test('fillLedger fills mapped rows, keeps unmapped rows and appends the two columns', () => {
  const totals = new Map([['1', { tokens: 54_300, toolUses: 2, wallMs: 65_000, toolFailures: 2, hookBlocks: 1 }]]);
  const { md } = fillLedger(REPORT, totals);
  assert.match(md, /\| # \| Agent \| Model \| Task \| Tokens \| Tool uses \| Wall time \| Findings changed code \| Findings refuted \| Tool failures \| Hook blocks \|/);
  assert.match(md, /\| 1 \| web-implementer \| opus \| Task 1 \| 54,300 \| 2 \| 65 s \| – \| – \| 2 \| 1 \|/);
  assert.match(md, /\| 2 \| code-reviewer \| opus \| Task 1 review \| 51,536 \| 14 \| 104 s \| 0 \| 0 \| – \| – \|/);
  assert.match(md, /\| 3 \| planner \| opus \| plan \| 272,466 \| 42 \| 1,339 s \| – \| – \| – \| – \|/);
  assert.ok(md.startsWith('# Run report\n\nSessions:'));
  assert.ok(md.endsWith('\nAfter.\n'));
});

test('the CLI fills the report in place from the fake telemetry', async () => {
  const file = writeReport('fill.md');
  const result = await runCli([file], { HARNESS_OTEL_ENDPOINTS: JSON.stringify(endpoints) });
  assert.equal(result.status, 0, result.stderr);
  const md = readFileSync(file, 'utf8');
  assert.match(md, /\| 1 \| web-implementer \| opus \| Task 1 \| 54,300 \| 2 \| 65 s \| – \| – \| 2 \| 1 \|/);
  assert.match(md, /\| 2 \| code-reviewer \| opus \| Task 1 review \| 51,536 \| 14 \| 104 s \| 0 \| 0 \| – \| – \|/);
});

test('--dry-run prints the filled table and writes nothing', async () => {
  const file = writeReport('dry.md');
  const result = await runCli([file, '--dry-run'], { HARNESS_OTEL_ENDPOINTS: JSON.stringify(endpoints) });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\| # \| Agent \|/);
  assert.match(result.stdout, /\| 54,300 \| 2 \| 65 s \|/);
  assert.equal(readFileSync(file, 'utf8'), REPORT);
});

test('telemetry down: exit 1 and the file stays byte-identical', async () => {
  const file = writeReport('down.md');
  const down = await closedPort();
  const result = await runCli([file], { HARNESS_OTEL_ENDPOINTS: JSON.stringify({ prometheus: down, tempo: down, loki: down }) });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /telemetry is not reachable/);
  assert.equal(readFileSync(file, 'utf8'), REPORT);
});

test('a report without header lines exits 2', async () => {
  const file = join(sandbox, 'bare.md');
  writeFileSync(file, REPORT.replace(/^Sessions:.*\n/m, ''));
  const result = await runCli([file], { HARNESS_OTEL_ENDPOINTS: JSON.stringify(endpoints) });
  assert.equal(result.status, 2);
});

test('a malformed HARNESS_OTEL_ENDPOINTS exits 1 without echoing its value', async () => {
  const file = writeReport('bad-env.md');
  const result = await runCli([file], { HARNESS_OTEL_ENDPOINTS: '{not-json-secret-marker' });
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'HARNESS_OTEL_ENDPOINTS is not valid JSON\n');
  assert.doesNotMatch(result.stdout + result.stderr, /secret-marker/);
  assert.equal(readFileSync(file, 'utf8'), REPORT);
});
