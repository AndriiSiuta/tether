export const DEFAULT_ENDPOINTS = Object.freeze({
  prometheus: 'http://127.0.0.1:9090',
  tempo: 'http://127.0.0.1:3200',
  loki: 'http://127.0.0.1:3100',
});

const LOOKBACK_S = 30 * 24 * 3600;
const TIMEOUT_MS = 5000;
const LLM_SPAN = 'claude_code.llm_request';
const TOOL_SPAN = 'claude_code.tool';
const TOKEN_ATTRS = ['input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_creation_tokens'];
const SERVICE = '{service_name="claude-code"}';

const quote = (value) => JSON.stringify(String(value));

async function getJson(base, path, params) {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url.origin}${url.pathname} answered ${response.status}`);
  return response.json();
}

async function isReady(base, path) {
  try {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function telemetryUp(endpoints = DEFAULT_ENDPOINTS) {
  const ready = await Promise.all([isReady(endpoints.prometheus, '/-/ready'), isReady(endpoints.tempo, '/ready'), isReady(endpoints.loki, '/ready')]);
  return ready.every(Boolean);
}

function attrValue(attr) {
  const v = attr?.value ?? {};
  return v.intValue ?? v.doubleValue ?? v.stringValue ?? v.boolValue;
}

function timeWindow() {
  const end = Math.floor(Date.now() / 1000);
  return { start: end - LOOKBACK_S, end };
}

export async function traceSpans(sessionId, agentId, endpoints = DEFAULT_ENDPOINTS) {
  const filter = [`.session.id = ${quote(sessionId)}`];
  if (agentId !== undefined) filter.push(`span.agent_id = ${quote(agentId)}`);
  const select = [...TOKEN_ATTRS, 'tool_use_id'].map((a) => `span.${a}`).join(', ');
  const q = `{ ${filter.join(' && ')} } | select(${select})`;
  const body = await getJson(endpoints.tempo, '/api/search', { q, ...timeWindow(), limit: 1000, spss: 10000 });
  const spans = new Map();
  for (const trace of body.traces ?? []) {
    for (const set of [...(trace.spanSets ?? []), ...(trace.spanSet ? [trace.spanSet] : [])]) {
      for (const span of set.spans ?? []) {
        const attrs = Object.fromEntries((span.attributes ?? []).map((a) => [a.key, attrValue(a)]));
        spans.set(span.spanID, {
          name: span.name,
          start: BigInt(span.startTimeUnixNano ?? 0),
          duration: BigInt(span.durationNanos ?? 0),
          attrs,
        });
      }
    }
  }
  return [...spans.values()];
}

function lokiFilter(sessionId, agentId, eventName) {
  const parts = [SERVICE, `session_id=${quote(sessionId)}`, `event_name=${quote(eventName)}`];
  if (agentId !== undefined) parts.push(`agent_id=${quote(agentId)}`);
  return parts.join(' | ');
}

async function toolFailures(sessionId, agentId, endpoints) {
  const query = `sum(count_over_time(${lokiFilter(sessionId, agentId, 'tool_result')} | success="false" [30d]))`;
  const body = await getJson(endpoints.loki, '/loki/api/v1/query', { query, time: timeWindow().end });
  return Number(body?.data?.result?.[0]?.value?.[1] ?? 0);
}

async function hookRejects(sessionId, endpoints) {
  const query = `${lokiFilter(sessionId, undefined, 'tool_decision')} | decision="reject" | source="hook"`;
  const { start, end } = timeWindow();
  const body = await getJson(endpoints.loki, '/loki/api/v1/query_range', { query, start: `${start}000000000`, end: `${end}000000000`, limit: 5000, direction: 'forward' });
  return (body?.data?.result ?? []).flatMap((stream) => (stream.values ?? []).map(() => stream.stream?.tool_use_id));
}

function spanTotals(spans) {
  let tokens = 0;
  let toolUses = 0;
  let first;
  let last;
  for (const span of spans) {
    if (span.name === LLM_SPAN) tokens += TOKEN_ATTRS.reduce((s, a) => s + (Number(span.attrs[a]) || 0), 0);
    if (span.name === TOOL_SPAN) toolUses++;
    const end = span.start + span.duration;
    if (first === undefined || span.start < first) first = span.start;
    if (last === undefined || end > last) last = end;
  }
  const wallMs = first === undefined ? 0 : Number((last - first) / 1_000_000n);
  return { tokens, toolUses, wallMs };
}

export async function agentTotals(sessionId, agentId, endpoints = DEFAULT_ENDPOINTS) {
  const spans = await traceSpans(sessionId, agentId, endpoints);
  if (spans.length === 0) return null;
  const toolIds = new Set(spans.filter((s) => s.name === TOOL_SPAN).map((s) => String(s.attrs.tool_use_id)));
  const [failures, rejects] = await Promise.all([toolFailures(sessionId, agentId, endpoints), hookRejects(sessionId, endpoints)]);
  return { ...spanTotals(spans), toolFailures: failures, hookBlocks: rejects.filter((id) => toolIds.has(String(id))).length };
}

export async function sessionTotals(sessionId, endpoints = DEFAULT_ENDPOINTS) {
  const query = `sum({__name__=~"claude_code_token_usage(_tokens)?(_total)?", session_id=${quote(sessionId)}})`;
  const [metrics, spans, failures, rejects] = await Promise.all([
    getJson(endpoints.prometheus, '/api/v1/query', { query }),
    traceSpans(sessionId, undefined, endpoints),
    toolFailures(sessionId, undefined, endpoints),
    hookRejects(sessionId, endpoints),
  ]);
  const sample = metrics?.data?.result?.[0]?.value?.[1];
  if (sample === undefined && spans.length === 0) return null;
  const fromSpans = spanTotals(spans);
  return { ...fromSpans, tokens: sample === undefined ? fromSpans.tokens : Number(sample), toolFailures: failures, hookBlocks: rejects.length };
}
