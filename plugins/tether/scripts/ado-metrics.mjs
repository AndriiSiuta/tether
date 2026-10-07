// CLI: node ado-metrics.mjs [--month YYYY-MM] [--policy-plan] [--project <dir>]; read-only ADO and ledger metrics.
// Writes <reports>/<YYYY-MM>-metrics.md; --policy-plan prints the branch policies and the create command, writes nothing.
// Exit 0 on success, 1 on a missing config or a failed read, 2 on bad arguments; the access token is never printed.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findConfig } from './lib/config.mjs';
import { parseLedger } from './lib/ledger.mjs';

const ADO_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';
const API_VERSION = '7.1';
const PAGE = 1000;
const HOUR_MS = 3_600_000;

export function parseArgs(argv) {
  const args = { policyPlan: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--policy-plan') args.policyPlan = true;
    else if (arg === '--month') args.month = argv[++i];
    else if (arg === '--project') args.project = argv[++i];
    else return { error: `unknown argument: ${arg}` };
  }
  if (args.month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(args.month)) return { error: `--month must be YYYY-MM, got ${args.month}` };
  return args;
}

export function currentMonth(now) {
  return now.toISOString().slice(0, 7);
}

export function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(year, mon - 1, 1)), end: new Date(Date.UTC(year, mon, 1)) };
}

export function median(values) {
  if (values.length === 0) return undefined;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values, p) {
  if (values.length === 0) return undefined;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

const inRange = (iso, { start, end }) => {
  const t = Date.parse(iso);
  return t >= start.getTime() && t < end.getTime();
};

export function prMetrics(prs, range) {
  const closed = prs.filter((pr) => inRange(pr.closedDate, range));
  const hours = closed.map((pr) => (Date.parse(pr.closedDate) - Date.parse(pr.creationDate)) / HOUR_MS);
  return {
    count: closed.length,
    medianHours: median(hours),
    p90Hours: percentile(hours, 90),
    reverts: closed.filter((pr) => /^Revert/.test(pr.title ?? '')).length,
  };
}

export function buildMetrics(builds) {
  const counted = { succeeded: 0, partiallySucceeded: 0, failed: 0 };
  for (const build of builds) if (Object.hasOwn(counted, build.result)) counted[build.result] += 1;
  const total = counted.succeeded + counted.partiallySucceeded + counted.failed;
  return { ...counted, total, failRate: total === 0 ? undefined : counted.failed / total };
}

const num = (s) => Number(String(s ?? '').replace(/[^\d]/g, '')) || 0;

export function ledgerMetrics(reports) {
  let fixRounds = 0;
  const reviewers = new Map();
  for (const { md } of reports) {
    const ledger = parseLedger(md);
    if (ledger === null) continue;
    for (const row of ledger.rows) {
      if (!/^\d+$/.test(row['#'] ?? '')) continue;
      if (/fix round/i.test(row.Task ?? '')) fixRounds += 1;
      if (!/reviewer/i.test(row.Agent ?? '')) continue;
      const entry = reviewers.get(row.Agent) ?? { runs: 0, tokens: 0, changed: 0 };
      entry.runs += 1;
      entry.tokens += num(row.Tokens);
      entry.changed += num(row['Findings changed code']);
      reviewers.set(row.Agent, entry);
    }
  }
  const yieldRows = [...reviewers]
    .map(([agent, r]) => ({ agent, ...r, per100k: r.tokens === 0 ? undefined : (r.changed / r.tokens) * 100_000 }))
    .sort((a, b) => a.agent.localeCompare(b.agent));
  return { reportCount: reports.length, fixRounds, reviewers: yieldRows };
}

export function readMonthReports(dir, month) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.startsWith(`${month}-`) && name.endsWith('-run-report.md'))
    .sort()
    .map((name) => ({ name, md: readFileSync(join(dir, name), 'utf8') }));
}

export function adoTarget(config) {
  const ado = config?.ado;
  if (ado === null || typeof ado !== 'object') return null;
  const { org, project, repo } = ado;
  if (![org, project, repo].every((v) => typeof v === 'string' && v !== '')) return null;
  return { org, project, repo, orgUrl: `https://dev.azure.com/${encodeURIComponent(org)}`, base: `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}` };
}

export function defaultAz(args) {
  return execFileSync('az', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export async function defaultHttp(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`GET ${url.split('?')[0]} returned ${response.status}`);
  return response.json();
}

function azJson(az, args) {
  return JSON.parse(az([...args, '-o', 'json']));
}

export function accessToken(az) {
  return az(['account', 'get-access-token', '--resource', ADO_RESOURCE, '--query', 'accessToken', '-o', 'tsv']).trim();
}

function query(params) {
  return Object.entries({ ...params, 'api-version': API_VERSION })
    .map(([k, v]) => `${encodeURIComponent(k).replace('%24', '$')}=${encodeURIComponent(v)}`)
    .join('&');
}

export async function fetchPullRequests(http, token, target, range) {
  const prs = [];
  for (let skip = 0; ; skip += PAGE) {
    const url = `${target.base}/_apis/git/repositories/${encodeURIComponent(target.repo)}/pullrequests?${query({
      'searchCriteria.status': 'completed',
      'searchCriteria.targetRefName': 'refs/heads/main',
      'searchCriteria.queryTimeRangeType': 'closed',
      'searchCriteria.minTime': range.start.toISOString(),
      'searchCriteria.maxTime': range.end.toISOString(),
      $top: PAGE,
      $skip: skip,
    })}`;
    const page = (await http(url, token)).value ?? [];
    prs.push(...page);
    if (page.length < PAGE) return prs;
  }
}

export async function fetchBuilds(http, token, target, range) {
  const url = `${target.base}/_apis/build/builds?${query({
    branchName: 'refs/heads/main',
    statusFilter: 'completed',
    minTime: range.start.toISOString(),
    maxTime: range.end.toISOString(),
    $top: 5000,
  })}`;
  return (await http(url, token)).value ?? [];
}

export function escapeWiql(value) {
  return value.replaceAll("'", "''");
}

export function countEscapes(az, target, range) {
  const day = (d) => d.toISOString().slice(0, 10);
  const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapeWiql(target.project)}' AND [System.WorkItemType] = 'Bug' AND [System.Tags] CONTAINS 'ai-escape' AND [System.CreatedDate] >= '${day(range.start)}' AND [System.CreatedDate] < '${day(range.end)}'`;
  const items = azJson(az, ['boards', 'query', '--wiql', wiql, '--org', target.orgUrl, '--project', target.project]);
  return Array.isArray(items) ? items.length : 0;
}

const hours = (h) => (h === undefined ? 'n/a' : `${h.toFixed(1)} h`);
const percent = (r) => (r === undefined ? 'n/a' : `${(r * 100).toFixed(1)} %`);

export function renderMetrics({ month, target, prs, builds, escapes, ledger }) {
  const lines = [
    `# Tether metrics ${month}`,
    '',
    `Source: ${target.org} / ${target.project} / ${target.repo}, \`refs/heads/main\`; ${ledger.reportCount} run report(s).`,
    '',
    '## Delivery',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Completed PRs into main | ${prs.count} |`,
    `| Lead time, median | ${hours(prs.medianHours)} |`,
    `| Lead time, p90 | ${hours(prs.p90Hours)} |`,
    `| Reverts | ${prs.reverts} |`,
    `| Builds on main (succeeded / partially / failed) | ${builds.succeeded} / ${builds.partiallySucceeded} / ${builds.failed} |`,
    `| Build fail rate | ${percent(builds.failRate)} |`,
    `| \`ai-escape\` bugs created | ${escapes} |`,
    '',
    '## Tether',
    '',
    `Fix rounds: ${ledger.fixRounds}`,
    '',
    '| Reviewer | Runs | Tokens | Findings changed code | Per 100k tokens |',
    '|---|---|---|---|---|',
    ...ledger.reviewers.map((r) => `| ${r.agent} | ${r.runs} | ${r.tokens.toLocaleString('en-US')} | ${r.changed} | ${r.per100k === undefined ? 'n/a' : r.per100k.toFixed(2)} |`),
    '',
    '---',
    '',
    'Proposal for a team decision: tag a bug `ai-escape` when it reached main through AI-written code that passed review, so this count measures what the harness let through.',
    '',
  ];
  return lines.join('\n');
}

export async function collectMetrics({ config, month, az, http }) {
  const target = adoTarget(config);
  const range = monthRange(month);
  const token = accessToken(az);
  const [prs, builds] = await Promise.all([fetchPullRequests(http, token, target, range), fetchBuilds(http, token, target, range)]);
  return {
    month,
    target,
    prs: prMetrics(prs, range),
    builds: buildMetrics(builds),
    escapes: countEscapes(az, target, range),
  };
}

export function policyCommand(target, repositoryId) {
  return `az repos policy approver-count create --minimum-approver-count 1 --creator-vote-counts false --reset-on-source-push true --allow-downvotes false --blocking true --enabled true --branch main --repository-id ${repositoryId} --org https://dev.azure.com/${target.org} --project "${target.project}"`;
}

export function policyPlan({ config, az }) {
  const target = adoTarget(config);
  const scope = ['--org', target.orgUrl, '--project', target.project];
  const repositoryId = az(['repos', 'show', '--repository', target.repo, ...scope, '--query', 'id', '-o', 'tsv']).trim();
  const policies = azJson(az, ['repos', 'policy', 'list', '--branch', 'main', '--repository-id', repositoryId, ...scope]);
  const types = [...new Set((Array.isArray(policies) ? policies : []).map((p) => p?.type?.displayName).filter(Boolean))].sort();
  return [
    `Branch policies on main in ${target.repo} (${repositoryId}):`,
    ...(types.length === 0 ? ['  none'] : types.map((t) => `  ${t}`)),
    '',
    'Proposed reviewer policy (not run):',
    policyCommand(target, repositoryId),
  ];
}

export async function run(argv, { cwd = process.cwd(), now = new Date(), az = defaultAz, http = defaultHttp } = {}) {
  const args = parseArgs(argv);
  if (args.error) return { code: 2, out: [], err: [args.error, 'usage: ado-metrics.mjs [--month YYYY-MM] [--policy-plan] [--project <dir>]'] };
  const found = findConfig(resolve(cwd, args.project ?? '.'));
  if (found === null) return { code: 1, out: [], err: ['no .claude/harness.json for this project'] };
  if (adoTarget(found.config) === null) return { code: 1, out: [], err: ['harness.json has no ado.org, ado.project and ado.repo'] };
  try {
    if (args.policyPlan) return { code: 0, out: policyPlan({ config: found.config, az }), err: [] };
    const month = args.month ?? currentMonth(now);
    if (typeof found.config.reports !== 'string') return { code: 1, out: [], err: ['harness.json has no reports folder'] };
    const reportsDir = join(found.root, found.config.reports);
    const metrics = await collectMetrics({ config: found.config, month, az, http });
    const ledger = ledgerMetrics(readMonthReports(reportsDir, month));
    const file = join(reportsDir, `${month}-metrics.md`);
    writeFileSync(file, renderMetrics({ ...metrics, ledger }));
    return { code: 0, out: [`wrote ${file}`], err: [] };
  } catch (error) {
    return { code: 1, out: [], err: [`ado-metrics: ${error.message.split('\n')[0]}`] };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { code, out, err } = await run(process.argv.slice(2));
  if (out.length > 0) process.stdout.write(`${out.join('\n')}\n`);
  if (err.length > 0) process.stderr.write(`${err.join('\n')}\n`);
  process.exitCode = code;
}
