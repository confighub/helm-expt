import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { parseDocs, readYaml, repoRoot, sha256File, toYaml, writeYaml } from "./proof-common.mjs";

const REQUIRED_PREDICATES = ["object-set-matches", "workloads-converged", "prerequisites-met"];

export function runCubScoutLiveReceipts({
  runDir,
  renderedPath,
  namespace,
  context,
  targetFacts = {},
  ttl = "1h",
  graceWindow = "5m",
  failOnNonPass = true,
} = {}) {
  mkdirSync(runDir, { recursive: true });
  const resolved = resolveCubScout(runDir);
  if (!resolved.available) {
    const skippedPath = join(runDir, "cub-scout.skipped.txt");
    writeFileSync(skippedPath, `${resolved.reason}\n`);
    console.log(`cub-scout live witness skipped: ${resolved.reason}`);
    return {
      status: "skipped",
      reason: resolved.reason,
      checks: [
        {
          name: "cub-scout-live-witness",
          result: "skipped",
          reason: resolved.reason,
          evidencePath: "cub-scout.skipped.txt",
          evidenceSHA256: sha256File(skippedPath),
        },
      ],
    };
  }

  const checks = [];
  const failures = [];
  const cubScoutRenderedPath = prepareCubScoutDesiredManifest(runDir, renderedPath);
  const cubScoutWorkloadsPath = prepareCubScoutWorkloadManifest(runDir, renderedPath);
  const restore = context ? switchKubeContext(context) : () => {};
  try {
    const baseArgs = ["receipt", "verify", "--scope", `namespace/${namespace}`, "--format", "json"];
    const maybeTtl = resolved.supportsTtl ? ["--ttl", ttl] : [];
    const objectSet = runPredicate({
      bin: resolved.bin,
      runDir,
      label: "object-set",
      args: [...baseArgs, "--file", cubScoutRenderedPath, "--predicate", "object-set-matches", ...maybeTtl],
    });
    checks.push(checkForPredicate("cub-scout-object-set-matches", objectSet));
    collectFailure(objectSet, failures);

    if (resolved.supportsNoExtras) {
      const closedWorld = runPredicate({
        bin: resolved.bin,
        runDir,
        label: "closed-world",
        args: [...baseArgs, "--file", cubScoutRenderedPath, "--predicate", "object-set-matches", "--no-extras", ...maybeTtl],
      });
      checks.push(checkForPredicate("cub-scout-closed-world-object-set", closedWorld, { allowWatch: true }));
      collectFailure(closedWorld, failures, { allowWatch: true });
    }

    if (cubScoutWorkloadsPath) {
      const workloads = runPredicate({
        bin: resolved.bin,
        runDir,
        label: "workloads",
        args: [
          ...baseArgs,
          "--file",
          cubScoutWorkloadsPath,
          "--predicate",
          "workloads-converged",
          "--grace-window",
          graceWindow,
          ...maybeTtl,
        ],
      });
      checks.push(checkForPredicate("cub-scout-workloads-converged", workloads));
      collectFailure(workloads, failures);
    }

    const prereqs = targetFactsToPrerequisites(targetFacts, namespace);
    if (hasPrerequisites(prereqs)) {
      const prereqsPath = join(runDir, "cub-scout.prerequisites.yaml");
      writeYaml(prereqsPath, prereqs);
      const prerequisites = runPredicate({
        bin: resolved.bin,
        runDir,
        label: "prerequisites",
        args: [
          ...baseArgs,
          "--prerequisites",
          prereqsPath,
          "--predicate",
          "prerequisites-met",
          ...maybeTtl,
        ],
      });
      checks.push(checkForPredicate("cub-scout-prerequisites-met", prerequisites));
      collectFailure(prerequisites, failures);
    }
  } finally {
    restore();
  }

  if (failOnNonPass && failures.length) {
    throw new Error(`cub-scout live witness reported non-PASS verdict(s): ${failures.join(", ")}`);
  }

  return {
    status: "observed",
    bin: resolved.bin,
    source: resolved.source,
    supportsTtl: resolved.supportsTtl,
    supportsNoExtras: resolved.supportsNoExtras,
    checks,
  };
}

export function loadTargetFactsForRevision(revisionPath) {
  const variantPath = variantPathFromRevision(revisionPath);
  if (!variantPath || !existsSync(variantPath)) return {};
  return readYaml(variantPath).spec?.targetFacts ?? {};
}

export function variantPathFromRevision(revisionPath) {
  const absolute = resolve(repoRoot, revisionPath);
  const match = absolute.match(/^(.*)\/revisions\/([^/]+)\/r001\/variant-revision\.yaml$/);
  if (!match) return null;
  return join(match[1], "variants", match[2], "variant.yaml");
}

export function targetFactsToPrerequisites(targetFacts = {}, namespace = "default") {
  return {
    requiredCRDs: (targetFacts.requiredCRDs ?? []).map((crd) => crd.name ?? crd).filter(Boolean),
    requiredSecrets: (targetFacts.requiredSecrets ?? [])
      .map((secret) => ({
        name: secret.name,
        namespace: secret.namespace ?? namespace,
        keys: secret.keys ?? [],
      }))
      .filter((secret) => secret.name),
    requiredNamespaces: normalizeNameList(targetFacts.requiredNamespaces),
    requiredStorageClasses: normalizeNameList(targetFacts.requiredStorageClasses),
    requiredIngressClasses: normalizeNameList(targetFacts.requiredIngressClasses),
  };
}

function prepareCubScoutDesiredManifest(runDir, renderedPath) {
  const desiredPath = join(runDir, "cub-scout.desired.yaml");
  const docs = parseDocs(readFileSync(renderedPath, "utf8")).map((doc) => pruneApiDroppedNoops(doc));
  writeFileSync(desiredPath, `${docs.map((doc) => toYaml(doc)).join("\n---\n")}\n`);
  return desiredPath;
}

function prepareCubScoutWorkloadManifest(runDir, renderedPath) {
  const desiredPath = join(runDir, "cub-scout.workloads.desired.yaml");
  const docs = parseDocs(readFileSync(renderedPath, "utf8"))
    .filter((doc) => cubScoutWorkloadKind(doc.apiVersion, doc.kind))
    .map((doc) => pruneApiDroppedNoops(doc));
  if (!docs.length) return null;
  writeFileSync(desiredPath, `${docs.map((doc) => toYaml(doc)).join("\n---\n")}\n`);
  return desiredPath;
}

function cubScoutWorkloadKind(apiVersion, kind) {
  return new Set([
    "apps/v1|DaemonSet",
    "apps/v1|Deployment",
    "apps/v1|StatefulSet",
    "batch/v1|CronJob",
    "batch/v1|Job",
    "v1|Pod",
  ]).has(`${apiVersion}|${kind}`);
}

// Match the authored fields Kubernetes preserves after apply. Do not prune all
// empty arrays: some, such as NetworkPolicy ingress: [], are meaningful.
function pruneApiDroppedNoops(value, path = []) {
  if (value === null || value === undefined) return undefined;
  const last = path.at(-1);
  const parent = path.at(-2);
  if (value === 0 && last === "initialDelaySeconds" && ["livenessProbe", "readinessProbe", "startupProbe"].includes(parent)) {
    return undefined;
  }
  if (value === 0 && path.length === 2 && path[0] === "spec" && last === "minReadySeconds") {
    return undefined;
  }
  if (value === "" && last === "caBundle" && parent === "clientConfig") {
    return undefined;
  }
  if (value === "" && last === "caBundle" && parent === "spec") {
    return undefined;
  }
  if (value === "" && last === "subPath" && path.at(-3) === "volumeMounts") {
    return undefined;
  }
  if (
    value === false &&
    (
      (path.length >= 4 && path.at(-3) === "template" && path.at(-2) === "spec" && ["hostIPC", "hostNetwork", "hostPID"].includes(last)) ||
      (path.length === 2 && path[0] === "spec" && last === "publishNotReadyAddresses")
    )
  ) {
    return undefined;
  }
  if (Array.isArray(value)) {
    if (
      value.length === 0 &&
      path.length >= 2 &&
      path.at(-2) === "securityContext" &&
      ["supplementalGroups", "sysctls"].includes(path.at(-1))
    ) {
      return undefined;
    }
    return value.map((item, index) => pruneApiDroppedNoops(item, [...path, String(index)])).filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const pruned = pruneApiDroppedNoops(item, [...path, key]);
    if (pruned !== undefined) result[key] = pruned;
  }
  if (Object.keys(result).length === 0 && path.length >= 2 && path.at(-2) === "metadata" && ["annotations", "labels"].includes(last)) {
    return undefined;
  }
  return result;
}

function resolveCubScout(runDir) {
  const candidates = [];
  if (process.env.CUB_SCOUT_BIN) candidates.push({ source: "CUB_SCOUT_BIN", bin: process.env.CUB_SCOUT_BIN });

  const siblingCheckout = join(dirname(repoRoot), "cub-scout");
  if (existsSync(join(siblingCheckout, "go.mod"))) {
    const builtBin = join(runDir, "cub-scout");
    candidates.push({
      source: "sibling-checkout",
      bin: builtBin,
      build() {
        execFileSync("go", ["build", "-o", builtBin, "./cmd/cub-scout"], {
          cwd: siblingCheckout,
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 1024 * 1024 * 100,
        });
      },
    });
  }

  candidates.push({ source: "PATH", bin: "cub-scout" });

  const errors = [];
  for (const candidate of candidates) {
    try {
      if (candidate.build) candidate.build();
      const support = cubScoutSupport(candidate.bin);
      if (support.supported) {
        return {
          available: true,
          bin: candidate.bin,
          source: candidate.source,
          supportsTtl: support.supportsTtl,
          supportsNoExtras: support.supportsNoExtras,
        };
      }
      errors.push(`${candidate.source}: ${support.reason}`);
    } catch (error) {
      errors.push(`${candidate.source}: ${error.stderr?.toString()?.trim() || error.message}`);
    }
  }

  return {
    available: false,
    reason: `no cub-scout binary with install-receipt predicates was found (${errors.join("; ")})`,
  };
}

function cubScoutSupport(bin) {
  const result = spawnSync(bin, ["receipt", "verify", "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.status !== 0) return { supported: false, reason: result.stderr || result.stdout || "help failed" };
  const text = `${result.stdout}\n${result.stderr}`;
  const missing = REQUIRED_PREDICATES.filter((predicate) => !text.includes(predicate));
  if (missing.length) return { supported: false, reason: `missing predicate(s): ${missing.join(", ")}` };
  return { supported: true, supportsTtl: text.includes("--ttl"), supportsNoExtras: text.includes("--no-extras") };
}

function runPredicate({ bin, runDir, label, args }) {
  const receiptPath = join(runDir, `cub-scout.${label}.receipt.json`);
  const stdoutPath = join(runDir, `cub-scout.${label}.stdout.json`);
  const stderrPath = join(runDir, `cub-scout.${label}.stderr.txt`);
  const result = spawnSync(bin, [...args, "--out", receiptPath, "--fail-on", "any-non-pass"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  writeFileSync(stdoutPath, result.stdout ?? "");
  writeFileSync(stderrPath, result.stderr ?? "");
  const receipt = readJsonIfExists(receiptPath) ?? readJsonIfExists(stdoutPath);
  const verdict = receipt?.predicate?.verdict ?? "UNKNOWN";
  return { label, receiptPath, stdoutPath, stderrPath, receipt, verdict, exitCode: result.status ?? 0 };
}

function checkForPredicate(name, result, { allowWatch = false } = {}) {
  const checkResult = result.verdict === "PASS" ? "pass" : allowWatch && result.verdict === "WATCH" ? "watch" : "fail";
  return {
    name,
    result: checkResult,
    verdict: result.verdict,
    exitCode: result.exitCode,
    evidencePath: basename(result.receiptPath),
    evidenceSHA256: existsSync(result.receiptPath) ? sha256File(result.receiptPath) : undefined,
    stderrPath: basename(result.stderrPath),
    stderrSHA256: existsSync(result.stderrPath) ? sha256File(result.stderrPath) : undefined,
  };
}

function collectFailure(result, failures, { allowWatch = false } = {}) {
  if (result.verdict === "PASS") return;
  if (allowWatch && result.verdict === "WATCH") return;
  failures.push(`${result.label}=${result.verdict}`);
}

function hasPrerequisites(prereqs) {
  return Object.values(prereqs).some((value) => Array.isArray(value) && value.length > 0);
}

function normalizeNameList(value) {
  return (value ?? []).map((item) => item.name ?? item).filter(Boolean);
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function switchKubeContext(context) {
  const current = spawnSync("kubectl", ["config", "current-context"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  const previous = current.status === 0 ? current.stdout.trim() : null;
  if (previous === context) return () => {};
  execFileSync("kubectl", ["config", "use-context", context], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024,
  });
  return () => {
    if (!previous || previous === context) return;
    try {
      execFileSync("kubectl", ["config", "use-context", previous], {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 1024 * 1024,
      });
    } catch {
      // Keep the original cub-scout result visible if context restoration fails.
    }
  };
}
