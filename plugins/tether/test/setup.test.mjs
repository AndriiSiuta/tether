import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TELEMETRY_ENV, backupPath, diffKeys, main, stamp } from '../scripts/setup.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'setup.mjs');
const CONFIG = {
  mcpWriteDeny: [{ server: 'figma', tools: ['use_figma', 'create_new_file'], patterns: ['^create_shader'] }],
  sandboxDomains: ['registry.npmjs.org', 'localhost'],
};
const NOW = new Date(2026, 9, 7, 9, 5);
const KEPT = { model: 'opus', effortLevel: 'high', enabledPlugins: { 'tether@tether': true } };
const SECRET = 'do-not-print-this-value';

let sandbox;
let counter = 0;

function fresh({ config = CONFIG, repo = false } = {}) {
  counter += 1;
  const home = join(sandbox, `home-${counter}`);
  const project = join(sandbox, `project-${counter}`);
  mkdirSync(join(home, '.claude'), { recursive: true });
  mkdirSync(join(project, '.claude'), { recursive: true });
  if (repo) execFileSync('git', ['init', '-q', '-b', 'feature', project]);
  if (config !== null) writeFileSync(join(project, '.claude', 'harness.json'), JSON.stringify(config));
  return { home, project };
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

async function setup(args, { home, project }, deps = {}) {
  let out = '';
  let err = '';
  const code = await main([...args, '--project', project], {
    env: { HOME: home },
    stdout: { write: (s) => (out += s) },
    stderr: { write: (s) => (err += s) },
    isTTY: false,
    now: () => NOW,
    probes: { npmVersion: () => '2.3.0', imageDigest: () => 'sha256:abc123' },
    ...deps,
  });
  return { code, out, err };
}

const userSettings = (home) => join(home, '.claude', 'settings.json');
const localSettings = (project) => join(project, '.claude', 'settings.local.json');
const claudeJson = (home) => join(home, '.claude.json');

before(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'harness-')));
  delete process.env.CLAUDE_PROJECT_DIR;
});

after(() => rmSync(sandbox, { recursive: true, force: true }));

test('diffKeys names keys only, counts array growth and never prints values', () => {
  const lines = diffKeys({ env: { A: SECRET }, permissions: { deny: ['x'] } }, { env: { A: 'other', B: SECRET }, permissions: { deny: ['x', 'y', 'z'] } });
  assert.deepEqual(lines, ['~ env.A', '+ env.B', '~ permissions.deny (+2)']);
  assert.ok(!lines.join('\n').includes(SECRET));
});

test('telemetry adds every spec variable to user env and keeps model, effortLevel and enabledPlugins', async () => {
  const dirs = fresh();
  writeJson(userSettings(dirs.home), { ...KEPT, env: { OTHER: SECRET } });
  const result = await setup(['--only', 'telemetry', '--yes'], dirs);
  assert.equal(result.code, 0);
  assert.match(result.out, /\+ env\.OTEL_METRICS_EXPORTER/);
  assert.match(result.out, /\+ env\.OTEL_LOG_RAW_API_BODIES/);
  assert.ok(!result.out.includes(SECRET));
  const written = readJson(userSettings(dirs.home));
  assert.deepEqual(written.env, { OTHER: SECRET, ...TELEMETRY_ENV });
  assert.equal(written.env.OTEL_LOG_USER_PROMPTS, '0');
  assert.equal(written.model, KEPT.model);
  assert.equal(written.effortLevel, KEPT.effortLevel);
  assert.deepEqual(written.enabledPlugins, KEPT.enabledPlugins);
  assert.ok(readFileSync(userSettings(dirs.home), 'utf8').endsWith('}\n'));
  const second = await setup(['--only', 'telemetry', '--yes'], dirs);
  assert.equal(second.code, 0);
  assert.match(second.out, /telemetry: no changes/);
  assert.equal(readdirSync(join(dirs.home, '.claude')).filter((f) => f.includes('.bak-')).length, 1);
});

test('deny unions the tool names of mcpWriteDeny into the local permissions.deny', async () => {
  const dirs = fresh();
  writeJson(localSettings(dirs.project), { ...KEPT, permissions: { deny: ['Bash(rm -rf:*)'], allow: ['Read'] } });
  const result = await setup(['--only', 'deny', '--yes'], dirs);
  assert.equal(result.code, 0);
  assert.match(result.out, /~ permissions\.deny \(\+2\)/);
  const written = readJson(localSettings(dirs.project));
  assert.deepEqual(written.permissions.deny, ['Bash(rm -rf:*)', 'mcp__figma__use_figma', 'mcp__figma__create_new_file']);
  assert.deepEqual(written.permissions.allow, ['Read']);
  assert.deepEqual(written.enabledPlugins, KEPT.enabledPlugins);
  assert.match((await setup(['--only', 'deny', '--yes'], dirs)).out, /deny: no changes/);
});

test('mcp-pins pins the ADO package and the sonar image and prints only argument strings', async () => {
  const dirs = fresh();
  const servers = {
    'azure-devops': { command: 'npx', args: ['-y', '@azure-devops/mcp', 'org'], env: { TOKEN: SECRET } },
    sonarqube: { command: 'docker', args: ['run', '-i', '--rm', '-e', 'SONARQUBE_TOKEN', 'sonarsource/sonarqube-mcp:latest'], env: { SONARQUBE_TOKEN: SECRET } },
  };
  writeJson(claudeJson(dirs.home), { projects: { [dirs.project]: { mcpServers: servers } }, userID: SECRET });
  const result = await setup(['--only', 'mcp-pins', '--yes'], dirs);
  assert.equal(result.code, 0);
  assert.match(result.out, /@azure-devops\/mcp -> @azure-devops\/mcp@2\.3\.0/);
  assert.match(result.out, /sonarsource\/sonarqube-mcp:latest -> sonarsource\/sonarqube-mcp@sha256:abc123/);
  assert.ok(!result.out.includes(SECRET));
  const written = readJson(claudeJson(dirs.home)).projects[dirs.project].mcpServers;
  assert.deepEqual(written['azure-devops'].args, ['-y', '@azure-devops/mcp@2.3.0', 'org']);
  assert.equal(written.sonarqube.args.at(-1), 'sonarsource/sonarqube-mcp@sha256:abc123');
  assert.deepEqual(written.sonarqube.env, servers.sonarqube.env);
  assert.match((await setup(['--only', 'mcp-pins', '--yes'], dirs)).out, /mcp-pins: no changes/);
});

test('mcp-pins skips an absent sonar image with a line', async () => {
  const dirs = fresh();
  writeJson(claudeJson(dirs.home), { projects: { [dirs.project]: { mcpServers: { sonarqube: { args: ['run', 'sonarsource/sonarqube-mcp'] } } } } });
  const result = await setup(['--only', 'mcp-pins', '--yes'], dirs, { probes: { npmVersion: () => '1.0.0', imageDigest: () => undefined } });
  assert.equal(result.code, 0);
  assert.match(result.out, /skip sonarqube: image sonarsource\/sonarqube-mcp is not present locally/);
  assert.match(result.out, /mcp-pins: no changes/);
});

test('sandbox enables the sandbox with the allowlist locally, or in user settings with --user', async () => {
  const dirs = fresh();
  writeJson(localSettings(dirs.project), { sandbox: { network: { allowedDomains: ['example.org'] } } });
  const local = await setup(['--only', 'sandbox', '--yes'], dirs);
  assert.equal(local.code, 0);
  assert.match(local.out, /\+ sandbox\.enabled/);
  assert.match(local.out, /~ sandbox\.network\.allowedDomains \(\+2\)/);
  assert.deepEqual(readJson(localSettings(dirs.project)).sandbox, { enabled: true, network: { allowedDomains: ['example.org', 'registry.npmjs.org', 'localhost'] } });
  const user = await setup(['--only', 'sandbox', '--user', '--yes'], dirs);
  assert.equal(user.code, 0);
  assert.deepEqual(readJson(userSettings(dirs.home)).sandbox, { enabled: true, network: { allowedDomains: ['registry.npmjs.org', 'localhost'] } });
});

test('--dry-run prints the diff and writes nothing', async () => {
  const dirs = fresh();
  const result = await setup(['--dry-run'], dirs);
  assert.equal(result.code, 0);
  assert.match(result.out, /telemetry: .*\(new file\)/);
  assert.match(result.out, /\+ permissions\.deny \(\+2\)/);
  assert.match(result.out, /mcp-pins: no MCP servers/);
  assert.match(result.out, /\+ sandbox\.enabled/);
  assert.ok(!existsSync(userSettings(dirs.home)));
  assert.ok(!existsSync(localSettings(dirs.project)));
});

test('without a TTY and without --yes the CLI exits 3 and writes nothing', () => {
  const dirs = fresh();
  const result = spawnSync(process.execPath, [CLI, '--only', 'telemetry', '--project', dirs.project], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: dirs.home },
  });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /confirm the diff, then re-run with --yes/);
  assert.ok(!existsSync(userSettings(dirs.home)));
});

test('without a TTY, --yes or --only every part prints its diff before one exit 3', async () => {
  const dirs = fresh();
  const result = await setup([], dirs);
  assert.equal(result.code, 3);
  assert.match(result.out, /telemetry: .*\(new file\)/);
  assert.match(result.out, /\+ permissions\.deny \(\+2\)/);
  assert.match(result.out, /mcp-pins: no MCP servers/);
  assert.match(result.out, /\+ sandbox\.enabled/);
  assert.equal(result.err.match(/confirm the diff, then re-run with --yes/g)?.length, 1);
  assert.ok(!existsSync(userSettings(dirs.home)));
  assert.ok(!existsSync(localSettings(dirs.project)));
});

test('a write keeps the target mode and leaves no temp file', async () => {
  const dirs = fresh();
  writeJson(userSettings(dirs.home), { model: 'opus' });
  chmodSync(userSettings(dirs.home), 0o600);
  const result = await setup(['--only', 'telemetry', '--yes'], dirs);
  assert.equal(result.code, 0);
  assert.equal(statSync(userSettings(dirs.home)).mode & 0o777, 0o600);
  assert.deepEqual(readJson(userSettings(dirs.home)).env, TELEMETRY_ENV);
  assert.deepEqual(readdirSync(join(dirs.home, '.claude')).sort(), ['settings.json', 'settings.json.bak-20261007-0905']);
});

test('a write through a symlinked target replaces the file it points to', async () => {
  const dirs = fresh();
  const real = join(sandbox, `real-settings-${counter}.json`);
  writeJson(real, { model: 'opus' });
  symlinkSync(real, userSettings(dirs.home));
  const result = await setup(['--only', 'telemetry', '--yes'], dirs);
  assert.equal(result.code, 0);
  assert.ok(lstatSync(userSettings(dirs.home)).isSymbolicLink());
  assert.deepEqual(readJson(real).env, TELEMETRY_ENV);
});

test('a TTY answer of no skips the write', async () => {
  const dirs = fresh();
  const result = await setup(['--only', 'telemetry'], dirs, { isTTY: true, ask: async () => false });
  assert.equal(result.code, 0);
  assert.match(result.out, /telemetry: skipped/);
  assert.ok(!existsSync(userSettings(dirs.home)));
});

test('a malformed target exits 1 and writes nothing', async () => {
  const dirs = fresh();
  writeFileSync(userSettings(dirs.home), '{ not json');
  const result = await setup(['--only', 'telemetry', '--yes'], dirs);
  assert.equal(result.code, 1);
  assert.match(result.err, /not valid JSON; nothing written/);
  assert.equal(readFileSync(userSettings(dirs.home), 'utf8'), '{ not json');
  assert.deepEqual(readdirSync(join(dirs.home, '.claude')), ['settings.json']);
});

test('a missing target is created without a backup', async () => {
  const dirs = fresh();
  const result = await setup(['--only', 'telemetry', '--yes'], dirs);
  assert.equal(result.code, 0);
  assert.deepEqual(readJson(userSettings(dirs.home)).env, TELEMETRY_ENV);
  assert.doesNotMatch(result.out, /backup/);
  assert.deepEqual(readdirSync(join(dirs.home, '.claude')), ['settings.json']);
});

test('a target outside a git repo is backed up beside itself', async () => {
  const dirs = fresh();
  writeJson(userSettings(dirs.home), { model: 'opus' });
  const result = await setup(['--only', 'telemetry', '--yes'], dirs);
  const backup = `${userSettings(dirs.home)}.bak-20261007-0905`;
  assert.match(result.out, new RegExp(`backup ${backup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.deepEqual(readJson(backup), { model: 'opus' });
});

test('a target inside a git repo is backed up under HOME, not in the working tree', async () => {
  const dirs = fresh({ repo: true });
  writeJson(localSettings(dirs.project), { permissions: { deny: [] } });
  const result = await setup(['--only', 'deny', '--yes'], dirs);
  assert.equal(result.code, 0);
  const expected = join(dirs.home, '.claude', 'backups', 'harness', `${localSettings(dirs.project).slice(1).replaceAll('/', '-')}.bak-20261007-0905`);
  assert.equal(backupPath(localSettings(dirs.project), dirs.home, NOW), expected);
  assert.deepEqual(readJson(expected), { permissions: { deny: [] } });
  assert.deepEqual(readdirSync(join(dirs.project, '.claude')).sort(), ['harness.json', 'settings.local.json']);
});

test('a second backup in the same minute does not overwrite the first', async () => {
  const dirs = fresh();
  writeJson(userSettings(dirs.home), { model: 'opus' });
  await setup(['--only', 'telemetry', '--yes'], dirs);
  await setup(['--only', 'sandbox', '--user', '--yes'], dirs);
  const backups = readdirSync(join(dirs.home, '.claude')).filter((f) => f.includes('.bak-')).sort();
  assert.deepEqual(backups, ['settings.json.bak-20261007-0905', 'settings.json.bak-20261007-0905-1']);
  assert.deepEqual(readJson(join(dirs.home, '.claude', backups[0])), { model: 'opus' });
});

test('deny and sandbox are skipped for a project without harness.json', async () => {
  const dirs = fresh({ config: null });
  const result = await setup(['--only', 'deny', '--yes'], dirs);
  assert.equal(result.code, 0);
  assert.match(result.out, /deny: no \.claude\/harness\.json/);
  assert.ok(!existsSync(localSettings(dirs.project)));
});

test('stamp formats local time as YYYYMMDD-HHmm', () => {
  assert.equal(stamp(NOW), '20261007-0905');
});
