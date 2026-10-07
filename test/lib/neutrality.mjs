// Scans the files a public repo would publish for private terms, ticket references and unknown npm scopes.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const TICKET = /(?<![&\w])#\d{5}(?!\d)/g;
export const SCOPE = /(?<![\w.@/])@([a-z0-9][a-z0-9._-]*)\//g;
export const ALLOWED_SCOPES = new Set([
  'angular',
  'angular-eslint',
  'angular-devkit',
  'nx',
  'ngrx',
  'ngx-translate',
  'typescript-eslint',
  'types',
  'testing-library',
  'axe-core',
  'spartan-ng',
  'ng-web-apis',
  'azure-devops',
  'org',
]);

const MANIFEST_FIELDS = new Map([['.claude-plugin/marketplace.json', 'owner']]);
const PLUGIN_MANIFEST = /^plugins\/[^/]+\/\.claude-plugin\/plugin\.json$/;
const LICENSE_FILE = /^(?:plugins\/[^/]+\/skills\/[^/]+\/)?LICENSE$/;

export function isBinary(buffer) {
  return buffer.subarray(0, 8192).includes(0);
}

export function listFiles(root) {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root });
  return [...new Set(out.toString('utf8').split('\0').filter(Boolean))].filter((path) => {
    const full = join(root, path);
    if (!existsSync(full) || !statSync(full).isFile()) return false;
    return !isBinary(readFileSync(full));
  });
}

export function loadDenylist(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => new RegExp(line, 'iu'));
}

function manifestText(path, text) {
  const key = MANIFEST_FIELDS.get(path) ?? (PLUGIN_MANIFEST.test(path) ? 'author' : undefined);
  if (key === undefined) return text;
  const json = JSON.parse(text);
  if (json[key] && typeof json[key] === 'object') delete json[key].name;
  return JSON.stringify(json, null, 2);
}

export function repoSlug(root) {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const match = url.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function exemptLine(path, line) {
  return LICENSE_FILE.test(path) && line.startsWith('Copyright (c)');
}

export function scanText(text, path, patterns, slug = null) {
  const findings = [];
  text.split('\n').forEach((raw, index) => {
    if (exemptLine(path, raw)) return;
    const line = slug ? raw.split(slug).join('') : raw;
    const at = { path, line: index + 1 };
    for (const pattern of patterns ?? []) {
      const match = line.match(pattern);
      if (match) findings.push({ ...at, check: 'denylist', match: match[0] });
    }
    for (const match of line.matchAll(TICKET)) findings.push({ ...at, check: 'ticket', match: match[0] });
    for (const match of line.matchAll(SCOPE)) {
      if (!ALLOWED_SCOPES.has(match[1])) findings.push({ ...at, check: 'scope', match: match[0] });
    }
  });
  return findings;
}

function scanPath(path, patterns) {
  return scanText(path, path, patterns)
    .filter((finding) => finding.check !== 'scope')
    .map((finding) => ({ ...finding, line: 0 }));
}

export function scan({ root, files, patterns, slug = repoSlug(root) }) {
  return files.flatMap((path) => [
    ...scanPath(path, patterns),
    ...scanText(manifestText(path, readFileSync(join(root, path), 'utf8')), path, patterns, slug),
  ]);
}

export function formatFindings(findings) {
  return findings.map(({ path, line, check, match }) => `${path}:${line} ${check} ${match}`).join('\n');
}
