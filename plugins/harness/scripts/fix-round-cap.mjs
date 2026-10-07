// SubagentStop: counts the stops of an implementerAgents agent per session and task (the first `# Task <id>` heading of its prompt).
// Stops that continue because a stop hook sent the agent back (stop_hook_active) are not counted.
// Exit 2 with one stderr paragraph once more than fixRoundCap fix rounds follow the first stop; exit 0 otherwise and on any missing input.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadHookContext, readStdinJson } from './lib/config.mjs';

const TASK_HEADING = /^#+\s+(Task\s+[\w.-]+)/m;

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

export function taskFromTranscript(jsonl) {
  for (const line of jsonl.split('\n')) {
    if (line.trim() === '') continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.type !== 'user') continue;
    return textOf(entry.message?.content).match(TASK_HEADING)?.[1] ?? null;
  }
  return null;
}

function readRounds(file) {
  try {
    const rounds = JSON.parse(readFileSync(file, 'utf8'));
    return rounds !== null && typeof rounds === 'object' && !Array.isArray(rounds) ? rounds : {};
  } catch {
    return {};
  }
}

export function recordStop(dataDir, key) {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'rounds.json');
  const rounds = readRounds(file);
  const count = (Number.isInteger(rounds[key]) ? rounds[key] : 0) + 1;
  rounds[key] = count;
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(rounds, null, 2)}\n`);
  renameSync(temp, file);
  return count;
}

export function capMessage(cap, task) {
  return `${cap} fix rounds used on ${task}; stop and escalate to Andrii with the failing check.`;
}

export function evaluate(input, config, dataDir) {
  const agents = config.implementerAgents ?? [];
  const cap = config.fixRoundCap;
  if (!agents.includes(input?.agent_type) || input.stop_hook_active === true) return null;
  if (!Number.isInteger(cap) || typeof dataDir !== 'string' || dataDir === '') return null;
  if (typeof input.session_id !== 'string' || typeof input.agent_transcript_path !== 'string') return null;
  let transcript;
  try {
    transcript = readFileSync(input.agent_transcript_path, 'utf8');
  } catch {
    return null;
  }
  const task = taskFromTranscript(transcript);
  if (task === null) return null;
  const count = recordStop(dataDir, `${input.session_id}|${task}`);
  return count - 1 > cap ? capMessage(cap, task) : null;
}

async function main() {
  const input = await readStdinJson();
  if (input === null) return 0;
  const found = loadHookContext(input);
  if (found === null) return 0;
  let message;
  try {
    message = evaluate(input, found.config, process.env.CLAUDE_PLUGIN_DATA);
  } catch {
    return 0;
  }
  if (message === null) return 0;
  process.stderr.write(`${message}\n`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
