import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'telemetry');
const compose = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8').split('\n');
const provisioning = readFileSync(join(ROOT, 'grafana', 'provisioning', 'dashboards', 'harness.yaml'), 'utf8').split('\n');

const TITLES = [
  'Tokens by agent and model',
  'Cost by agent and model',
  'Tool failures by tool',
  'Tool decision rejects by source',
  'Auto gate denied',
  'MCP connection errors',
  'Session traces',
];

function listUnder(lines, key) {
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  assert.notEqual(start, -1, `no ${key}: block`);
  const indent = lines[start].search(/\S/);
  const items = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue;
    if (line.search(/\S/) <= indent) break;
    const item = line.trim().match(/^-\s+(.*)$/);
    if (item) items.push(item[1]);
  }
  return items;
}

function unquote(value) {
  return value.replace(/^"(.*)"$/, '$1');
}

test('every published port is bound to 127.0.0.1', () => {
  const ports = listUnder(compose, 'ports');
  assert.equal(ports.length, 6);
  for (const port of ports) assert.match(port, /^"127\.0\.0\.1:/);
  assert.deepEqual(
    ports.map((port) => unquote(port).split(':')[2]).sort(),
    ['3000', '3100', '3200', '4317', '4318', '9090'],
  );
});

test('the image is pinned by a sha256 digest', () => {
  const images = compose.map((line) => line.trim()).filter((line) => line.startsWith('image:'));
  assert.equal(images.length, 1);
  assert.match(images[0], /^image: grafana\/otel-lgtm:[\w.-]+@sha256:[0-9a-f]{64}$/);
});

test('retention is 14 days for metrics, logs and traces', () => {
  const text = compose.join('\n');
  assert.match(text, /--storage\.tsdb\.retention\.time=14d/);
  assert.match(text, /-store\.retention=14d -compactor\.retention-enabled=true/);
  assert.match(text, /--backend-worker\.compaction\.block-retention=336h/);
  assert.ok(listUnder(compose, 'volumes').includes('lgtm-data:/data'));
});

test('the dashboard parses and carries all seven panel titles', () => {
  const dashboard = JSON.parse(readFileSync(join(ROOT, 'grafana', 'dashboard.json'), 'utf8'));
  assert.deepEqual(dashboard.panels.map((panel) => panel.title), TITLES);
});

test('the provisioning path matches the mounted dashboard', () => {
  const pathLine = provisioning.map((line) => line.trim()).find((line) => line.startsWith('path:'));
  const providerDir = pathLine.slice('path:'.length).trim();
  const mounts = listUnder(compose, 'volumes').map((entry) => entry.split(':'));
  const dashboardMount = mounts.find(([source]) => source === './grafana/dashboard.json');
  const providerMount = mounts.find(([source]) => source === './grafana/provisioning/dashboards/harness.yaml');
  assert.ok(dashboardMount, 'dashboard.json is not mounted');
  assert.ok(providerMount, 'harness.yaml is not mounted');
  assert.equal(posix.dirname(dashboardMount[1]), providerDir);
  assert.equal(posix.dirname(providerMount[1]), posix.dirname(providerDir));
});
