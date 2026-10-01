import { test } from 'node:test';
import assert from 'node:assert/strict';
import { driftBody, reconcileIssue, marker } from '../scripts/report-workshop-drift.mjs';

test('tracker creates, updates without comment spam, closes and reopens the same issue', () => {
  const report = { plugins: [], apps: [{ id: 'sample', head: 'new' }], stacks: [] };
  const body = driftBody(report);
  assert.equal(reconcileIssue([], body).method, 'POST');
  const issue = { number: 123, state: 'open', body };
  assert.equal(reconcileIssue([issue], body), null);
  assert.deepEqual(reconcileIssue([issue], null), { method: 'PATCH', number: 123, fields: { state: 'closed' } });
  assert.equal(reconcileIssue([{ ...issue, state: 'closed' }], body).fields.state, 'open');
  assert.equal(reconcileIssue([{ ...issue, body: marker }], body).fields.body, body);
});
test('invalid reports and duplicate trackers fail rather than close an issue', () => {
  assert.throws(() => driftBody({}), /Missing report/);
  assert.throws(() => reconcileIssue([{ body: marker }, { body: marker }], null), /Multiple/);
  assert.equal(driftBody({ plugins: [], apps: [], stacks: [] }), null);
  assert.equal(reconcileIssue([{ pull_request: {}, body: marker }], null), null);
});

test('upstream text cannot break out of the report code fence', () => {
  const body = driftBody({ plugins: [], apps: [{ path: '```\n@unexpected' }], stacks: [] });
  assert.equal(body.split('```').length, 3);
  assert.ok(body.includes('\\u0060\\u0060\\u0060'));
});
