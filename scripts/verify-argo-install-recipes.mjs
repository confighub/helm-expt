import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRecipe, CHART } from './lib/argo-install-recipes.mjs';
import { parseDocs } from './lib/proof-common.mjs';

const hash = (x) => createHash('sha256').update(x).digest('hex');
const fixturePath = 'examples/argo-install-recipes/fixtures/hardened-hub.json';
const receiptPath = 'runs/argo-install-recipes/10.2.1/render-receipt.json';
const sourceHash = () => hash(readFileSync('scripts/lib/argo-install-recipes.mjs'));
const fixture = JSON.parse(readFileSync(fixturePath));
const recipes = ['demo-in-cluster', 'demo-hub', 'hardened-in-cluster', 'hardened-hub'];
const cases = [];
for (const recipe of recipes) for (const delivery of [false, true]) {
  const input = structuredClone(fixture);
  input.recipe = recipe;
  if (recipe.startsWith('demo')) { delete input.oidc; delete input.ingress; delete input.syncWindow; }
  if (!recipe.endsWith('hub')) { input.target.server = 'https://kubernetes.default.svc'; delete input.target.remoteServer; }
  if (!delivery) delete input.delivery;
  cases.push({ id: `${recipe}-${delivery ? 'confighub' : 'git'}`, input });
}
const archive = process.argv[2];
if (!archive) {
  const receipt = JSON.parse(readFileSync(receiptPath));
  assert.equal(receipt.builderSHA256, sourceHash(), 'render receipt requires rerun after builder change');
  assert.equal(receipt.fixtureSHA256, hash(readFileSync(fixturePath)));
  assert.equal(receipt.chartSHA256, CHART.sha256);
  assert.equal(receipt.behavioralEvidence, 'not-run');
  assert.equal(receipt.cases.length, cases.length);
  for (const [i, entry] of cases.entries()) {
    const actual = buildRecipe(entry.input);
    assert.equal(receipt.cases[i].id, entry.id);
    assert.equal(receipt.cases[i].inputSHA256, hash(JSON.stringify(entry.input)));
    assert.equal(receipt.cases[i].valuesSHA256, hash(JSON.stringify(actual.values)));
    assert.equal(receipt.cases[i].projectsSHA256, hash(JSON.stringify(actual.projects)));
    assert.match(receipt.cases[i].renderSHA256, /^[a-f0-9]{64}$/);
    assert.ok(receipt.cases[i].objects > 0);
  }
  console.log('Argo recipe render receipt matches all eight current inputs; behavioral evidence remains not-run');
} else {
  assert.equal(hash(readFileSync(archive)), CHART.sha256, 'chart archive differs from Catalog lock');
  const scratch = mkdtempSync(join(tmpdir(), 'argo-recipe-render-'));
  const rows = [];
  try {
    for (const entry of cases) {
      const { values, projects } = buildRecipe(entry.input);
      const valuesFile = join(scratch, 'values.json');
      writeFileSync(valuesFile, JSON.stringify(values));
      const rendered = execFileSync('helm', ['template', 'argo-cd', archive, '--namespace', 'argocd', '--kube-version', '1.30.0', '--include-crds', '--skip-tests', '--no-hooks', '-f', valuesFile], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
      const docs = parseDocs(rendered);
      const cm = docs.find((o) => o.kind === 'ConfigMap' && o.metadata.name.endsWith('argocd-cm'));
      const rbac = docs.find((o) => o.kind === 'ConfigMap' && o.metadata.name.endsWith('argocd-rbac-cm'));
      assert.ok(cm && rbac);
      if (entry.input.recipe.startsWith('hardened')) {
        assert.equal(cm.data['admin.enabled'], 'false');
        assert.equal(rbac.data['policy.default'], 'role:readonly');
        const ingress = docs.find((o) => o.kind === 'Ingress');
        assert.equal(ingress.spec.rules[0].host, entry.input.ingress.hostname);
        assert.ok(ingress.spec.tls.some((tls) => tls.secretName === entry.input.ingress.tlsSecretRef));
        assert.ok(cm.data['oidc.config'].includes('$argocd-oidc:clientSecret'));
      }
      if (entry.input.delivery?.enableHelm) assert.equal(cm.data['kustomize.buildOptions'], '--enable-helm');
      assert.ok(projects.every((p) => p.kind === 'AppProject' && p.metadata.namespace === 'argocd'));
      rows.push({ id: entry.id, inputSHA256: hash(JSON.stringify(entry.input)), valuesSHA256: hash(JSON.stringify(values)), projectsSHA256: hash(JSON.stringify(projects)), renderSHA256: hash(rendered), objects: docs.length, projectCount: projects.length, assertions: 'passed' });
    }
    mkdirSync('runs/argo-install-recipes/10.2.1', { recursive: true });
    writeFileSync(receiptPath, JSON.stringify({ scope: 'eight offline Helm renders; selected configuration assertions only', chartSHA256: CHART.sha256, builderSHA256: sourceHash(), fixtureSHA256: hash(readFileSync(fixturePath)), helmVersion: execFileSync('helm', ['version', '--short'], { encoding: 'utf8' }).trim(), behavioralEvidence: 'not-run', cases: rows }, null, 2) + '\n');
    console.log('Recorded all eight Argo candidate renders; no cluster or ConfigHub operation ran');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
