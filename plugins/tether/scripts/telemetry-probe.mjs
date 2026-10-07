// CLI: node telemetry-probe.mjs; prints whether 127.0.0.1:4317 accepts a connection and whether this session enables telemetry.
// Prints no environment value; exit 0 always.
import { connect } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const OTLP_HOST = '127.0.0.1';
export const OTLP_PORT = 4317;

export function probePort(host, port, timeoutMs = 2000) {
  return new Promise((done) => {
    const socket = connect(port, host);
    const finish = (open) => {
      socket.destroy();
      done(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

export function telemetryEnabled(env) {
  return env.CLAUDE_CODE_ENABLE_TELEMETRY === '1';
}

export function report(open, enabled) {
  return [`otlp ${OTLP_HOST}:${OTLP_PORT} ${open ? 'open' : 'closed'}`, `telemetry ${enabled ? 'on' : 'off'}`];
}

async function main() {
  const lines = report(await probePort(OTLP_HOST, OTLP_PORT), telemetryEnabled(process.env));
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
