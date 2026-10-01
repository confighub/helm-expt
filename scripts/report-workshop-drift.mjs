#!/usr/bin/env node
// One durable issue, updated only when its findings change. API failures must
// fail the job, never masquerade as a clean upstream report.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const marker = '<!-- workshop-upstream-drift -->';
export function driftBody(report) {
  for (const key of ['plugins', 'apps', 'stacks']) {
    if (!Array.isArray(report[key])) throw new Error(`Missing report array: ${key}`);
  }
  if (!report.plugins.length && !report.apps.length && !report.stacks.length) return null;
  return `${marker}\n# Workshop upstream review\n\nThe scheduled upstream check found these changes. Plugin pins can be proposed mechanically; summaries, limitations and app evidence need review. See #2051.\n\n` +
    ['plugins', 'apps', 'stacks'].filter(key => report[key].length).map(key =>
      `## ${key}\n\n\`\`\`json\n${JSON.stringify(report[key], null, 2).replaceAll("`", "\\u0060")}\n\`\`\``).join('\n\n') +
    '\n\nFor app changes, run `node scripts/generate-workshop-sections.mjs --sync-apps` to inspect the changed paths and comparison links. Do not update checked commits until the descriptions and delivery claims have been reviewed.\n';
}

export function reconcileIssue(issues, body) {
  const matches = issues.filter(issue => !issue.pull_request && issue.body?.includes(marker));
  if (matches.length > 1) throw new Error('Multiple drift tracking issues: reconcile them before proceeding');
  const issue = matches[0];
  if (!body) return issue?.state === 'open' ? { method: 'PATCH', number: issue.number, fields: { state: 'closed' } } : null;
  if (!issue) return { method: 'POST', fields: { title: 'catalog: upstream registry changes need review', body } };
  if (issue.body === body && issue.state === 'open') return null;
  return { method: 'PATCH', number: issue.number, fields: { body, state: 'open' } };
}

function api(args, input) {
  return JSON.parse(execFileSync('gh', ['api', ...args], {
    encoding: 'utf8', input: input && JSON.stringify(input), maxBuffer: 20 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'inherit'],
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const repo = process.env.GITHUB_REPOSITORY || 'confighub/helm-expt';
  const pages = api(['--paginate', '--slurp', `repos/${repo}/issues?state=all&per_page=100`]);
  const action = reconcileIssue(pages.flat(), driftBody(report));
  if (action) api(['--method', action.method, `repos/${repo}/issues${action.number ? `/${action.number}` : ''}`, '--input', '-'], action.fields);
  console.log(action ? `drift tracker ${action.method.toLowerCase()} completed` : 'drift tracker unchanged');
}
