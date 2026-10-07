// CLI: node backup.mjs --dir <dir> [--project <root>]; tars the existing harness.json localOnlyPaths and encrypts them with age, else gpg.
// Writes <dir>/harness-<YYYY-MM-DD>.tar.gz.<age|gpg> and keeps the newest 10; the encryptor owns the terminal for the passphrase.
// Exit 0 when written, 1 without a dir, harness.json, a path to back up or an encryptor (nothing written), or when tar or the encryptor fails.
import { spawn } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findConfig } from './lib/config.mjs';

export const KEEP = 10;
const BACKUP_FILE = /^harness-.*\.tar\.gz\..+$/;

const ENCRYPTORS = [
  { command: 'age', ext: 'age', args: (out) => ['--passphrase', '--output', out] },
  { command: 'gpg', ext: 'gpg', args: (out) => ['--symmetric', '--cipher-algo', 'AES256', '--output', out] },
];

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dir') args.dir = argv[++i];
    else if (arg === '--project') args.project = argv[++i];
    else return { error: `unknown argument: ${arg}` };
  }
  return args;
}

function isExecutable(file) {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function onPath(command, pathEnv) {
  return (pathEnv ?? '').split(delimiter).some((dir) => dir !== '' && isExecutable(join(dir, command)));
}

export function pickEncryptor(pathEnv) {
  return ENCRYPTORS.find((encryptor) => onPath(encryptor.command, pathEnv));
}

export function existingPaths(root, paths) {
  return (Array.isArray(paths) ? paths : []).filter((path) => typeof path === 'string' && existsSync(join(root, path)));
}

export function backupName(date, ext) {
  const pad = (n) => String(n).padStart(2, '0');
  return `harness-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.tar.gz.${ext}`;
}

export function rotate(dir, keep = KEEP) {
  const backups = readdirSync(dir)
    .filter((name) => BACKUP_FILE.test(name))
    .toSorted()
    .reverse();
  const removed = backups.slice(keep);
  for (const name of removed) rmSync(join(dir, name));
  return removed;
}

function exitOf(child) {
  return new Promise((done) => {
    child.on('error', () => done(1));
    child.on('close', (code) => done(code ?? 1));
  });
}

async function encrypt({ root, paths, encryptor, out, env }) {
  const tar = spawn('tar', ['-czf', '-', '-C', root, ...paths], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  const enc = spawn(encryptor.command, encryptor.args(out), { env, stdio: ['pipe', 'inherit', 'inherit'] });
  enc.stdin.on('error', () => {});
  tar.stdout.pipe(enc.stdin);
  const [tarCode, encCode] = await Promise.all([exitOf(tar), exitOf(enc)]);
  return { tarCode, encCode };
}

export async function run(argv, { env = process.env, now = () => new Date() } = {}) {
  const args = parseArgs(argv);
  if (args.error) return { code: 1, out: [], err: [`backup: ${args.error}`] };
  if (typeof args.dir !== 'string' || args.dir.trim() === '') {
    return { code: 1, out: [], err: ['backup: pass the backup directory: --dir <dir>'] };
  }
  const found = findConfig(resolve(args.project ?? env.CLAUDE_PROJECT_DIR ?? process.cwd()));
  if (found === null) return { code: 1, out: [], err: ['backup: no .claude/harness.json for this project'] };
  const paths = existingPaths(found.root, found.config.localOnlyPaths);
  if (paths.length === 0) return { code: 1, out: [], err: ['backup: none of the localOnlyPaths exist; nothing to back up'] };
  const encryptor = pickEncryptor(env.PATH);
  if (encryptor === undefined) return { code: 1, out: [], err: ['backup: neither age nor gpg is on PATH; nothing written'] };
  const dir = resolve(args.dir);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, backupName(now(), encryptor.ext));
  const { tarCode, encCode } = await encrypt({ root: found.root, paths, encryptor, out, env });
  if (tarCode !== 0 || encCode !== 0) {
    rmSync(out, { force: true });
    return { code: 1, out: [], err: [`backup: tar exited ${tarCode}, ${encryptor.command} exited ${encCode}; no backup written`] };
  }
  const removed = rotate(dir);
  return {
    code: 0,
    out: [`wrote ${out} (${encryptor.command}, ${paths.length} paths)`, ...removed.map((name) => `removed ${join(dir, name)}`)],
    err: [],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { code, out, err } = await run(process.argv.slice(2));
  if (out.length > 0) process.stdout.write(`${out.join('\n')}\n`);
  if (err.length > 0) process.stderr.write(`${err.join('\n')}\n`);
  process.exitCode = code;
}
