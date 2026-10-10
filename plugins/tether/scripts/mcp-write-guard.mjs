// PreToolUse, matcher mcp__.*: denies an MCP tool listed in harness.json mcpWriteDeny by name or pattern.
// A server matches, case-insensitively and with non-alphanumeric runs as `_`, as `<server>` or as `..._<server>`.
// Any MCP call whose input carries a secret-shaped token is denied as well, unless harness.json sets secretShapes to false.
// Prints a PreToolUse deny and exits 0; exits 0 silently otherwise, and on malformed stdin or no harness.json.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSecurityContext, readStdinJson } from './lib/config.mjs';
import { findSecretShape } from './lib/secrets.mjs';

export function denyNames(config) {
  return (config?.mcpWriteDeny ?? []).flatMap((rule) => (rule.tools ?? []).map((tool) => `mcp__${rule.server}__${tool}`));
}

export function splitToolName(toolName) {
  const match = /^mcp__(.+?)__(.+)$/.exec(toolName);
  return match === null ? null : { server: match[1], tool: match[2] };
}

export function normaliseServer(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

export function serverMatches(server, ruleServer) {
  const actual = normaliseServer(server);
  const rule = normaliseServer(ruleServer);
  return actual === rule || actual.endsWith(`_${rule}`);
}

function safeRegExp(pattern) {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

export function findMatch(toolName, config) {
  const parts = splitToolName(toolName);
  if (parts === null) return null;
  for (const rule of config?.mcpWriteDeny ?? []) {
    if (typeof rule?.server !== 'string' || !serverMatches(parts.server, rule.server)) continue;
    if ((rule.tools ?? []).includes(parts.tool)) return { server: rule.server, matched: parts.tool };
    const pattern = (rule.patterns ?? []).find((source) => safeRegExp(source)?.test(parts.tool));
    if (pattern !== undefined) return { server: rule.server, matched: `/${pattern}/` };
  }
  return null;
}

function deny(reason) {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}

export function secretInInput(input, config) {
  if (config?.secretShapes === false || !/^mcp__/.test(String(input?.tool_name))) return null;
  return findSecretShape(JSON.stringify(input?.tool_input ?? {}));
}

export function evaluate(input, config) {
  const toolName = input?.tool_name;
  if (typeof toolName !== 'string') return null;
  const match = findMatch(toolName, config);
  if (match !== null) {
    return deny(`tether: ${toolName} is an MCP write (server ${match.server}, matched ${match.matched}); the deny list is in .claude/harness.json.`);
  }
  const secret = secretInInput(input, config);
  if (secret !== null) return deny(`tether: the ${toolName} call carries ${secret}; a credential never leaves through an MCP tool.`);
  return null;
}

async function main() {
  const input = await readStdinJson();
  if (input === null) return 0;
  const found = loadSecurityContext(input);
  if (found === null) return 0;
  const output = evaluate(input, found.config);
  if (output !== null) process.stdout.write(`${JSON.stringify(output)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
