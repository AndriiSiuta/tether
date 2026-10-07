// CLI: node ledger-from-otel.mjs <report.md> [--dry-run]; fills mapped ledger rows from Tempo and Loki, keeps unmapped rows.
// Endpoints default to DEFAULT_ENDPOINTS; HARNESS_OTEL_ENDPOINTS (JSON) overrides any of them.
// Exit 0 when filled, 1 with `telemetry is not reachable` and the file untouched, 2 on usage or a report without a ledger or header lines.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseLedger, renderLedger, replaceLedger } from './lib/ledger.mjs';
import { DEFAULT_ENDPOINTS, agentTotals, telemetryUp } from './lib/otel.mjs';

const DASH = '–';
const EXTRA = ['Tool failures', 'Hook blocks'];

export function parseHeaderLines(md) {
  const line = (label) => md.match(new RegExp(`^${label}:[ \\t]*(.*)$`, 'm'))?.[1] ?? '';
  const sessions = line('Sessions').split(',').map((s) => s.trim()).filter(Boolean);
  const agentIds = new Map();
  for (const pair of line('Agent ids').split(',')) {
    const match = pair.trim().match(/^(\d+)\s*=\s*(\S+)$/);
    if (match) agentIds.set(match[1], match[2]);
  }
  return { sessions, agentIds };
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function fillLedger(md, totalsByRow) {
  const ledger = parseLedger(md);
  if (ledger === null) return null;
  const header = [...ledger.header, ...EXTRA.filter((name) => !ledger.header.includes(name))];
  const rows = ledger.rows.map((row) => {
    const totals = totalsByRow.get(row['#']);
    if (!totals) return Object.fromEntries(header.map((name) => [name, name in row ? row[name] : DASH]));
    return {
      ...row,
      Tokens: fmt(totals.tokens),
      'Tool uses': fmt(totals.toolUses),
      'Wall time': `${fmt(totals.wallMs / 1000)} s`,
      'Tool failures': fmt(totals.toolFailures),
      'Hook blocks': fmt(totals.hookBlocks),
    };
  });
  return { md: replaceLedger(md, ledger, header, rows), table: renderLedger(header, rows) };
}

export async function collectTotals({ sessions, agentIds }, endpoints, totalsOf = agentTotals) {
  const totalsByRow = new Map();
  for (const [row, agentId] of agentIds) {
    for (const session of sessions) {
      const totals = await totalsOf(session, agentId, endpoints);
      if (totals) {
        totalsByRow.set(row, totals);
        break;
      }
    }
  }
  return totalsByRow;
}

export function endpointsFromEnv(env = process.env) {
  if (!env.HARNESS_OTEL_ENDPOINTS) return DEFAULT_ENDPOINTS;
  return { ...DEFAULT_ENDPOINTS, ...JSON.parse(env.HARNESS_OTEL_ENDPOINTS) };
}

async function main(argv) {
  const file = argv.find((a) => !a.startsWith('--'));
  const dryRun = argv.includes('--dry-run');
  if (!file) {
    process.stderr.write('usage: node ledger-from-otel.mjs <report.md> [--dry-run]\n');
    return 2;
  }
  const md = readFileSync(file, 'utf8');
  const mapping = parseHeaderLines(md);
  if (parseLedger(md) === null || mapping.sessions.length === 0 || mapping.agentIds.size === 0) {
    process.stderr.write('the report needs a `| # | Agent |` table and `Sessions:` and `Agent ids:` lines\n');
    return 2;
  }
  let endpoints;
  try {
    endpoints = endpointsFromEnv();
  } catch {
    process.stderr.write('HARNESS_OTEL_ENDPOINTS is not valid JSON\n');
    return 1;
  }
  let filled;
  try {
    if (!(await telemetryUp(endpoints))) throw new Error('down');
    filled = fillLedger(md, await collectTotals(mapping, endpoints));
  } catch {
    process.stderr.write('telemetry is not reachable\n');
    return 1;
  }
  if (dryRun) process.stdout.write(`${filled.table.join('\n')}\n`);
  else writeFileSync(file, filled.md);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
