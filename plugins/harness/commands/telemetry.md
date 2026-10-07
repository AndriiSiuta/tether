---
disable-model-invocation: true
description: Start, stop or check the local telemetry stack (grafana/otel-lgtm on 127.0.0.1)
argument-hint: up|down|status
allowed-tools: ["Bash(docker image inspect grafana/otel-lgtm:0.35.0@sha256:2de1094c593c671cbfca878a28ffcd7e46ff5e32f2ce966c0cf33003f6cf4266)", "Bash(docker compose -f ${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml up -d --pull never)", "Bash(docker compose -f ${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml down)", "Bash(docker compose -f ${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml ps)", "Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/telemetry-probe.mjs)"]
---

Manage the harness telemetry stack defined in `${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml`. The requested action is: `$ARGUMENTS`.

The stack is one `grafana/otel-lgtm` container pinned by digest, every port bound to `127.0.0.1`: Grafana 3000, OTLP gRPC 4317, OTLP HTTP 4318, Prometheus 9090, Tempo 3200, Loki 3100. Metrics, logs and traces are kept for 14 days in the named volume `lgtm-data`.

Run each command exactly as written, unquoted, so it matches the pre-approved rule. Act on exactly one of these, and on nothing else:

- `up`
  1. Run `docker image inspect grafana/otel-lgtm:0.35.0@sha256:2de1094c593c671cbfca878a28ffcd7e46ff5e32f2ce966c0cf33003f6cf4266`. If it fails, the image has never been pulled: tell the user the full image reference `grafana/otel-lgtm:0.35.0@sha256:2de1094c593c671cbfca878a28ffcd7e46ff5e32f2ce966c0cf33003f6cf4266` and ask whether to pull it. Stop and wait for their answer. On anything but a yes, stop.
  2. Only after their yes, run `docker compose -f ${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml pull`. It is not pre-approved, so the permission prompt asks again; if it fails, show its stderr and stop.
  3. Run `docker compose -f ${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml up -d --pull never`. It never pulls: an image missing here means step 1 or 2 did not run.
  4. Report Grafana at `http://127.0.0.1:3000`, dashboard "Harness: Claude Code".
- `down`: run `docker compose -f ${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml down`. Never pass `-v`: the volume holds the 14 days of data.
- `status`
  1. Run `docker compose -f ${CLAUDE_PLUGIN_ROOT}/telemetry/docker-compose.yml ps`.
  2. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/telemetry-probe.mjs`. It prints `otlp 127.0.0.1:4317 open|closed` and `telemetry on|off`, and no environment value.
  3. If it printed `telemetry on` and `closed`, warn: telemetry is on but nothing listens on 127.0.0.1:4317, so this session's metrics, events and traces are being dropped; run `/harness:telemetry up`. Never print an environment value.

Any other argument: print the usage `/harness:telemetry up|down|status` and stop.
