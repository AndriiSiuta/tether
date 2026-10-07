// SubagentStop: an agent listed in harness.json implementerAgents must end with every reportFields line, or a Blocked: line.
// A field's alternatives are separated by `|`; any one of them satisfies the field.
// Exit 2 with one stderr paragraph sends the agent back; exit 0 otherwise, and on malformed stdin, a missing field or no harness.json.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadHookContext, readStdinJson } from './lib/config.mjs';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function firstAlternative(field) {
  return field.split('|')[0];
}

export function missingFields(message, fields) {
  return fields.filter(
    (field) => !field.split('|').some((alternative) => new RegExp(`^\\s*${escapeRegExp(alternative)}`, 'm').test(message)),
  );
}

export function evaluate(input, config) {
  const agents = config.implementerAgents ?? [];
  const fields = config.reportFields ?? [];
  const message = input?.last_assistant_message;
  if (!agents.includes(input?.agent_type) || typeof message !== 'string') return null;
  if (/^\s*Blocked:/m.test(message)) return null;
  const missing = missingFields(message, fields);
  if (missing.length === 0) return null;
  return (
    `Report is incomplete, missing ${missing.map(firstAlternative).join(', ')}. ` +
    `End with these lines: ${fields.map((field) => `${firstAlternative(field)} <content>`).join('; ')}. ` +
    'If you are stopping because you are blocked, write Blocked: <what you need> instead.'
  );
}

async function main() {
  const input = await readStdinJson();
  if (input === null) return 0;
  const found = loadHookContext(input);
  if (found === null) return 0;
  const message = evaluate(input, found.config);
  if (message === null) return 0;
  process.stderr.write(`${message}\n`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
