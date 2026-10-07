// PreToolUse, matcher mcp__.*: denies an MCP tool listed in harness.json mcpWriteDeny by name or pattern.
// A server matches as `<server>` or as the plugin-provided `..._<server>`.
// Prints a PreToolUse deny and exits 0; exits 0 silently otherwise, and on malformed stdin or no harness.json.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSecurityContext, readStdinJson } from './lib/config.mjs';

export function denyNames(config) {
  return (config?.mcpWriteDeny ?? []).flatMap((rule) => (rule.tools ?? []).map((tool) => `mcp__${rule.server}__${tool}`));
}

export function splitToolName(toolName) {
  const match = /^mcp__(.+?)__(.+)$/.exec(toolName);
  return match === null ? null : { server: match[1], tool: match[2] };
}

export function serverMatches(server, ruleServer) {
  return server === ruleServer || server.endsWith(`_${ruleServer}`);
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

export function evaluate(input, config) {
  const toolName = input?.tool_name;
  if (typeof toolName !== 'string') return null;
  const match = findMatch(toolName, config);
  if (match === null) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `harness: ${toolName} is an MCP write (server ${match.server}, matched ${match.matched}); the deny list is in .claude/harness.json.`,
    },
  };
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
