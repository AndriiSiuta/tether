// CLI: node setup.mjs [--only telemetry|deny|mcp-pins|sandbox] [--user] [--dry-run] [--yes] [--project <dir>]
// Prints a key-level diff per part, then backs up, writes and re-reads the target on confirmation.
// Exit 0 done or unchanged, 1 on a malformed target or bad arguments, 3 when a change needs --yes without a TTY.
import { execFileSync } from 'node:child_process';
import { copyFileSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { findConfig } from './lib/config.mjs';

export const PARTS = ['telemetry', 'deny', 'mcp-pins', 'sandbox'];

export const TELEMETRY_ENV = {
  CLAUDE_CODE_ENABLE_TELEMETRY: '1',
  OTEL_METRICS_EXPORTER: 'otlp',
  OTEL_LOGS_EXPORTER: 'otlp',
  OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4317',
  OTEL_LOG_TOOL_DETAILS: '1',
  OTEL_METRICS_INCLUDE_REPOSITORY: 'true',
  CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: '1',
  OTEL_TRACES_EXPORTER: 'otlp',
  OTEL_LOG_USER_PROMPTS: '0',
  OTEL_LOG_ASSISTANT_RESPONSES: '0',
  OTEL_LOG_TOOL_CONTENT: '0',
  OTEL_LOG_RAW_API_BODIES: '0',
};

const ADO_PACKAGE = '@azure-devops/mcp';
const ADO_UNPINNED = /^@azure-devops\/mcp(@latest)?$/;
const SONAR_UNPINNED = /^sonarsource\/sonarqube-mcp(:[^@\s]+)?$/;

export class MalformedTargetError extends Error {}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

function union(existing, additions) {
  const base = Array.isArray(existing) ? existing : [];
  return [...base, ...additions.filter((item) => !base.includes(item))];
}

export function readTarget(file) {
  if (!existsSync(file)) return { exists: false, data: {} };
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new MalformedTargetError(`${file} is not valid JSON; nothing written`);
  }
  if (!isObject(data)) throw new MalformedTargetError(`${file} is not a JSON object; nothing written`);
  return { exists: true, data };
}

function keyPath(prefix, key) {
  if (prefix === '') return key;
  return /^[\w-]+$/.test(key) ? `${prefix}.${key}` : `${prefix}[${JSON.stringify(key)}]`;
}

export function diffKeys(before, after, prefix = '') {
  const lines = [];
  for (const key of Object.keys(after)) {
    const path = keyPath(prefix, key);
    const was = isObject(before) ? before[key] : undefined;
    const now = after[key];
    if (isObject(now) && (isObject(was) || was === undefined)) lines.push(...diffKeys(was ?? {}, now, path));
    else if (Array.isArray(now) && Array.isArray(was)) {
      if (JSON.stringify(now) !== JSON.stringify(was)) {
        const grown = now.length - was.length;
        lines.push(grown > 0 ? `~ ${path} (+${grown})` : `~ ${path}`);
      }
    } else if (was === undefined) lines.push(Array.isArray(now) ? `+ ${path} (+${now.length})` : `+ ${path}`);
    else if (JSON.stringify(now) !== JSON.stringify(was)) lines.push(`~ ${path}`);
  }
  if (isObject(before)) {
    for (const key of Object.keys(before)) if (!(key in after)) lines.push(`- ${keyPath(prefix, key)}`);
  }
  return lines;
}

export function planTelemetry(settings) {
  const next = clone(settings);
  next.env = { ...(isObject(next.env) ? next.env : {}), ...TELEMETRY_ENV };
  return { next, notes: [] };
}

export function planDeny(settings, names) {
  const next = clone(settings);
  const permissions = isObject(next.permissions) ? next.permissions : {};
  next.permissions = { ...permissions, deny: union(permissions.deny, names) };
  return { next, notes: [] };
}

export function planSandbox(settings, domains) {
  const next = clone(settings);
  const sandbox = isObject(next.sandbox) ? next.sandbox : {};
  const network = isObject(sandbox.network) ? sandbox.network : {};
  next.sandbox = { ...sandbox, enabled: true, network: { ...network, allowedDomains: union(network.allowedDomains, domains) } };
  return { next, notes: [] };
}

export function planPins(claudeJson, projectPath, probes) {
  const next = clone(claudeJson);
  const notes = [];
  const pins = [];
  const servers = next.projects?.[projectPath]?.mcpServers;
  if (!isObject(servers)) return { next, notes: [`no MCP servers for ${projectPath}`], pins };
  let adoVersion;
  for (const [name, server] of Object.entries(servers)) {
    if (!isObject(server) || !Array.isArray(server.args)) continue;
    server.args = server.args.map((arg) => {
      if (typeof arg !== 'string') return arg;
      if (ADO_UNPINNED.test(arg)) {
        adoVersion ??= probes.npmVersion(ADO_PACKAGE);
        if (!adoVersion) {
          notes.push(`skip ${name}: npm returned no version for ${ADO_PACKAGE}`);
          return arg;
        }
        const pinned = `${ADO_PACKAGE}@${adoVersion}`;
        pins.push(`~ mcpServers.${name}.args: ${arg} -> ${pinned}`);
        return pinned;
      }
      if (SONAR_UNPINNED.test(arg)) {
        const digest = probes.imageDigest(arg);
        if (!digest) {
          notes.push(`skip ${name}: image ${arg} is not present locally`);
          return arg;
        }
        const pinned = `sonarsource/sonarqube-mcp@${digest}`;
        pins.push(`~ mcpServers.${name}.args: ${arg} -> ${pinned}`);
        return pinned;
      }
      return arg;
    });
  }
  return { next, notes, pins };
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export const defaultProbes = {
  npmVersion: (pkg) => run('npm', ['view', pkg, 'version']) || undefined,
  imageDigest: (ref) => {
    const repoDigest = run('docker', ['image', 'inspect', '--format', '{{index .RepoDigests 0}}', ref]);
    const at = repoDigest.indexOf('@sha256:');
    return at === -1 ? undefined : repoDigest.slice(at + 1);
  },
};

export function stamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function insideGitRepo(dir) {
  return existsSync(dir) && run('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree']) === 'true';
}

export function backupPath(file, home, date) {
  const absolute = resolve(file);
  const suffix = `.bak-${stamp(date)}`;
  if (!insideGitRepo(dirname(absolute))) return `${absolute}${suffix}`;
  const sanitised = absolute.replace(/^\/+/, '').replace(/[/\\:]+/g, '-');
  return join(home, '.claude', 'backups', 'harness', `${sanitised}${suffix}`);
}

function writeBackup(file, home, date) {
  const base = backupPath(file, home, date);
  mkdirSync(dirname(base), { recursive: true });
  for (let n = 0; ; n += 1) {
    const candidate = n === 0 ? base : `${base}-${n}`;
    try {
      copyFileSync(file, candidate, constants.COPYFILE_EXCL);
      return candidate;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

export function parseArgs(argv) {
  const args = { user: false, dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--only') args.only = argv[++i];
    else if (arg === '--user') args.user = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes') args.yes = true;
    else if (arg === '--project') args.project = argv[++i];
    else throw new Error(`unknown argument ${arg}`);
  }
  if (args.only !== undefined && !PARTS.includes(args.only)) throw new Error(`--only takes one of ${PARTS.join('|')}`);
  return args;
}

function targetFor(part, ctx) {
  switch (part) {
    case 'telemetry':
      return join(ctx.home, '.claude', 'settings.json');
    case 'deny':
      return join(ctx.projectPath, '.claude', 'settings.local.json');
    case 'mcp-pins':
      return join(ctx.home, '.claude.json');
    case 'sandbox':
      return ctx.user ? join(ctx.home, '.claude', 'settings.json') : join(ctx.projectPath, '.claude', 'settings.local.json');
    default:
      throw new Error(`unknown part ${part}`);
  }
}

async function planPart(part, data, ctx) {
  switch (part) {
    case 'telemetry':
      return planTelemetry(data);
    case 'deny': {
      const denyNames = ctx.denyNames ?? (await import('./mcp-write-guard.mjs')).denyNames;
      return planDeny(data, denyNames(ctx.config));
    }
    case 'mcp-pins':
      return planPins(data, ctx.projectPath, ctx.probes);
    case 'sandbox':
      return planSandbox(data, Array.isArray(ctx.config.sandboxDomains) ? ctx.config.sandboxDomains : []);
    default:
      throw new Error(`unknown part ${part}`);
  }
}

async function confirm(part, ctx) {
  if (ctx.yes) return true;
  if (!ctx.isTTY) return null;
  return ctx.ask(`${part}: write these changes? [y/N] `);
}

async function runPart(part, ctx) {
  const out = (line) => ctx.stdout.write(`${line}\n`);
  if ((part === 'deny' || part === 'sandbox') && ctx.config === null) {
    out(`${part}: no .claude/harness.json for ${ctx.projectPath}; skipped`);
    return 0;
  }
  const file = targetFor(part, ctx);
  const { exists, data } = readTarget(file);
  const { next, notes, pins = [] } = await planPart(part, data, ctx);
  for (const note of notes) out(`${part}: ${note}`);
  const lines = part === 'mcp-pins' ? pins : diffKeys(data, next);
  if (lines.length === 0) {
    out(`${part}: no changes`);
    return 0;
  }
  out(`${part}: ${file}${exists ? '' : ' (new file)'}`);
  for (const line of lines) out(`  ${line}`);
  if (ctx.dryRun) return 0;
  const answer = await confirm(part, ctx);
  if (answer === null) {
    ctx.stderr.write('confirm the diff, then re-run with --yes\n');
    return 3;
  }
  if (!answer) {
    out(`${part}: skipped`);
    return 0;
  }
  const backup = exists ? writeBackup(file, ctx.home, ctx.now()) : undefined;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  const reread = readTarget(file).data;
  const settled = diffKeys(next, reread).length === 0 && diffKeys(reread, next).length === 0;
  out(`${part}: ${settled ? 'wrote' : 'wrote, but the re-read differs:'} ${file}${backup ? ` (backup ${backup})` : ''}`);
  return settled ? 0 : 1;
}

export async function main(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    stderr.write(`setup: ${error.message}\n`);
    return 1;
  }
  const projectDir = resolve(args.project ?? env.CLAUDE_PROJECT_DIR ?? process.cwd());
  const found = findConfig(projectDir);
  const ctx = {
    ...args,
    home: env.HOME,
    projectPath: found?.root ?? projectDir,
    config: found?.config ?? null,
    probes: deps.probes ?? defaultProbes,
    denyNames: deps.denyNames,
    isTTY: deps.isTTY ?? Boolean(process.stdin.isTTY && process.stdout.isTTY),
    ask: deps.ask ?? askOnTerminal,
    now: deps.now ?? (() => new Date()),
    stdout,
    stderr,
  };
  if (!ctx.home) {
    stderr.write('setup: HOME is not set\n');
    return 1;
  }
  for (const part of args.only === undefined ? PARTS : [args.only]) {
    try {
      const code = await runPart(part, ctx);
      if (code !== 0) return code;
    } catch (error) {
      if (!(error instanceof MalformedTargetError)) throw error;
      stderr.write(`setup: ${error.message}\n`);
      return 1;
    }
  }
  return 0;
}

async function askOnTerminal(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
