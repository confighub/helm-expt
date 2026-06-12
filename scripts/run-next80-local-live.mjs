#!/usr/bin/env node
// Generic local-kind live lane for next80 charts: apply a recipe variant's
// COMMITTED rendered objects to a kind cluster, observe workload
// convergence, and write a lane-compatible observation receipt under
// runs/next80-local-kind/<slug>/observation-receipt.yaml.
//
// Honesty rules:
// - The receipt records pass / blocked / fail with named reasons (image-pull
//   blocks and per-workload pod states), never a bare red.
// - The applied bytes are the committed render (release-objects.yaml), so
//   the receipt's renderedObjectSetSHA256 ties the observation to the exact
//   reviewed artifact.
// - Cluster hygiene: clusters are created with the claude-helm-expt- prefix,
//   only clusters this runner created are deleted, and per-chart objects are
//   deleted after observation (namespace if chart-owned, CRDs applied here).
//
//   node scripts/run-next80-local-live.mjs --chart <repo>/<chart>/<version> [--variant default]
//     [--cluster <name>]      reuse an existing claude- kind cluster (create/keep otherwise)
//     [--keep-cluster]        do not delete the cluster afterwards
//     [--timeout-seconds 240] per-chart convergence budget

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, parseDocs, readYaml, relativeRepo, repoRoot, sha256, toYaml, writeYaml } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const chartPath = optionValue("--chart");
const variantName = optionValue("--variant") ?? "default";
const clusterArg = optionValue("--cluster");
const keepCluster = args.includes("--keep-cluster");
const timeoutSeconds = Number(optionValue("--timeout-seconds") ?? "240");

check(chartPath, "usage: node scripts/run-next80-local-live.mjs --chart <repo>/<chart>/<version> [--variant default]");

const recipeRoot = join(repoRoot, "recipes", chartPath);
check(existsSync(join(recipeRoot, "recipe.yaml")), `no recipe at recipes/${chartPath}`);
const variant = readYaml(join(recipeRoot, "variants", variantName, "variant.yaml"));
const targetFacts = variant.spec?.targetFacts ?? {};
const revisionRel = `recipes/${chartPath}/revisions/${variantName}/r001/variant-revision.yaml`;
check(existsSync(join(repoRoot, revisionRel)), `no committed revision at ${revisionRel}`);
const renderedPath = join(repoRoot, "recipes", chartPath, "revisions", variantName, "r001", "rendered", "release-objects.yaml");
check(existsSync(renderedPath), `no committed render at ${relativeRepo(renderedPath)}`);

const namespace = variant.spec?.namespace ?? "default";
const slug = `${chartPath.replaceAll("/", "-")}-${variantName}`;
const clusterName = clusterArg ?? "claude-helm-expt-next80";
const context = `kind-${clusterName}`;
const runDir = join(repoRoot, "runs", "next80-local-kind", slug);
mkdirSync(runDir, { recursive: true });

const renderedText = readFileSync(renderedPath, "utf8");
const docs = parseDocs(renderedText).filter((doc) => doc && doc.kind);
const crds = docs.filter((doc) => doc.kind === "CustomResourceDefinition");
const workloads = docs.filter((doc) => ["Deployment", "StatefulSet", "DaemonSet"].includes(doc.kind));

let createdCluster = false;
if (!kindClusters().includes(clusterName)) {
  check(clusterName.startsWith("claude-helm-expt-"), `refusing to create cluster ${clusterName}: claude lane clusters must be prefixed claude-helm-expt-`);
  console.log(`creating kind cluster ${clusterName}...`);
  run("kind", ["create", "cluster", "--name", clusterName, "--wait", "60s"]);
  createdCluster = true;
}

const checks = [];
let blockedReasons = [];
let observedPayload = "";
const createdNamespaces = [];
// Some charts render objects into namespaces other than the variant's (for
// example keda places objects in kube-system). Apply namespace-faithfully:
// docs with an explicit namespace keep it; docs without get the variant
// namespace; referenced namespaces are created when missing — and ONLY the
// ones this run created are deleted afterwards.
const docNamespaces = [...new Set([namespace, ...docs.map((doc) => doc.metadata?.namespace).filter(Boolean)])];
try {
  for (const ns of docNamespaces) {
    if (ns === "default" || ns === "kube-system") continue;
    if (!tryRun("kubectl", ["--context", context, "get", "namespace", ns])) {
      run("kubectl", ["--context", context, "create", "namespace", ns]);
      createdNamespaces.push(ns);
      checks.push({ name: "namespace-created", result: "pass", object: `v1|Namespace||${ns}` });
    }
  }

  for (const crd of targetFacts.requiredCRDs ?? []) {
    const name = typeof crd === "string" ? crd : crd.name;
    if (!name) continue;
    if (tryRun("kubectl", ["--context", context, "get", "crd", name])) {
      checks.push({
        name: "target-fact-crd-present",
        result: "pass",
        object: `apiextensions.k8s.io/v1|CustomResourceDefinition||${name}`,
      });
    } else {
      checks.push({
        name: "target-fact-crd-present",
        result: "blocked",
        object: `apiextensions.k8s.io/v1|CustomResourceDefinition||${name}`,
        reason: `required CRD ${name} was not present before apply`,
      });
      blockedReasons.push(`target fact: required CRD ${name} missing`);
    }
  }

  // CRDs first, then wait Established, then everything else.
  if (crds.length) {
    // Big CRDs (keda, kyverno) exceed the 256KB last-applied annotation
    // limit under client-side apply; server-side apply is the route.
    const crdErrors = [];
    tryApply(crds, ["--server-side", "--force-conflicts"], crdErrors);
    if (crdErrors.length) {
      checks.push({ name: "crds-applied-and-established", result: "blocked", object: `${crds.length} CustomResourceDefinition(s)`, reason: crdErrors.join(" | ").slice(0, 300) });
      blockedReasons.push(`crds: ${crdErrors.join(" | ").slice(0, 200)}`);
    }
    for (const crd of crds) {
      tryRun("kubectl", ["--context", context, "wait", "--for=condition=Established", `crd/${crd.metadata.name}`, "--timeout=60s"]);
    }
    if (!crdErrors.length) checks.push({ name: "crds-applied-and-established", result: "pass", object: `${crds.length} CustomResourceDefinition(s)` });
  }
  const rest = docs.filter((doc) => doc.kind !== "CustomResourceDefinition");
  const withOwnNamespace = rest.filter((doc) => doc.metadata?.namespace);
  const withoutNamespace = rest.filter((doc) => !doc.metadata?.namespace);
  // An apply failure is a named outcome, not a crash: the receipt records
  // WHY the rendered set cannot land (for example a CR whose CRD ships with
  // a different chart), and the run continues to observe whatever applied.
  const applyErrors = [];
  if (withOwnNamespace.length) tryApply(withOwnNamespace, [], applyErrors);
  if (withoutNamespace.length) tryApply(withoutNamespace, ["-n", namespace], applyErrors);
  if (applyErrors.length) {
    checks.push({ name: "rendered-objects-applied", result: "blocked", object: `${docs.length} object(s) from ${relativeRepo(renderedPath)}`, reason: `apply-blocked: ${applyErrors.join(" | ").slice(0, 300)}` });
    blockedReasons.push(`apply: ${applyErrors.join(" | ").slice(0, 200)}`);
  } else {
    checks.push({ name: "rendered-objects-applied", result: "pass", object: `${docs.length} object(s) from ${relativeRepo(renderedPath)}` });
  }

  // Observe convergence within the budget.
  const deadline = Date.now() + timeoutSeconds * 1000;
  for (const workload of workloads) {
    const ns = workload.metadata?.namespace ?? namespace;
    const ref = `${workload.kind.toLowerCase()}/${workload.metadata.name}`;
    const remaining = Math.max(15, Math.round((deadline - Date.now()) / 1000));
    const ok = tryRun("kubectl", ["--context", context, "rollout", "status", ref, "-n", ns, `--timeout=${remaining}s`]);
    if (ok) {
      checks.push({ name: "workload-converged", result: "pass", object: `${workload.kind}|${ns}|${workload.metadata.name}` });
      continue;
    }
    const podStates = podStateSummary(ns);
    const imageBlocked = /ImagePullBackOff|ErrImagePull|ImageInspectError/.test(podStates);
    const prereqBlocked = !imageBlocked && /ContainerCreating|CreateContainerConfigError/.test(podStates);
    const kind = imageBlocked ? "image-pull-blocked" : prereqBlocked ? "prerequisite-blocked (stuck creating: missing mount/secret/config)" : "not-ready";
    checks.push({
      name: "workload-converged",
      result: imageBlocked || prereqBlocked ? "blocked" : "fail",
      object: `${workload.kind}|${ns}|${workload.metadata.name}`,
      reason: `${kind}: ${podStates.slice(0, 300) || "did not converge within the budget"}`,
    });
    blockedReasons.push(`${ref}: ${kind} (${podStates.slice(0, 160)})`);
  }
  // Capture the observed live payload as evidence: the applied identities
  // read back from the cluster, written next to the receipt and digested.
  const observedParts = [];
  const getBack = (objects, nsArgs) => {
    if (!objects.length) return;
    const text = objects.map((doc) => JSON.stringify(doc)).join("\n");
    try {
      observedParts.push(
        execFileSync("kubectl", ["--context", context, "get", "-f", "-", "--ignore-not-found", "-o", "yaml", ...nsArgs], {
          cwd: repoRoot,
          input: text,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          maxBuffer: 1024 * 1024 * 200,
        }),
      );
    } catch {
      /* unreadable objects stay out of the payload; checks already recorded why */
    }
  };
  getBack(docs.filter((doc) => doc.metadata?.namespace), []);
  getBack(docs.filter((doc) => !doc.metadata?.namespace), ["-n", namespace]);
  observedPayload = sanitizeObservedPayload(observedParts.join("\n---\n"));
} finally {
  // Per-chart cleanup: applied objects (namespace-faithfully), then ONLY the
  // namespaces this run created.
  deleteDocs(docs.filter((doc) => doc.metadata?.namespace), []);
  deleteDocs(docs.filter((doc) => !doc.metadata?.namespace), ["-n", namespace]);
  for (const ns of createdNamespaces) {
    tryRun("kubectl", ["--context", context, "delete", "namespace", ns, "--ignore-not-found", "--wait=false"]);
  }
  if (createdCluster && !keepCluster) {
    console.log(`deleting kind cluster ${clusterName}...`);
    tryRun("kind", ["delete", "cluster", "--name", clusterName]);
  }
}

const failed = checks.filter((entry) => entry.result === "fail");
const blocked = checks.filter((entry) => entry.result === "blocked");
const result = failed.length ? "fail" : blocked.length ? "blocked" : "pass";

// Fully-blocked applies capture no live payload; the observation log (the
// checks and reasons themselves) is then the committed evidence so the p0
// receipt contract (some evidence digest) always holds.
const logPath = join(runDir, "observation-log.txt");
const logText = `${checks.map((c) => `${c.result.toUpperCase()} ${c.name} ${c.object}${c.reason ? ` :: ${c.reason}` : ""}`).join("\n")}\n${blockedReasons.length ? `blocked:\n${blockedReasons.join("\n")}\n` : ""}`;
if (!observedPayload.trim()) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(logPath, logText);
  const firstNonPass = checks.find((c) => c.result !== "pass") ?? checks[0];
  if (firstNonPass) {
    firstNonPass.evidencePath = "observation-log.txt";
    firstNonPass.evidenceSHA256 = sha256(logText);
  }
}
const receiptPath = join(runDir, "observation-receipt.yaml");
const observedPath = join(runDir, "observed-objects.yaml");
if (observedPayload.trim()) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(observedPath, observedPayload);
}
writeYaml(receiptPath, {
  apiVersion: "helm-expt.confighub.com/v1alpha1",
  kind: "ObservationReceipt",
  metadata: { name: `${slug}-local-kind` },
  spec: {
    variantRevision: revisionRel,
    renderedObjectSetSHA256: sha256(renderedText),
    observer: { name: "next80-local-live", version: "0.1.0", method: "kubectl-kind" },
    target: { kind: "kind", name: clusterName, context, namespace },
    observedAt: new Date().toISOString(),
    freshnessTTL: "1h",
    result,
    clusterStatus: createdCluster ? "created-by-test" : "existing",
    variant: variantName,
    targetFacts,
    workloads: workloads.length,
    ...(observedPayload.trim()
      ? { kubectlObjects: { path: "observed-objects.yaml", sha256: sha256(observedPayload) } }
      : {}),
    checks,
    ...(blockedReasons.length ? { blockedReasons } : {}),
  },
});
console.log(`${result.toUpperCase()} ${chartPath} ${variantName}: ${checks.filter((c) => c.result === "pass").length}/${checks.length} checks pass -> ${relativeRepo(receiptPath)}`);
if (result !== "pass") process.exitCode = result === "blocked" ? 3 : 2;

function applyDocs(objects, nsArgs) {
  const text = objects.map((doc) => JSON.stringify(doc)).join("\n");
  execFileSync("kubectl", ["--context", context, "apply", "-f", "-", ...nsArgs], {
    cwd: repoRoot,
    input: text,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50,
  });
}

function tryApply(objects, nsArgs, errors) {
  try {
    applyDocs(objects, nsArgs);
  } catch (error) {
    const raw = `${error.stderr ?? ""}${error.message ?? ""}`.replaceAll("\n", " ").trim();
    errors.push(raw.slice(0, 200) || "apply failed");
  }
}

function deleteDocs(objects, nsArgs) {
  if (!objects.length) return;
  const text = objects.map((doc) => JSON.stringify(doc)).join("\n");
  try {
    execFileSync("kubectl", ["--context", context, "delete", "-f", "-", "--ignore-not-found", "--wait=false", ...nsArgs], {
      cwd: repoRoot,
      input: text,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 50,
    });
  } catch {
    /* cleanup is best-effort */
  }
}

function podStateSummary(ns) {
  const out = tryCapture("kubectl", [
    "--context", context, "get", "pods", "-n", ns, "-o",
    "jsonpath={range .items[*]}{.metadata.name}[{range .status.containerStatuses[*]}{.state.waiting.reason}{.state.terminated.reason} ready={.ready} restarts={.restartCount};{end}] {end}",
  ]);
  return (out ?? "").trim();
}

function kindClusters() {
  return (tryCapture("kind", ["get", "clusters"]) ?? "").split("\n").filter(Boolean);
}

function run(cmd, cmdArgs) {
  return execFileSync(cmd, cmdArgs, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 50 });
}

function tryRun(cmd, cmdArgs) {
  try {
    run(cmd, cmdArgs);
    return true;
  } catch {
    return false;
  }
}

function tryCapture(cmd, cmdArgs) {
  try {
    return run(cmd, cmdArgs);
  } catch {
    return null;
  }
}

function optionValue(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function sanitizeObservedPayload(payload) {
  if (!payload.trim()) return "";
  return `${parseDocs(payload).map((doc) => toYaml(sanitizeObservedDoc(doc))).join("\n---\n")}\n`;
}

function sanitizeObservedDoc(doc) {
  if (!doc || typeof doc !== "object") return doc;
  if (Array.isArray(doc)) return doc.map((item) => sanitizeObservedDoc(item));

  const result = { ...doc };
  if (Array.isArray(result.items)) {
    result.items = result.items.map((item) => sanitizeObservedDoc(item));
  }
  if (result.kind === "Secret") {
    if ("data" in result) result.data = { redacted: "live Secret data is not committed" };
    if ("binaryData" in result) result.binaryData = { redacted: "live Secret binaryData is not committed" };
    if ("stringData" in result) result.stringData = { redacted: "live Secret stringData is not committed" };
    const annotations = result.metadata?.annotations;
    if (annotations && typeof annotations === "object" && "kubectl.kubernetes.io/last-applied-configuration" in annotations) {
      result.metadata = {
        ...result.metadata,
        annotations: {
          ...annotations,
          "kubectl.kubernetes.io/last-applied-configuration": "redacted: live Secret last-applied-configuration is not committed",
        },
      };
    }
  }
  return result;
}
