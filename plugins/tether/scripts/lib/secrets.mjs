// Shapes of credentials that must never travel in a commit message or an MCP call. Matched on text, never printed back.
const SHAPES = [
  ['a GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/],
  ['an Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['an AWS access key id', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['a JSON web token', /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
  ['a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['an Azure DevOps personal access token', /\b[a-z2-7]{52}\b/],
];

export function findSecretShape(text) {
  if (typeof text !== 'string' || text === '') return null;
  return SHAPES.find(([, shape]) => shape.test(text))?.[0] ?? null;
}
