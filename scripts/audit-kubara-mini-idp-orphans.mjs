#!/usr/bin/env node

// Read-only orphan audit for the Kubara + ConfigHub mini-IDP.
//
// The audit deliberately consumes the reconciler's deterministic --plan output
// instead of maintaining a second topology. Live mode acquires the shared
// live-parity lock, refuses every in-flight journal state, and performs only
// ConfigHub/Kubernetes reads. It never deletes or detaches anything.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  sha256File,
  toYaml,
} from "./lib/proof-common.mjs";

const MODES = new Set(["--plan", "--audit", "--self-test", "--receipt-verify"]);
const requestedModes = process.argv.filter((arg) => MODES.has(arg));
check(requestedModes.length <= 1, `choose one mode: ${[...MODES].join(", ")}`);
const mode = requestedModes[0] ?? "--plan";
const contextOption = optionValue("--context") || process.env.CUB_CONTEXT?.trim() || "";
const receiptOption = optionValue("--receipt");
validateArgs();

const ORGANIZATION = "Kubara";
const ORGANIZATION_EXTERNAL_ID = "58b23b85-9699-4384-bd57-80ef695a1d58";
const ORGANIZATION_ENTITY_ID = "12c33fa8-00b1-4011-ad3e-19d56458b29c";
const CONFIGHUB_SERVER_URL = "https://hub.confighub.com";
const RECONCILER_PATH = join(repoRoot, "scripts", "reconcile-kubara-mini-idp.mjs");
const RECEIPT_PATH = receiptOption
  ? resolve(receiptOption)
  : join(repoRoot, "runs", "kubara-mini-idp-reconcile", "orphan-audit.yaml");
const OPERATION_JOURNAL_PATH = join(homedir(), ".confighub", "locks", "helm-expt-kubara-operation-journal.json");
const LIVE_LOCK_PATH = process.env.HELM_EXPT_LIVE_PARITY_LOCK
  ? resolve(process.env.HELM_EXPT_LIVE_PARITY_LOCK)
  : join(homedir(), ".confighub", "locks", "helm-expt-live-parity.lock");
const OCI_SPACE_PREFIX = "oci://oci.hub.confighub.com:443/space/";
const PROTECTED_NAMESPACES = ["default", "kube-system", "kube-public", "kube-node-lease"];
const OWNERSHIP_ANNOTATIONS = [
  "argocd.argoproj.io/tracking-id",
  "confighub.com/origin",
  "confighub.com/SpaceID",
  "confighub.com/UnitSlug",
  "confighub.com/RevisionNum",
];
const LEGACY_DEFAULT_NAMESPACE_LABELS = ["project-name", "stage"];
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ARGO_TRACKING_ANNOTATION = "argocd.argoproj.io/tracking-id";
const DURABLE_WORKLOAD_RESOURCES = [
  "deployments.apps",
  "statefulsets.apps",
  "daemonsets.apps",
  "cronjobs.batch",
  "jobs.batch",
];
const ARGO_CD_RUNTIME_VERSION = "v3.4.6";
const ARGO_CD_RUNTIME_IMAGE = `quay.io/argoproj/argocd:${ARGO_CD_RUNTIME_VERSION}`;
const ARGO_CD_RUNTIME_CONTAINER_PAIRS = Object.freeze([
  ["argocd-application-controller", "argocd-application-controller"],
  ["argocd-applicationset-controller", "argocd-applicationset-controller"],
  ["argocd-dex-server", "copyutil"],
  ["argocd-notifications-controller", "argocd-notifications-controller"],
  ["argocd-redis", "secret-init"],
  ["argocd-repo-server", "argocd-repo-server"],
  ["argocd-repo-server", "copyutil"],
  ["argocd-server", "argocd-server"],
]);
const BOOTSTRAP_DURABLE_WORKLOADS = Object.freeze([
  { group: "apps", kind: "DaemonSet", namespace: "kube-system", name: "kindnet", role: "kind-network" },
  { group: "apps", kind: "DaemonSet", namespace: "kube-system", name: "kube-proxy", role: "kubernetes-network-proxy" },
  { group: "apps", kind: "Deployment", namespace: "kube-system", name: "coredns", role: "kubernetes-dns" },
  { group: "apps", kind: "Deployment", namespace: "local-path-storage", name: "local-path-provisioner", role: "kind-storage" },
  { group: "apps", kind: "StatefulSet", namespace: "argocd", name: "argocd-application-controller", role: "argocd-runtime" },
  { group: "apps", kind: "Deployment", namespace: "argocd", name: "argocd-applicationset-controller", role: "argocd-runtime" },
  { group: "apps", kind: "Deployment", namespace: "argocd", name: "argocd-dex-server", role: "argocd-runtime" },
  { group: "apps", kind: "Deployment", namespace: "argocd", name: "argocd-notifications-controller", role: "argocd-runtime" },
  { group: "apps", kind: "Deployment", namespace: "argocd", name: "argocd-redis", role: "argocd-runtime" },
  { group: "apps", kind: "Deployment", namespace: "argocd", name: "argocd-repo-server", role: "argocd-runtime" },
  { group: "apps", kind: "Deployment", namespace: "argocd", name: "argocd-server", role: "argocd-runtime" },
]);
const BOOTSTRAP_DURABLE_WORKLOADS_BY_KEY = new Map(
  BOOTSTRAP_DURABLE_WORKLOADS.map((item) => [resourceKey(item), item]),
);

const reconcilePlan = mode === "--self-test" ? selfTestReconcilePlan() : loadReconcilePlan();
const auditPlan = buildAuditPlan(reconcilePlan);

if (mode === "--plan") {
  console.log(JSON.stringify(publicAuditPlan(auditPlan), null, 2));
} else if (mode === "--self-test") {
  selfTest(auditPlan);
} else if (mode === "--receipt-verify") {
  verifyReceipt(auditPlan);
} else {
  runAudit(auditPlan);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  check(process.argv[index + 1] && !process.argv[index + 1].startsWith("--"), `${name} requires a value`);
  return process.argv[index + 1];
}

function validateArgs() {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    if (MODES.has(args[index])) continue;
    if (["--context", "--receipt"].includes(args[index])) {
      check(args[index + 1] && !args[index + 1].startsWith("--"), `${args[index]} requires a value`);
      index += 1;
      continue;
    }
    check(false, `unknown argument ${args[index]}`);
  }
}

function command(binary, args, options = {}) {
  try {
    return execFileSync(binary, args, {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, CONFIGHUB_AGENT: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 200,
      timeout: options.timeout ?? 600_000,
    });
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    throw new Error(`${binary} ${args.join(" ")} failed${output ? `:\n${output}` : ""}`);
  }
}

function tryCommand(binary, args, options = {}) {
  try {
    return { ok: true, output: command(binary, args, options) };
  } catch (error) {
    return { ok: false, output: error.message };
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function loadReconcilePlan() {
  const output = command(process.execPath, [RECONCILER_PATH, "--plan"], { timeout: 1_200_000 });
  let value;
  try {
    value = JSON.parse(output);
  } catch (error) {
    throw new Error(`reconciler --plan did not return JSON: ${error.message}`);
  }
  check(value?.kind === "KubaraMiniIDPReconcilePlan", "unexpected reconciler plan kind");
  check(value.spec?.organization === ORGANIZATION, "reconciler plan Organization drifted");
  check(value.spec?.execution?.organizationExternalID === ORGANIZATION_EXTERNAL_ID, "reconciler plan external Organization ID drifted");
  check(value.spec?.execution?.organizationEntityID === ORGANIZATION_ENTITY_ID, "reconciler plan Organization entity ID drifted");
  check(value.spec?.execution?.serverURL === CONFIGHUB_SERVER_URL, "reconciler plan ConfigHub server drifted");
  return value;
}

function selfTestReconcilePlan() {
  const catalogLabels = {
    CatalogComponents: "103",
    CatalogVersions: "130",
    KubaraSelections: "18",
    Retention: "AdditiveOnly",
  };
  const spaces = [
    { slug: "hx-platform", type: "control" },
    { slug: "cluster-a", type: "cluster-target" },
    { slug: "cluster-a-argo-apps", type: "delivery-instance" },
    { slug: "argobot-base", type: "delivery-definition" },
    { slug: "argobot-cluster-a", type: "delivery-instance" },
    { slug: "app-base", type: "app-definition" },
    { slug: "app-dev", type: "app-instance", target: "cluster-a/target" },
  ];
  const units = [
    { space: "hx-platform", slug: "component-catalog-coverage", target: null, labels: catalogLabels },
    { space: "app-base", slug: "app", target: null },
    { space: "app-dev", slug: "app", target: "cluster-a/target", upstream: "app-base/app" },
  ];
  const preservedControlUnits = [
    { ref: "hx-platform/faithful-hub-spoke-plan", owner: "faithful-hub-spoke-proof" },
    { ref: "hx-platform/faithful-hub-spoke-attestation", owner: "faithful-hub-spoke-proof" },
  ];
  const deliveryApplicationUnits = [
    { ref: "cluster-a-argo-apps/root", labels: { Cluster: "cluster-a" } },
    { ref: "cluster-a-argo-apps/argobot-cluster-a", labels: { Cluster: "cluster-a" } },
    { ref: "cluster-a-argo-apps/app-dev", labels: { Cluster: "cluster-a" } },
  ];
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubaraMiniIDPReconcilePlan",
    metadata: { name: "self-test" },
    spec: {
      organization: ORGANIZATION,
      execution: {
        organizationExternalID: ORGANIZATION_EXTERNAL_ID,
        organizationEntityID: ORGANIZATION_ENTITY_ID,
        serverURL: CONFIGHUB_SERVER_URL,
      },
      counts: {
        spaces: spaces.length,
        managedUnits: units.length,
        preservedFaithfulControlUnits: preservedControlUnits.length,
        deliveryApplicationUnits: deliveryApplicationUnits.length,
      },
      spaces,
      units,
      preservedControlUnits,
      deliveryApplicationUnits,
      deployments: [{ cluster: "cluster-a", space: "app-dev", appSpace: "cluster-a-argo-apps", appUnit: "app-dev" }],
      links: [],
    },
  };
}

function addUnique(map, key, value, label) {
  check(!map.has(key), `duplicate ${label} ${key}`);
  map.set(key, value);
}

function buildAuditPlan(plan) {
  const spaces = new Map(plan.spec.spaces.map((item) => [item.slug, item]));
  const clusters = [...spaces.values()].filter((item) => item.type === "cluster-target").map((item) => item.slug).sort();
  check(clusters.length > 0, "reconciler plan has no cluster targets");
  const appsSpaces = new Map(clusters.map((cluster) => [cluster, `${cluster}-argo-apps`]));
  for (const [cluster, appsSpace] of appsSpaces) check(spaces.has(appsSpace), `${cluster}: apps Space ${appsSpace} is absent`);

  const units = new Map();
  for (const item of plan.spec.units) {
    const ref = `${item.space}/${item.slug}`;
    addUnique(units, ref, { ...item, ref, owner: "mini-idp-plan", expectedTarget: item.target ?? null }, "Unit");
  }
  for (const item of plan.spec.preservedControlUnits) {
    addUnique(units, item.ref, { ref: item.ref, owner: item.owner, expectedTarget: null }, "Unit");
  }
  for (const item of plan.spec.deliveryApplicationUnits) {
    const cluster = item.labels?.Cluster;
    check(clusters.includes(cluster), `${item.ref}: delivery Application lacks an exact fleet cluster`);
    addUnique(units, item.ref, {
      ref: item.ref,
      owner: "delivery-application",
      expectedTarget: `${cluster}/target`,
      cluster,
      applicationUnit: true,
    }, "Unit");
  }
  addUnique(units, "argobot-base/argobot", {
    ref: "argobot-base/argobot",
    owner: "delivery-helper",
    expectedTarget: null,
  }, "Unit");
  for (const cluster of clusters) {
    const ref = `argobot-${cluster}/argobot`;
    addUnique(units, ref, { ref, owner: "delivery-helper", expectedTarget: `${cluster}/target` }, "Unit");
  }

  const links = new Map();
  for (const item of plan.spec.units.filter((unit) => unit.upstream)) {
    const ref = `${item.space}/upgrade-${item.slug}`;
    addUnique(links, ref, {
      ref,
      space: item.space,
      slug: `upgrade-${item.slug}`,
      from: `${item.space}/${item.slug}`,
      to: item.upstream,
      updateType: "UpgradeUnit",
      autoUpdate: false,
    }, "Link");
  }
  for (const cluster of clusters) {
    const ref = `argobot-${cluster}/upgrade-argobot`;
    addUnique(links, ref, {
      ref,
      space: `argobot-${cluster}`,
      slug: "upgrade-argobot",
      from: `argobot-${cluster}/argobot`,
      to: "argobot-base/argobot",
      updateType: "UpgradeUnit",
      autoUpdate: false,
    }, "Link");
  }
  for (const item of plan.spec.links) {
    const ref = `${item.space}/${item.slug}`;
    addUnique(links, ref, {
      ref,
      space: item.space,
      slug: item.slug,
      from: `${item.space}/${item.fromUnit}`,
      to: `${item.toSpace}/${item.toUnit}`,
      updateType: item.updateType,
      autoUpdate: item.autoUpdate === true,
    }, "Link");
  }

  const targets = new Map(clusters.map((cluster) => [`${cluster}/target`, {
    ref: `${cluster}/target`,
    space: cluster,
    slug: "target",
    appsSpace: appsSpaces.get(cluster),
  }]));

  const releaseStreams = new Map();
  for (const deployment of plan.spec.deployments) {
    addUnique(releaseStreams, deployment.space, {
      space: deployment.space,
      cluster: deployment.cluster,
      role: "workload-or-component",
      application: deployment.space,
    }, "current release stream");
  }
  for (const cluster of clusters) {
    const appsSpace = appsSpaces.get(cluster);
    addUnique(releaseStreams, appsSpace, {
      space: appsSpace,
      cluster,
      role: "delivery-root",
      application: "root",
    }, "current release stream");
    addUnique(releaseStreams, `argobot-${cluster}`, {
      space: `argobot-${cluster}`,
      cluster,
      role: "delivery-helper",
      application: null,
    }, "current release stream");
  }

  const allowedRetainedReleaseTypes = new Set([
    "control",
    "component-definition",
    "app-definition",
    "delivery-definition",
    "delivery-runtime-definition",
  ]);
  const catalogCoverage = plan.spec.units.find((item) => item.space === "hx-platform" && item.slug === "component-catalog-coverage")?.labels ?? {};
  check(Number(catalogCoverage.CatalogComponents) > 0, "catalog component retention count is missing from the plan");
  check(Number(catalogCoverage.CatalogVersions) >= Number(catalogCoverage.CatalogComponents), "catalog version retention count is invalid");

  const result = {
    reconcilePlan: plan,
    planSha256: `sha256:${sha256(stableJson(plan))}`,
    reconcilerSha256: `sha256:${sha256File(RECONCILER_PATH)}`,
    spaces,
    units,
    links,
    targets,
    clusters,
    appsSpaces,
    releaseStreams,
    allowedRetainedReleaseTypes,
    catalogRetention: {
      components: Number(catalogCoverage.CatalogComponents),
      versions: Number(catalogCoverage.CatalogVersions),
      selections: Number(catalogCoverage.KubaraSelections),
      policy: catalogCoverage.Retention,
    },
  };
  check(result.spaces.size === plan.spec.counts.spaces, "audit Space inventory differs from reconciler count");
  check(result.units.size === plan.spec.counts.managedUnits + plan.spec.counts.preservedFaithfulControlUnits + plan.spec.counts.deliveryApplicationUnits + clusters.length + 1, "audit Unit inventory differs from the plan-derived total");
  check(result.links.size === plan.spec.links.length + plan.spec.units.filter((item) => item.upstream).length + clusters.length, "audit Link inventory differs from the plan-derived total");
  check(result.releaseStreams.size === plan.spec.deployments.length + (clusters.length * 2), "audit release streams differ from the plan-derived total");
  return result;
}

function publicAuditPlan(plan) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubaraMiniIDPOrphanAuditPlan",
    metadata: { name: "kubara-v0-13-0-mini-idp-orphan-audit" },
    spec: {
      organization: {
        name: ORGANIZATION,
        externalID: ORGANIZATION_EXTERNAL_ID,
        entityID: ORGANIZATION_ENTITY_ID,
        serverURL: CONFIGHUB_SERVER_URL,
      },
      source: {
        reconciler: relativeRepo(RECONCILER_PATH),
        reconcilerSha256: plan.reconcilerSha256,
        reconcilePlanSha256: plan.planSha256,
      },
      policies: {
        liveMutation: "none",
        unexpectedConfigHubSpacesUnitsLinksTargets: "fail",
        argoApplicationInventory: "exact-plan-derived-allowlist",
        argoRequiresPruning: "zero",
        durableWorkloadInventory: "every-Deployment-StatefulSet-DaemonSet-CronJob-Job-must-be-Argo-desired-bootstrap-or-directly-owned-by-an-Argo-desired-root",
        danglingArgoTrackedDurableWorkloads: "zero",
        unclassifiedDurableWorkloads: "zero",
        protectedNamespaceOwnershipMetadata: "zero",
        currentRelease: "latest-published-manifest-must-equal-observed-argo-revision",
        historicalRelease: "retain-and-classify-never-delete",
        catalogHistory: "retain-additively-never-classify-unselected-version-as-orphan",
      },
      counts: {
        spaces: plan.spaces.size,
        units: plan.units.size,
        links: plan.links.size,
        targets: plan.targets.size,
        currentReleaseStreams: plan.releaseStreams.size,
        expectedArgoApplications: plan.reconcilePlan.spec.counts.deliveryApplicationUnits,
        bootstrapDurableWorkloadsPerCluster: BOOTSTRAP_DURABLE_WORKLOADS.length,
      },
      catalogRetention: plan.catalogRetention,
      spaces: [...plan.spaces.keys()].sort(),
      units: [...plan.units.keys()].sort(),
      links: [...plan.links.keys()].sort(),
      targets: [...plan.targets.keys()].sort(),
      currentReleaseStreams: [...plan.releaseStreams.values()].sort((a, b) => a.space.localeCompare(b.space)),
      bootstrapDurableWorkloads: BOOTSTRAP_DURABLE_WORKLOADS,
      protectedNamespaces: PROTECTED_NAMESPACES,
    },
  };
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function assertQuiescentJournal() {
  if (!existsSync(OPERATION_JOURNAL_PATH)) return;
  let journal;
  try {
    journal = JSON.parse(readFileSync(OPERATION_JOURNAL_PATH, "utf8"));
  } catch (error) {
    throw new Error(`operation journal is unreadable: ${error.message}`);
  }
  check(Object.keys(journal.convergence ?? {}).length === 0, "orphan audit refuses an in-flight Argo convergence journal");
  const terminalStates = new Set(["completed", "observed-gone", "observed-detached", "already-detached"]);
  for (const [key, value] of Object.entries(journal)) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !("state" in value)) continue;
    if (!["namespaceMove", "scenario", "fleetBootstrap"].includes(key) && !/namespace.*detach/i.test(key)) continue;
    check(terminalStates.has(value.state), `orphan audit refuses in-flight journal ${key} state ${value.state}`);
  }
}

function acquireAuditLock(lockPath = LIVE_LOCK_PATH, isProcessAlive = processAlive) {
  while (true) {
    try {
      mkdirSync(dirname(lockPath), { recursive: true });
      mkdirSync(lockPath);
      writeFileSync(join(lockPath, "owner.json"), `${JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
        command: "audit-kubara-mini-idp-orphans --audit (read-only live access)",
      }, null, 2)}\n`, { mode: 0o600 });
      return lockPath;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner = {};
      try {
        owner = JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8"));
      } catch {
        // Never remove a lock whose exact owner cannot be established.
      }
      const hasExactOwner = Number.isInteger(owner.pid) && owner.pid > 0;
      if (hasExactOwner && !isProcessAlive(owner.pid)) {
        rmSync(lockPath, { recursive: true, force: true });
        continue;
      }
      check(false, `live parity lane is locked at ${lockPath}${hasExactOwner ? ` by pid ${owner.pid}` : " (owner is missing or malformed)"}`);
    }
  }
}

function releaseAuditLock(path) {
  if (!path || !existsSync(path)) return;
  let owner;
  try {
    owner = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"));
  } catch {
    return;
  }
  if (owner.pid === process.pid) rmSync(path, { recursive: true, force: true });
}

function expectFailure(operation, pattern, label) {
  let failure = null;
  try {
    operation();
  } catch (error) {
    failure = error;
  }
  check(failure, `${label}: operation unexpectedly succeeded`);
  check(pattern.test(failure.message), `${label}: unexpected error: ${failure.message}`);
}

function testAuditLockSemantics() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "kubara-orphan-lock-test-"));
  const owner = (pid) => `${JSON.stringify({ pid, startedAt: "2026-01-01T00:00:00.000Z", command: "fixture" }, null, 2)}\n`;
  try {
    const deadLock = join(fixtureRoot, "dead.lock");
    mkdirSync(deadLock);
    writeFileSync(join(deadLock, "owner.json"), owner(4242));
    const acquired = acquireAuditLock(deadLock, (pid) => {
      check(pid === 4242, `dead-lock test inspected unexpected pid ${pid}`);
      return false;
    });
    check(JSON.parse(readFileSync(join(acquired, "owner.json"), "utf8")).pid === process.pid, "proven-dead lock was not replaced by the audit owner");
    releaseAuditLock(acquired);
    check(!existsSync(deadLock), "audit-owned replacement for dead lock was not released");

    const liveLock = join(fixtureRoot, "live.lock");
    mkdirSync(liveLock);
    writeFileSync(join(liveLock, "owner.json"), owner(4343));
    expectFailure(
      () => acquireAuditLock(liveLock, (pid) => {
        check(pid === 4343, `live-lock test inspected unexpected pid ${pid}`);
        return true;
      }),
      /locked.*pid 4343/,
      "live owner",
    );
    check(JSON.parse(readFileSync(join(liveLock, "owner.json"), "utf8")).pid === 4343, "live owner's lock was changed");

    const malformedLock = join(fixtureRoot, "malformed.lock");
    mkdirSync(malformedLock);
    writeFileSync(join(malformedLock, "owner.json"), "not-json\n");
    expectFailure(
      () => acquireAuditLock(malformedLock, () => false),
      /owner is missing or malformed/,
      "malformed owner",
    );
    check(readFileSync(join(malformedLock, "owner.json"), "utf8") === "not-json\n", "malformed-owner lock was changed");
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function parseContext(text) {
  return {
    name: text.match(/^Context Name\s+(\S+)\s*$/mi)?.[1] ?? "",
    organizationExternalID: text.match(/^Organization ID\s+([0-9a-f-]+)\s*$/mi)?.[1] ?? "",
    organizationName: text.match(/^Organization Name\s+(.+?)\s*$/mi)?.[1] ?? "",
    serverURL: text.match(/^Server URL\s+(\S+)\s*$/mi)?.[1]?.replace(/\/$/, "") ?? "",
  };
}

function pinnedCubClient() {
  const initialArgs = contextOption ? ["--context", contextOption] : [];
  const coordinate = parseContext(command("cub", [...initialArgs, "context", "get"]));
  check(coordinate.name, "cub context name is unavailable");
  check(coordinate.organizationName === ORGANIZATION, `refusing ConfigHub Organization ${coordinate.organizationName || "unknown"}`);
  check(coordinate.organizationExternalID === ORGANIZATION_EXTERNAL_ID, "ConfigHub external Organization ID drifted");
  check(coordinate.serverURL === CONFIGHUB_SERVER_URL, "ConfigHub server URL drifted");
  const contextArgs = ["--context", coordinate.name];
  const organizations = JSON.parse(command("cub", [
    ...contextArgs,
    "organization", "list",
    "--where", `ExternalID = '${ORGANIZATION_EXTERNAL_ID}'`,
    "--select", "DisplayName,ExternalID,OrganizationID",
    "-o", "json",
  ]));
  check(Array.isArray(organizations) && organizations.length === 1, "expected exactly one pinned Kubara Organization entity");
  const organization = organizations[0]?.Organization ?? organizations[0];
  check(organization.OrganizationID === ORGANIZATION_ENTITY_ID, "ConfigHub Organization entity ID drifted");
  return {
    coordinate,
    json(args) { return JSON.parse(command("cub", [...contextArgs, ...args, "-o", "json"])); },
    text(args) { return command("cub", [...contextArgs, ...args]); },
  };
}

function unwrapRows(value, key) {
  const plural = value?.[`${key}s`] ?? value?.[`${key.toLowerCase()}s`] ?? value;
  check(Array.isArray(plural), `${key} list returned an unexpected shape`);
  return plural.map((row) => row?.[key] ?? row);
}

function splitRef(ref) {
  const index = ref.indexOf("/");
  check(index > 0 && index < ref.length - 1, `invalid ref ${ref}`);
  return [ref.slice(0, index), ref.slice(index + 1)];
}

function apiGroup(apiVersion) {
  const value = String(apiVersion ?? "");
  return value.includes("/") ? value.slice(0, value.indexOf("/")) : "";
}

function resourceKey(resource) {
  return `${resource.group || "core"}/${resource.kind}/${resource.namespace || "_cluster"}/${resource.name}`;
}

function workloadKey(workload) {
  return resourceKey({
    group: apiGroup(workload.apiVersion),
    kind: workload.kind,
    namespace: workload.metadata?.namespace,
    name: workload.metadata?.name,
  });
}

function ownerReferenceKey(workload, owner) {
  return resourceKey({
    group: apiGroup(owner.apiVersion),
    kind: owner.kind,
    namespace: workload.metadata?.namespace,
    name: owner.name,
  });
}

function addFinding(findings, category, ref, detail) {
  findings.push({ category, ref, detail });
}

function setDifference(left, right) {
  return [...left].filter((item) => !right.has(item)).sort();
}

function readConfigHubInventory(client, plan, findings) {
  const spaces = unwrapRows(client.json([
    "space", "list",
    "--select", "OrganizationID,Labels,Annotations,ReleaseTargetID,TriggerFilterID,TriggerIDs,UpdatedAt",
  ]), "Space");
  const spacesBySlug = new Map(spaces.map((space) => [space.Slug, space]));
  const expectedSpaceSlugs = new Set(plan.spaces.keys());
  const actualSpaceSlugs = new Set(spacesBySlug.keys());
  for (const slug of setDifference(actualSpaceSlugs, expectedSpaceSlugs)) addFinding(findings, "unexpectedConfigHubSpace", slug, "Space is outside the exact reconciler plan");
  for (const slug of setDifference(expectedSpaceSlugs, actualSpaceSlugs)) addFinding(findings, "missingConfigHubSpace", slug, "planned Space is missing");
  const control = spacesBySlug.get("hx-platform");
  if (control && control.OrganizationID !== ORGANIZATION_ENTITY_ID) addFinding(findings, "organizationDrift", "hx-platform", "Space belongs to another Organization entity");

  const units = new Map();
  const links = new Map();
  for (const slug of [...actualSpaceSlugs].sort()) {
    const unitRows = unwrapRows(client.json([
      "unit", "list", "--space", slug,
      "--select", "Labels,Annotations,TargetID,UpstreamUnitID,ToolchainType,ProviderType,HeadRevisionNum,LastAppliedRevisionNum,DataHash",
    ]), "Unit");
    for (const unit of unitRows) units.set(`${slug}/${unit.Slug}`, unit);
    const linkRows = unwrapRows(client.json([
      "link", "list", "--space", slug,
      "--select", "FromUnitID,ToUnitID,ToSpaceID,UpdateType,AutoUpdate,Labels,Annotations",
    ]), "Link");
    for (const link of linkRows) links.set(`${slug}/${link.Slug}`, link);
  }

  const expectedUnits = new Set(plan.units.keys());
  const actualUnits = new Set(units.keys());
  for (const ref of setDifference(actualUnits, expectedUnits)) addFinding(findings, "unexpectedConfigHubUnit", ref, "Unit is outside the plan-derived allowlist");
  for (const ref of setDifference(expectedUnits, actualUnits)) addFinding(findings, "missingConfigHubUnit", ref, "planned Unit is missing");
  const expectedLinks = new Set(plan.links.keys());
  const actualLinks = new Set(links.keys());
  for (const ref of setDifference(actualLinks, expectedLinks)) addFinding(findings, "unexpectedConfigHubLink", ref, "Link is outside the plan-derived allowlist");
  for (const ref of setDifference(expectedLinks, actualLinks)) addFinding(findings, "missingConfigHubLink", ref, "planned Link is missing");

  const targets = unwrapRows(client.json([
    "target", "list", "--space", "*",
    "--select", "SpaceID,ProviderType,ToolchainType,Annotations",
  ]), "Target");
  const spaceSlugByID = new Map(spaces.map((space) => [space.SpaceID, space.Slug]));
  const targetsByRef = new Map(targets.map((target) => [`${spaceSlugByID.get(target.SpaceID) ?? `unknown:${target.SpaceID}`}/${target.Slug}`, target]));
  const expectedTargets = new Set(plan.targets.keys());
  const actualTargets = new Set(targetsByRef.keys());
  for (const ref of setDifference(actualTargets, expectedTargets)) addFinding(findings, "unexpectedConfigHubTarget", ref, "Target is outside the exact four-target allowlist");
  for (const ref of setDifference(expectedTargets, actualTargets)) addFinding(findings, "missingConfigHubTarget", ref, "planned Target is missing");
  for (const [ref, expected] of plan.targets) {
    const target = targetsByRef.get(ref);
    if (!target) continue;
    if (target.ProviderType !== "OCI" || target.ToolchainType !== "Any") addFinding(findings, "targetContractDrift", ref, `provider/toolchain is ${target.ProviderType ?? "missing"}/${target.ToolchainType ?? "missing"}`);
    if (target.Annotations?.["confighub.com/argo-apps-space"] !== expected.appsSpace) addFinding(findings, "targetContractDrift", ref, `argo-apps-space does not name ${expected.appsSpace}`);
  }

  const targetIDByRef = new Map([...targetsByRef].map(([ref, target]) => [ref, target.TargetID]));
  const unitIDByRef = new Map([...units].map(([ref, unit]) => [ref, unit.UnitID]));
  for (const [ref, expected] of plan.units) {
    const live = units.get(ref);
    if (!live) continue;
    const expectedTargetID = expected.expectedTarget ? targetIDByRef.get(expected.expectedTarget) : null;
    if ((live.TargetID ?? null) !== (expectedTargetID ?? null)) addFinding(findings, "unitTargetDrift", ref, `TargetID differs from ${expected.expectedTarget ?? "untargeted"}`);
  }
  for (const [ref, expected] of plan.links) {
    const live = links.get(ref);
    if (!live) continue;
    const [toSpace] = splitRef(expected.to);
    const toSpaceID = spacesBySlug.get(toSpace)?.SpaceID;
    if (
      live.UpdateType !== expected.updateType
      || live.AutoUpdate === true
      || live.FromUnitID !== unitIDByRef.get(expected.from)
      || live.ToUnitID !== unitIDByRef.get(expected.to)
      || live.ToSpaceID !== toSpaceID
    ) addFinding(findings, "linkContractDrift", ref, "Link type, auto-update, or endpoint identity drifted");
  }
  for (const [cluster, appsSpace] of plan.appsSpaces) {
    const targetID = targetIDByRef.get(`${cluster}/target`);
    if (spacesBySlug.get(appsSpace)?.ReleaseTargetID !== targetID) addFinding(findings, "spaceTargetDrift", appsSpace, `release target is not ${cluster}/target`);
    if (spacesBySlug.get(`argobot-${cluster}`)?.ReleaseTargetID !== targetID) addFinding(findings, "spaceTargetDrift", `argobot-${cluster}`, `release target is not ${cluster}/target`);
  }
  for (const item of plan.reconcilePlan.spec.spaces.filter((space) => space.target)) {
    const [cluster] = splitRef(item.target);
    if (spacesBySlug.get(item.slug)?.ReleaseTargetID !== targetIDByRef.get(`${cluster}/target`)) addFinding(findings, "spaceTargetDrift", item.slug, `release target is not ${item.target}`);
  }

  const allReleases = unwrapRows(client.json([
    "release", "list", "--space", "*",
    "--select", "SpaceID,Digest,ManifestDigest,ReleaseNum,CreatedAt,Published",
  ]), "Release");
  const publishedReleases = unwrapRows(client.json([
    "release", "list", "--space", "*", "--where", "Published = true",
    "--select", "SpaceID,Digest,ManifestDigest,ReleaseNum,CreatedAt,Published",
  ]), "Release");
  const publishedIDs = new Set(publishedReleases.map((release) => release.ReleaseID));
  const normalizedReleases = allReleases.map((release) => ({
    ...release,
    space: spaceSlugByID.get(release.SpaceID) ?? "",
    published: publishedIDs.has(release.ReleaseID),
  }));
  for (const release of normalizedReleases) {
    if (!release.space) addFinding(findings, "orphanRelease", release.ReleaseID ?? "unknown", `release belongs to unknown SpaceID ${release.SpaceID ?? "missing"}`);
    if (!SHA256_PATTERN.test(release.Digest ?? "") || !SHA256_PATTERN.test(release.ManifestDigest ?? "")) addFinding(findings, "releaseDigestDrift", `${release.space}/${release.ReleaseID ?? "unknown"}`, "bundle or OCI manifest digest is invalid");
  }
  const releaseClassification = classifyReleases(normalizedReleases, plan, findings);
  return {
    spaces,
    spacesBySlug,
    units,
    links,
    targetsByRef,
    targetIDByRef,
    releaseClassification,
    latestPublishedBySpace: new Map(releaseClassification.activeCurrent.map((item) => [item.space, item])),
    unitData(ref) {
      const [space, slug] = splitRef(ref);
      return client.text(["unit", "data", "--space", space, slug]);
    },
  };
}

function releaseSort(left, right) {
  return Number(right.ReleaseNum ?? 0) - Number(left.ReleaseNum ?? 0)
    || String(right.CreatedAt ?? "").localeCompare(String(left.CreatedAt ?? ""));
}

function releaseEvidence(release, classification) {
  return {
    space: release.space,
    releaseID: release.ReleaseID,
    releaseNum: release.ReleaseNum,
    bundleDigest: release.Digest,
    manifestDigest: release.ManifestDigest,
    createdAt: release.CreatedAt,
    published: release.published,
    classification,
  };
}

function classifyReleases(releases, plan, findings) {
  const bySpace = new Map();
  for (const release of releases) {
    if (!bySpace.has(release.space)) bySpace.set(release.space, []);
    bySpace.get(release.space).push(release);
  }
  const activeCurrent = [];
  const historical = [];
  const retainedCatalogOrProof = [];
  const orphaned = [];
  for (const [space, stream] of plan.releaseStreams) {
    const rows = (bySpace.get(space) ?? []).sort(releaseSort);
    const published = rows.filter((row) => row.published).sort(releaseSort);
    if (!published.length) {
      addFinding(findings, "missingCurrentRelease", space, "current delivery stream has no Published release");
      continue;
    }
    activeCurrent.push({ ...releaseEvidence(published[0], "active-current"), role: stream.role, cluster: stream.cluster });
    for (const row of rows.filter((item) => item.ReleaseID !== published[0].ReleaseID)) historical.push(releaseEvidence(row, "historical-retained"));
  }
  for (const [space, rows] of bySpace) {
    if (plan.releaseStreams.has(space)) continue;
    const spaceType = plan.spaces.get(space)?.type;
    for (const row of rows) {
      if (!plan.spaces.has(space) || (row.published && !plan.allowedRetainedReleaseTypes.has(spaceType))) {
        const evidence = releaseEvidence(row, "orphan-active-nondelivery");
        orphaned.push(evidence);
        addFinding(findings, "orphanRelease", `${space}/${row.ReleaseID ?? "unknown"}`, `Published release is not a delivery stream or an allowed retained definition/proof package (${spaceType ?? "unknown Space"})`);
      } else {
        retainedCatalogOrProof.push(releaseEvidence(row, row.published ? "catalog-or-proof-retained" : "historical-retained"));
      }
    }
  }
  return {
    activeCurrent: activeCurrent.sort((a, b) => a.space.localeCompare(b.space)),
    historical: historical.sort((a, b) => `${a.space}/${a.releaseNum}`.localeCompare(`${b.space}/${b.releaseNum}`)),
    retainedCatalogOrProof: retainedCatalogOrProof.sort((a, b) => `${a.space}/${a.releaseNum}`.localeCompare(`${b.space}/${b.releaseNum}`)),
    orphaned,
  };
}

function kubectl(cluster, args) {
  return command("kubectl", [
    "--kubeconfig", join(homedir(), ".confighub", "clusters", `${cluster}.kubeconfig`),
    "--context", `kind-${cluster}`,
    ...args,
  ]);
}

function sourceSpaceFromApplication(app, ref) {
  const repoURL = app.spec?.source?.repoURL ?? "";
  check(repoURL.startsWith(OCI_SPACE_PREFIX), `${ref}: Application source is not a ConfigHub Space OCI reference`);
  const sourceSpace = repoURL.slice(OCI_SPACE_PREFIX.length);
  check(sourceSpace && !sourceSpace.includes("/"), `${ref}: Application source Space is invalid`);
  return sourceSpace;
}

function expectedApplications(plan, confighub, findings) {
  const result = new Map(plan.clusters.map((cluster) => [cluster, new Map()]));
  for (const item of plan.reconcilePlan.spec.deliveryApplicationUnits) {
    const cluster = item.labels?.Cluster;
    let docs;
    try {
      docs = parseDocs(confighub.unitData(item.ref));
    } catch (error) {
      addFinding(findings, "applicationUnitData", item.ref, error.message);
      continue;
    }
    if (docs.length !== 1 || docs[0]?.kind !== "Application") {
      addFinding(findings, "applicationUnitData", item.ref, "delivery Unit must contain exactly one Argo Application");
      continue;
    }
    const app = docs[0];
    const name = app.metadata?.name;
    if (!name || app.metadata?.namespace !== "argocd") {
      addFinding(findings, "applicationUnitData", item.ref, "Application identity must be argocd/<name>");
      continue;
    }
    let sourceSpace = "";
    try {
      sourceSpace = sourceSpaceFromApplication(app, item.ref);
    } catch (error) {
      addFinding(findings, "applicationUnitData", item.ref, error.message);
      continue;
    }
    if (result.get(cluster).has(name)) addFinding(findings, "duplicateApplicationOwner", `${cluster}/${name}`, `multiple ConfigHub delivery Units declare the same Application (${item.ref})`);
    result.get(cluster).set(name, { name, cluster, sourceSpace, unitRef: item.ref, desiredSpec: app.spec, kind: "configHub-delivery-unit" });
  }
  return result;
}

function auditArgo(plan, confighub, findings) {
  const expectedByCluster = expectedApplications(plan, confighub, findings);
  const desiredResourcesByCluster = new Map(plan.clusters.map((cluster) => [cluster, new Map()]));
  const rows = [];
  let resourceCount = 0;
  let requiresPruningCount = 0;
  for (const cluster of plan.clusters) {
    const payload = JSON.parse(kubectl(cluster, ["get", "applications.argoproj.io", "-n", "argocd", "-o", "json"]));
    const actual = new Map((payload.items ?? []).map((app) => [app.metadata?.name, app]));
    const expected = expectedByCluster.get(cluster);
    for (const name of setDifference(new Set(actual.keys()), new Set(expected.keys()))) addFinding(findings, "unexpectedArgoApplication", `${cluster}/${name}`, "Application is outside the plan-derived allowlist");
    for (const name of setDifference(new Set(expected.keys()), new Set(actual.keys()))) addFinding(findings, "missingArgoApplication", `${cluster}/${name}`, "planned Application is missing");
    for (const [name, contract] of expected) {
      const app = actual.get(name);
      if (!app) continue;
      if (stableJson(app.spec) !== stableJson(contract.desiredSpec)) addFinding(findings, "argoApplicationContractDrift", `${cluster}/${name}`, `live spec differs from ${contract.unitRef}`);
      const release = confighub.latestPublishedBySpace.get(contract.sourceSpace);
      if (!release) addFinding(findings, "missingCurrentRelease", contract.sourceSpace, `${cluster}/${name} has no current release`);
      const observedRevision = app.status?.sync?.revision ?? "";
      if (app.status?.sync?.status !== "Synced") addFinding(findings, "argoApplicationNotSynced", `${cluster}/${name}`, `sync=${app.status?.sync?.status ?? "Unknown"}`);
      if (release && observedRevision !== release.manifestDigest) addFinding(findings, "argoRevisionDrift", `${cluster}/${name}`, `revision=${observedRevision || "missing"}, expected ${release.manifestDigest}`);
      const statusResources = app.status?.resources ?? [];
      const prunable = statusResources.filter((resource) => resource.requiresPruning === true);
      const desiredResources = desiredResourcesByCluster.get(cluster);
      for (const resource of statusResources.filter((item) => item.requiresPruning !== true)) {
        if (!resource.kind || !resource.name) {
          addFinding(findings, "argoResourceIdentity", `${cluster}/${name}`, "Application status contains a desired resource without kind/name identity");
          continue;
        }
        const key = resourceKey(resource);
        const entry = desiredResources.get(key) ?? { key, applications: [] };
        if (!entry.applications.includes(name)) entry.applications.push(name);
        desiredResources.set(key, entry);
      }
      resourceCount += statusResources.length;
      requiresPruningCount += prunable.length;
      for (const resource of prunable) {
        const group = resource.group ? `${resource.group}/` : "";
        const ref = `${cluster}/${name}/${group}${resource.kind}/${resource.namespace ?? ""}/${resource.name}`;
        addFinding(findings, "argoRequiresPruning", ref, "accepted state requires zero stale tracked resources");
      }
      rows.push({
        cluster,
        name,
        kind: contract.kind,
        sourceSpace: contract.sourceSpace,
        sourceUnit: contract.unitRef,
        expectedRevision: release?.manifestDigest ?? null,
        observedRevision: observedRevision || null,
        sync: app.status?.sync?.status ?? "Unknown",
        health: app.status?.health?.status ?? "Unknown",
        trackedResources: (app.status?.resources ?? []).length,
        requiresPruning: prunable.length,
      });
    }
  }
  return {
    expectedApplicationCount: [...expectedByCluster.values()].reduce((sum, items) => sum + items.size, 0),
    observedApplications: rows.sort((a, b) => `${a.cluster}/${a.name}`.localeCompare(`${b.cluster}/${b.name}`)),
    trackedResourceCount: resourceCount,
    requiresPruningCount,
    desiredResourcesByCluster,
  };
}

function classifyDurableWorkloads(
  cluster,
  workloads,
  desiredResources,
  findings,
  bootstrapByKey = BOOTSTRAP_DURABLE_WORKLOADS_BY_KEY,
) {
  const rows = [];
  for (const workload of workloads) {
    const key = workloadKey(workload);
    const ref = `${cluster}/${key}`;
    const annotations = workload.metadata?.annotations ?? {};
    const hasTrackingAnnotation = Object.prototype.hasOwnProperty.call(annotations, ARGO_TRACKING_ANNOTATION);
    const trackingID = hasTrackingAnnotation ? annotations[ARGO_TRACKING_ANNOTATION] : null;
    const desired = desiredResources.get(key);
    const bootstrap = bootstrapByKey.get(key);
    const ownerReferences = (workload.metadata?.ownerReferences ?? []).map((owner) => ({
      apiVersion: owner.apiVersion ?? null,
      kind: owner.kind ?? null,
      namespace: workload.metadata?.namespace ?? null,
      name: owner.name ?? null,
      uid: owner.uid ?? null,
      controller: owner.controller === true,
      key: owner.apiVersion && owner.kind && owner.name ? ownerReferenceKey(workload, owner) : null,
    }));
    const desiredOwnerRoots = ownerReferences
      .filter((owner) => owner.key && desiredResources.has(owner.key))
      .map((owner) => ({
        key: owner.key,
        applications: desiredResources.get(owner.key).applications,
        controller: owner.controller,
        uid: owner.uid,
      }));

    let classification;
    let applications = [];
    if (hasTrackingAnnotation && !desired) {
      classification = "dangling-argo-tracking";
      addFinding(findings, "danglingTrackedDurableWorkload", ref, `${ARGO_TRACKING_ANNOTATION} is present but the exact workload key is absent from every expected Application status.resources`);
    } else if (desired) {
      classification = "argo-status-desired";
      applications = desired.applications;
    } else if (bootstrap) {
      classification = "bootstrap-baseline";
    } else if (desiredOwnerRoots.length > 0) {
      classification = "generated-by-argo-desired-root";
      applications = [...new Set(desiredOwnerRoots.flatMap((owner) => owner.applications))].sort();
    } else {
      classification = "unclassified";
      addFinding(findings, "unclassifiedDurableWorkload", ref, "durable workload is neither Argo desired, exact bootstrap, nor directly owned by a current Argo desired root");
    }

    rows.push({
      cluster,
      key,
      apiVersion: workload.apiVersion ?? null,
      kind: workload.kind ?? null,
      namespace: workload.metadata?.namespace ?? null,
      name: workload.metadata?.name ?? null,
      uid: workload.metadata?.uid ?? null,
      classification,
      applications,
      trackingID,
      bootstrapRole: bootstrap?.role ?? null,
      bootstrapRuntimeVersion: bootstrap?.role === "argocd-runtime" ? ARGO_CD_RUNTIME_VERSION : null,
      desiredOwnerRoots,
      ownerReferences,
    });
  }
  return rows.sort((left, right) => left.key.localeCompare(right.key));
}

function workloadContainers(workload) {
  return [
    ...(workload.spec?.template?.spec?.initContainers ?? []),
    ...(workload.spec?.template?.spec?.containers ?? []),
  ];
}

function validateArgoBootstrapRuntime(cluster, workloadsByKey, findings) {
  const runtimeByName = new Map();
  for (const expected of BOOTSTRAP_DURABLE_WORKLOADS.filter((item) => item.role === "argocd-runtime")) {
    const workload = workloadsByKey.get(resourceKey(expected));
    if (workload) runtimeByName.set(expected.name, workload);
  }
  const expectedPairs = new Set(ARGO_CD_RUNTIME_CONTAINER_PAIRS.map(([workload, container]) => `${workload}/${container}`));
  for (const [workloadName, containerName] of ARGO_CD_RUNTIME_CONTAINER_PAIRS) {
    const workload = runtimeByName.get(workloadName);
    if (!workload) continue;
    const matches = workloadContainers(workload).filter((container) => container.name === containerName);
    if (matches.length !== 1) {
      addFinding(findings, "argoBootstrapRuntimeDrift", `${cluster}/argocd/${workloadName}/${containerName}`, `expected exactly one pinned runtime container, observed ${matches.length}`);
    } else if (matches[0].image !== ARGO_CD_RUNTIME_IMAGE) {
      addFinding(findings, "argoBootstrapRuntimeDrift", `${cluster}/argocd/${workloadName}/${containerName}`, `image is ${matches[0].image ?? "missing"}, expected ${ARGO_CD_RUNTIME_IMAGE}`);
    }
  }
  for (const [workloadName, workload] of runtimeByName) {
    for (const container of workloadContainers(workload)) {
      const pair = `${workloadName}/${container.name}`;
      if (String(container.image ?? "").startsWith("quay.io/argoproj/argocd:") && !expectedPairs.has(pair)) {
        addFinding(findings, "argoBootstrapRuntimeDrift", `${cluster}/argocd/${pair}`, `unexpected Argo CD runtime container uses ${container.image}`);
      }
    }
  }
}

function auditDurableWorkloads(plan, argo, findings) {
  const rows = [];
  const missingBootstrap = [];
  for (const cluster of plan.clusters) {
    const payload = JSON.parse(kubectl(cluster, [
      "get",
      DURABLE_WORKLOAD_RESOURCES.join(","),
      "--all-namespaces",
      "-o", "json",
    ]));
    const workloads = payload.items ?? [];
    const workloadsByKey = new Map();
    for (const workload of workloads) {
      const key = workloadKey(workload);
      if (workloadsByKey.has(key)) addFinding(findings, "duplicateDurableWorkload", `${cluster}/${key}`, "bulk Kubernetes inventory returned a duplicate durable-workload identity");
      workloadsByKey.set(key, workload);
    }
    for (const [key] of BOOTSTRAP_DURABLE_WORKLOADS_BY_KEY) {
      if (workloadsByKey.has(key)) continue;
      missingBootstrap.push({ cluster, key });
      addFinding(findings, "missingBootstrapDurableWorkload", `${cluster}/${key}`, "exact kind/Argo bootstrap workload is missing");
    }
    validateArgoBootstrapRuntime(cluster, workloadsByKey, findings);
    rows.push(...classifyDurableWorkloads(
      cluster,
      workloads,
      argo.desiredResourcesByCluster.get(cluster),
      findings,
    ));
  }
  const classifications = Object.fromEntries(
    [...new Set(rows.map((row) => row.classification))].sort()
      .map((classification) => [classification, rows.filter((row) => row.classification === classification).length]),
  );
  return {
    resourceTypes: DURABLE_WORKLOAD_RESOURCES,
    bootstrapVersion: { argoCD: ARGO_CD_RUNTIME_VERSION, image: ARGO_CD_RUNTIME_IMAGE },
    argoDesiredRootCount: [...argo.desiredResourcesByCluster.values()].reduce((sum, resources) => sum + resources.size, 0),
    expectedBootstrapPerCluster: BOOTSTRAP_DURABLE_WORKLOADS.length,
    expectedBootstrapTotal: plan.clusters.length * BOOTSTRAP_DURABLE_WORKLOADS.length,
    missingBootstrap,
    classifications,
    observedCount: rows.length,
    unclassifiedCount: rows.filter((row) => row.classification === "unclassified").length,
    danglingTrackedCount: rows.filter((row) => row.classification === "dangling-argo-tracking").length,
    rows: rows.sort((left, right) => `${left.cluster}/${left.key}`.localeCompare(`${right.cluster}/${right.key}`)),
  };
}

function staleOwnershipAnnotations(resource) {
  const annotations = resource.metadata?.annotations ?? {};
  return OWNERSHIP_ANNOTATIONS.filter((key) => annotations[key] !== undefined);
}

function auditProtectedNamespaces(plan, findings) {
  const rows = [];
  for (const cluster of plan.clusters) {
    for (const namespace of PROTECTED_NAMESPACES) {
      const resource = JSON.parse(kubectl(cluster, ["get", "namespace", namespace, "-o", "json"]));
      const staleAnnotations = staleOwnershipAnnotations(resource);
      const staleLabels = namespace === "default"
        ? LEGACY_DEFAULT_NAMESPACE_LABELS.filter((key) => resource.metadata?.labels?.[key] !== undefined)
        : [];
      for (const key of staleAnnotations) addFinding(findings, "protectedNamespaceOwnership", `${cluster}/Namespace/${namespace}`, `stale annotation ${key} must be detached without deleting the namespace`);
      for (const key of staleLabels) addFinding(findings, "protectedNamespaceOwnership", `${cluster}/Namespace/${namespace}`, `stale label ${key} must be detached without deleting the namespace`);
      rows.push({
        cluster,
        namespace,
        uid: resource.metadata?.uid ?? null,
        phase: resource.status?.phase ?? "Unknown",
        staleOwnershipAnnotations: staleAnnotations,
        staleLegacyOwnershipLabels: staleLabels,
      });
    }
  }
  return rows;
}

function findingCounts(findings) {
  const categories = {};
  for (const finding of findings) categories[finding.category] = (categories[finding.category] ?? 0) + 1;
  return {
    unexpectedConfigHubSpaces: categories.unexpectedConfigHubSpace ?? 0,
    unexpectedConfigHubUnits: categories.unexpectedConfigHubUnit ?? 0,
    unexpectedConfigHubLinks: categories.unexpectedConfigHubLink ?? 0,
    unexpectedConfigHubTargets: categories.unexpectedConfigHubTarget ?? 0,
    orphanReleases: categories.orphanRelease ?? 0,
    unexpectedArgoApplications: categories.unexpectedArgoApplication ?? 0,
    requiresPruning: categories.argoRequiresPruning ?? 0,
    unclassifiedDurableWorkloads: categories.unclassifiedDurableWorkload ?? 0,
    danglingTrackedDurableWorkloads: categories.danglingTrackedDurableWorkload ?? 0,
    missingBootstrapDurableWorkloads: categories.missingBootstrapDurableWorkload ?? 0,
    argoBootstrapRuntimeDrift: categories.argoBootstrapRuntimeDrift ?? 0,
    protectedNamespaceOwnership: categories.protectedNamespaceOwnership ?? 0,
  };
}

function buildReceipt(plan, confighub, argo, durableWorkloads, protectedNamespaces, findings, observedAt) {
  const counts = findingCounts(findings);
  const zeroOrphans = Object.values(counts).every((value) => value === 0);
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubaraMiniIDPOrphanAuditReceipt",
    metadata: { name: "kubara-v0-13-0-mini-idp-orphan-audit" },
    spec: {
      observedAt,
      organization: {
        name: ORGANIZATION,
        externalID: ORGANIZATION_EXTERNAL_ID,
        entityID: ORGANIZATION_ENTITY_ID,
        serverURL: CONFIGHUB_SERVER_URL,
      },
      source: {
        reconciler: relativeRepo(RECONCILER_PATH),
        reconcilerSha256: plan.reconcilerSha256,
        reconcilePlanSha256: plan.planSha256,
      },
      execution: {
        readOnly: true,
        liveMutationCommands: 0,
        sharedSerialLiveLock: true,
        operationJournalRequiredQuiescent: true,
        persistentClustersPreserved: plan.clusters,
      },
      expected: {
        spaces: plan.spaces.size,
        units: plan.units.size,
        links: plan.links.size,
        targets: plan.targets.size,
        currentReleaseStreams: plan.releaseStreams.size,
        argoApplications: argo.expectedApplicationCount,
        bootstrapDurableWorkloads: plan.clusters.length * BOOTSTRAP_DURABLE_WORKLOADS.length,
        protectedNamespaces: plan.clusters.length * PROTECTED_NAMESPACES.length,
      },
      observed: {
        spaces: confighub.spaces.length,
        units: confighub.units.size,
        links: confighub.links.size,
        targets: confighub.targetsByRef.size,
        argoApplications: argo.observedApplications.length,
        argoTrackedResources: argo.trackedResourceCount,
        durableWorkloads: durableWorkloads.observedCount,
      },
      catalogRetention: {
        ...plan.catalogRetention,
        classification: "intentional-additive-inventory-not-orphans",
      },
      releaseClassification: confighub.releaseClassification,
      argo: {
        applicationInventoryPolicy: "exact-plan-derived-allowlist",
        requiresPruningPolicy: "zero",
        applications: argo.observedApplications,
      },
      durableWorkloads: {
        policy: "classify every Deployment, StatefulSet, DaemonSet, CronJob and Job as exact Argo desired, exact bootstrap, or directly owned by a current Argo desired root",
        danglingTrackingPolicy: "tracking-id-present-but-exact-key-absent-from-expected-Application-status-is-always-a-failure",
        ...durableWorkloads,
      },
      protectedNamespaces: {
        policy: "retain-the-namespace-and-require-all-ConfigHub-Argo-ownership-metadata-absent",
        rows: protectedNamespaces,
      },
      findings,
    },
    status: {
      result: findings.length === 0 && zeroOrphans ? "pass" : "fail",
      zeroUnexpectedConfigHubInventory: counts.unexpectedConfigHubSpaces + counts.unexpectedConfigHubUnits + counts.unexpectedConfigHubLinks + counts.unexpectedConfigHubTargets === 0,
      zeroArgoRequiresPruning: counts.requiresPruning === 0,
      zeroUnclassifiedDurableWorkloads: counts.unclassifiedDurableWorkloads === 0,
      zeroDanglingTrackedDurableWorkloads: counts.danglingTrackedDurableWorkloads === 0,
      zeroProtectedNamespaceOwnership: counts.protectedNamespaceOwnership === 0,
      historicalReleasesRetained: true,
      orphanCounts: counts,
      findingCount: findings.length,
    },
  };
}

function runAudit(plan) {
  assertQuiescentJournal();
  const processes = tryCommand("pgrep", ["-fl", "reconcile-kubara-mini-idp.mjs --apply"]);
  check(!processes.ok || !processes.output.trim(), `orphan audit refuses an active reconciler:\n${processes.output}`);
  const lock = acquireAuditLock();
  try {
    assertQuiescentJournal();
    const findings = [];
    const client = pinnedCubClient();
    const confighub = readConfigHubInventory(client, plan, findings);
    const argo = auditArgo(plan, confighub, findings);
    const durableWorkloads = auditDurableWorkloads(plan, argo, findings);
    const protectedNamespaces = auditProtectedNamespaces(plan, findings);
    assertQuiescentJournal();
    const receipt = buildReceipt(plan, confighub, argo, durableWorkloads, protectedNamespaces, findings, new Date().toISOString());
    mkdirSync(dirname(RECEIPT_PATH), { recursive: true });
    writeFileSync(RECEIPT_PATH, `${toYaml(receipt)}\n`, "utf8");
    console.log(`wrote ${relativeRepo(RECEIPT_PATH)}: ${receipt.status.result}; ${receipt.status.findingCount} finding(s)`);
    check(receipt.status.result === "pass", `Kubara mini-IDP orphan audit failed:\n- ${findings.map((item) => `${item.category} ${item.ref}: ${item.detail}`).join("\n- ")}`);
  } finally {
    releaseAuditLock(lock);
  }
}

function verifyReceipt(plan) {
  check(existsSync(RECEIPT_PATH), `${relativeRepo(RECEIPT_PATH)} is missing; run --audit after reconciliation is quiescent`);
  const receipt = readYaml(RECEIPT_PATH);
  check(receipt?.kind === "KubaraMiniIDPOrphanAuditReceipt", "orphan audit receipt kind drifted");
  check(receipt.spec?.organization?.externalID === ORGANIZATION_EXTERNAL_ID, "orphan audit receipt external Organization ID drifted");
  check(receipt.spec?.organization?.entityID === ORGANIZATION_ENTITY_ID, "orphan audit receipt Organization entity ID drifted");
  check(receipt.spec?.organization?.serverURL === CONFIGHUB_SERVER_URL, "orphan audit receipt server drifted");
  check(receipt.spec?.source?.reconcilerSha256 === plan.reconcilerSha256, "orphan audit receipt reconciler digest is stale");
  check(receipt.spec?.source?.reconcilePlanSha256 === plan.planSha256, "orphan audit receipt plan digest is stale");
  check(receipt.spec?.execution?.readOnly === true && receipt.spec?.execution?.liveMutationCommands === 0, "orphan audit receipt no longer proves read-only execution");
  const expected = receipt.spec?.expected ?? {};
  check(expected.spaces === plan.spaces.size, "orphan audit receipt Space count drifted");
  check(expected.units === plan.units.size, "orphan audit receipt Unit count drifted");
  check(expected.links === plan.links.size, "orphan audit receipt Link count drifted");
  check(expected.targets === plan.targets.size, "orphan audit receipt Target count drifted");
  check(expected.currentReleaseStreams === plan.releaseStreams.size, "orphan audit receipt release stream count drifted");
  check(expected.argoApplications === plan.reconcilePlan.spec.counts.deliveryApplicationUnits, "orphan audit receipt Argo Application count drifted");
  check(expected.bootstrapDurableWorkloads === plan.clusters.length * BOOTSTRAP_DURABLE_WORKLOADS.length, "orphan audit receipt bootstrap workload count drifted");
  check(receipt.spec?.releaseClassification?.activeCurrent?.length === plan.releaseStreams.size, "orphan audit active release classification is incomplete");
  check(receipt.spec?.releaseClassification?.orphaned?.length === 0, "orphan audit receipt contains orphan releases");
  check(receipt.spec?.argo?.requiresPruningPolicy === "zero", "orphan audit requiresPruning policy drifted");
  check(receipt.spec?.durableWorkloads?.resourceTypes?.length === DURABLE_WORKLOAD_RESOURCES.length, "durable workload resource inventory is incomplete");
  check(receipt.spec?.durableWorkloads?.bootstrapVersion?.argoCD === ARGO_CD_RUNTIME_VERSION, "durable workload Argo bootstrap version drifted");
  check(receipt.spec?.durableWorkloads?.expectedBootstrapTotal === plan.clusters.length * BOOTSTRAP_DURABLE_WORKLOADS.length, "durable workload bootstrap inventory drifted");
  check(receipt.spec?.durableWorkloads?.missingBootstrap?.length === 0, "durable workload receipt is missing bootstrap workloads");
  check(receipt.spec?.durableWorkloads?.unclassifiedCount === 0, "durable workload receipt contains unclassified workloads");
  check(receipt.spec?.durableWorkloads?.danglingTrackedCount === 0, "durable workload receipt contains dangling Argo tracking");
  check(Array.isArray(receipt.spec?.durableWorkloads?.rows), "durable workload receipt rows are missing");
  const durableRows = receipt.spec.durableWorkloads.rows;
  check(durableRows.length === receipt.spec?.observed?.durableWorkloads, "durable workload receipt does not record every observed workload");
  check(durableRows.every((row) => ["argo-status-desired", "bootstrap-baseline", "generated-by-argo-desired-root"].includes(row.classification)), "durable workload receipt contains a rejected classification");
  const durableRowKeys = new Set(durableRows.map((row) => `${row.cluster}/${row.key}`));
  for (const cluster of plan.clusters) {
    for (const [key] of BOOTSTRAP_DURABLE_WORKLOADS_BY_KEY) check(durableRowKeys.has(`${cluster}/${key}`), `${cluster}: receipt omits bootstrap workload ${key}`);
  }
  const protectedRows = receipt.spec?.protectedNamespaces?.rows ?? [];
  check(protectedRows.length === plan.clusters.length * PROTECTED_NAMESPACES.length, "protected namespace inventory is incomplete");
  for (const row of protectedRows) {
    check(plan.clusters.includes(row.cluster) && PROTECTED_NAMESPACES.includes(row.namespace), "protected namespace receipt identity drifted");
    check(/^[0-9a-f-]{36}$/i.test(row.uid ?? "") && row.phase === "Active", `${row.cluster}/Namespace/${row.namespace}: retained identity or phase is invalid`);
    check((row.staleOwnershipAnnotations ?? []).length === 0, `${row.cluster}/Namespace/${row.namespace}: stale ownership annotations remain`);
    check((row.staleLegacyOwnershipLabels ?? []).length === 0, `${row.cluster}/Namespace/${row.namespace}: stale legacy ownership labels remain`);
  }
  check(receipt.spec?.findings?.length === 0, "orphan audit receipt retains findings");
  check(receipt.status?.result === "pass", "orphan audit receipt is not a pass");
  check(receipt.status?.zeroUnexpectedConfigHubInventory === true, "orphan audit receipt does not prove zero unexpected ConfigHub inventory");
  check(receipt.status?.zeroArgoRequiresPruning === true, "orphan audit receipt does not prove zero Argo requiresPruning resources");
  check(receipt.status?.zeroUnclassifiedDurableWorkloads === true, "orphan audit receipt does not prove zero unclassified durable workloads");
  check(receipt.status?.zeroDanglingTrackedDurableWorkloads === true, "orphan audit receipt does not prove zero dangling tracked durable workloads");
  check(receipt.status?.zeroProtectedNamespaceOwnership === true, "orphan audit receipt does not prove protected namespace detachment");
  check(Object.values(receipt.status?.orphanCounts ?? {}).every((value) => value === 0), "orphan audit receipt orphan counters are nonzero");
  check(receipt.status?.historicalReleasesRetained === true, "orphan audit receipt no longer preserves release history");
  console.log(`verified ${relativeRepo(RECEIPT_PATH)}: zero unexpected ConfigHub inventory, prunable Argo resources, unclassified/dangling durable workloads, and protected-namespace ownership`);
}

function selfTest(plan) {
  check(plan.spaces.size === 7, `self-test plan Space count drifted: ${plan.spaces.size}`);
  check(plan.units.size === 10, `self-test plan Unit count drifted: ${plan.units.size}`);
  check(plan.links.size === 2, `self-test plan Link count drifted: ${plan.links.size}`);
  check(plan.targets.size === 1, `self-test plan Target count drifted: ${plan.targets.size}`);
  check(plan.releaseStreams.size === 3, `self-test plan release stream count drifted: ${plan.releaseStreams.size}`);
  check(plan.catalogRetention.components === 103 && plan.catalogRetention.versions === 130 && plan.catalogRetention.selections === 18, "catalog retention contract drifted");
  check(publicAuditPlan(plan).spec.counts.expectedArgoApplications === 3, "delivery Application Units must be the sole Argo allowlist and count");

  const currentSpace = [...plan.releaseStreams.keys()][0];
  const retainedSpace = [...plan.spaces.values()].find((space) => plan.allowedRetainedReleaseTypes.has(space.type) && !plan.releaseStreams.has(space.slug))?.slug;
  const invalidSpace = plan.clusters[0];
  const sha = `sha256:${"a".repeat(64)}`;
  const fixture = [
    { space: currentSpace, ReleaseID: "current-1", ReleaseNum: 2, CreatedAt: "2026-01-02T00:00:00Z", Digest: sha, ManifestDigest: sha, published: true },
    { space: currentSpace, ReleaseID: "current-0", ReleaseNum: 1, CreatedAt: "2026-01-01T00:00:00Z", Digest: sha, ManifestDigest: sha, published: true },
    { space: retainedSpace, ReleaseID: "catalog-1", ReleaseNum: 1, CreatedAt: "2026-01-01T00:00:00Z", Digest: sha, ManifestDigest: sha, published: true },
  ];
  for (const space of [...plan.releaseStreams.keys()].slice(1)) fixture.push({ space, ReleaseID: `active-${space}`, ReleaseNum: 1, CreatedAt: "2026-01-01T00:00:00Z", Digest: sha, ManifestDigest: sha, published: true });
  const findings = [];
  const classified = classifyReleases(fixture, plan, findings);
  check(findings.length === 0, `historical/catalog release fixture should pass: ${stableJson(findings)}`);
  check(classified.activeCurrent.length === plan.releaseStreams.size, "active current release classification is incomplete");
  check(classified.historical.some((item) => item.releaseID === "current-0"), "older current-stream release was not retained as history");
  check(classified.retainedCatalogOrProof.some((item) => item.releaseID === "catalog-1"), "definition release was not retained as catalog/proof inventory");

  const invalidFindings = [];
  classifyReleases([...fixture, { space: invalidSpace, ReleaseID: "orphan", ReleaseNum: 1, CreatedAt: "2026-01-01T00:00:00Z", Digest: sha, ManifestDigest: sha, published: true }], plan, invalidFindings);
  check(invalidFindings.some((item) => item.category === "orphanRelease"), "active release in a cluster target Space was not rejected");
  check(staleOwnershipAnnotations({ metadata: { annotations: { "argocd.argoproj.io/tracking-id": "stale" } } }).length === 1, "protected namespace tracking metadata was not detected");
  check(staleOwnershipAnnotations({ metadata: { labels: { "argocd.argoproj.io/instance": "chart-label" } } }).length === 0, "ordinary Kubara chart instance label was incorrectly treated as ownership");
  const prunable = [{ requiresPruning: true }, { requiresPruning: false }].filter((item) => item.requiresPruning === true);
  check(prunable.length === 1, "Argo requiresPruning fixture was not fail-closed");

  const desiredResources = new Map([
    ["apps/Deployment/demo/direct", { key: "apps/Deployment/demo/direct", applications: ["direct-app"] }],
    ["monitoring.coreos.com/Prometheus/monitoring/platform", { key: "monitoring.coreos.com/Prometheus/monitoring/platform", applications: ["monitoring-app"] }],
    ["batch/CronJob/jobs/report", { key: "batch/CronJob/jobs/report", applications: ["jobs-app"] }],
  ]);
  const durable = (apiVersion, kind, namespace, name, metadata = {}) => ({
    apiVersion,
    kind,
    metadata: { namespace, name, uid: `uid-${name}`, ...metadata },
  });
  const kindnetKey = "apps/DaemonSet/kube-system/kindnet";
  const fixtureBootstrap = new Map([[kindnetKey, BOOTSTRAP_DURABLE_WORKLOADS_BY_KEY.get(kindnetKey)]]);
  const acceptedDurableFindings = [];
  const acceptedDurableRows = classifyDurableWorkloads("cluster-a", [
    durable("apps/v1", "Deployment", "demo", "direct", { annotations: { [ARGO_TRACKING_ANNOTATION]: "direct-app:apps/Deployment:demo/direct" } }),
    durable("apps/v1", "DaemonSet", "kube-system", "kindnet"),
    durable("apps/v1", "StatefulSet", "monitoring", "prometheus-platform", { ownerReferences: [{ apiVersion: "monitoring.coreos.com/v1", kind: "Prometheus", name: "platform", uid: "prometheus-uid", controller: true }] }),
    durable("batch/v1", "Job", "jobs", "report-123", { ownerReferences: [{ apiVersion: "batch/v1", kind: "CronJob", name: "report", uid: "cronjob-uid", controller: true }] }),
  ], desiredResources, acceptedDurableFindings, fixtureBootstrap);
  check(acceptedDurableFindings.length === 0, `valid durable-workload fixture should pass: ${stableJson(acceptedDurableFindings)}`);
  check(acceptedDurableRows.find((row) => row.name === "direct")?.classification === "argo-status-desired", "exact Application status workload was not classified as desired");
  check(acceptedDurableRows.find((row) => row.name === "kindnet")?.classification === "bootstrap-baseline", "exact kind bootstrap workload was not classified as baseline");
  check(acceptedDurableRows.find((row) => row.name === "prometheus-platform")?.classification === "generated-by-argo-desired-root", "operator-generated StatefulSet owner root was not recognized");
  check(acceptedDurableRows.find((row) => row.name === "report-123")?.classification === "generated-by-argo-desired-root", "CronJob-generated Job owner root was not recognized");

  const rejectedDurableFindings = [];
  const rejectedDurableRows = classifyDurableWorkloads("cluster-a", [
    durable("apps/v1", "Deployment", "demo", "dangling", {
      annotations: { [ARGO_TRACKING_ANNOTATION]: "old-app:apps/Deployment:demo/dangling" },
      ownerReferences: [{ apiVersion: "monitoring.coreos.com/v1", kind: "Prometheus", name: "platform", uid: "prometheus-uid", controller: true }],
    }),
    durable("batch/v1", "Job", "jobs", "manual-job"),
  ], desiredResources, rejectedDurableFindings, fixtureBootstrap);
  check(rejectedDurableRows.find((row) => row.name === "dangling")?.classification === "dangling-argo-tracking", "tracked-but-not-in-status workload was not rejected before owner classification");
  check(rejectedDurableRows.find((row) => row.name === "manual-job")?.classification === "unclassified", "unowned durable workload was not rejected");
  const rejectedDurableCounts = findingCounts(rejectedDurableFindings);
  check(rejectedDurableCounts.danglingTrackedDurableWorkloads === 1, "dangling durable workload counter drifted");
  check(rejectedDurableCounts.unclassifiedDurableWorkloads === 1, "unclassified durable workload counter drifted");

  const runtimeWorkloads = new Map();
  for (const expected of BOOTSTRAP_DURABLE_WORKLOADS.filter((item) => item.role === "argocd-runtime")) {
    runtimeWorkloads.set(resourceKey(expected), {
      apiVersion: "apps/v1",
      kind: expected.kind,
      metadata: { namespace: expected.namespace, name: expected.name },
      spec: { template: { spec: { containers: ARGO_CD_RUNTIME_CONTAINER_PAIRS
        .filter(([workload]) => workload === expected.name)
        .map(([, container]) => ({ name: container, image: ARGO_CD_RUNTIME_IMAGE })) } } },
    });
  }
  const runtimeFindings = [];
  validateArgoBootstrapRuntime("cluster-a", runtimeWorkloads, runtimeFindings);
  check(runtimeFindings.length === 0, `pinned Argo runtime fixture should pass: ${stableJson(runtimeFindings)}`);
  runtimeWorkloads.get("apps/Deployment/argocd/argocd-server").spec.template.spec.containers[0].image = "quay.io/argoproj/argocd:v0.0.0";
  validateArgoBootstrapRuntime("cluster-a", runtimeWorkloads, runtimeFindings);
  check(runtimeFindings.some((item) => item.category === "argoBootstrapRuntimeDrift"), "unpinned Argo runtime image was not rejected");

  testAuditLockSemantics();
  console.log("Kubara mini-IDP orphan audit self-test passed");
}
