#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  canonicalObjectMaps,
  check,
  identityFor,
  parseDocs,
  parseObjects,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const CHART = "bitnami/nginx";
const VERSION = "24.0.2";
const BASE = "http-clusterip";
const NAMESPACE = "nginx";
const DEPLOYMENT = "nginx";
const SERVICE = "nginx";
const PACKAGE_PATH = "packages/bitnami/nginx/24.0.2";
const PACKAGE_OCI = "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2";
const COMMITTED_OBJECTS = "recipes/bitnami/nginx/24.0.2/revisions/http-clusterip/r001/rendered/release-objects.yaml";
const RENDER_INTENT = "data/helm-render-intents/intents/bitnami-nginx-24-0-2-http-clusterip.yaml";
const OCI_HOST = "oci.hub.confighub.com:443";
const receiptPath = join(repoRoot, "runs", "catalog-oci-delivery-proof", "bitnami-nginx-24-0-2-http-clusterip.yaml");
const summaryPath = join(repoRoot, "data", "catalog-oci-delivery-proof", "summary.md");
const htmlPath = join(repoRoot, "data", "catalog-oci-delivery-proof", "by-controller.html");

let kubeconfig = "";

function sh(file, args, opts = {}) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
    ...opts,
  });
}

function tsh(file, args, opts = {}) {
  try {
    return { ok: true, out: sh(file, args, opts) };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
    };
  }
}

function k(context, args, opts = {}) {
  return tsh("kubectl", [
    ...(kubeconfig ? ["--kubeconfig", kubeconfig] : []),
    "--context",
    context,
    ...args,
  ], opts);
}

function filesUnder(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  }).sort();
}

function normalizeDigest(value) {
  return String(value ?? "").match(/sha256:[a-f0-9]{64}/)?.[0] ?? "";
}

function renderCatalogBase(workRoot) {
  const workDir = join(workRoot, "installer");
  const setup = tsh("cub", [
    "installer",
    "setup",
    "--pull",
    PACKAGE_OCI,
    "--base",
    BASE,
    "--work-dir",
    workDir,
    "--non-interactive",
    "--namespace",
    NAMESPACE,
  ], { timeout: 300_000 });
  if (!setup.ok) {
    return {
      ok: false,
      reason: `cub installer setup failed: ${setup.out.slice(0, 240)}`,
    };
  }

  const manifestsDir = join(workDir, "out", "manifests");
  const manifestFiles = filesUnder(manifestsDir)
    .filter((path) => path.endsWith(".yaml") || path.endsWith(".yml"));
  if (!manifestFiles.length) {
    return { ok: false, reason: "cub installer produced no Kubernetes manifests" };
  }
  const renderedYaml = manifestFiles
    .map((path) => readFileSync(path, "utf8"))
    .join("\n---\n");
  const committedYaml = readFileSync(join(repoRoot, COMMITTED_OBJECTS), "utf8");
  const objectMaps = canonicalObjectMaps(committedYaml, renderedYaml);
  const allowedExtra = "v1|Namespace||nginx";
  const committedKeys = Object.keys(objectMaps.helm).sort();
  const renderedKeys = Object.keys(objectMaps.cub)
    .filter((identity) => identity !== allowedExtra)
    .sort();
  const identitiesMatch = JSON.stringify(committedKeys) === JSON.stringify(renderedKeys);
  const objectsMatch = identitiesMatch && committedKeys.every(
    (identity) => objectMaps.helm[identity] === objectMaps.cub[identity],
  );
  if (!objectsMatch) {
    const missing = committedKeys.filter((identity) => !renderedKeys.includes(identity));
    const extra = renderedKeys.filter((identity) => !committedKeys.includes(identity));
    const changed = committedKeys.filter(
      (identity) => objectMaps.cub[identity]
        && objectMaps.helm[identity] !== objectMaps.cub[identity],
    );
    return {
      ok: false,
      reason: `render differs from the committed base (missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}; changed=${changed.join(",") || "none"})`,
    };
  }

  return {
    ok: true,
    workDir,
    renderedYaml,
    manifestSha256: sha256(renderedYaml),
    objectCount: parseObjects(renderedYaml).length,
    expectedIdentities: parseObjects(renderedYaml).map((object) => object.identity),
    allowedExtra,
  };
}

function publishCatalogBase(render, workloadSpace, target) {
  const upload = tsh("cub", [
    "installer",
    "upload",
    "--work-dir",
    render.workDir,
    "--space",
    workloadSpace,
    "--target",
    target,
  ], { timeout: 420_000 });
  if (!upload.ok) {
    return {
      ok: false,
      reason: `cub installer upload failed: ${upload.out.slice(0, 240)}`,
    };
  }

  const listed = tsh("cub", ["unit", "list", "--space", workloadSpace]);
  if (!listed.ok) {
    return { ok: false, reason: `could not list uploaded Units: ${listed.out.slice(0, 200)}` };
  }
  const units = listed.out.split("\n")
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((name) => name && name !== "NAME" && name !== "installer-record");
  if (!units.length) return { ok: false, reason: "upload created no targeted workload Units" };

  const releaseTarget = tsh("cub", [
    "space",
    "update",
    workloadSpace,
    "--release-target",
    target,
  ]);
  if (!releaseTarget.ok) {
    return {
      ok: false,
      reason: `could not set the Space release target: ${releaseTarget.out.slice(0, 240)}`,
    };
  }

  const published = tsh("cub", [
    "release",
    "publish",
    workloadSpace,
    "-o",
    "json",
  ], { timeout: 240_000 });
  if (!published.ok) {
    return {
      ok: false,
      reason: `cub release publish failed: ${published.out.slice(0, 240)}`,
    };
  }
  let response = {};
  try {
    response = JSON.parse(published.out);
  } catch {
    return {
      ok: false,
      reason: `cub release publish returned invalid JSON: ${published.out.slice(0, 160)}`,
    };
  }
  const release = response.Release ?? response.release ?? response;
  const manifestDigest = normalizeDigest(
    release.ManifestDigest ?? release.manifestDigest,
  );
  const bundleDigest = normalizeDigest(release.Digest ?? release.digest);
  if (!manifestDigest) {
    return {
      ok: false,
      reason: "cub release publish returned no OCI manifest digest",
    };
  }
  return {
    ok: true,
    units: units.sort(),
    releaseId: String(release.ReleaseID ?? release.releaseId ?? ""),
    manifestDigest,
    bundleDigest,
  };
}

function observeNginx(context) {
  const deployment = k(context, [
    "-n",
    NAMESPACE,
    "get",
    "deployment",
    DEPLOYMENT,
    "-o",
    "json",
  ]);
  const service = k(context, [
    "-n",
    NAMESPACE,
    "get",
    "service",
    SERVICE,
    "-o",
    "json",
  ]);
  if (!deployment.ok || !service.ok) {
    return {
      ok: false,
      deploymentReady: false,
      serviceType: "",
      podReady: false,
      reason: "the NGINX Deployment or Service was not found",
    };
  }

  let deploymentObject;
  let serviceObject;
  try {
    deploymentObject = JSON.parse(deployment.out);
    serviceObject = JSON.parse(service.out);
  } catch {
    return {
      ok: false,
      deploymentReady: false,
      serviceType: "",
      podReady: false,
      reason: "could not parse the NGINX runtime objects",
    };
  }
  const desired = Number(deploymentObject.spec?.replicas ?? 1);
  const ready = Number(deploymentObject.status?.readyReplicas ?? 0);
  const available = Number(deploymentObject.status?.availableReplicas ?? 0);
  const podList = k(context, [
    "-n",
    NAMESPACE,
    "get",
    "pods",
    "-l",
    "app.kubernetes.io/instance=nginx",
    "-o",
    "json",
  ]);
  let pods = [];
  try {
    pods = JSON.parse(podList.out || "{}").items ?? [];
  } catch {
    pods = [];
  }
  const podReady = pods.length > 0 && pods.every((pod) =>
    (pod.status?.conditions ?? []).some(
      (condition) => condition.type === "Ready" && condition.status === "True",
    ));
  const serviceType = String(serviceObject.spec?.type ?? "");
  const deploymentReady = desired > 0 && ready === desired && available === desired;
  return {
    ok: deploymentReady && podReady && serviceType === "ClusterIP",
    deploymentReady,
    replicas: `${ready}/${desired}`,
    serviceType,
    podReady,
    image: deploymentObject.spec?.template?.spec?.containers?.[0]?.image ?? "",
    reason: deploymentReady && podReady && serviceType === "ClusterIP"
      ? ""
      : `deployment=${ready}/${desired}; podsReady=${podReady}; serviceType=${serviceType || "missing"}`,
  };
}

function waitForNginx(context) {
  k(context, [
    "-n",
    NAMESPACE,
    "wait",
    "--for=condition=available",
    `deployment/${DEPLOYMENT}`,
    "--timeout=300s",
  ], { timeout: 330_000 });
  return observeNginx(context);
}

function cleanupNamespace(context) {
  const deleted = k(context, [
    "delete",
    "namespace",
    NAMESPACE,
    "--ignore-not-found=true",
    "--wait=true",
    "--timeout=180s",
  ], { timeout: 210_000 });
  return deleted.ok;
}

function deliveryLeg(modeName, source, controllerReady, digest, runtime, reason = "") {
  const ok = controllerReady && Boolean(digest) && runtime.ok;
  return {
    mode: modeName,
    source,
    controllerReady: controllerReady ? "yes" : "no",
    digest,
    workload: {
      deploymentReady: runtime.deploymentReady ? "yes" : "no",
      replicas: runtime.replicas ?? "",
      podReady: runtime.podReady ? "yes" : "no",
      serviceType: runtime.serviceType ?? "",
      image: runtime.image ?? "",
    },
    result: ok ? "pass" : "watch",
    ...(!ok ? { reason: reason || runtime.reason || "delivery did not converge" } : {}),
  };
}

function legArgo(context, workloadSpace, workRoot) {
  const application = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: catalog-nginx
  namespace: argocd
spec:
  project: default
  source:
    repoURL: "oci://${OCI_HOST}/space/${workloadSpace}"
    targetRevision: latest
    path: "."
  destination:
    server: https://kubernetes.default.svc
    namespace: ${NAMESPACE}
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
    syncOptions:
      - ServerSideApply=true
      - CreateNamespace=true
`;
  const appPath = join(workRoot, "argo-application.yaml");
  writeFileSync(appPath, application);
  const applied = k(context, ["apply", "-f", appPath]);
  if (!applied.ok) {
    return deliveryLeg(
      "Argo CD",
      "OCI Application",
      false,
      "",
      observeNginx(context),
      `Application apply failed: ${applied.out.slice(0, 160)}`,
    );
  }
  const appCreated = k(context, [
    "-n",
    "argocd",
    "wait",
    "--for=create",
    "application/catalog-nginx",
    "--timeout=180s",
  ], { timeout: 210_000 });
  if (!appCreated.ok) {
    return deliveryLeg(
      "Argo CD",
      "OCI Application",
      false,
      "",
      observeNginx(context),
      "the Argo CD Application was not created",
    );
  }
  k(context, [
    "-n",
    "argocd",
    "wait",
    "--for=jsonpath={.status.sync.status}=Synced",
    "application/catalog-nginx",
    "--timeout=180s",
  ], { timeout: 210_000 });
  k(context, [
    "-n",
    "argocd",
    "wait",
    "--for=jsonpath={.status.health.status}=Healthy",
    "application/catalog-nginx",
    "--timeout=180s",
  ], { timeout: 210_000 });
  const runtime = waitForNginx(context);
  const status = k(context, [
    "-n",
    "argocd",
    "get",
    "application",
    "catalog-nginx",
    "-o",
    "json",
  ]);
  let applicationObject = {};
  try {
    applicationObject = JSON.parse(status.out || "{}");
  } catch {
    applicationObject = {};
  }
  const sync = applicationObject.status?.sync?.status ?? "";
  const health = applicationObject.status?.health?.status ?? "";
  const digest = normalizeDigest(applicationObject.status?.sync?.revision);
  return deliveryLeg(
    "Argo CD",
    "OCI Application",
    sync === "Synced" && health === "Healthy",
    digest,
    runtime,
    `Application sync=${sync || "unknown"} health=${health || "unknown"}; ${runtime.reason}`,
  );
}

function removeArgo(context) {
  const appGone = k(context, [
    "-n",
    "argocd",
    "delete",
    "application",
    "catalog-nginx",
    "--ignore-not-found=true",
    "--cascade=foreground",
    "--wait=true",
    "--timeout=180s",
  ], { timeout: 210_000 });
  return appGone.ok && cleanupNamespace(context);
}

function dockerConfigFromSecret(context) {
  const retrieved = k(context, [
    "-n",
    "argocd",
    "get",
    "secret",
    "confighub-oci-creds",
    "-o",
    "json",
  ]);
  if (!retrieved.ok) return { ok: false, reason: "ConfigHub OCI pull Secret was not found" };
  let secret;
  try {
    secret = JSON.parse(retrieved.out);
  } catch {
    return { ok: false, reason: "ConfigHub OCI pull Secret could not be parsed" };
  }
  const data = secret.data ?? {};
  if (secret.type === "kubernetes.io/dockerconfigjson" && data[".dockerconfigjson"]) {
    return {
      ok: true,
      base64: data[".dockerconfigjson"],
      text: Buffer.from(data[".dockerconfigjson"], "base64").toString("utf8"),
    };
  }
  if (!data.username || !data.password) {
    return {
      ok: false,
      reason: `unsupported OCI pull Secret shape (${Object.keys(data).sort().join(",") || "no data"})`,
    };
  }
  const username = Buffer.from(data.username, "base64").toString("utf8");
  const password = Buffer.from(data.password, "base64").toString("utf8");
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const text = JSON.stringify({
    auths: {
      [OCI_HOST]: {
        username,
        password,
        auth,
      },
    },
  });
  return {
    ok: true,
    base64: Buffer.from(text).toString("base64"),
    text,
  };
}

function installFluxAndCredentials(context) {
  const installed = tsh("flux", [
    "install",
    "--kubeconfig",
    kubeconfig,
    "--context",
    context,
    "--components",
    "source-controller,kustomize-controller",
  ], { timeout: 300_000 });
  if (!installed.ok) {
    return { ok: false, reason: `Flux install failed: ${installed.out.slice(0, 180)}` };
  }
  const config = dockerConfigFromSecret(context);
  if (!config.ok) return config;
  const secret = {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: "confighub-oci",
      namespace: "flux-system",
    },
    type: "kubernetes.io/dockerconfigjson",
    data: {
      ".dockerconfigjson": config.base64,
    },
  };
  const secretDir = mkdtempSync(join(tmpdir(), "catalog-flux-secret-"));
  const secretPath = join(secretDir, "secret.json");
  writeFileSync(secretPath, JSON.stringify(secret), { mode: 0o600 });
  const applied = k(context, ["apply", "-f", secretPath]);
  rmSync(secretDir, { recursive: true, force: true });
  return applied.ok
    ? { ok: true }
    : { ok: false, reason: `Flux OCI pull Secret apply failed: ${applied.out.slice(0, 160)}` };
}

function legFlux(context, workloadSpace, workRoot) {
  const ready = installFluxAndCredentials(context);
  if (!ready.ok) {
    return deliveryLeg(
      "Flux",
      "OCIRepository",
      false,
      "",
      observeNginx(context),
      ready.reason,
    );
  }
  const manifest = `apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata:
  name: catalog-nginx
  namespace: flux-system
spec:
  interval: 1m
  url: oci://${OCI_HOST}/space/${workloadSpace}
  ref:
    tag: latest
  secretRef:
    name: confighub-oci
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: catalog-nginx
  namespace: flux-system
spec:
  interval: 1m
  sourceRef:
    kind: OCIRepository
    name: catalog-nginx
  path: "./"
  prune: true
  wait: true
  timeout: 5m
`;
  const manifestPath = join(workRoot, "flux-nginx.yaml");
  writeFileSync(manifestPath, manifest);
  const applied = k(context, ["apply", "-f", manifestPath]);
  if (!applied.ok) {
    return deliveryLeg(
      "Flux",
      "OCIRepository",
      false,
      "",
      observeNginx(context),
      `Flux source apply failed: ${applied.out.slice(0, 160)}`,
    );
  }
  tsh("flux", [
    "--kubeconfig",
    kubeconfig,
    "--context",
    context,
    "-n",
    "flux-system",
    "reconcile",
    "source",
    "oci",
    "catalog-nginx",
    "--timeout",
    "180s",
  ], { timeout: 210_000 });
  tsh("flux", [
    "--kubeconfig",
    kubeconfig,
    "--context",
    context,
    "-n",
    "flux-system",
    "reconcile",
    "kustomization",
    "catalog-nginx",
    "--timeout",
    "300s",
  ], { timeout: 330_000 });
  const runtime = waitForNginx(context);
  const source = k(context, [
    "-n",
    "flux-system",
    "get",
    "ocirepository",
    "catalog-nginx",
    "-o",
    "json",
  ]);
  const kustomization = k(context, [
    "-n",
    "flux-system",
    "get",
    "kustomization",
    "catalog-nginx",
    "-o",
    "json",
  ]);
  let sourceObject = {};
  let kustomizationObject = {};
  try {
    sourceObject = JSON.parse(source.out || "{}");
    kustomizationObject = JSON.parse(kustomization.out || "{}");
  } catch {
    sourceObject = {};
    kustomizationObject = {};
  }
  const sourceReady = (sourceObject.status?.conditions ?? []).some(
    (condition) => condition.type === "Ready" && condition.status === "True",
  );
  const applyReady = (kustomizationObject.status?.conditions ?? []).some(
    (condition) => condition.type === "Ready" && condition.status === "True",
  );
  const digest = normalizeDigest(
    sourceObject.status?.artifact?.revision
      ?? sourceObject.status?.artifact?.digest,
  );
  return deliveryLeg(
    "Flux",
    "OCIRepository and Kustomization",
    sourceReady && applyReady,
    digest,
    runtime,
    `OCIRepository ready=${sourceReady}; Kustomization ready=${applyReady}; ${runtime.reason}`,
  );
}

function removeFlux(context) {
  k(context, [
    "-n",
    "flux-system",
    "delete",
    "kustomization",
    "catalog-nginx",
    "--ignore-not-found=true",
    "--wait=true",
    "--timeout=180s",
  ], { timeout: 210_000 });
  k(context, [
    "-n",
    "flux-system",
    "delete",
    "ocirepository",
    "catalog-nginx",
    "--ignore-not-found=true",
  ]);
  return cleanupNamespace(context);
}

function extractTarBlobs(root, destination) {
  mkdirSync(destination, { recursive: true });
  for (const path of filesUnder(root)) {
    tsh("tar", ["-xf", path, "-C", destination]);
  }
}

function selectedDocuments(root, expectedIdentities) {
  const expected = new Set(expectedIdentities);
  const byIdentity = new Map();
  for (const path of filesUnder(root)) {
    let text = "";
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    if (!/apiVersion/.test(text) || !/kind/.test(text)) continue;
    let documents = [];
    try {
      documents = parseDocs(text);
    } catch {
      documents = [];
    }
    for (const document of documents) {
      const identity = identityFor(document);
      if (expected.has(identity)) byIdentity.set(identity, document);
    }
  }
  return byIdentity;
}

function legDirect(context, workloadSpace, workRoot, expectedIdentities) {
  const config = dockerConfigFromSecret(context);
  if (!config.ok) {
    return deliveryLeg(
      "Direct apply",
      "oras pull and kubectl apply",
      false,
      "",
      observeNginx(context),
      config.reason,
    );
  }
  const configPath = join(workRoot, "oras-registry.json");
  writeFileSync(configPath, config.text, { mode: 0o600 });
  const reference = `${OCI_HOST}/space/${workloadSpace}:latest`;
  const resolved = tsh("oras", [
    "resolve",
    reference,
    "--registry-config",
    configPath,
  ]);
  const pullRoot = join(workRoot, "direct-pull");
  const pulled = tsh("oras", [
    "pull",
    reference,
    "--registry-config",
    configPath,
    "-o",
    pullRoot,
  ], { timeout: 240_000 });
  rmSync(configPath, { force: true });
  if (!pulled.ok) {
    return deliveryLeg(
      "Direct apply",
      "oras pull and kubectl apply",
      false,
      normalizeDigest(resolved.out),
      observeNginx(context),
      `oras pull failed: ${pulled.out.slice(0, 180)}`,
    );
  }

  const extracted = join(workRoot, "direct-extracted");
  extractTarBlobs(pullRoot, extracted);
  const documents = selectedDocuments(pullRoot, expectedIdentities);
  for (const [identity, document] of selectedDocuments(extracted, expectedIdentities)) {
    documents.set(identity, document);
  }
  const missing = expectedIdentities.filter((identity) => !documents.has(identity));
  if (missing.length) {
    return deliveryLeg(
      "Direct apply",
      "oras pull and kubectl apply",
      false,
      normalizeDigest(resolved.out),
      observeNginx(context),
      `pulled OCI is missing ${missing.join(",")}`,
    );
  }
  const manifestPath = join(workRoot, "direct-nginx.jsonl.yaml");
  const namespaceIdentity = "v1|Namespace||nginx";
  const namespacePath = join(workRoot, "direct-nginx-namespace.json");
  writeFileSync(namespacePath, JSON.stringify(documents.get(namespaceIdentity)));
  const namespaceApplied = k(context, ["apply", "-f", namespacePath]);
  if (!namespaceApplied.ok) {
    return deliveryLeg(
      "Direct apply",
      "oras pull and kubectl apply",
      false,
      normalizeDigest(resolved.out),
      observeNginx(context),
      `Namespace apply failed: ${namespaceApplied.out.slice(0, 180)}`,
    );
  }
  k(context, [
    "wait",
    "--for=jsonpath={.status.phase}=Active",
    `namespace/${NAMESPACE}`,
    "--timeout=60s",
  ], { timeout: 90_000 });
  writeFileSync(
    manifestPath,
    expectedIdentities
      .filter((identity) => identity !== namespaceIdentity)
      .map((identity) => JSON.stringify(documents.get(identity)))
      .join("\n---\n"),
  );
  const applied = k(context, ["apply", "-f", manifestPath]);
  if (!applied.ok) {
    return deliveryLeg(
      "Direct apply",
      "oras pull and kubectl apply",
      false,
      normalizeDigest(resolved.out),
      observeNginx(context),
      `kubectl apply failed: ${applied.out.slice(0, 180)}`,
    );
  }
  const runtime = waitForNginx(context);
  return deliveryLeg(
    "Direct apply",
    "oras pull and kubectl apply",
    true,
    normalizeDigest(resolved.out),
    runtime,
  );
}

function runProof() {
  check(
    process.env.HELM_EXPT_ALLOW_SCRATCH_ORG === "1",
    "refusing live run without HELM_EXPT_ALLOW_SCRATCH_ORG=1",
  );
  check(
    process.env.CUB_CONTEXT && process.env.CUB_CONTEXT !== "river-bear",
    "use an authenticated scratch-org context, not the helm-catalog context",
  );
  const observedAt = new Date().toISOString();
  const rig = `hx-catalog-oci-${observedAt.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const clusterSpace = `${rig}-cluster`;
  const workloadSpace = `${rig}-nginx`;
  const target = `${clusterSpace}/oci`;
  const context = `kind-${rig}`;
  kubeconfig = join(homedir(), ".confighub", "clusters", `${rig}.kubeconfig`);
  const workRoot = mkdtempSync(join(tmpdir(), "catalog-oci-delivery-"));
  const legs = {};
  let render = { ok: false, reason: "not attempted" };
  let publish = { ok: false, reason: "not attempted" };
  let rigUp = false;
  let namespaceCleanup = true;
  let workloadSpaceCleanup = false;
  let rigCleanup = false;
  let runError = "";

  try {
    render = renderCatalogBase(workRoot);
    if (!render.ok) throw new Error(render.reason);
    const up = tsh("cub", [
      "cluster",
      "up",
      "--name",
      rig,
      "--space",
      clusterSpace,
      "--no-ports",
    ], { timeout: 900_000 });
    rigUp = up.ok || (tsh("cub", ["cluster", "list"]).out || "").includes(rig);
    if (!rigUp) throw new Error(`cub cluster up failed: ${up.out.slice(0, 240)}`);
    publish = publishCatalogBase(render, workloadSpace, target);
    if (!publish.ok) throw new Error(publish.reason);

    legs.argo = legArgo(context, workloadSpace, workRoot);
    namespaceCleanup = removeArgo(context) && namespaceCleanup;

    legs.flux = legFlux(context, workloadSpace, workRoot);
    namespaceCleanup = removeFlux(context) && namespaceCleanup;

    legs.direct = legDirect(
      context,
      workloadSpace,
      workRoot,
      render.expectedIdentities,
    );
    namespaceCleanup = cleanupNamespace(context) && namespaceCleanup;
  } catch (error) {
    runError = String(error.message ?? error).slice(0, 400);
  } finally {
    if (existsSync(join(repoRoot, COMMITTED_OBJECTS))) {
      const deleted = tsh("cub", [
        "space",
        "delete",
        workloadSpace,
        "--recursive",
      ], { timeout: 180_000 });
      workloadSpaceCleanup = deleted.ok || /not found/i.test(deleted.out);
    }
    if (rigUp) {
      const down = tsh("cub", [
        "cluster",
        "down",
        "--name",
        rig,
        "--force",
      ], { timeout: 360_000 });
      rigCleanup = down.ok;
    }
    rmSync(workRoot, { recursive: true, force: true });
  }

  const presentLegs = Object.values(legs);
  const allLegsPass = presentLegs.length === 3
    && presentLegs.every((leg) => leg.result === "pass");
  const digests = [...new Set(presentLegs.map((leg) => leg.digest).filter(Boolean))];
  const sameDigest = allLegsPass
    && digests.length === 1
    && digests[0] === publish.manifestDigest;
  const cleanupPass = namespaceCleanup && workloadSpaceCleanup && rigCleanup;
  const result = render.ok && publish.ok && allLegsPass && sameDigest && cleanupPass
    ? "pass"
    : presentLegs.some((leg) => leg.result === "pass")
      ? "watch"
      : "blocked";

  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "CatalogOciDeliveryProofReceipt",
    metadata: {
      name: "bitnami-nginx-24-0-2-http-clusterip",
    },
    spec: {
      chart: CHART,
      version: VERSION,
      base: BASE,
      observedAt,
      result,
      source: {
        packagePath: PACKAGE_PATH,
        packageOci: PACKAGE_OCI,
        renderIntent: RENDER_INTENT,
        committedObjects: COMMITTED_OBJECTS,
      },
      render: {
        result: render.ok ? "pass" : "blocked",
        manifestSha256: render.manifestSha256 ?? "",
        objectCount: render.objectCount ?? 0,
        allowedExtraObject: render.allowedExtra ?? "",
        exactCatalogObjects: render.ok ? "yes" : "no",
        ...(!render.ok ? { reason: render.reason } : {}),
      },
      releaseOci: {
        host: OCI_HOST,
        reference: `oci://${OCI_HOST}/space/${workloadSpace}:latest`,
        publish: publish.ok ? "pass" : "blocked",
        releaseId: publish.releaseId ?? "",
        bundleDigest: publish.bundleDigest ?? "",
        workloadSpace,
        unitCount: publish.units?.length ?? 0,
        sameDigestAcrossConsumers: sameDigest ? "yes" : "no",
        digest: publish.manifestDigest ?? "",
        ...(!publish.ok ? { reason: publish.reason } : {}),
      },
      run: {
        rig,
        clusterCommand: "cub cluster up",
        targetShape: "one throwaway cub-managed kind cluster with Argo CD and Flux",
        releaseTarget: target,
        organizationPurpose: "ephemeral scratch organization",
        cleanup: {
          namespace: namespaceCleanup ? "pass" : "watch",
          workloadSpace: workloadSpaceCleanup ? "pass" : "watch",
          rig: rigCleanup ? "pass" : "watch",
        },
      },
      legs,
      limits: [
        "This proves bitnami/nginx 24.0.2 with the http-clusterip base on the recorded throwaway kind target.",
        "It does not prove another chart, base, Kubernetes version, or production target.",
        "The scratch organization did not have the helm-catalog apply-policy Triggers; this run proves delivery, not policy execution.",
        "The test applied the Argo CD Application and Flux source objects directly so that it measured release-OCI consumption without also testing app-of-apps delivery.",
        "The direct leg proves first apply and workload readiness. Separate receipts cover prune, CRD ordering, and field-conflict handling.",
      ],
      ...((runError && result !== "pass") ? { error: runError } : {}),
    },
  };
}

function validateReceipt(receipt) {
  check(
    receipt.kind === "CatalogOciDeliveryProofReceipt",
    "catalog OCI delivery receipt kind is invalid",
  );
  check(
    receipt.metadata?.name === "bitnami-nginx-24-0-2-http-clusterip",
    "catalog OCI delivery receipt name drifted",
  );
  check(receipt.spec?.chart === CHART, "catalog OCI delivery chart drifted");
  check(receipt.spec?.version === VERSION, "catalog OCI delivery version drifted");
  check(receipt.spec?.base === BASE, "catalog OCI delivery base drifted");
  check(receipt.spec?.result === "pass", "catalog OCI delivery receipt did not pass");
  check(
    receipt.spec?.render?.result === "pass"
      && receipt.spec?.render?.exactCatalogObjects === "yes",
    "catalog OCI delivery render did not match the committed base",
  );
  check(
    receipt.spec?.releaseOci?.publish === "pass"
      && receipt.spec?.releaseOci?.sameDigestAcrossConsumers === "yes"
      && normalizeDigest(receipt.spec?.releaseOci?.digest),
    "catalog OCI publication or digest comparison did not pass",
  );
  const legs = receipt.spec?.legs ?? {};
  check(
    Object.keys(legs).sort().join(",") === "argo,direct,flux",
    "catalog OCI delivery receipt must contain Argo CD, Flux, and direct legs",
  );
  for (const [name, leg] of Object.entries(legs)) {
    check(leg.result === "pass", `${name} catalog OCI delivery leg did not pass`);
    check(leg.controllerReady === "yes", `${name} controller or apply path was not ready`);
    check(
      leg.workload?.deploymentReady === "yes"
        && leg.workload?.podReady === "yes"
        && leg.workload?.serviceType === "ClusterIP",
      `${name} NGINX workload did not pass`,
    );
    check(
      leg.digest === receipt.spec.releaseOci.digest,
      `${name} did not consume the recorded release OCI digest`,
    );
  }
  check(
    Object.values(receipt.spec?.run?.cleanup ?? {}).every((value) => value === "pass"),
    "catalog OCI delivery cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("does not prove another chart")),
    "catalog OCI delivery receipt is missing its scope limit",
  );
  for (const path of [
    receipt.spec.source.packagePath,
    receipt.spec.source.renderIntent,
    receipt.spec.source.committedObjects,
  ]) {
    check(existsSync(join(repoRoot, path)), `catalog OCI delivery source is missing: ${path}`);
  }
}

function resultRows(receipt) {
  const legs = receipt.spec?.legs ?? {};
  return ["argo", "flux", "direct"]
    .map((name) => [name, legs[name]])
    .filter(([, leg]) => leg);
}

function summaryMd(receipt) {
  const spec = receipt.spec;
  const rows = resultRows(receipt)
    .map(([, leg]) => `| ${leg.mode} | ${leg.source} | ${leg.digest} | ${leg.workload.replicas} | ${leg.workload.serviceType} | ${leg.result} |`)
    .join("\n");
  return `# NGINX delivered from one ConfigHub release OCI

**UNOFFICIAL/EXPERIMENTAL.** Generated from the committed live receipt. Regenerate this page with \`npm run catalog-oci:proof:generate\`; rerun the cluster test with \`npm run catalog-oci:proof\`.

This test used the real \`${CHART}@${VERSION}\` \`${BASE}\` catalog base. \`cub installer\` pulled the public package, selected that base, and reproduced the committed Kubernetes objects. ConfigHub then published those objects once as a release OCI.

Argo CD, Flux, and direct apply consumed that release in sequence on one throwaway cluster. All three reported the same OCI digest and reached a ready NGINX Deployment and ClusterIP Service.

| Delivery method | Source | OCI digest | NGINX replicas | Service | Result |
| --- | --- | --- | --- | --- | --- |
${rows}

Overall: **${spec.result}**. Rendered objects: **${spec.render.objectCount}**. Published Units: **${spec.releaseOci.unitCount}**. Cleanup: namespace **${spec.run.cleanup.namespace}**, ConfigHub Space **${spec.run.cleanup.workloadSpace}**, rig **${spec.run.cleanup.rig}**.

This proves one catalog configuration on the recorded target. It does not prove another chart, base, Kubernetes version, or production cluster. The scratch organization did not run the \`helm-catalog\` apply-policy Triggers, so policy and delivery remain separate claims.

- [Render intent](../../${RENDER_INTENT})
- [Committed Kubernetes objects](../../${COMMITTED_OBJECTS})
- [Live receipt](../../runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml)
`;
}

function summaryHtml(receipt) {
  const spec = receipt.spec;
  const rows = resultRows(receipt)
    .map(([, leg]) => `<tr><td>${leg.mode}</td><td><code>${leg.source}</code></td><td><code>${leg.digest}</code></td><td>${leg.workload.replicas}</td><td>${leg.workload.serviceType}</td><td>${leg.result}</td></tr>`)
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NGINX delivered from one ConfigHub release OCI</title>
<style>
body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
main{max-width:1000px;margin:0 auto}h1{font-size:1.6rem}table{border-collapse:collapse;width:100%;background:#fff}
th,td{text-align:left;padding:.55rem .7rem;border:1px solid #d0d7de;vertical-align:top}th{background:#eef1f4}
code{font-size:.82em;overflow-wrap:anywhere}.note{border-left:4px solid #0969da;padding:.7rem 1rem;background:#ddf4ff}
</style></head><body><main>
<h1>NGINX delivered from one ConfigHub release OCI</h1>
<p>This test used the real <code>${CHART}@${VERSION}</code> <code>${BASE}</code> catalog base. cub installer reproduced the committed Kubernetes objects, and ConfigHub published them once as a release OCI.</p>
<p>Argo CD, Flux, and direct apply consumed that release in sequence on one throwaway cluster. All three reported the same OCI digest and reached a ready NGINX Deployment and ClusterIP Service.</p>
<table><thead><tr><th>Delivery method</th><th>Source</th><th>OCI digest</th><th>NGINX replicas</th><th>Service</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>
<p><strong>Overall: ${spec.result}.</strong> Rendered objects: ${spec.render.objectCount}. Published Units: ${spec.releaseOci.unitCount}. Cleanup: namespace ${spec.run.cleanup.namespace}, ConfigHub Space ${spec.run.cleanup.workloadSpace}, rig ${spec.run.cleanup.rig}.</p>
<p class="note">This proves one catalog configuration on the recorded target. It does not prove another chart, base, Kubernetes version, or production cluster. Policy and delivery remain separate claims.</p>
</main></body></html>
`;
}

if (mode === "--run") {
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, summaryMd(receipt));
  write(htmlPath, summaryHtml(receipt));
  console.log(
    `wrote catalog OCI delivery proof -> ${relativeRepo(receiptPath)} result=${receipt.spec.result}`,
  );
  if (receipt.spec.result !== "pass") process.exitCode = 1;
} else if (mode === "--generate") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing`);
  const receipt = readYaml(receiptPath);
  write(summaryPath, summaryMd(receipt));
  write(htmlPath, summaryHtml(receipt));
  console.log(`regenerated catalog OCI delivery summary from ${relativeRepo(receiptPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing`);
  const receipt = readYaml(receiptPath);
  validateReceipt(receipt);
  check(
    existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(receipt),
    `${relativeRepo(summaryPath)} is stale`,
  );
  check(
    existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(receipt),
    `${relativeRepo(htmlPath)} is stale`,
  );
  console.log(
    `verified catalog OCI delivery proof: ${receipt.spec.chart}@${receipt.spec.version}/${receipt.spec.base}`,
  );
} else {
  console.log(`Usage:
  node scripts/run-catalog-oci-delivery-proof.mjs --run
  node scripts/run-catalog-oci-delivery-proof.mjs --generate
  node scripts/run-catalog-oci-delivery-proof.mjs --verify`);
}
