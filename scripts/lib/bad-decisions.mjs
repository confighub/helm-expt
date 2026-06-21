// Shared corpus for the careless-dev lane: the sample charts + the catalogue of bad
// config decisions. Used by BOTH the Helm-only fuzz (run-bad-decisions-fuzz.mjs) and the
// Helm-vs-ConfigHub comparison (run-bad-decisions-comparison.mjs) so "the same 180
// decisions" is literally one source of truth.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { readYaml, repoRoot } from "./proof-common.mjs";

// Curated charts that baseline-render with defaults (owner/chart). Version + repo are read
// from the recipe source-lock so they track the catalog.
export const CHARTS = [
  ["bitnami", "nginx"], ["bitnami", "redis"], ["bitnami", "mysql"], ["bitnami", "mongodb"],
  ["bitnami", "rabbitmq"], ["fluent", "fluent-bit"], ["prometheus-community", "prometheus"],
  ["grafana", "grafana"], ["ingress-nginx", "ingress-nginx"], ["metrics-server", "metrics-server"],
];

// The bad decisions a careless dev might make. `detect` matches the rendered output to see
// whether the bad value leaked into a manifest.
export const DECISIONS = [
  { id: "replicas-negative", set: "replicaCount=-1", detect: /replicas:\s*-1\b/ },
  { id: "replicas-zero", set: "replicaCount=0", detect: /replicas:\s*0\b/ },
  { id: "replicas-absurd", set: "replicaCount=1000000", detect: /replicas:\s*1000000\b/ },
  { id: "replicas-string", set: "replicaCount=lots", detect: /replicas:\s*lots\b/ },
  { id: "image-pullpolicy-bad", set: "image.pullPolicy=Sometimes", detect: /pullPolicy:\s*Sometimes/ },
  { id: "cpu-limit-nonsense", set: "resources.limits.cpu=banana", detect: /cpu:\s*banana/ },
  { id: "mem-limit-negative", set: "resources.limits.memory=-2Gi", detect: /memory:\s*-2Gi/ },
  { id: "service-type-bad", set: "service.type=Maybe", detect: /type:\s*Maybe/ },
  { id: "service-port-overflow", set: "service.port=70000", detect: /port:\s*70000\b/ },
  { id: "service-port-negative", set: "service.port=-1", detect: /port:\s*-1\b/ },
  { id: "bool-as-string", set: "hostNetwork=yes-please", detect: /hostNetwork:\s*"?yes-please"?/ },
  { id: "grace-negative", set: "terminationGracePeriodSeconds=-5", detect: /terminationGracePeriodSeconds:\s*-5/ },
  { id: "probe-negative", set: "livenessProbe.initialDelaySeconds=-30", detect: /initialDelaySeconds:\s*-30/ },
  { id: "priorityclass-missing", set: "priorityClassName=does-not-exist-zzz", detect: /priorityClassName:\s*does-not-exist-zzz/ },
  { id: "nodeselector-impossible", set: "nodeSelector.diskType=unobtanium", detect: /unobtanium/ },
  { id: "storageclass-missing", set: "global.storageClass=does-not-exist-zzz", detect: /does-not-exist-zzz/ },
  { id: "typo-key-noop", set: "thisKeyDoesNotExistAtAll=oops", detect: /thisKeyDoesNotExistAtAll|oops/ },
  { id: "deep-typo-key-noop", set: "contoller.replicas=3", detect: /contoller/ },
];

export function sh(file, args, opts = {}) {
  return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 64, ...opts });
}
export function tsh(file, args, opts = {}) {
  try { return { ok: true, out: sh(file, args, opts) }; }
  catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; }
}

export function chartCoords(owner, chart) {
  const dir = join(repoRoot, "recipes", owner, chart);
  if (!existsSync(dir)) return null;
  const versions = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const v of versions.reverse()) {
    const lock = join(dir, v, "source-lock.yaml");
    if (!existsSync(lock)) continue;
    const y = readYaml(lock);
    const url = y?.spec?.repositoryURL || y?.repositoryURL;
    const cname = y?.spec?.chart || y?.chart || chart;
    const version = y?.spec?.version || y?.version || v;
    if (url) return { slug: `${owner}/${chart}`, repo: url, chart: cname, version };
  }
  return null;
}
