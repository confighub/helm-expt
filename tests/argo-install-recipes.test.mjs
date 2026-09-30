import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRecipe, CHART } from '../scripts/lib/argo-install-recipes.mjs';
const fixturePath = 'examples/argo-install-recipes/fixtures/hardened-hub.json';
const fixture = () => JSON.parse(readFileSync(fixturePath));
test('all eight topology/posture/delivery choices build from exact facts', () => {
  for (const recipe of ['demo-in-cluster','demo-hub','hardened-in-cluster','hardened-hub']) for (const delivery of [false,true]) {
    const input = fixture(); input.recipe = recipe;
    if (recipe.startsWith('demo')) { delete input.oidc; delete input.ingress; delete input.syncWindow; }
    if (!recipe.endsWith('hub')) { input.target.server = 'https://kubernetes.default.svc'; delete input.target.remoteServer; }
    if (!delivery) delete input.delivery;
    const out = buildRecipe(input);
    assert.equal(out.prerequisites.helm.packageSHA256, CHART.sha256);
    assert.equal(out.prerequisites.candidateOnly, true);
    assert.ok(!JSON.stringify(out).includes('"kind":"Secret"'));
  }
});
test('tenant cannot inherit a platform source or cluster privileges', () => {
  const out = buildRecipe(fixture());
  const team = out.projects.find(p => p.metadata.name === 'team-payments');
  assert.deepEqual(team.spec.clusterResourceWhitelist, []);
  assert.deepEqual(team.spec.clusterResourceBlacklist, [{group:'*',kind:'*'}]);
  assert.ok(team.spec.namespaceResourceWhitelist.every(r => r.kind !== '*'));
  assert.ok(team.spec.destinations.every(d => d.namespace === 'payments'));
  assert.deepEqual(out.projects.find(p => p.metadata.name === 'platform-infrastructure').spec.sourceRepos, []);
  assert.deepEqual(out.projects[0].spec, { sourceRepos: [], destinations: [] });
  assert.match(out.values.configs.rbac['policy.csv'], /team-payments\/\*/);
  assert.equal(team.spec.syncWindows[0].manualSync, true);
  assert.equal(team.spec.syncWindows[0].kind, 'deny');
});
test('secret, ambiguous, privileged and ignored inputs are refused', () => {
  const mutations = [
    x => x.password = 'must-not-be-accepted',
    x => x.oidc.clientSecret = 'must-not-be-accepted',
    x => delete x.oidc.groups.platform,
    x => x.teams[0].developerGroup = x.oidc.groups.platform,
    x => x.teams[0].developerGroup = x.oidc.groups.readonly,
    x => { delete x.delivery; x.teams.push({...x.teams[0],name:"other",namespace:"other"}); },
    x => x.oidc.groups.platform = 'admin, role:admin',
    x => x.delivery.gateway = 'https://user:password@gateway.example.invalid',
    x => x.delivery.source += '/*',
    x => x.delivery.source += '/../../other',
    x => x.delivery.gateway += '/ignored-path',
    x => x.teams[0].repository += '/*',
    x => x.teams[0].namespace = 'argocd',
    x => x.target.remoteServer = x.target.server,
    x => x.teams.push({...x.teams[0],name:'other'}),
    x => x.recipe = 'hardened-in-cluster',
    x => delete x.syncWindow,
    x => x.syncWindow.schedule = "99 25 * * *",
    x => x.ingress.hostname = "bad..example.invalid",
    x => x.teams[0].name = "x".repeat(60),
    x => { delete x.delivery; x.teams.push({...x.teams[0], name:"other"}); },
    x => x.target.namespace = x.teams[0].namespace,
  ];
  for (const mutate of mutations) { const input = fixture(); mutate(input); assert.throws(() => buildRecipe(input)); }
});
test('OIDC and TLS are references and Helm inflation stays opt-in', () => {
  const input = fixture(); input.delivery.enableHelm = false;
  const out = buildRecipe(input);
  const oidc = JSON.parse(out.values.configs.cm['oidc.config']);
  assert.equal(oidc.clientSecret, '$argocd-oidc:clientSecret');
  assert.equal(out.values.configs.cm.url, 'https://argo.example.invalid');
  assert.equal(out.values.configs.cm['kustomize.buildOptions'], undefined);
  assert.equal(out.values.configs.cm['kustomize.path.v5'], undefined);
  assert.equal(out.values.server.ingress.extraTls[0].secretName, 'argo-tls');
});
test('CLI produces a Kubernetes document stream and refuses overwrite', () => {
  const scratch = mkdtempSync(join(tmpdir(),'argo-recipes-test-'));
  try {
    const output = join(scratch,'candidate');
    execFileSync(process.execPath,['scripts/render-argo-install-recipe.mjs',fixturePath,output]);
    const docs = readFileSync(join(output,'projects.yaml'),'utf8').trim().split('\n---\n').map(JSON.parse);
    assert.ok(docs.every(d => d.kind === 'AppProject'));
    assert.throws(() => execFileSync(process.execPath,['scripts/render-argo-install-recipe.mjs',fixturePath,output],{stdio:'pipe'}));
  } finally { rmSync(scratch,{recursive:true,force:true}); }
});
