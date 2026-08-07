import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join as joinPath } from "node:path";

// One scope declaration for the additive Kubara catalog release. Promotion,
// publication, and release acceptance all import these constants so a command
// cannot silently publish a path that the retention contract does not cover.

export const KUBARA_CATALOG_BASELINE = Object.freeze({
  versionCount: 110,
  recipesTreeSHA256: "405bb7847cff4a4c9c691aafbaf69a1baff160c5e8a8f5d927569c8dd2286424",
  packagesTreeSHA256: "68c82bb177743dc610172bacd035475160515cccb47aea68910d32d222bd6e1c",
});

// The tree digests above freeze whole version-root directories, which was the
// right shape while this catalog served one workstream. It no longer is: later
// lanes add their own artifacts inside existing roots, such as a per-chart
// flattening-safety verdict, and other workstreams add version roots that
// Kubara never claimed. Both are legitimate, and both move a whole-tree digest.
//
// The manifest pins the exact files the release recorded, each with its SHA-256,
// so the acceptance keeps its real guarantee, that nothing the release recorded
// was removed or altered, while staying blind to anything added afterwards. Its
// own digest is pinned here so the manifest cannot be edited quietly.
export const KUBARA_CATALOG_RELEASE_SCOPE = Object.freeze({
  manifestPath: "data/kubara-catalog-1.1-full-coverage/release-scope-manifest.json",
  manifestSHA256: "3c09892019676b3f8a25bf7fe44553294849ba1ccb11baebb6e48811abe74fa4",
  recordedFromCommit: "e173cf89f",
  rootCount: 260,
  fileCount: 4646,
});

export const KUBARA_HISTORICAL_ADDITIONS = Object.freeze([
  "argo-cd/argo-cd/10.1.3",
  "external-secrets/external-secrets/2.7.0",
  "jetstack/cert-manager/v1.21.0",
  "metrics-server/metrics-server/3.13.1",
  "prometheus-community/kube-prometheus-stack/87.15.1",
  "prometheus-community/prometheus-blackbox-exporter/11.15.1",
  "traefik/traefik/41.0.2",
]);

export const KUBARA_CURRENT_ADDITIONS = Object.freeze([
  "argo-cd/argo-cd/10.2.1",
  "external-secrets/external-secrets/2.8.0",
  "prometheus-community/kube-prometheus-stack/87.19.2",
]);

export const KUBARA_CATALOG_ADDITIONS = Object.freeze([
  ...KUBARA_HISTORICAL_ADDITIONS,
  ...KUBARA_CURRENT_ADDITIONS,
]);

export const KUBARA_OCI_PACKAGES = Object.freeze(
  KUBARA_CATALOG_ADDITIONS.map((path) => `packages/${path}`),
);

export const KUBARA_PROMOTION_RECEIPTS = Object.freeze([
  "data/kubara-catalog-refresh/root-promotion/receipt.yaml",
  "data/kubara-catalog-refresh/current-root-promotion/receipt.yaml",
]);

export function kubaraAdditionPath(rootName, chartVersionPath) {
  return `${rootName}/${chartVersionPath}`;
}

// Reading the manifest belongs here rather than in each caller, because the
// acceptance and the publisher enforce the same retention promise and drifting
// copies of it would defeat the point.
export function readKubaraReleaseScope(repoRoot) {
  const manifestPath = joinPath(repoRoot, KUBARA_CATALOG_RELEASE_SCOPE.manifestPath);
  if (!existsSync(manifestPath)) {
    return { ok: false, reason: `${KUBARA_CATALOG_RELEASE_SCOPE.manifestPath} is missing` };
  }
  const bytes = readFileSync(manifestPath);
  if (createHash("sha256").update(bytes).digest("hex") !== KUBARA_CATALOG_RELEASE_SCOPE.manifestSHA256) {
    return { ok: false, reason: `${KUBARA_CATALOG_RELEASE_SCOPE.manifestPath} does not match its pinned digest` };
  }
  const doc = JSON.parse(bytes.toString("utf8"));
  if (doc.kind !== "KubaraReleaseScopeManifest") {
    return { ok: false, reason: "release scope manifest kind changed" };
  }
  const roots = new Map(Object.entries(doc.spec?.roots ?? {}));
  const fileCount = [...roots.values()].reduce((total, files) => total + Object.keys(files).length, 0);
  if (roots.size !== KUBARA_CATALOG_RELEASE_SCOPE.rootCount || fileCount !== KUBARA_CATALOG_RELEASE_SCOPE.fileCount) {
    return {
      ok: false,
      reason: `release scope manifest must record ${KUBARA_CATALOG_RELEASE_SCOPE.fileCount} files across ${KUBARA_CATALOG_RELEASE_SCOPE.rootCount} roots`,
    };
  }
  return { ok: true, roots };
}

// Returns the first thing the release recorded that is no longer there, or an
// empty string when every recorded file still matches. Files added later are
// deliberately invisible: they belong to other lanes.
export function findKubaraReleaseScopeDrift(repoRoot, scope, roots) {
  for (const root of roots) {
    const files = scope.roots.get(root);
    if (!files) return `${root} is not in the recorded release scope`;
    for (const [relativePath, expectedSha256] of Object.entries(files)) {
      const filePath = joinPath(repoRoot, root, relativePath);
      if (!existsSync(filePath)) return `${root}/${relativePath} is missing`;
      const actual = createHash("sha256").update(readFileSync(filePath)).digest("hex");
      if (actual !== expectedSha256) return `${root}/${relativePath} changed`;
    }
  }
  return "";
}
