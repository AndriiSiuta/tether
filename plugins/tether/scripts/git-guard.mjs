// PreToolUse, matcher Bash: blocks a git commit or push on a protected branch or carrying a local-only path.
// The branch is read in a leading `cd <dir>` or `git -C <dir>`, else the hook cwd; that directory's own harness.json
// governs it, else the one under CLAUDE_PROJECT_DIR.
// A commit whose command text carries a secret-shaped token is blocked too, unless harness.json sets secretShapes to false.
// Heredoc bodies and plain quoted strings do not make a command a commit: a note that mentions one passes.
// Exit 2 with one stderr paragraph blocks; exit 0 otherwise, and on malformed stdin or no harness.json.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeRegExp, findConfig, loadSecurityContext, readStdinJson } from './lib/config.mjs';
import { findSecretShape } from './lib/secrets.mjs';

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function localOnlyPattern(paths) {
  if (paths.length === 0) return null;
  return new RegExp(`(^|[\\s"'=])(${paths.map(escapeRegExp).join('|')})`);
}

const HEREDOC = /<<-?\s*(["']?)(\w+)\1[^\n]*\n[\s\S]*?\n[ \t]*\2(?=\n|$)/g;
const QUOTED = /"(?:[^"\\]|\\.)*"|'[^']*'/g;
const INTERPRETER_ARG = /(?:\s-l?c|\beval|\bxargs(?:\s+-\S+)*|\bssh\s+\S+)\s*$/;

// Heredoc bodies are data the shell never runs; so are quoted literals, unless they are the program an interpreter runs.
export function withoutHeredocs(command) {
  return command.replace(HEREDOC, (match) => match.slice(0, match.indexOf('\n')));
}

export function executableText(command) {
  return withoutHeredocs(command).replace(QUOTED, (match, offset, text) =>
    INTERPRETER_ARG.test(text.slice(0, offset)) ? match : '""',
  );
}

export function classify(command) {
  const text = executableText(command);
  return {
    commits: /\bgit\b[^|;&\n]*\bcommit\b/.test(text),
    pushes: /\bgit\b[^|;&\n]*\bpush\b/.test(text),
  };
}

export function commandDir(command, base) {
  const cd = command.match(/(?:^|&&|;)\s*cd\s+("[^"]+"|'[^']+'|\S+)/);
  const dashC = command.match(/\bgit\s+-C\s+("[^"]+"|'[^']+'|\S+)/);
  const picked = (cd ?? dashC)?.[1]?.replace(/^["']|["']$/g, '');
  return picked ? resolve(base, picked.replace(/^~(?=$|\/)/, process.env.HOME ?? '~')) : base;
}

export function findProblems({ command, dir, config }) {
  const { commits, pushes } = classify(command);
  if (!commits && !pushes) return [];
  const protectedBranches = config.protectedBranches ?? [];
  const localOnlyPaths = config.localOnlyPaths ?? [];
  let branch;
  try {
    branch = git(dir, ['branch', '--show-current']);
  } catch {
    return [];
  }
  const problems = [];
  const onProtected = protectedBranches.includes(branch);
  if (onProtected) {
    problems.push(`the directory ${dir} is on ${branch}; make the branch first (git switch -c <name> origin/${branch})`);
  }
  const pattern = localOnlyPattern(localOnlyPaths);
  const args = withoutHeredocs(command);
  if (commits && pattern?.test(args.slice(args.search(/\bcommit\b/)))) {
    problems.push(`the commit names a local-only harness path (${localOnlyPaths.join(', ')})`);
  }
  const secret = commits && config.secretShapes !== false ? findSecretShape(command) : null;
  if (secret !== null) problems.push(`the commit text carries ${secret}; a credential never goes into a message`);
  if (pushes && branch !== '' && !onProtected && protectedBranches.length > 0 && localOnlyPaths.length > 0) {
    const upstream = `origin/${protectedBranches[0]}`;
    try {
      const leaked = git(dir, ['diff', '--stat', `${upstream}..HEAD`, '--', ...localOnlyPaths]);
      if (leaked !== '') problems.push(`the push range carries local-only files:\n${leaked}`);
    } catch {
      problems.push(`${upstream} is not available to check the push range; fetch first`);
    }
  }
  return problems;
}

export function evaluate(input, base = input?.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd()) {
  const command = String(input?.tool_input?.command ?? '');
  const { commits, pushes } = classify(command);
  if (!commits && !pushes) return null;
  const dir = commandDir(command, base);
  const found = findConfig(dir) ?? loadSecurityContext({ cwd: dir });
  if (found === null) return null;
  const problems = findProblems({ command, dir, config: found.config });
  return problems.length === 0 ? null : `git guard blocked the command: ${problems.join('; ')}.`;
}

async function main() {
  const input = await readStdinJson();
  if (input === null) return 0;
  const message = evaluate(input);
  if (message === null) return 0;
  process.stderr.write(`${message}\n`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
