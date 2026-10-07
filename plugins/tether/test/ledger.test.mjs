import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ledgerStats, parseLedger, renderLedger } from '../scripts/lib/ledger.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'scripts', 'ledger-stats.mjs');
const FIXTURE = join(HERE, 'fixtures', 'ledger-9-columns.md');

const OLD_OUTPUT = `agent                          runs      tokens  share   per run  findings/100k (refuted)
web-implementer-mechanical        3     346,946    21%   115,649  0.00 (0)
planner                           1     272,466    17%   272,466  0.00 (0)
conventions-reviewer              3     262,035    16%    87,345  0.00 (0)
investigator                      1     231,200    14%   231,200  0.00 (0)
code-reviewer                     3     226,040    14%    75,347  0.00 (0)
spec-writer                       1     186,488    12%   186,488  0.00 (0)
web-implementer                   1      94,245     6%    94,245  0.00 (0)
total                            13   1,619,420
`;

function table(header, rows) {
  return `intro\n\n${renderLedger(header, rows.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i]])))).join('\n')}\n\noutro\n`;
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

test('the 9-column fixture prints what the old script printed', () => {
  const result = runCli([FIXTURE]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, OLD_OUTPUT);
});

test('parseLedger keys cells by header name and bounds the table', () => {
  const md = readFileSync(FIXTURE, 'utf8');
  const ledger = parseLedger(md);
  assert.equal(ledger.rows.length, 13);
  assert.equal(ledger.rows[0].Agent, 'investigator');
  assert.equal(ledger.rows[0]['Wall time'], '1,050 s');
  const lines = md.split('\n');
  assert.match(lines[ledger.start], /^\| # \| Agent \|/);
  assert.equal(lines[ledger.end], '');
  assert.equal(parseLedger('no table here'), null);
});

test('7 columns: no findings, per-100k is a dash', () => {
  const header = ['#', 'Agent', 'Model', 'Task', 'Tokens', 'Tool uses', 'Wall time'];
  const out = ledgerStats(parseLedger(table(header, [['1', 'planner', 'm', 't', '1,000', '3', '10 s'], ['2', 'planner', 'm', 't', '3,000', '3', '10 s']])));
  assert.equal(out[1], `${'planner'.padEnd(30)}    2       4,000   100%     2,000  -`);
  assert.doesNotMatch(out[0], /failures/);
});

test('11 columns: findings and the per-agent failure and block totals', () => {
  const header = ['#', 'Agent', 'Model', 'Task', 'Tokens', 'Tool uses', 'Wall time', 'Findings changed code', 'Findings refuted', 'Tool failures', 'Hook blocks'];
  const out = ledgerStats(
    parseLedger(
      table(header, [
        ['1', 'reviewer', 'm', 't', '100,000', '3', '10 s', '2', '1', '4', '1'],
        ['2', 'reviewer', 'm', 't', '100,000', '3', '10 s', '1', '0', '–', '2'],
      ]),
    ),
  );
  assert.match(out[0], /per run  failures blocks  findings/);
  assert.equal(out[1], `${'reviewer'.padEnd(30)}    2     200,000   100%   100,000         4      3  1.50 (1)`);
  assert.match(out[2], /^total +2 +200,000 +4 +3$/);
});

test('columns are found by name, so 7 plus the two new columns in another order still count', () => {
  const header = ['#', 'Agent', 'Hook blocks', 'Model', 'Task', 'Tokens', 'Tool uses', 'Wall time', 'Tool failures'];
  const out = ledgerStats(parseLedger(table(header, [['1', 'impl', '2', 'm', 't', '5,000', '3', '10 s', '7']])));
  assert.equal(out[1], `${'impl'.padEnd(30)}    1       5,000   100%     5,000         7      2  -`);
});

test('the CLI exits 2 without an argument or without a ledger', () => {
  assert.equal(runCli([]).status, 2);
  const dir = mkdtempSync(join(tmpdir(), 'harness-'));
  writeFileSync(join(dir, 'r.md'), '# nothing\n');
  const result = runCli([join(dir, 'r.md')]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no ledger table/);
});
