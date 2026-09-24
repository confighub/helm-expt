#!/usr/bin/env node
// Exact-source qualification for the reviewed minimal profile. This is not a
// general template interpreter: changing the archive or values requires review.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { check, readYaml, repoRoot, sha256, sha256File } from './lib/proof-common.mjs';

const archiveSHA = 'b846cc368aaafd122148c8eec9b361d3893c6068d6301ec20d41c8023dcd8c88';
const valuesSHA = '9046c76974f147cb4e5ec0959772f99c0a8d7d2c7b79e03bd148d663b079a4ef';
const effectiveValuesSHA = '962c6cb60ab643330f4950ce17d66bb40b6eb45bb92e8c6355e367f9afcd7571';
const reviewRoot = join(repoRoot, 'examples/prometheus-operator-minimal/source-review');
const sourceLockPath = join(repoRoot, 'runs/prometheus-operator-minimal-candidate/recipes/prometheus-community/kube-prometheus-stack/87.19.2/source-lock.yaml');
const effectiveValuesPath = join(repoRoot, 'runs/prometheus-operator-minimal-candidate/recipes/prometheus-community/kube-prometheus-stack/87.19.2/effective-values-minimal.yaml');
const renderReceiptPath = join(repoRoot, 'runs/prometheus-operator-minimal-candidate/recipes/prometheus-community/kube-prometheus-stack/87.19.2/revisions/minimal/r001/receipts/render-receipt.yaml');
const chartMember = 'kube-prometheus-stack/Chart.yaml';
const chartMemberSHA = '01d45ce56bbc115aeaac90031b7b9ec761f0879fc83f2d2c68206ac7906359e1';
const members = {
  'kube-prometheus-stack/charts/grafana/templates/_helpers.tpl': 'ff2d786ba3f92ac9def8b30879e5f2afc1eb5d0cd9ebbd1dad47bcbf6111b174',
  'kube-prometheus-stack/charts/grafana/templates/pvc.yaml': '87c256a401c601b17fb45c67cd7a78fa208e154112759e1749be5dc3f306b6f8',
};
const artifactUrl = 'https://github.com/prometheus-community/helm-charts/releases/download/kube-prometheus-stack-87.19.2/kube-prometheus-stack-87.19.2.tgz';

const archiveIndex = process.argv.indexOf('--archive');
const archive = archiveIndex >= 0 ? process.argv[archiveIndex + 1] : null;
const extract = process.argv.includes('--extract');
check(!extract || archive, '--extract requires --archive <chart.tgz>');
if (archive) verifyArchive(archive);
if (extract) extractReviewedMembers(archive);
verifySourceReviewManifest();
verifyRetainedMembers(archive);
verifyGrafanaDependencyReview(archive);

const valuesPath = join(repoRoot, 'examples/prometheus-operator-minimal/values.yaml');
check(sha256File(valuesPath) === valuesSHA, 'minimal values changed; repeat the source gating review');
const values = readYaml(valuesPath);
check(values.grafana?.enabled === false, 'Grafana dependency must remain disabled');
const effectiveValues = readYaml(effectiveValuesPath);
check(sha256File(effectiveValuesPath) === effectiveValuesSHA, 'effective values changed; repeat the source gating review');
const renderReceipt = readYaml(renderReceiptPath);
verifyEffectiveValues(effectiveValues, renderReceipt);
const source = readYaml(sourceLockPath);
check(source.spec.packageSHA256 === archiveSHA, 'reviewed source archive changed');
const candidateRoot = 'runs/prometheus-operator-minimal-candidate';
const expectedRender = '9947d9f86e3cabce7870b80560cda7ffd0381a909d253c43c6120f56c0b5a78c';
for (const file of [`${candidateRoot}/recipes/prometheus-community/kube-prometheus-stack/87.19.2/revisions/minimal/r001/rendered/release-objects.yaml`, `${candidateRoot}/packages/prometheus-community/kube-prometheus-stack/87.19.2/bases/minimal/upstream.yaml`]) {
  check(sha256File(join(repoRoot, file)) === expectedRender, 'minimal profile payload differs from the exact source-reviewed and live-qualified candidate');
}
console.log('verified exact minimal values and source identity; four reviewed Grafana lookups and its generated credentials are gated by grafana.enabled=false');
console.log('Boundary: enabling Grafana or changing the values/archive requires renewed source review; this does not evaluate arbitrary tpl extensions or prove lifecycle execution.');
if (process.argv.includes('--self-test')) runSelfTest();

function verifyArchive(path) {
  check(existsSync(path) && sha256(readFileSync(path)) === archiveSHA, 'archive differs from reviewed source');
}

function archiveChart(path) {
  const bytes = execFileSync('tar', ['-xOf', path, chartMember], { maxBuffer: 1024 * 1024 });
  check(sha256(bytes) === chartMemberSHA, 'Chart.yaml: reviewed dependency conditions changed');
  return bytes.toString('utf8');
}

function archiveMember(path, member) {
  const bytes = execFileSync('tar', ['-xOf', path, member], { maxBuffer: 1024 * 1024 });
  verifyMemberBytes(member, bytes, 'reviewed dependency condition or lookup implementation changed');
  return bytes;
}

function verifyRetainedMembers(sourceArchive) {
  for (const member of Object.keys(members)) {
    const retained = join(reviewRoot, member);
    check(existsSync(retained), `${member}: retained source-review file is missing; rerun with --extract --archive <chart.tgz>`);
    const bytes = readFileSync(retained);
    verifyMemberBytes(member, bytes, 'retained source-review bytes changed');
    if (sourceArchive) check(Buffer.compare(bytes, archiveMember(sourceArchive, member)) === 0, `${member}: retained source-review bytes differ from the reviewed archive`);
  }
}

function verifyMemberBytes(member, bytes, message) {
  check(sha256(bytes) === members[member], `${member}: ${message}`);
}

function verifySourceReviewManifest() {
  const path = join(reviewRoot, 'source-review.json');
  check(existsSync(path), 'retained source-review provenance is missing; rerun with --extract --archive <chart.tgz>');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  verifySourceReviewManifestDocument(manifest);
}

function verifySourceReviewManifestDocument(manifest) {
  check(manifest.apiVersion === 'evidence.confighub.com/v1alpha1' && manifest.kind === 'HelmChartSourceReview', 'retained source-review provenance has the wrong kind');
  check(manifest.spec?.artifact?.url === artifactUrl && manifest.spec?.artifact?.sha256 === `sha256:${archiveSHA}`, 'retained source-review provenance does not name the reviewed archive');
  const recorded = new Map((manifest.spec?.members ?? []).map((entry) => [entry.archivePath, entry]));
  check(recorded.size === Object.keys(members).length, 'retained source-review provenance has the wrong member count');
  for (const [archivePath, digest] of Object.entries(members)) {
    const entry = recorded.get(archivePath);
    check(entry?.path === archivePath && entry.sha256 === `sha256:${digest}`, `${archivePath}: retained source-review provenance changed`);
  }
}

function verifyGrafanaDependencyReview(sourceArchive) {
  const path = join(reviewRoot, 'source-review.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const review = manifest.spec?.chartDependencyReview;
  check(
    review?.archivePath === chartMember
      && review.sha256 === `sha256:${chartMemberSHA}`
      && review.dependency === 'grafana'
      && review.condition === 'grafana.enabled',
    'retained chart dependency review no longer binds Grafana to grafana.enabled',
  );
  if (sourceArchive) {
    const chart = archiveChart(sourceArchive);
    check(/- condition: grafana\.enabled\n  name: grafana\n/.test(chart), 'Chart.yaml no longer gates Grafana with grafana.enabled');
  }
}

function verifyEffectiveValues(effective, receipt) {
  check(effective.spec?.files?.length === 1, 'effective values must name exactly one reviewed values file');
  check(effective.spec.files[0]?.sha256 === valuesSHA, 'effective values no longer bind the reviewed minimal values file');
  check(effective.spec?.values?.grafana?.enabled === false, 'effective values must keep Grafana disabled');
  check(receipt.spec?.inputs?.effectiveValuesSHA256 === effectiveValuesSHA, 'render receipt no longer binds the reviewed effective values');
}

function runSelfTest() {
  const manifest = JSON.parse(readFileSync(join(reviewRoot, 'source-review.json'), 'utf8'));
  expectFailure('a changed retained template byte', () => verifyMemberBytes('kube-prometheus-stack/charts/grafana/templates/_helpers.tpl', Buffer.from('changed'), 'retained source-review bytes changed'));
  const changedEffectiveValues = structuredClone(effectiveValues);
  changedEffectiveValues.spec.values.grafana.enabled = true;
  expectFailure('effective values that enable Grafana', () => verifyEffectiveValues(changedEffectiveValues, renderReceipt));
  const changedManifest = structuredClone(manifest);
  changedManifest.spec.members[0].sha256 = `sha256:${'0'.repeat(64)}`;
  expectFailure('source provenance with a changed member digest', () => verifySourceReviewManifestDocument(changedManifest));
  console.log('source review self-test: 3 refusal(s) fired as required');
}

function expectFailure(label, verify) {
  try {
    verify();
  } catch {
    return;
  }
  throw new Error(`source review self-test failed: ${label} was admitted instead of refused`);
}

function extractReviewedMembers(sourceArchive) {
  for (const member of Object.keys(members)) {
    const output = join(reviewRoot, member);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, archiveMember(sourceArchive, member));
  }
  const manifest = {
    apiVersion: 'evidence.confighub.com/v1alpha1',
    kind: 'HelmChartSourceReview',
    spec: {
      artifact: { url: artifactUrl, sha256: `sha256:${archiveSHA}` },
      members: Object.entries(members).map(([archivePath, digest]) => ({ archivePath, path: archivePath, sha256: `sha256:${digest}` })),
      chartDependencyReview: {
        archivePath: chartMember,
        sha256: `sha256:${chartMemberSHA}`,
        dependency: 'grafana',
        condition: 'grafana.enabled',
      },
      generatedBy: 'scripts/verify-kps-minimal-source.mjs --extract --archive <chart.tgz>',
    },
  };
  writeFileSync(join(reviewRoot, 'source-review.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
