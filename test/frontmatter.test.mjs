// Fails when a plugin agent or skill breaks the name, description, reference-link or rules-file contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPlugins, subjects } from './lib/frontmatter.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the tree has agents or skills to check', () => {
  assert.ok(subjects(ROOT).length > 0, 'no plugins/*/agents/*.md or plugins/*/skills/*/SKILL.md found');
});

test('every plugin agent and skill passes the frontmatter checks', () => {
  const findings = checkPlugins(ROOT);
  assert.equal(findings.length, 0, `\n${findings.join('\n')}`);
});
