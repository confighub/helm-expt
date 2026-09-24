#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, parseDocs, readYaml, repoRoot, sha256File, write, writeYaml } from './lib/proof-common.mjs';

const candidate = 'runs/prometheus-operator-minimal-candidate';
const packageRoot = `${candidate}/packages/prometheus-community/kube-prometheus-stack/87.19.2`;
const lifecycle = `${packageRoot}/prerequisites/kube-prometheus-stack-lifecycle`;
const source = `${candidate}/recipes/prometheus-community/kube-prometheus-stack/87.19.2/source-lock.yaml`;
const app = 'examples/prometheus-operator-minimal/app.yaml';
const out = 'runs/prometheus-operator-minimal-live';
const receiptPath = join(repoRoot, out, 'receipt.yaml');
const mode = process.argv[2] ?? '--verify';
const target = 'kind-workshop-monitoring-1970';
const sourceFiles = [source, `${packageRoot}/bases/minimal/upstream.yaml`, `${lifecycle}/generation-receipt.yaml`, `${lifecycle}/default-crds.yaml`, `${lifecycle}/hook-support.yaml`, `${lifecycle}/admission-create-job.yaml`, `${lifecycle}/admission-patch-job.yaml`, `${lifecycle}/prepare.sh`, `${lifecycle}/finish.sh`, app];
const checks = [];
function run(name, executable, args, timeout = 360000) {
  const result = spawnSync(executable, args, { cwd: repoRoot, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 });
  const file = `${name}.txt`;
  write(join(repoRoot, out, file), `${result.stdout ?? ''}${result.stderr ?? ''}`);
  checks.push({ name, result: result.status === 0 && !result.error ? 'pass' : 'fail', detail: name, evidencePath: file, evidenceSHA256: sha256File(join(repoRoot, out, file)) });
  check(!result.error && result.status === 0, `${name} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout;
}
function kubectl(name, args, timeout) { return run(name, 'kubectl', ['--context', target, ...args], timeout); }
export function verify(receipt) {
  const spec = receipt.spec;
  check(receipt.kind === 'MinimalMonitoringLiveReceipt' && spec?.result === 'pass', 'minimal monitoring qualification did not pass');
  check(spec.chart === 'prometheus-community/kube-prometheus-stack' && spec.version === '87.19.2' && spec.base === 'minimal' && spec.clusterContext === target, 'qualification identity changed');
  check(spec.chartPackageSHA256 === readYaml(join(repoRoot, source)).spec.packageSHA256, 'qualification source changed');
  for (const file of sourceFiles) check(spec.sourceFiles[file] === sha256File(join(repoRoot, file)), `${file} changed since qualification`);
  check(new Set(spec.checks.map(row => row.name)).size === spec.checks.length, 'duplicate qualification steps');
  const expected = ['target-version', 'namespace', 'crds-apply', 'crds-established', 'admission-prepare', 'platform-apply', 'admission-finish', 'app-apply', 'app-ready', 'prometheus-ready', 'scrape-query', 'workloads'];
  check(spec.checks.length === expected.length, 'qualification step set changed');
  for (const name of expected) {
    const step = spec.checks.find(row => row.name === name);
    check(step?.result === 'pass', `${name} did not pass`);
  }
  for (const step of spec.checks) {
    check(step.result === 'pass' && /^[a-z0-9-]+\.txt$/.test(step.evidencePath), 'invalid qualification step');
    check(step.evidenceSHA256 === sha256File(join(repoRoot, out, step.evidencePath)), `${step.name} evidence changed`);
  }
  const answer = JSON.parse(readFileSync(join(repoRoot, out, 'scrape-query.txt'), 'utf8'));
  check(answer.status === 'success' && answer.data.result.some(row => row.metric.fixture === 'prometheus-operator-minimal' && row.value?.[1] === '1'), 'synthetic fixture was not scraped');
  const finish = readYaml(join(repoRoot, out, 'admission-receipt.yaml'));
  check(finish.spec?.result === 'pass' && finish.spec?.temporaryResourcesRemoved === true && finish.spec?.matchingWebhookCABundles === 3, 'admission qualification incomplete');
  check(spec.admissionReceiptSHA256 === sha256File(join(repoRoot, out, 'admission-receipt.yaml')), 'admission receipt changed');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
if (mode === '--verify') {
  verify(readYaml(receiptPath));
  console.log('verified minimal monitoring live lifecycle and synthetic scrape evidence');
} else if (mode === '--run') {
  check(process.env.KUBECONFIG && existsSync(process.env.KUBECONFIG), 'qualification requires a dedicated KUBECONFIG');
  check(!existsSync(receiptPath), 'refusing to overwrite a retained qualification receipt');
  mkdirSync(join(repoRoot, out), { recursive: true });
  const spec = { result: 'fail', observedAt: new Date().toISOString(), chart: 'prometheus-community/kube-prometheus-stack', version: '87.19.2', base: 'minimal', clusterContext: target, chartPackageSHA256: readYaml(join(repoRoot, source)).spec.packageSHA256, sourceFiles: Object.fromEntries(sourceFiles.map(file => [file, sha256File(join(repoRoot, file))])), checks,
    lifecycleModel: { claim: 'Observed once on a dedicated kind cluster. Proves the retained lifecycle steps and synthetic application scrape, not production safety, upgrades, rollback or GitOps execution.' } };
  try {
    check(spawnSync('kubectl', ['config', 'current-context'], { encoding: 'utf8' }).stdout?.trim() === target, 'dedicated kubeconfig current context does not match target');
    kubectl('target-version', ['version', '-o', 'json']);
    kubectl('namespace', ['create', 'namespace', 'monitoring']);
    kubectl('crds-apply', ['apply', '--server-side', '--force-conflicts', '-f', `${lifecycle}/default-crds.yaml`]);
    const crds = parseDocs(readFileSync(join(repoRoot, lifecycle, 'default-crds.yaml'), 'utf8'));
    kubectl('crds-established', ['wait', '--for=condition=Established', '--timeout=120s', ...crds.map(doc => `crd/${doc.metadata.name}`)]);
    run('admission-prepare', 'bash', [`${lifecycle}/prepare.sh`, 'monitoring']);
    kubectl('platform-apply', ['apply', '--server-side', '--force-conflicts', '-f', `${packageRoot}/bases/minimal/upstream.yaml`]);
    process.env.HELM_EXPT_LIFECYCLE_RECEIPT = join(repoRoot, out, 'admission-receipt.yaml');
    process.env.KPS_LIFECYCLE_BASE = 'minimal';
    run('admission-finish', 'bash', [`${lifecycle}/finish.sh`, 'monitoring']);
    const admissionPath = join(repoRoot, out, 'admission-receipt.yaml');
    const admission = readYaml(admissionPath);
    admission.spec.observedAt = new Date().toISOString();
    writeYaml(admissionPath, admission);
    spec.admissionReceiptSHA256 = sha256File(join(repoRoot, out, 'admission-receipt.yaml'));
    kubectl('app-apply', ['apply', '-f', app]);
    kubectl('app-ready', ['-n', 'monitoring', 'rollout', 'status', 'deployment/candidate-metrics-app', '--timeout=300s']);
    kubectl('prometheus-ready', ['-n', 'monitoring', 'rollout', 'status', 'statefulset/prometheus-kube-prometheus-stack-prometheus', '--timeout=300s']);
    const probe = `import json,time,urllib.request\nu='http://kube-prometheus-stack-prometheus:9090/api/v1/query?query=candidate_fixture_info'\nfor attempt in range(60):\n try:\n  data=json.load(urllib.request.urlopen(u,timeout=5))\n  if data.get('status')=='success' and any(r.get('metric',{}).get('fixture')=='prometheus-operator-minimal' and r.get('value',[None,None])[1]=='1' for r in data['data']['result']):\n   print(json.dumps(data));break\n except Exception: pass\n time.sleep(3)\nelse: raise SystemExit('synthetic fixture not scraped within deadline')`;
    kubectl('scrape-query', ['-n', 'monitoring', 'exec', 'deployment/candidate-metrics-app', '--', 'python', '-c', probe], 240000);
    kubectl('workloads', ['-n', 'monitoring', 'get', 'deploy,sts,pod,servicemonitor', '-o', 'json']);
    spec.result = 'pass';
  } catch (error) {
    spec.failure = error.message;
    throw error;
  } finally {
    writeYaml(receiptPath, { apiVersion: 'helm-expt.confighub.com/v1alpha1', kind: 'MinimalMonitoringLiveReceipt', spec });
  }
  verify(readYaml(receiptPath));
  console.log(`recorded ${out}/receipt.yaml`);
} else throw new Error('use --run or --verify');

}
