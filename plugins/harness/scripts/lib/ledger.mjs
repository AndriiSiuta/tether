const HEADER = /^\|\s*#\s*\|\s*Agent\s*\|/;

export const LEDGER_COLUMNS = ['#', 'Agent', 'Model', 'Task', 'Tokens', 'Tool uses', 'Wall time', 'Findings changed code', 'Findings refuted', 'Tool failures', 'Hook blocks'];

function cellsOf(line) {
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

export function parseLedger(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => HEADER.test(l));
  if (start === -1) return null;
  const header = cellsOf(lines[start]);
  const rows = [];
  let end = start + 1;
  if (end < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[end])) end++;
  for (; end < lines.length && lines[end].startsWith('|'); end++) {
    const cells = cellsOf(lines[end]);
    rows.push(Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ''])));
  }
  return { header, rows, start, end };
}

export function renderLedger(header, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(header), `|${header.map(() => '---').join('|')}|`, ...rows.map((row) => line(header.map((name) => row[name] ?? '')))];
}

export function replaceLedger(md, ledger, header, rows) {
  const lines = md.split('\n');
  lines.splice(ledger.start, ledger.end - ledger.start, ...renderLedger(header, rows));
  return lines.join('\n');
}

const num = (s) => Number(String(s ?? '').replace(/[^\d]/g, '')) || 0;
const fmt = (n) => n.toLocaleString('en-US');

export function ledgerStats(ledger) {
  const has = (name) => ledger.header.includes(name);
  const hasFindings = has('Findings changed code');
  const hasHealth = has('Tool failures') && has('Hook blocks');
  const rows = ledger.rows
    .filter((row) => /^\d+$/.test(row['#']))
    .map((row) => ({
      agent: row.Agent,
      tokens: num(row.Tokens),
      changed: num(row['Findings changed code']),
      refuted: num(row['Findings refuted']),
      failures: num(row['Tool failures']),
      blocks: num(row['Hook blocks']),
    }));
  const total = rows.reduce((s, r) => s + r.tokens, 0);
  const byAgent = new Map();
  for (const r of rows) {
    const a = byAgent.get(r.agent) ?? { runs: 0, tokens: 0, changed: 0, refuted: 0, failures: 0, blocks: 0 };
    a.runs++;
    a.tokens += r.tokens;
    a.changed += r.changed;
    a.refuted += r.refuted;
    a.failures += r.failures;
    a.blocks += r.blocks;
    byAgent.set(r.agent, a);
  }
  const health = (failures, blocks) => (hasHealth ? `  ${String(failures).padStart(8)} ${String(blocks).padStart(6)}` : '');
  const out = [`${'agent'.padEnd(30)} ${'runs'.padStart(4)} ${'tokens'.padStart(11)} ${'share'.padStart(6)} ${'per run'.padStart(9)}${hasHealth ? `  ${'failures'.padStart(8)} ${'blocks'.padStart(6)}` : ''}  findings/100k (refuted)`];
  for (const [agent, a] of [...byAgent].sort((x, y) => y[1].tokens - x[1].tokens)) {
    const per100k = hasFindings ? `${((a.changed / a.tokens) * 100_000).toFixed(2)} (${a.refuted})` : '-';
    out.push(
      `${agent.padEnd(30)} ${String(a.runs).padStart(4)} ${fmt(a.tokens).padStart(11)} ${((a.tokens / total) * 100).toFixed(0).padStart(5)}% ${fmt(Math.round(a.tokens / a.runs)).padStart(9)}${health(a.failures, a.blocks)}  ${per100k}`,
    );
  }
  const totalLine = `${'total'.padEnd(30)} ${String(rows.length).padStart(4)} ${fmt(total).padStart(11)}`;
  out.push(hasHealth ? `${totalLine} ${''.padStart(6)} ${''.padStart(9)}${health(rows.reduce((s, r) => s + r.failures, 0), rows.reduce((s, r) => s + r.blocks, 0))}` : totalLine);
  return out;
}
