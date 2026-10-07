// SubagentStop: for the harness.json spec.agent, a spec under spec.dir dated today and named in the final message is capped at spec.maxWords.
// Older-dated specs the run only amended are exempt; paths resolve against the folder whose harness.json was read.
// Exit 2 with one stderr paragraph sends the agent back; exit 0 otherwise, and on malformed stdin, a missing field or no harness.json.
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadHookContext, readStdinJson } from './lib/config.mjs';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

export function specPaths(message, dir, today) {
  const pattern = new RegExp(`${escapeRegExp(dir.replace(/\/+$/, ''))}\\/[\\w./-]+\\.md`, 'g');
  return [...new Set(message.match(pattern) ?? [])].filter((p) => basename(p).startsWith(today));
}

export function evaluate(input, { root, config }, today = new Date().toISOString().slice(0, 10)) {
  const spec = config.spec;
  const message = input?.last_assistant_message;
  if (spec === null || typeof spec !== 'object' || input?.agent_type !== spec.agent || typeof message !== 'string') return null;
  if (typeof spec.dir !== 'string' || !Number.isFinite(spec.maxWords)) return null;
  const CAP = spec.maxWords;
  const over = [];
  for (const p of specPaths(message, spec.dir, today)) {
    try {
      const words = readFileSync(resolve(root, p), 'utf8').split(/\s+/).filter(Boolean).length;
      if (words > CAP) over.push(`${p} (${words} words)`);
    } catch {
      continue;
    }
  }
  if (over.length === 0) return null;
  return (
    `Spec over the ${CAP}-word cap, tables included: ${over.join(', ')}. Cut it to the decisions ` +
    '(a plan carries the rest), or split a component wave into one spec per batch of at most six ' +
    'components, then report again.'
  );
}

async function main() {
  const input = await readStdinJson();
  if (input === null) return 0;
  const found = loadHookContext(input);
  if (found === null) return 0;
  const message = evaluate(input, found);
  if (message === null) return 0;
  process.stderr.write(`${message}\n`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
