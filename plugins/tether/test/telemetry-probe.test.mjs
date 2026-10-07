import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { probePort, report, telemetryEnabled } from '../scripts/telemetry-probe.mjs';

function listen() {
  return new Promise((done) => {
    const server = createServer((socket) => socket.end());
    server.listen(0, '127.0.0.1', () => done(server));
  });
}

test('probePort reports a listening port as open and a closed one as closed', async () => {
  const server = await listen();
  const { port } = server.address();
  assert.equal(await probePort('127.0.0.1', port), true);
  await new Promise((done) => server.close(done));
  assert.equal(await probePort('127.0.0.1', port), false);
});

test('telemetryEnabled is true only for the value 1', () => {
  assert.equal(telemetryEnabled({ CLAUDE_CODE_ENABLE_TELEMETRY: '1' }), true);
  assert.equal(telemetryEnabled({ CLAUDE_CODE_ENABLE_TELEMETRY: 'true' }), false);
  assert.equal(telemetryEnabled({}), false);
});

test('report prints states, never an environment value', () => {
  assert.deepEqual(report(false, true), ['otlp 127.0.0.1:4317 closed', 'telemetry on']);
  assert.deepEqual(report(true, false), ['otlp 127.0.0.1:4317 open', 'telemetry off']);
});
