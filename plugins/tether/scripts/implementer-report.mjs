// SubagentStop: an agent listed in harness.json implementerAgents must end with every reportFields line, or a Blocked: line.
// A field's alternatives are separated by `|`; any one of them satisfies the field.
// With checksPassLine (a regex), a line of the Checks: section (up to the next report field) must match it.
// Exit 2 with one stderr paragraph sends the agent back; exit 0 otherwise, on stop_hook_active, malformed stdin, a missing field or no harness.json.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeRegExp, loadHookContext, readStdinJson } from './lib/config.mjs';

function firstAlternative(field) {
  return field.split('|')[0];
}

export function missingFields(message, fields) {
  return fields.filter(
    (field) => !field.split('|').some((alternative) => new RegExp(`^\\s*${escapeRegExp(alternative)}`, 'm').test(message)),
  );
}

function passLinePattern(source) {
  if (typeof source !== 'string' || source === '') return null;
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

export function checksLines(message, fields) {
  const labels = [...fields.flatMap((field) => field.split('|')), 'Blocked:'].filter((label) => label !== 'Checks:');
  const startsWith = (line, label) => line.trimStart().startsWith(label);
  const lines = [];
  let inside = false;
  for (const line of message.split('\n')) {
    if (startsWith(line, 'Checks:')) {
      inside = true;
      lines.push(line.trimStart().slice('Checks:'.length).trim());
    } else if (labels.some((label) => startsWith(line, label))) inside = false;
    else if (inside) lines.push(line.trim());
  }
  return lines;
}

export function evaluate(input, config) {
  const agents = config.implementerAgents ?? [];
  const fields = config.reportFields ?? [];
  const message = input?.last_assistant_message;
  if (input?.stop_hook_active === true) return null;
  if (!agents.includes(input?.agent_type) || typeof message !== 'string') return null;
  if (/^\s*Blocked:/m.test(message)) return null;
  const missing = missingFields(message, fields);
  if (missing.length > 0) {
    return (
      `Report is incomplete, missing ${missing.map(firstAlternative).join(', ')}. ` +
      `End with these lines: ${fields.map((field) => `${firstAlternative(field)} <content>`).join('; ')}. ` +
      'If you are stopping because you are blocked, write Blocked: <what you need> instead.'
    );
  }
  const passLine = passLinePattern(config.checksPassLine);
  if (passLine === null || checksLines(message, fields).some((line) => passLine.test(line))) return null;
  return (
    `Checks: must quote the verify pass line, e.g. \`${config.checksPassLine}\`. ` +
    'Run the verify command and paste its pass line, or write Blocked: <what you need> if it does not pass.'
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
