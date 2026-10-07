// CLI: node config.mjs --get <key> [--dir <dir>]; arrays one per line, objects as JSON; exit 1 without config or key.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CONFIG_FILE = join('.claude', 'harness.json');

function git(dir, args) {
  try {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function readConfig(root) {
  let raw;
  try {
    raw = readFileSync(join(root, CONFIG_FILE), 'utf8');
  } catch {
    return undefined;
  }
  try {
    const config = JSON.parse(raw);
    if (config === null || typeof config !== 'object' || Array.isArray(config)) throw new Error('not an object');
    return { root, config };
  } catch (error) {
    process.stderr.write(`harness: ignoring malformed ${join(root, CONFIG_FILE)}: ${error.message}\n`);
    return null;
  }
}

function candidateRoots(dir) {
  const toplevel = git(dir, ['rev-parse', '--show-toplevel']);
  if (toplevel === '') return [dir];
  const commonDir = git(dir, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const mainRoot = commonDir === '' ? toplevel : dirname(commonDir);
  return mainRoot === toplevel ? [toplevel] : [toplevel, mainRoot];
}

export function findConfig(dir) {
  for (const root of candidateRoots(resolve(dir))) {
    const found = readConfig(root);
    if (found !== undefined) return found;
  }
  return null;
}

export function loadHookContext(input) {
  return findConfig(input?.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
}

export function loadSecurityContext(input) {
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  const fromProject = projectDir ? findConfig(projectDir) : null;
  return fromProject ?? loadHookContext(input);
}

export async function readStdinJson() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

export function getConfigValue(config, key) {
  return key.split('.').reduce((value, part) => (value !== null && typeof value === 'object' ? value[part] : undefined), config);
}

export function formatValue(value) {
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join('\n');
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--get') args.key = argv[++i];
    else if (argv[i] === '--dir') args.dir = argv[++i];
  }
  return args;
}

function main(argv) {
  const { key, dir } = parseArgs(argv);
  if (key === undefined) {
    process.stderr.write('usage: config.mjs --get <key> [--dir <dir>]\n');
    return 1;
  }
  const found = findConfig(dir ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  if (found === null) return 1;
  const value = getConfigValue(found.config, key);
  if (value === undefined) return 1;
  process.stdout.write(`${formatValue(value)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
