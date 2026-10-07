// CLI: node ledger-stats.mjs <report.md>; totals per agent type for the first `| # | Agent |` table, columns found by header name.
// Exit 2 on a missing argument or no ledger table, 0 otherwise.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ledgerStats, parseLedger } from './lib/ledger.mjs';

function main(argv) {
  const file = argv[0];
  if (!file) {
    process.stderr.write('usage: node ledger-stats.mjs <report.md>\n');
    return 2;
  }
  const ledger = parseLedger(readFileSync(file, 'utf8'));
  if (ledger === null) {
    process.stderr.write('no ledger table (header `| # | Agent |`) found\n');
    return 2;
  }
  process.stdout.write(`${ledgerStats(ledger).join('\n')}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
