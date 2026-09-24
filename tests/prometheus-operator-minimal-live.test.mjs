import test from 'node:test';
import assert from 'node:assert/strict';
import { readYaml, repoRoot } from '../scripts/lib/proof-common.mjs';
import { verify } from '../scripts/run-prometheus-operator-minimal-live.mjs';
import { join } from 'node:path';
const receipt = () => readYaml(join(repoRoot, 'runs/prometheus-operator-minimal-live/receipt.yaml'));
test('retained minimal monitoring lifecycle and scrape are bound to current inputs', () => verify(receipt()));
for (const [name, mutate] of [
  ['source substitution', r => { r.spec.chartPackageSHA256 = '0'.repeat(64); }],
  ['payload drift', r => { r.spec.sourceFiles[Object.keys(r.spec.sourceFiles)[0]] = '0'.repeat(64); }],
  ['missing scrape', r => { r.spec.checks = r.spec.checks.filter(s => s.name !== 'scrape-query'); }],
  ['failed readiness', r => { r.spec.checks.find(s => s.name === 'prometheus-ready').result = 'fail'; }],
  ['altered log', r => { r.spec.checks[0].evidenceSHA256 = '0'.repeat(64); }],
  ['duplicate step', r => { r.spec.checks.push(r.spec.checks[0]); }],
  ['admission substitution', r => { r.spec.admissionReceiptSHA256 = '0'.repeat(64); }],
]) test(`qualification rejects ${name}`, () => { const r = receipt(); mutate(r); assert.throws(() => verify(r)); });
