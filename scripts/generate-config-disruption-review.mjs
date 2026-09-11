#!/usr/bin/env node
// Static risk review of retained object pairs and explicitly synthetic mutations.
// This never renders, applies, drains a node, or measures workload continuity.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { check, parseDocs, repoRoot, sha256, write } from './lib/proof-common.mjs';
import { reviewDisruption } from './lib/config-disruption-review.mjs';

const mode = process.argv[2] ?? '--verify';
check(['--generate', '--verify'].includes(mode) && process.argv.length <= 3,
  'Usage: node scripts/generate-config-disruption-review.mjs --generate|--verify');
const root = 'data/config-disruption-review';
const gpuSource = 'examples/aicr/eks-h100-training-kubeflow-v0-20-0/nested-renders/gpu-operator/objects.yaml';
const crdBase = 'recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/release-objects.yaml';
const crdCandidate = 'recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/no-crds/r001/rendered/release-objects.yaml';
const inputs = new Map();
function load(path) {
  if (!inputs.has(path)) {
    const bytes = readFileSync(join(repoRoot, path), 'utf8');
    inputs.set(path, { path, sha256: sha256(bytes), objects: parseDocs(bytes) });
  }
  return inputs.get(path);
}
const gpu = load(gpuSource).objects.filter((o) => o.apiVersion === 'apps/v1' && o.kind === 'Deployment' && o.metadata.name === 'gpu-operator');
check(gpu.length === 1, 'Retained GPU Operator Deployment selection must match exactly one object');
const original = gpu[0];
check(original.spec?.template?.spec?.containers?.[0]?.image, 'Retained operator container image is missing');
const cases = [];
function synthetic(id, description, mutate, expectedCategory) {
  const candidate = structuredClone(original);
  mutate(candidate);
  const review = reviewDisruption([original], [candidate]);
  const categories = [...new Set(review.objects.flatMap((o) => o.rules.map((r) => r.category)))].sort();
  if (expectedCategory) check(categories.includes(expectedCategory), `${id}: expected static category is missing`);
  else check(review.verdict === 'no-config-change', `${id}: unchanged pair must report no configuration change`);
  check(!categories.includes('rebuild-driver') && !categories.includes('drain-node'), `${id}: generic operator image must not imply driver rebuild or node drain`);
  cases.push({ id, scenario: 'synthetic-mutation-of-retained-render', description,
    source: gpuSource, selection: 'apps/v1 Deployment gpu-operator/gpu-operator only', review });
}
synthetic('operator-image-change', 'Synthetic operator pod image change; no real upstream upgrade or runtime outcome is claimed.',
  (o) => { o.spec.template.spec.containers[0].image = `example.invalid/operator-review@sha256:${'1'.repeat(64)}`; }, 'recreate-workload');
synthetic('deployment-selector-change', 'Synthetic immutable selector change; the API would reject an in-place patch, not automatically replace it.',
  (o) => { o.spec.selector.matchLabels = { 'review.example/selection': 'candidate' }; o.spec.template.metadata.labels = { ...o.spec.template.metadata.labels, 'review.example/selection': 'candidate' }; }, 'replace-immutable-field');
synthetic('metadata-only-change', 'Synthetic metadata annotation change; no pod-template rule matches, and runtime side effects remain unknown.',
  (o) => { o.metadata.annotations = { ...o.metadata.annotations, 'review.example/note': 'candidate' }; }, 'unclassified');
synthetic('unchanged-config', 'Identical selected configuration; unchanged bytes do not prove runtime health.', () => {}, null);

const beforeCrds = load(crdBase).objects.filter((o) => o.apiVersion.startsWith('apiextensions.k8s.io/') && o.kind === 'CustomResourceDefinition');
const afterCrds = load(crdCandidate).objects.filter((o) => o.apiVersion.startsWith('apiextensions.k8s.io/') && o.kind === 'CustomResourceDefinition');
check(beforeCrds.length === 10 && afterCrds.length === 0, 'Retained CRD-enabled/no-CRDs pair changed; review its fixture scope');
const crdReview = reviewDisruption(beforeCrds, afterCrds);
check(crdReview.objects.length === 10 && crdReview.objects.every((o) => o.changeType === 'deleted' && o.rules.some((r) => r.category === 'crd-or-apiversion-change')), 'CRD removal must remain an explicit compatibility/lifecycle hazard');
cases.push({ id: 'retained-crd-removal', scenario: 'retained-base-pair',
  description: 'CRD-only selection from committed default and no-crds renders; candidate omission does not prove live deletion, whose prune/retention policy is unassessed.',
  source: crdBase, candidateSource: crdCandidate, selection: 'apiextensions.k8s.io CustomResourceDefinitions only', review: crdReview });
const report = { schemaVersion: 1, kind: 'StaticDisruptionProof',
  scope: 'configuration-only; no runtime, driver, drain, ordering, continuity or rollback proof',
  inputs: [...inputs.values()].map(({ path, sha256 }) => ({ path, sha256 })), cases };
const rows = cases.map((c) => ({ id: c.id, scenario: c.scenario,
  changed: c.review.objects.filter((o) => o.changeType !== 'unchanged').length,
  categories: [...new Set(c.review.objects.flatMap((o) => o.rules.map((r) => r.category)))].sort().join('; '),
  verdict: c.review.verdict }));
const csv = ['case_id,scenario,changed_objects,categories,verdict', ...rows.map((r) => [r.id,r.scenario,r.changed,r.categories,r.verdict].map((v) => JSON.stringify(String(v))).join(','))].join('\n') + '\n';
const summary = `# Static disruption review\n\nThis first slice of [#1660](https://github.com/confighub/helm-expt/issues/1660) classifies configuration hazards; it does not predict observed disruption or certify safety.\n\nThree cases mutate a retained GPU Operator Deployment synthetically, one compares it unchanged, and one compares the CRD-only selection of two committed Helm bases. No source chart was rerendered and no cluster was used.\n\n| Case | Input scope | Changed objects | Categories | Verdict |\n| --- | --- | --- | --- | --- |\n${rows.map((r) => `| ${r.id} | ${r.scenario} | ${r.changed} | ${r.categories || 'none'} | ${r.verdict} |`).join('\n')}\n\nThe [machine report](./report.json) binds source file hashes and per-object before/after hashes to changed JSON Pointer paths. It omits field values. [Unit tests](../../tests/config-disruption-review.test.mjs) exercise strategy changes, custom resources, API changes, duplicate inputs and secret-value exclusion.\n\nRun \`npm run disruption-review:generate\` to regenerate and \`npm run disruption-review:verify\` to check the report and adversarial cases offline. These are repository proof commands, not new cub commands.\n\nRemaining work: domain-specific driver/drain and dependency-order classification, integration into upgrade/promote previews and live-chat adapters, real target preflight, interruption/continuity measurements, and separate data-safe and successful rollback evidence. An unchanged or unclassified diff is never a runtime safety verdict.\n`;
for (const [name, content] of [['report.json', JSON.stringify(report, null, 2)+'\n'], ['cases.csv', csv], ['summary.md', summary]]) {
  const path = join(repoRoot, root, name);
  if (mode === '--generate') write(path, content);
  else check(existsSync(path) && readFileSync(path, 'utf8') === content, `${root}/${name} is stale; run npm run disruption-review:generate`);
}
console.log(`${mode === '--generate' ? 'generated' : 'verified'} static disruption review: ${cases.length} cases; no runtime safety claim`);
