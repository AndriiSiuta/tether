import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { RULES_SENTENCE, checkPlugins, parseFrontmatter } from './lib/frontmatter.mjs';

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'tether-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function doc(front, body) {
  return `---\n${front}\n---\n\n${body}\n`;
}

function skill(name, body = 'Use it.', extra = '') {
  return doc(`name: ${name}\ndescription: Use when testing.${extra}`, `# ${name}\n\n${RULES_SENTENCE}\n\n${body}`);
}

function agent(name, front = '', body = 'Do the task.') {
  return doc(`name: ${name}\ndescription: Use when testing.${front}`, `${RULES_SENTENCE}\n\n${body}`);
}

function good() {
  return {
    'plugins/tether-nx/skills/alpha/SKILL.md': skill('alpha', 'See [rules](references/rules.md) and `references/more.md`.'),
    'plugins/tether-nx/skills/alpha/references/rules.md': 'Back to [the skill](../SKILL.md).\n',
    'plugins/tether-nx/skills/alpha/references/more.md': 'More.\n',
    'plugins/tether-nx/skills/beta/SKILL.md': skill('beta'),
    'plugins/tether-nx/agents/worker.md': agent('worker', '\nskills:\n  - alpha\n  - tether-nx:beta', 'Read `references/rules.md`.'),
    'plugins/other/skills/plain/SKILL.md': doc('name: plain\ndescription: Use when plain.', '# Plain\n\nNo sentence needed.'),
  };
}

function findings(overrides) {
  return checkPlugins(tree({ ...good(), ...overrides }));
}

test('parseFrontmatter reads key lines, dash lists and inline lists', () => {
  const parsed = parseFrontmatter('---\nname: a\ndescription: "quoted: text"\nskills:\n  - x\n  - p:y\ntools: [Read, Grep]\n---\nbody\n');
  assert.deepEqual(parsed, {
    data: { name: 'a', description: 'quoted: text', skills: ['x', 'p:y'], tools: ['Read', 'Grep'] },
    body: 'body\n',
  });
});

test('parseFrontmatter returns null without a first-line block', () => {
  assert.equal(parseFrontmatter('# title\n---\nname: a\n---\n'), null);
  assert.equal(parseFrontmatter('---\nname: a\n'), null);
});

test('a good tree passes', () => {
  assert.deepEqual(checkPlugins(tree(good())), []);
});

test('skills accepts the plugin prefix in the inline list form', () => {
  const result = findings({ 'plugins/tether-nx/agents/worker.md': agent('worker', '\nskills: [tether-nx:alpha, beta]') });
  assert.deepEqual(result, []);
});

test('a missing name is reported with the file', () => {
  const result = findings({ 'plugins/tether-nx/skills/beta/SKILL.md': doc('description: Use when testing.', `# beta\n\n${RULES_SENTENCE}`) });
  assert.deepEqual(result, ['plugins/tether-nx/skills/beta/SKILL.md: missing frontmatter name']);
});

test('a skill name that does not match its folder is reported', () => {
  const result = findings({ 'plugins/tether-nx/skills/beta/SKILL.md': skill('gamma') });
  assert.deepEqual(result, ['plugins/tether-nx/skills/beta/SKILL.md: skill name "gamma" does not match "beta"']);
});

test('an agent name that does not match its file is reported', () => {
  const result = findings({ 'plugins/tether-nx/agents/worker.md': agent('builder') });
  assert.deepEqual(result, ['plugins/tether-nx/agents/worker.md: agent name "builder" does not match "worker"']);
});

test('an empty description is reported', () => {
  const result = findings({ 'plugins/other/skills/plain/SKILL.md': doc('name: plain\ndescription:', '# Plain') });
  assert.deepEqual(result, ['plugins/other/skills/plain/SKILL.md: missing or empty frontmatter description']);
});

test('a dead references link in a skill is reported', () => {
  const result = findings({ 'plugins/tether-nx/skills/beta/SKILL.md': skill('beta', 'See `references/gone.md`.') });
  assert.deepEqual(result, ['plugins/tether-nx/skills/beta/SKILL.md: dead reference references/gone.md']);
});

test('a dead relative link in a skill file is reported', () => {
  const result = findings({ 'plugins/tether-nx/skills/alpha/references/more.md': 'See [x](./missing.md).\n' });
  assert.deepEqual(result, ['plugins/tether-nx/skills/alpha/references/more.md: dead link ./missing.md']);
});

test('an agent reference that exists in no skill is reported', () => {
  const result = findings({ 'plugins/tether-nx/agents/worker.md': agent('worker', '', 'Read `references/nowhere.md`.') });
  assert.deepEqual(result, ['plugins/tether-nx/agents/worker.md: reference references/nowhere.md exists in no skill of tether-nx']);
});

test('an agent skills entry with no folder is reported', () => {
  const result = findings({ 'plugins/tether-nx/agents/worker.md': agent('worker', '\nskills:\n  - tether-nx:missing') });
  assert.deepEqual(result, ['plugins/tether-nx/agents/worker.md: skills entry "tether-nx:missing" has no folder plugins/tether-nx/skills/missing']);
});

test('an agent skills entry naming another plugin is reported', () => {
  const result = findings({ 'plugins/tether-nx/agents/worker.md': agent('worker', '\nskills: [other:plain]') });
  assert.deepEqual(result, ['plugins/tether-nx/agents/worker.md: skills entry "other:plain" names plugin "other", not "tether-nx"']);
});

test('a tether-nx skill or agent without the rules-file sentence is reported', () => {
  const result = findings({
    'plugins/tether-nx/skills/beta/SKILL.md': doc('name: beta\ndescription: Use when testing.', '# beta'),
    'plugins/tether-nx/agents/worker.md': doc('name: worker\ndescription: Use when testing.', 'Do it.'),
  });
  assert.deepEqual(result, [
    `plugins/tether-nx/skills/beta/SKILL.md: missing the rules-file sentence: ${RULES_SENTENCE}`,
    `plugins/tether-nx/agents/worker.md: missing the rules-file sentence: ${RULES_SENTENCE}`,
  ]);
});

test('a tether-nx skill or agent with the rules-file sentence twice is reported', () => {
  const result = findings({
    'plugins/tether-nx/skills/beta/SKILL.md': skill('beta', RULES_SENTENCE),
    'plugins/tether-nx/agents/worker.md': agent('worker', '', RULES_SENTENCE),
  });
  assert.deepEqual(result, [
    'plugins/tether-nx/skills/beta/SKILL.md: the rules-file sentence occurs 2 times, not once',
    'plugins/tether-nx/agents/worker.md: the rules-file sentence occurs 2 times, not once',
  ]);
});

test('a file without frontmatter is reported', () => {
  const result = findings({ 'plugins/other/skills/plain/SKILL.md': '# Plain\n' });
  assert.deepEqual(result, ['plugins/other/skills/plain/SKILL.md: no frontmatter block between a first-line --- and a closing ---']);
});
