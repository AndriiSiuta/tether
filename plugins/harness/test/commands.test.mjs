import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE = '${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml';

function allowedTools(command) {
  const text = readFileSync(join(ROOT, 'commands', `${command}.md`), 'utf8');
  const line = text.split('\n').find((l) => l.startsWith('allowed-tools:'));
  assert.ok(line, `${command}.md has no allowed-tools line`);
  return JSON.parse(line.slice('allowed-tools:'.length).trim());
}

test('telemetry pre-approves exact commands only, without a pull or node -e', () => {
  const image = readFileSync(join(ROOT, 'telemetry', 'docker-compose.yml'), 'utf8').match(/^\s*image:\s*(\S+)$/m)[1];
  assert.deepEqual(allowedTools('telemetry'), [
    `Bash(docker image inspect ${image})`,
    `Bash(docker compose -f ${COMPOSE} up -d --pull never)`,
    `Bash(docker compose -f ${COMPOSE} down)`,
    `Bash(docker compose -f ${COMPOSE} ps)`,
    'Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/telemetry-probe.mjs)',
  ]);
});

test('telemetry up pulls explicitly after the yes, then starts with --pull never', () => {
  const text = readFileSync(join(ROOT, 'commands', 'telemetry.md'), 'utf8');
  const pull = text.indexOf(`docker compose -f ${COMPOSE} pull\``);
  const up = text.indexOf(`docker compose -f ${COMPOSE} up -d --pull never\``);
  assert.ok(pull !== -1 && up > pull);
  assert.doesNotMatch(text, /node -e/);
});

test('ledger pre-approves its two scripts only', () => {
  assert.deepEqual(allowedTools('ledger'), [
    'Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/ledger-from-otel.mjs:*)',
    'Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/ledger-stats.mjs:*)',
  ]);
});

for (const command of ['setup', 'eval', 'backup', 'metrics', 'telemetry']) {
  test(`${command} is user-invoked only`, () => {
    const text = readFileSync(join(ROOT, 'commands', `${command}.md`), 'utf8');
    const frontmatter = text.split('---\n')[1];
    assert.match(frontmatter, /^disable-model-invocation: true$/m);
  });
}
