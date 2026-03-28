import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildCompleteArticlePrompt } from '../prompts/complete-article-prompt.mjs';
import { parseArticleSummary } from '../parsers/article-summary-parser.mjs';

const execFileAsync = promisify(execFile);

function buildRoutingArgs(options = {}) {
  const agentId = options.agentId || process.env.OPENCLAW_AGENT_ID || process.env.OPENCLAW_AGENT || null;
  const sessionId = options.sessionId || process.env.OPENCLAW_SESSION_ID || null;
  const recipient = options.to || process.env.OPENCLAW_TO || null;
  const channel = options.channel || process.env.OPENCLAW_CHANNEL || null;
  const args = [];

  if (agentId) {
    args.push('--agent', agentId);
  } else if (sessionId) {
    args.push('--session-id', sessionId);
  } else if (recipient) {
    args.push('--to', recipient);
  }

  if (channel) {
    args.push('--channel', channel);
  }

  return args;
}

export async function runOpenClawAgent(article, content, options = {}) {
  const { timeoutSeconds = 600, thinking = 'medium' } = options;
  const prompt = buildCompleteArticlePrompt(article, content);
  const { stdout, stderr } = await execFileAsync('openclaw', [
    'agent',
    ...buildRoutingArgs(options),
    '--json',
    '--message',
    prompt,
    '--timeout',
    String(timeoutSeconds),
    '--thinking',
    thinking
  ]);

  const raw = stdout.trim() ? stdout : stderr;
  const parsed = JSON.parse(raw);
  const text = parsed?.response?.output_text || parsed?.output_text || parsed?.message || '';
  if (!text) {
    throw new Error('empty agent response');
  }
  return text;
}

export async function generateArticleSummaryWithRetry({
  runner = runOpenClawAgent,
  article,
  content,
  retries = 2,
  options = {}
}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const raw = await runner(article, content, options);
      return parseArticleSummary(raw);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
