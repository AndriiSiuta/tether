---
description: Start, stop or check the local telemetry stack (grafana/otel-lgtm on 127.0.0.1)
argument-hint: up|down|status
allowed-tools: Bash(docker compose:*), Bash(docker image inspect:*), Bash(node -e:*)
---

Manage the harness telemetry stack defined in `${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml`. The requested action is: `$ARGUMENTS`.

The stack is one `grafana/otel-lgtm` container pinned by digest, every port bound to `127.0.0.1`: Grafana 3000, OTLP gRPC 4317, OTLP HTTP 4318, Prometheus 9090, Tempo 3200, Loki 3100. Metrics, logs and traces are kept for 14 days in the named volume `lgtm-data`.

Act on exactly one of these, and on nothing else:

- `up`
  1. Read the `image:` line of the compose file. Run `docker image inspect <that image>`. If it fails, the image has never been pulled: tell Andrii the full image reference (tag and digest) and ask whether to pull it. Stop and wait for his answer; do not pull without a yes.
  2. Run `docker compose -f "${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml" up -d`.
  3. Report Grafana at `http://127.0.0.1:3000`, dashboard "Harness: Claude Code".
- `down`: run `docker compose -f "${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml" down`. Never pass `-v`: the volume holds the 14 days of data.
- `status`
  1. Run `docker compose -f "${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml" ps`.
  2. Run `node -e "const s=require('node:net').connect(4317,'127.0.0.1');s.setTimeout(2000);s.on('connect',()=>{console.log('open');s.end()});s.on('timeout',()=>{console.log('closed');s.destroy()});s.on('error',()=>console.log('closed'))"`.
  3. If `CLAUDE_CODE_ENABLE_TELEMETRY` is `1` in this session's environment and the probe printed `closed`, warn: telemetry is on but nothing listens on 127.0.0.1:4317, so this session's metrics, events and traces are being dropped; run `/harness:telemetry up`. Check the variable with `node -e "console.log(process.env.CLAUDE_CODE_ENABLE_TELEMETRY === '1')"` and never print any other environment value.

Any other argument: print the usage `/harness:telemetry up|down|status` and stop.
