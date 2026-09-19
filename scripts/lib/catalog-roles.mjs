// Discovery is an authored classification of exact retained bytes, never a
// readiness verdict or an inference from a chart's name.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, sha256 } from './proof-common.mjs';

const path = 'data/catalog-roles/assignments.json';
const roles = new Set(['cache', 'database', 'ingress', 'certificates', 'metrics', 'logs', 'secrets', 'queue', 'gpu']);
const componentTypes = new Set(['service', 'operator', 'agent']);
const boundary = 'Discovery only: a role does not establish readiness, compatibility or support. An operator needs custom resources; an agent needs its destination. Read the listing prerequisites and coverage before composing.';

export function validateAssignments(document, records) {
  assert.equal(document.kind, 'CatalogRoleAssignments');
  assert.equal(document.apiVersion, 'catalog.confighub.com/v1alpha1');
  assert.ok(Array.isArray(document.assignments), 'role assignments must be an array');
  const catalog = new Map(records.map(record => [record.metadata.name, record]));
  const result = new Map();
  for (const entry of document.assignments) {
    assert.ok(!result.has(entry.id), `duplicate role assignment: ${entry.id}`);
    const record = catalog.get(entry.id);
    assert.ok(record, `role assignment has no catalog entry: ${entry.id}`);
    assert.equal(entry.configurationDigest, record.spec.configuration.digest, `${entry.id}: configuration changed; review its role assignment`);
    assert.ok(Array.isArray(entry.roles) && entry.roles.length > 0, `${entry.id}: roles required`);
    assert.ok(typeof entry.rationale === 'string' && entry.rationale.trim(), `${entry.id}: rationale required`);
    const assigned = new Set();
    for (const role of entry.roles) {
      assert.ok(roles.has(role.role), `${entry.id}: unknown role ${role.role}`);
      assert.ok(componentTypes.has(role.componentType), `${entry.id}: unknown component type`);
      assert.ok(!assigned.has(role.role), `${entry.id}: duplicate role`);
      assigned.add(role.role);
    }
    result.set(entry.id, entry);
  }
  return result;
}

export function loadRoleAssignments(records) {
  const bytes = readFileSync(join(repoRoot, path));
  return { entries: validateAssignments(JSON.parse(bytes), records), assignment: {
    path, sha256: `sha256:${sha256(bytes)}`,
    url: `https://github.com/confighub/helm-expt/blob/main/${path}`,
  } };
}

export function discoveryFor(id, assignments) {
  const entry = assignments?.entries.get(id);
  if (!entry) return { status: 'not-classified', roles: [], boundary };
  return { status: 'classified', roles: entry.roles, rationale: entry.rationale, assignment: assignments.assignment, boundary };
}

export function testRoleAssignments() {
  const records = [{ metadata: { name: 'database-controller' }, spec: { configuration: { digest: 'a'.repeat(64) } } }];
  const row = { id: 'database-controller', configurationDigest: 'a'.repeat(64), roles: [{ role: 'database', componentType: 'operator' }], rationale: 'Controller only; a database custom resource is required.' };
  const doc = entries => ({ apiVersion: 'catalog.confighub.com/v1alpha1', kind: 'CatalogRoleAssignments', assignments: entries });
  const entries = validateAssignments(doc([row]), records);
  assert.equal(discoveryFor(row.id, { entries }).roles[0].componentType, 'operator');
  assert.deepEqual(discoveryFor('unknown', { entries }).roles, []);
  assert.equal(discoveryFor('unknown', { entries }).status, 'not-classified');
  for (const invalid of [
    [row, row], [{ ...row, id: 'missing' }],
    [{ ...row, configurationDigest: 'b'.repeat(64) }],
    [{ ...row, roles: [{ role: 'invented', componentType: 'service' }] }],
    [{ ...row, roles: [{ role: 'database', componentType: 'ready' }] }],
    [{ ...row, roles: [] }], [{ ...row, rationale: '' }],
  ]) assert.throws(() => validateAssignments(doc(invalid), records));
}
