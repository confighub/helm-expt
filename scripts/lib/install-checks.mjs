import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { check, readYaml, repoRoot } from "./proof-common.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/*
InstallChecks schema, intentionally small for the first Redis user verifier:

apiVersion: helm-expt.confighub.com/v1alpha1
kind: InstallChecks
spec:
  chart: <repo>/<chart>/<version>
  canonicalNamespace: <namespace used by catalog proof>
  releaseName: <helm release name>
  receiptRoot: .tmp/verify-install
  variants:
    - name: <variant name>
      base: <cub installer package base>
      variantRevision: <path>
      renderedObjects: <canonical rendered release object YAML path>
      helmEquivalenceReceipt: <receipt path with spec.regularHelm.renderedSHA256>
      targetFacts:
        requiredSecrets:
          - namespace: <canonical namespace>
            name: <secret name>
            keys: [<key>]
      expected:
        helmObjects: <canonical Helm object count>
        cubInstallObjectsIncludingSupport: <cub installer object count>
        semanticObjectMatches: <n/n>
        allowedCubOnlyObjects:
          - {apiVersion, kind, namespace, name}
      clusterChecks:
        statefulsets:
          - {name, readyReplicas}
        persistentVolumeClaims:
          selector: <kubectl label selector>
          boundCount: <expected bound PVC count>
        redisPing:
          statefulset: <statefulset to exec into>
          passwordDefault: <demo password>
        redisAuthSecretName: <secret referenced by Redis workloads>
        forbiddenObjects:
          - {apiVersion, kind, namespace, name}
        inventoryResources: <kubectl resource list>
      confighubChecks:
        expectedUnitCount: <all Units including installer-record>
        requiredLabels:
          <label key>: <label value>
        expectedVariantLabeledUnitCount: <Kubernetes object Units>
        installerRecordRequired: true
*/

export function loadInstallChecks(chart, base) {
  const manifestPath = installChecksPath(chart);
  const checks = readYaml(manifestPath);
  check(checks.kind === "InstallChecks", `${manifestPath} must be kind InstallChecks`);
  check(checks.spec?.chart === chart, `${manifestPath} chart mismatch: expected ${chart}`);
  const variant = checks.spec.variants.find((item) => item.base === base || item.name === base);
  check(Boolean(variant), `unsupported ${chart} base: ${base}`);
  return { checks, spec: checks.spec, variant, path: manifestPath };
}

export function installChecksPath(chart) {
  const parts = chart.split("/");
  if (parts.length === 3) {
    const candidate = join(repoRoot, "recipes", ...parts, "install-checks.yaml");
    if (existsSync(candidate)) return candidate;
  }
  const supported = supportedInstallCheckCharts();
  const suffix = supported.length ? ` Currently available: ${supported.join(", ")}.` : " No install-checks.yaml files are currently available.";
  throw new Error(`verify-install requires recipes/<repo>/<chart>/<version>/install-checks.yaml for ${chart}.${suffix}`);
}

export function supportedInstallCheckCharts() {
  return walk(join(repoRoot, "recipes"))
    .filter((path) => path.endsWith("/install-checks.yaml"))
    .map((path) => relative(join(repoRoot, "recipes"), dirname(path)).replaceAll("\\", "/"))
    .sort();
}

function walk(root) {
  return readdirSafe(root).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  });
}

function readdirSafe(root) {
  try {
    return readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
}
