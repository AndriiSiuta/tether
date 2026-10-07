// Parses Markdown frontmatter without a YAML package and checks every plugin agent and skill against the repo's naming, link and rules-file contracts.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

export const RULES_SENTENCE = 'Read `.claude/tether-nx.md` first; where it differs from this file, it wins.';
export const SENTENCE_PLUGIN = 'tether-nx';

const KEY_LINE = /^([A-Za-z_][\w-]*):(?:\s+(.*))?$/;
const LIST_ITEM = /^\s+-\s+(.*)$/;
const REFERENCE = /(?<![\w/.-])references\/[\w.-]+(?:\/[\w.-]+)*\.md/g;
const LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i;

function unquote(value) {
  const trimmed = value.trim();
  const quoted = /^(['"])(.*)\1$/.exec(trimmed);
  return quoted ? quoted[2] : trimmed;
}

function parseValue(raw) {
  const value = raw.trim();
  const inline = /^\[(.*)\]$/.exec(value);
  if (!inline) return unquote(value);
  return inline[1].split(',').map(unquote).filter(Boolean);
}

export function parseFrontmatter(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0].trim() !== '---') return null;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end === -1) return null;
  const data = {};
  let current;
  for (const line of lines.slice(1, end)) {
    const item = LIST_ITEM.exec(line);
    if (item && current !== undefined) {
      data[current] = [...(Array.isArray(data[current]) ? data[current] : []), unquote(item[1])];
      continue;
    }
    if (/^\s+\S/.test(line) && current !== undefined && typeof data[current] === 'string') {
      data[current] = [data[current], line.trim()].filter(Boolean).join(' ');
      continue;
    }
    const pair = KEY_LINE.exec(line);
    if (!pair) continue;
    current = pair[1];
    const raw = pair[2] ?? '';
    data[current] = /^[>|][+-]?$/.test(raw.trim()) ? '' : parseValue(raw);
  }
  return { data, body: lines.slice(end + 1).join('\n') };
}

function listDirs(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory()).sort();
}

function listMarkdown(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { recursive: true })
    .map((name) => join(path, name))
    .filter((full) => full.endsWith('.md') && statSync(full).isFile())
    .sort();
}

function asList(value) {
  if (value === undefined || value === '') return [];
  return Array.isArray(value) ? value : value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function isEmpty(value) {
  return value === undefined || (Array.isArray(value) ? value.length === 0 : value.trim() === '');
}

function withoutFences(text) {
  return text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
}

function checkCommon({ rel, parsed, expectedName, kind, plugin }) {
  if (parsed === null) return [`${rel}: no frontmatter block between a first-line --- and a closing ---`];
  const findings = [];
  const { name, description } = parsed.data;
  if (isEmpty(name)) findings.push(`${rel}: missing frontmatter name`);
  else if (name !== expectedName) findings.push(`${rel}: ${kind} name "${name}" does not match "${expectedName}"`);
  if (isEmpty(description)) findings.push(`${rel}: missing or empty frontmatter description`);
  if (plugin === SENTENCE_PLUGIN) {
    const count = parsed.body.split(RULES_SENTENCE).length - 1;
    if (count === 0) findings.push(`${rel}: missing the rules-file sentence: ${RULES_SENTENCE}`);
    else if (count > 1) findings.push(`${rel}: the rules-file sentence occurs ${count} times, not once`);
  }
  return findings;
}

function checkSkillLinks(root, skillDir) {
  const findings = [];
  for (const file of listMarkdown(skillDir)) {
    const rel = relative(root, file);
    const text = readFileSync(file, 'utf8');
    for (const mention of new Set(text.match(REFERENCE) ?? [])) {
      if (!existsSync(join(skillDir, mention))) findings.push(`${rel}: dead reference ${mention}`);
    }
    for (const [, target] of withoutFences(text).matchAll(LINK)) {
      if (EXTERNAL.test(target)) continue;
      const path = decodeURI(target.split('#')[0]);
      if (path === '') continue;
      const resolves = [dirname(file), skillDir].some((base) => existsSync(resolve(base, path)));
      if (!resolves) findings.push(`${rel}: dead link ${target}`);
    }
  }
  return findings;
}

function checkAgent({ root, plugin, pluginDir, file, skills }) {
  const rel = relative(root, file);
  const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
  const findings = checkCommon({ rel, parsed, expectedName: basename(file, '.md'), kind: 'agent', plugin });
  if (parsed === null) return findings;
  for (const entry of asList(parsed.data.skills)) {
    const separator = entry.lastIndexOf(':');
    const prefix = separator === -1 ? plugin : entry.slice(0, separator);
    const skill = entry.slice(separator + 1);
    if (prefix !== plugin) findings.push(`${rel}: skills entry "${entry}" names plugin "${prefix}", not "${plugin}"`);
    else if (!skills.includes(skill)) findings.push(`${rel}: skills entry "${entry}" has no folder ${relative(root, join(pluginDir, 'skills', skill))}`);
  }
  for (const mention of new Set(parsed.body.match(REFERENCE) ?? [])) {
    if (!skills.some((skill) => existsSync(join(pluginDir, 'skills', skill, mention)))) {
      findings.push(`${rel}: reference ${mention} exists in no skill of ${plugin}`);
    }
  }
  return findings;
}

export function checkPlugins(root) {
  const findings = [];
  for (const plugin of listDirs(join(root, 'plugins'))) {
    const pluginDir = join(root, 'plugins', plugin);
    const skills = listDirs(join(pluginDir, 'skills')).filter((skill) => existsSync(join(pluginDir, 'skills', skill, 'SKILL.md')));
    for (const skill of skills) {
      const skillDir = join(pluginDir, 'skills', skill);
      const file = join(skillDir, 'SKILL.md');
      const parsed = parseFrontmatter(readFileSync(file, 'utf8'));
      findings.push(...checkCommon({ rel: relative(root, file), parsed, expectedName: skill, kind: 'skill', plugin }));
      findings.push(...checkSkillLinks(root, skillDir));
    }
    const agentsDir = join(pluginDir, 'agents');
    const agents = existsSync(agentsDir) ? readdirSync(agentsDir).filter((name) => name.endsWith('.md')).sort() : [];
    for (const name of agents) {
      findings.push(...checkAgent({ root, plugin, pluginDir, file: join(agentsDir, name), skills }));
    }
  }
  return findings;
}

export function subjects(root) {
  return listDirs(join(root, 'plugins')).flatMap((plugin) => {
    const pluginDir = join(root, 'plugins', plugin);
    const skills = listDirs(join(pluginDir, 'skills'))
      .map((skill) => join(pluginDir, 'skills', skill, 'SKILL.md'))
      .filter((file) => existsSync(file));
    const agentsDir = join(pluginDir, 'agents');
    const agents = existsSync(agentsDir)
      ? readdirSync(agentsDir).filter((name) => name.endsWith('.md')).map((name) => join(agentsDir, name))
      : [];
    return [...skills, ...agents].map((file) => relative(root, file));
  });
}
