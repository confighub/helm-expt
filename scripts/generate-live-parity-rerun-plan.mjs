#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "live-parity-rerun-plan");
const summaryPath = join(outputRoot, "summary.md");
const csvPath = join(outputRoot, "rerun-plan.csv");
const bitnamiOciRepository = "oci://registry-1.docker.io/bitnamicharts";

if (mode === "--generate") {
  const plan = buildPlan();
  write(summaryPath, plan.markdown);
  write(csvPath, plan.csv);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const plan = buildPlan();
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run live-parity:rerun-plan`);
  check(existsSync(csvPath), `${relativeRepo(csvPath)} is missing; run npm run live-parity:rerun-plan`);
  check(readFileSync(summaryPath, "utf8") === plan.markdown, `${relativeRepo(summaryPath)} is stale; run npm run live-parity:rerun-plan`);
  check(readFileSync(csvPath, "utf8") === plan.csv, `${relativeRepo(csvPath)} is stale; run npm run live-parity:rerun-plan`);
  console.log(`verified live parity rerun plan for ${plan.rows.length} row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-live-parity-rerun-plan.mjs --generate
  node scripts/generate-live-parity-rerun-plan.mjs --verify`);
}

function buildPlan() {
  const allRows = [
    ...configHubOciRows(),
    ...twoClusterRows(),
  ].map((row) => {
    const next_step_type = nextStepType(row);
    const support_artifact = supportArtifactFor(row);
    const candidate = {
      next_step_type,
      rerun_readiness: rerunReadiness(next_step_type),
      support_artifact,
      ...row,
    };
    return {
      ...candidate,
      ...usefulBaseResolution(candidate),
    };
  }).sort((left, right) =>
    left.priority - right.priority
    || left.lane.localeCompare(right.lane)
    || `${left.chart}@${left.version}/${left.base}`.localeCompare(`${right.chart}@${right.version}/${right.base}`),
  );
  const lifecycleRoutedRows = allRows.filter(lifecycleRouted);
  const usefulBaseResolvedRows = allRows.filter(usefulBaseResolved);
  const rows = allRows.filter((row) => !lifecycleRouted(row) && !usefulBaseResolved(row));
  return { rows, lifecycleRoutedRows, usefulBaseResolvedRows, csv: toCsv(rows), markdown: markdown(rows, lifecycleRoutedRows, usefulBaseResolvedRows) };
}

function configHubOciRows() {
  const path = join(repoRoot, "data", "live-helm-confighub-compare", "summary.csv");
  const rowsByReceipt = new Map();
  if (existsSync(path)) {
    for (const row of parseCsv(readFileSync(path, "utf8"))) {
      if (["blocked", "watch"].includes(row.result)) rowsByReceipt.set(row.receipt, row);
    }
  }
  for (const row of allLiveComparisonReceiptRows()) {
    if (["blocked", "watch"].includes(row.result) && !rowsByReceipt.has(row.receipt)) {
      rowsByReceipt.set(row.receipt, row);
    }
  }
  return [...rowsByReceipt.values()]
    .map((row) => ({
      priority: priorityForConfigHubOci(row),
      lane: "configHub-oci-live-comparison",
      chart: row.chart,
      version: row.version,
      base: row.variant,
      current_result: row.result,
      reason: row.reason || "watch: inspect receipt",
      diagnosis: diagnosisForConfigHubOci(row),
      rerun_command: rerunCommandForConfigHubOci(row),
      followup: followupForConfigHubOci(row),
      receipt: row.receipt,
    }));
}

function allLiveComparisonReceiptRows() {
  const root = join(repoRoot, "runs", "live-helm-confighub-compare");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const receiptPath = join(root, entry.name, "receipt.yaml");
      if (!existsSync(receiptPath)) return null;
      const receipt = readYaml(receiptPath);
      const spec = receipt.spec ?? {};
      return {
        chart: spec.chart ?? "",
        version: spec.version ?? "",
        variant: spec.base ?? "",
        result: spec.result ?? "",
        reason: classifyLiveComparisonReason(spec),
        receipt: relativeRepo(receiptPath),
      };
    })
    .filter(Boolean);
}

function rerunCommandForConfigHubOci(row) {
  return `npm run live-parity:run -- --recipe recipes/${row.chart}/${row.version} --base ${row.variant}${repoUrlFlag(row)}${targetProfileFlag(row)}`;
}

function twoClusterRows() {
  const path = join(repoRoot, "data", "live-kind-parity", "summary.csv");
  if (!existsSync(path)) return [];
  const lifecycleObservations = lifecycleObservationIndex();
  return parseCsv(readFileSync(path, "utf8"))
    .filter((row) => ["blocked", "watch"].includes(row.result))
    .map((row) => {
      const lifecycle = lifecycleObservations.get(lifecycleKey(row));
      return {
        priority: priorityForTwoCluster(row),
        lane: "two-cluster-kind-parity",
        chart: row.chart,
        version: row.version,
        base: row.base,
        current_result: row.result,
        reason: row.reason || reasonForTwoCluster(row),
        diagnosis: diagnosisForTwoCluster(row, lifecycle),
        rerun_command: `npm run kind-parity:run -- --chart ${row.chart} --version ${row.version} --base ${row.base}${repoUrlFlag(row)}`,
        followup: followupForTwoCluster(row, lifecycle),
        receipt: row.receipt,
        related_lifecycle_result: lifecycle?.result ?? "",
        related_lifecycle_receipt: lifecycle?.receipt ?? "",
      };
    });
}

function lifecycleObservationIndex() {
  const path = join(repoRoot, "data", "lifecycle-observations", "cert-manager-eso", "summary.csv");
  if (!existsSync(path)) return new Map();
  return new Map(parseCsv(readFileSync(path, "utf8")).map((row) => [lifecycleKey(row), row]));
}

function lifecycleKey(row) {
  return `${row.chart}@${row.version}/${row.base}`;
}

function repoUrlFlag(row) {
  return repoUrlOverrideFor(row) ? ` --repo-url ${repoUrlOverrideFor(row)}` : "";
}

function repoUrlOverrideFor(row) {
  if (row.chart?.startsWith("bitnami/")) return bitnamiOciRepository;
  return "";
}

function targetProfileFlag(row) {
  if (minimumSchedulableNodes(row) >= 3) return " --target-profile kind-three-node";
  if (
    row.chart === "ingress-nginx/ingress-nginx" &&
    ["default", "admission-disabled"].includes(row.variant ?? row.base)
  ) {
    return " --target-profile kind-loadbalancer";
  }
  return "";
}

function minimumSchedulableNodes(row) {
  const topologyPath = join(repoRoot, "recipes", row.chart ?? "", row.version ?? "", "target-topology.yaml");
  if (!existsSync(topologyPath)) return 0;
  const topology = readYaml(topologyPath);
  const baseKey = variantKeyForTopology(row.variant ?? row.base);
  const bases = topology.spec?.bases ?? {};
  const direct = bases[baseKey]?.targetFit?.minimumSchedulableNodes;
  if (direct) return Number(direct);
  for (const value of Object.values(bases)) {
    if (value?.variant === (row.variant ?? row.base) && value?.targetFit?.minimumSchedulableNodes) {
      return Number(value.targetFit.minimumSchedulableNodes);
    }
  }
  return 0;
}

function variantKeyForTopology(value) {
  return String(value ?? "").replaceAll(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function classifyLiveComparisonReason(spec) {
  if (!["blocked", "watch"].includes(spec.result)) return "";
  const semantic = spec.semanticComparison ?? {};
  const semanticDiff = Object.values(semantic).some(
    (value) =>
      value &&
      typeof value === "object" &&
      (((value.semanticDiffs ?? []).length > 0) || ((value.missingFromConfigHub ?? []).length > 0)),
  );
  if (semanticDiff) return "parity: live semantic diff";

  if (spec.result === "watch") return classifyLiveComparisonWatch(spec);

  const message = String(spec.failure?.message ?? "").toLowerCase();
  if (message.includes("kind create cluster")) return "infra: kind create failed";
  if (message.includes("argocd-server")) return "infra: rig bootstrap (argocd) not ready";
  if (message.includes("please run this again with `sudo`") || message.includes("please run this again with sudo")) {
    return "infra: target profile requires sudo";
  }
  if (message.includes("target topology requires at least") || message.includes("schedulable node")) {
    return "target-fit: minimum schedulable nodes not met";
  }
  if (message.includes("timeout after")) return "infra: provisioning timeout";
  if (message.includes("etcdserver") || message.includes("request timed out")) return "infra: etcd/apiserver overload";
  const semanticPassed = Object.values(semantic).some(
    (value) => value && typeof value === "object" && value.result === "pass",
  );
  const regularHelm = spec.legs?.regularHelm ?? {};
  if (regularHelm.result === "blocked") {
    const regularMessage = String(`${regularHelm.stderr ?? ""}\n${regularHelm.getManifestError ?? ""}`).toLowerCase();
    if (regularMessage.includes("customresourcedefinition") && regularMessage.includes("cannot be imported")) {
      return "fixture: pre-existing CRDs owned by test controller";
    }
    if (
      regularMessage.includes("backupstoragelocation.velero.io") &&
      regularMessage.includes("volumesnapshotlocation.velero.io") &&
      regularMessage.includes("spec.provider") &&
      regularMessage.includes("spec.credential")
    ) {
      return "render-input: required Velero provider values missing";
    }
    if (regularMessage.includes("namespaces ") && regularMessage.includes(" not found")) {
      return semanticPassed ? "target-prerequisite: namespace missing (parity passed)" : "target-prerequisite: namespace missing";
    }
    return semanticPassed ? "helm-runtime: upstream not ready (parity passed)" : "helm-runtime: upstream leg blocked";
  }
  return "uncategorized";
}

function classifyLiveComparisonWatch(spec) {
  const text = JSON.stringify(spec).toLowerCase();
  if (text.includes("you must specify values for either") && text.includes("autodiscovery")) {
    return "render-input: required Helm values missing (parity passed)";
  }
  if (spec.chart === "hashicorp/vault") return "operate-policy: Vault init/unseal readiness (parity passed)";
  if (spec.chart === "ingress-nginx/ingress-nginx" && spec.base === "admission-disabled") {
    return "target-fit: LoadBalancer Service has no external IP on kind (parity passed)";
  }
  if (spec.chart === "grafana/tempo" && text.includes("pending")) return "target-runtime: PVC/storage pending (parity passed)";
  if (hasImagePullFailure(text)) {
    return "remote-image: image pull failed or pinned image is unavailable (parity passed)";
  }
  if (text.includes("createcontainerconfigerror") || text.includes("crashloopbackoff") ||
    text.includes("imagepullbackoff") || text.includes("errimagepull")) {
    return "target-runtime: pod config/runtime errors (parity passed)";
  }
  if (text.includes("containercreating")) return "target-runtime: pod ContainerCreating (parity passed)";
  if (text.includes("child argo application was not materialized")) {
    return "gitops-runtime: child Argo Application not materialized (parity passed)";
  }
  const gitops = spec.legs?.configHubOciArgo ?? {};
  if (gitops.sync && gitops.sync !== "Synced") {
    return `gitops-runtime: Argo sync ${gitops.sync} health ${gitops.health || "unknown"} (parity passed)`;
  }
  if (gitops.sync === "Synced" && gitops.health && gitops.health !== "Healthy") {
    return `gitops-runtime: Argo health ${gitops.health} (parity passed)`;
  }
  return "watch: inspect receipt";
}

function hasImagePullFailure(text) {
  return text.includes("imagepullbackoff") || text.includes("errimagepull") || text.includes("failed to pull image");
}

function priorityForConfigHubOci(row) {
  if (row.reason?.startsWith("infra:")) return 10;
  if (row.reason?.startsWith("helm-runtime:")) return 20;
  if (row.result === "watch") return 30;
  return 40;
}

function priorityForTwoCluster(row) {
  if (row.reason?.startsWith("parity:")) return 45;
  if (row.reason?.startsWith("target-prerequisite:")) return 50;
  if (row.reason?.startsWith("helm-hook:")) return 55;
  if (row.reason?.startsWith("target-runtime:") || row.reason?.startsWith("helm-runtime:")) return 60;
  if (row.result === "blocked") return 50;
  if (row.result === "watch") return 60;
  return 70;
}

function diagnosisForConfigHubOci(row) {
  if (row.reason?.startsWith("infra:")) {
    if (row.reason === "infra: target profile requires sudo") {
      return "The selected target profile needs host-level network privileges before it can provide LoadBalancer behavior.";
    }
    return "Rerun on a clean host with serial execution and authoritative cluster/container cleanup.";
  }
  if (row.reason?.startsWith("helm-runtime:")) {
    return "Semantic parity already passed; rerun with right-sized Helm readiness waits or classify as watch if upstream Helm stays pending.";
  }
  if (row.reason?.startsWith("target-fit:")) {
    return targetTopologyDiagnosis(row) ?? "Semantic parity passed, but the proof target lacks a platform behavior required by this base.";
  }
  if (row.reason?.startsWith("remote-image:")) {
    return "Semantic parity passed, but at least one rendered image could not be pulled on the target. This is an image retention, registry, or image override problem, not a ConfigHub object-model defect.";
  }
  if (row.reason?.startsWith("render-input:")) {
    return "Semantic object parity passed, but the selected base did not render a functional workload because required Helm values were not modeled.";
  }
  if (row.reason?.startsWith("gitops-runtime:")) {
    return "Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review.";
  }
  if (row.result === "watch") {
    return "Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior.";
  }
  return "Inspect receipt before rerun.";
}

function targetTopologyDiagnosis(row) {
  const topologyPath = join(repoRoot, "recipes", row.chart ?? "", row.version ?? "", "target-topology.yaml");
  if (!existsSync(topologyPath)) return "";
  const topology = readYaml(topologyPath);
  const baseKey = variantKeyForTopology(row.variant ?? row.base);
  const base = topology.spec?.bases?.[baseKey] ?? Object.values(topology.spec?.bases ?? {})
    .find((value) => value?.variant === (row.variant ?? row.base));
  const fit = base?.targetFit;
  if (!fit) return "";
  const requirements = [];
  if (fit.minimumSchedulableNodes) requirements.push(`${fit.minimumSchedulableNodes} schedulable nodes`);
  if (fit.requiresPersistentStorage) requirements.push("persistent storage");
  if (fit.requiresIngressController) requirements.push("ingress controller");
  if (fit.requiresGatewayPolicyReview) requirements.push("gateway policy review");
  const prefix = requirements.length > 0
    ? `The base declares target-fit requirements: ${requirements.join(", ")}.`
    : "The base declares target-fit requirements.";
  return fit.reason ? `${prefix} ${capitalizeSentence(fit.reason)}` : prefix;
}

function capitalizeSentence(value) {
  const text = String(value ?? "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
}

function followupForConfigHubOci(row) {
  if (row.reason === "infra: target profile requires sudo") {
    return "Run the LoadBalancer target profile with the required host privilege, or use a non-LoadBalancer proof target for this base.";
  }
  if (row.reason?.startsWith("infra:")) return "If it still blocks, fix rig provisioning before judging chart parity.";
  if (row.reason?.startsWith("helm-runtime:")) return "If object comparison remains clean, record this as upstream runtime readiness rather than a ConfigHub parity defect.";
  if (row.reason?.startsWith("target-fit:")) return "Use a target with the required platform behavior, or create a separate base that matches the proof target.";
  if (row.reason?.startsWith("remote-image:")) return "Resolve the image reference by digest, override to a pullable image, or refresh the catalog base before rerunning.";
  if (row.reason?.startsWith("render-input:")) return "Create a non-alias base with the required Helm values, then rerun render, ConfigHub proof, and live parity.";
  if (row.reason?.startsWith("gitops-runtime:")) return "Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing.";
  if (row.result === "watch") return "Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation.";
  return "Open a dedicated parity issue only if the semantic object comparison fails.";
}

function reasonForTwoCluster(row) {
  if (row.result === "watch") return "object parity passed but readiness needs review";
  return "strict parity row blocked; inspect receipt";
}

function diagnosisForTwoCluster(row, lifecycle) {
  if (isMetricsServerExternalTlsCa(row)) {
    return "Object parity passed, but the current rendered APIService caBundle is a placeholder. Generate target TLS material first, inject the matching CA as a pre-render value, then render both legs and stage the matching Secret before rerun.";
  }
  if (lifecycle?.result === "pass" && row.reason?.startsWith("helm-hook:")) {
    return `Object parity passed. Helm hook execution blocked the regular Helm leg, while the related lifecycle observation passed: ${lifecycle.receipt}.`;
  }
  if (lifecycle?.result === "pass" && row.reason?.startsWith("target-prerequisite:")) {
    return `Object parity passed. This base needs external prerequisites; the related lifecycle observation passed with those prerequisites staged: ${lifecycle.receipt}.`;
  }
  if (row.reason?.startsWith("parity:")) {
    return "Semantic object comparison did not pass. Inspect the diff before changing waits or target provisioning.";
  }
  if (row.reason?.startsWith("target-prerequisite:")) {
    return "The target is missing required API types or prerequisites. Stage them, then rerun the same base.";
  }
  if (row.reason?.startsWith("helm-hook:")) {
    return "This is Helm lifecycle behavior. Decide whether the hook maps to desired config, a lifecycle operation, or an observation check.";
  }
  if (row.reason?.startsWith("operate-policy:")) {
    return "Object parity passed; the remaining condition is a post-render operating procedure, not a recipe drift.";
  }
  if (row.reason?.startsWith("target-fit:")) {
    return "Object parity passed; the selected proof target does not provide the platform shape required by this base.";
  }
  if (row.reason?.startsWith("render-input:")) {
    return "Object parity passed, but the selected base did not render a functional workload because required Helm values were missing. Choose or create a values-profile base before rerunning.";
  }
  if (row.reason?.startsWith("target-runtime:") || row.reason?.startsWith("helm-runtime:")) {
    return "Object parity passed; rerun only after target resources, storage, and readiness waits are appropriate.";
  }
  if (row.result === "watch") {
    return "Rerun once on a clean pair of vanilla kind clusters; if object parity remains clean, decide whether readiness should stay watch.";
  }
  return "Rerun the same chart/base with two clean vanilla kind clusters before changing the recipe.";
}

function followupForTwoCluster(row, lifecycle) {
  if (row.reason?.startsWith("parity:")) return "Open a parity issue only if the diff is not an intentional, documented normalization.";
  if (isMetricsServerExternalTlsCa(row)) return "Do not rerun the existing placeholder render as-is; use the target-prerequisite plan to bind caBundle and metrics-server-tls from the same generated or supplied CA.";
  if (lifecycle?.result === "pass" && row.reason?.startsWith("helm-hook:")) return "Keep this as lifecycle-routed evidence unless the product decision is to emulate the Helm hook directly.";
  if (lifecycle?.result === "pass" && row.reason?.startsWith("target-prerequisite:")) return "Record the external prerequisite in the base variant and use the lifecycle receipt when explaining target readiness.";
  if (row.reason?.startsWith("target-prerequisite:")) return "Record the prerequisite in the chart facts, base variant, or install checks before promoting.";
  if (row.reason?.startsWith("helm-hook:")) return "Keep desired object parity separate from hook execution and document the lifecycle route.";
  if (row.reason?.startsWith("operate-policy:")) return "Record the operating procedure and a receipt for it; rerun strict parity only if the expected readiness contract changes.";
  if (row.reason?.startsWith("target-fit:")) return "Use a target that satisfies the base, or add a separate base for the smaller proof target.";
  if (row.reason?.startsWith("render-input:")) {
    return "Use a values-profile rerender base such as the reviewed controller base, or model the missing values in a new base before rerunning strict parity.";
  }
  if (row.reason?.startsWith("target-runtime:") || row.reason?.startsWith("helm-runtime:")) {
    return "Keep the recipe stable unless the rendered object comparison starts failing.";
  }
  if (row.result === "watch") return "Do not change chart artifacts unless semantic parity or object readiness shows a real difference.";
  return "If blocked again, classify as recipe issue, target-fact/prerequisite issue, or chart runtime issue from the receipt.";
}

function isMetricsServerExternalTlsCa(row) {
  return row.chart === "metrics-server/metrics-server" && row.base === "external-tls-ca";
}

function nextStepType(row) {
  const reason = row.reason ?? "";
  if (reason.startsWith("parity:")) return "inspect-parity-diff";
  if (reason.startsWith("infra:")) return "clean-rerun";
  if (reason.startsWith("target-prerequisite:")) return "stage-prerequisite";
  if (reason.startsWith("helm-hook:")) return "lifecycle-route";
  if (reason.startsWith("operate-policy:")) return "operating-policy";
  if (reason.startsWith("render-input:")) return "render-input-model";
  if (reason.startsWith("remote-image:")) return "image-retention-review";
  if (reason.startsWith("target-fit:")) return "target-fit-review";
  if (reason.startsWith("gitops-runtime:")) return "gitops-runtime-review";
  if (reason.startsWith("target-runtime:") || reason.startsWith("helm-runtime:")) return "runtime-review";
  if (row.current_result === "watch") return "runtime-review";
  return "inspect-receipt";
}

function supportArtifactFor(row) {
  const recipePath = join("recipes", row.chart ?? "", row.version ?? "");
  const reason = row.reason ?? "";
  const candidates = [];
  if (reason.startsWith("infra:")) return "data/live-helm-confighub-compare/blocked-triage.md";
  if (reason.startsWith("target-prerequisite:")) candidates.push("target-prerequisite-plan.yaml");
  if (reason.startsWith("render-input:")) candidates.push("value-model.yaml", "helm-plan.yaml");
  if (reason.startsWith("remote-image:")) return "data/image-digest-workdown/summary.md";
  if (reason.startsWith("helm-hook:")) candidates.push("lifecycle-policy.yaml");
  if (reason.startsWith("operate-policy:")) candidates.push("operating-policy.yaml");
  if (reason.startsWith("target-fit:")) candidates.push("target-topology.yaml", "operating-policy.yaml");
  if (reason.startsWith("gitops-runtime:")) candidates.push("gitops-runtime-review.yaml");
  if (reason.startsWith("target-runtime:") || reason.startsWith("helm-runtime:")) {
    candidates.push("runtime-review.yaml", "target-prerequisite-plan.yaml", "target-topology.yaml", "operating-policy.yaml");
  }
  for (const candidate of candidates) {
    const absolutePath = join(repoRoot, recipePath, candidate);
    if (existsSync(absolutePath)) return `${recipePath}/${candidate}`;
  }
  return "";
}

function usefulBaseResolution(row) {
  if (!row.reason?.startsWith("render-input:")) return {};
  const recipePath = join(repoRoot, "recipes", row.chart ?? "", row.version ?? "");
  const valueModelPath = join(recipePath, "value-model.yaml");
  if (!existsSync(valueModelPath)) return {};
  const valueModel = readYaml(valueModelPath);
  const candidates = [
    ...new Set((valueModel.spec?.checkedValues ?? [])
      .filter((entry) => entry.variant && entry.variant !== row.base)
      .filter((entry) => entry.disposition === "required-render-input-modeled")
      .map((entry) => entry.variant)),
  ];
  for (const variant of candidates) {
    const receipt = passReceiptForVariant(row, variant);
    if (receipt) {
      return {
        resolved_by_base: variant,
        resolved_by_receipt: receipt,
        resolved_by_reason: "required render inputs are modeled in a useful values-profile base with passing live evidence",
      };
    }
  }
  return {};
}

function passReceiptForVariant(row, variant) {
  const chartSlug = slug(row.chart);
  const candidates = [
    join("runs", "live-helm-confighub-compare", `${chartSlug}-${variant}`, "receipt.yaml"),
    join("runs", "live-kind-parity", `${chartSlug}-${variant}`, "receipt.yaml"),
  ];
  for (const candidate of candidates) {
    const absolutePath = join(repoRoot, candidate);
    if (!existsSync(absolutePath)) continue;
    const receipt = readYaml(absolutePath);
    if (receipt.spec?.result === "pass") return candidate;
  }
  return "";
}

function usefulBaseResolved(row) {
  return Boolean(row.resolved_by_base && row.resolved_by_receipt);
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function lifecycleRouted(row) {
  return row.related_lifecycle_result === "pass"
    && (row.reason?.startsWith("helm-hook:") || row.reason?.startsWith("target-prerequisite:"));
}

function nextStepDescription(type) {
  return {
    "inspect-parity-diff": "Inspect the object diff before changing waits, target provisioning, or the recipe.",
    "clean-rerun": "Rerun once on a clean host with serial execution and authoritative cleanup.",
    "stage-prerequisite": "Stage or model CRDs, APIs, Secrets, storage, or another prerequisite before rerunning.",
    "lifecycle-route": "Choose the lifecycle route or observation contract before rerunning strict parity.",
    "operating-policy": "Record the operating policy decision, then rerun only if the expected readiness changes.",
    "render-input-model": "Model the required Helm values as a real base before rerunning.",
    "image-retention-review": "Resolve missing or mutable images by digest, override, or catalog refresh before rerunning.",
    "target-fit-review": "Choose a target that provides the required platform behavior, or create a base that fits the target.",
    "gitops-runtime-review": "Inspect GitOps/controller health; rerun after target conditions or controller waits are corrected.",
    "runtime-review": "Inspect runtime readiness, waits, storage, capacity, or app initialization before rerunning.",
    "inspect-receipt": "Read the receipt and classify the row before rerunning.",
  }[type] ?? "Read the receipt and classify the row before rerunning.";
}

function rerunReadiness(type) {
  return {
    "inspect-parity-diff": "inspect-diff-first",
    "clean-rerun": "rerun-now-after-cleanup",
    "stage-prerequisite": "model-or-stage-first",
    "lifecycle-route": "model-or-stage-first",
    "operating-policy": "model-or-stage-first",
    "render-input-model": "model-or-stage-first",
    "image-retention-review": "model-or-stage-first",
    "target-fit-review": "model-or-stage-first",
    "gitops-runtime-review": "review-target-first",
    "runtime-review": "review-target-first",
    "inspect-receipt": "inspect-receipt-first",
  }[type] ?? "inspect-receipt-first";
}

function rerunReadinessDescription(type) {
  return {
    "inspect-diff-first": "Do not rerun until the semantic diff has been inspected.",
    "rerun-now-after-cleanup": "Rerun serially on a clean host after confirming no other live lane is running.",
    "model-or-stage-first": "Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning.",
    "review-target-first": "Review runtime, storage, controller health, or wait conditions before rerunning.",
    "inspect-receipt-first": "Read the receipt and classify the row before rerunning.",
  }[type] ?? "Read the receipt and classify the row before rerunning.";
}

function markdown(rows, lifecycleRoutedRows = [], usefulBaseResolvedRows = []) {
  const counts = countBy(rows, "lane");
  const resultCounts = countBy(rows, "current_result");
  const laneResults = countByLaneAndResult(rows);
  const nextStepCounts = countBy(rows, "next_step_type");
  const readinessCounts = countBy(rows, "rerun_readiness");
  const lifecycleRows = [
    ...rows.filter((row) => row.related_lifecycle_receipt),
    ...lifecycleRoutedRows,
  ];
  const semanticDefects = rows.filter((row) => row.reason?.startsWith("parity:")).length;
  const infraRows = rows.filter((row) => row.reason?.startsWith("infra:")).length;
  const prerequisiteRows = rows.filter((row) => row.reason?.startsWith("target-prerequisite:") || row.reason?.startsWith("helm-hook:")).length;
  const runtimeRows = rows.filter((row) =>
    ["runtime-review", "gitops-runtime-review"].includes(row.next_step_type)
  ).length;
  return `# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

\`\`\`text
rows: ${rows.length}
lifecycle-routed-not-active-rerun: ${lifecycleRoutedRows.length}
useful-base-resolved-not-active-rerun: ${usefulBaseResolvedRows.length}
blocked: ${resultCounts.blocked ?? 0}
watch: ${resultCounts.watch ?? 0}
configHub-oci-live-comparison: ${counts["configHub-oci-live-comparison"] ?? 0}
two-cluster-kind-parity: ${counts["two-cluster-kind-parity"] ?? 0}
semantic-parity-defects: ${semanticDefects}
infra-or-rig-rows: ${infraRows}
prerequisite-or-lifecycle-rows: ${prerequisiteRows}
runtime-or-watch-rows: ${runtimeRows}
\`\`\`

${currentInterpretationMarkdown(rows, semanticDefects, usefulBaseResolvedRows)}

## Lane Breakdown

| Lane | Rows | Pass | Watch | Blocked | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
${["configHub-oci-live-comparison", "two-cluster-kind-parity"].map((lane) => {
  const row = laneResults[lane] ?? {};
  return `| ${lane} | ${counts[lane] ?? 0} | ${row.pass ?? 0} | ${row.watch ?? 0} | ${row.blocked ?? 0} | ${row.fail ?? 0} |`;
}).join("\n")}

Rows in this queue are non-pass live parity rows that need a decision before
the next claim can be made. A \`watch\` row usually means object parity passed
and runtime/controller health needs review. A \`blocked\` row can come from
either lane and may be infrastructure, prerequisite, lifecycle, target-fit, or
upstream-runtime work. Only \`parity:\` rows indicate an object-set defect.

## Recommended Order

1. Inspect any \`parity:\` rows first. Those are the only rows that currently
   point at an object-set difference.
2. Re-run any \`infra:\` rows on a clean host, one at a time.
3. Resolve \`target-prerequisite:\`, \`target-fit:\`, and \`helm-hook:\` rows by
   staging the prerequisite, choosing a suitable target, or choosing the
   lifecycle route before rerunning.
4. Review \`target-runtime:\`, \`helm-runtime:\`, and \`watch\` rows last. They
   usually mean object parity passed and the target needs a readiness, storage,
   capacity, or operating-policy decision.

## Next Step Buckets

| Next step | Rows | What to do |
| --- | ---: | --- |
${Object.entries(nextStepCounts).sort((left, right) => left[0].localeCompare(right[0])).map(([type, count]) => `| ${type} | ${count} | ${nextStepDescription(type)} |`).join("\n")}

Rows in \`stage-prerequisite\`, \`lifecycle-route\`, and \`operating-policy\`
usually need a model or target decision before another rerun is useful. Rows in
\`runtime-review\` and \`gitops-runtime-review\` are good rerun candidates only
after the receipt explains what readiness, storage, controller, or wait
condition changed.

## Rerun Readiness

This table separates rows that need modeling or target work from rows that are
reasonable live rerun candidates.

| Readiness | Rows | Meaning |
| --- | ---: | --- |
${Object.entries(readinessCounts).sort((left, right) => left[0].localeCompare(right[0])).map(([type, count]) => `| ${type} | ${count} | ${rerunReadinessDescription(type)} |`).join("\n")}

${usefulBaseResolvedRows.length ? `## Resolved By Useful Base

These rows are no longer active rerun work. The raw base still has a non-pass
receipt, but a separate useful base models the required render inputs and has a
passing live receipt. The product answer is to use or promote the useful base,
not to keep rerunning a known missing-values render.

| Chart | Raw base | Useful base | Receipt | Reason |
| --- | --- | --- | --- | --- |
${usefulBaseResolvedRows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.resolved_by_base} | [receipt](../../${row.resolved_by_receipt}) | ${row.resolved_by_reason} |`).join("\n")}
` : ""}

## Run Safety

Run live parity reruns serially. Do not run two live parity commands at the
same time from different terminals or agents. The live harness creates and
prunes parity-owned kind clusters and related local resources; concurrent runs
can delete each other's in-flight cluster and produce a false infrastructure
failure.

If several rows need reruns, run one command, let it finish, inspect the
receipt, regenerate the relevant summary, then move to the next row.

## Repository Overrides

Some pinned public chart versions remain available from OCI even when the classic
Helm repository index no longer exposes them. The generated commands include an
explicit \`--repo-url\` override for those rows. This keeps the rerun command
faithful to the locked chart/version without changing the recipe.

## Rerun Queue

| Priority | Readiness | Next step | Lane | Chart | Base | Current | Reason | Support artifact | Command |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.priority} | ${row.rerun_readiness} | ${row.next_step_type} | ${row.lane} | \`${row.chart}@${row.version}\` | ${row.base} | ${row.current_result} | ${row.reason} | ${row.support_artifact ? `[\`${row.support_artifact}\`](../../${row.support_artifact})` : "-"} | \`${row.rerun_command}\` |`).join("\n")}

${lifecycleRows.length ? `## Related Lifecycle Evidence

These rows have a separate lifecycle receipt for hook, CRD, webhook, or
controller-owned behavior. Rows with a passing lifecycle receipt are not active
rerun work unless the lifecycle decision changes.

| Chart | Base | Rerun result | Lifecycle result | Lifecycle receipt |
| --- | --- | --- | --- | --- |
${lifecycleRows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.current_result} | ${row.related_lifecycle_result} | ${row.related_lifecycle_receipt} |`).join("\n")}
` : ""}

The machine-readable queue is:

\`\`\`text
data/live-parity-rerun-plan/rerun-plan.csv
\`\`\`
`;
}

function currentInterpretationMarkdown(rows, semanticDefects, usefulBaseResolvedRows = []) {
  if (rows.length === 0) {
    const resolvedSentence = usefulBaseResolvedRows.length > 0
      ? ` ${usefulBaseResolvedRows.length} row(s) have been moved out of active rerun work because a useful base with passing live evidence exists.`
      : "";
    return `## Current Interpretation

The current committed live parity rerun queue is empty. That means the selected
live lanes have no outstanding non-pass rows in the generated queue.${resolvedSentence} It does
not mean every possible chart, values file, target, or delivery path has been
tested.
`;
  }
  const defectSentence = semanticDefects === 0
    ? "No current row says ConfigHub and Helm produced different Kubernetes object meaning."
    : `${semanticDefects} row(s) currently point at an object-set parity defect; inspect those first.`;
  const resolvedSentence = usefulBaseResolvedRows.length > 0
    ? ` ${usefulBaseResolvedRows.length} row(s) are documented below as resolved by a separate useful base and are no longer active rerun work.`
    : "";
  return `## Current Interpretation

${defectSentence} The rows below are the active work queue for stronger live
claims.${resolvedSentence}

| Chart | Base | Current | Meaning | Next action |
| --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${mdCell(`${row.chart}@${row.version}`)}\` | ${mdCell(row.base)} | ${mdCell(row.current_result)} | ${mdCell(row.diagnosis)} | ${mdCell(row.followup)} |`).join("\n")}
`;
}

function mdCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function countBy(rows, key) {
  const result = {};
  for (const row of rows) result[row[key]] = (result[row[key]] ?? 0) + 1;
  return result;
}

function countByLaneAndResult(rows) {
  const result = {};
  for (const row of rows) {
    result[row.lane] ??= {};
    result[row.lane][row.current_result] = (result[row.lane][row.current_result] ?? 0) + 1;
  }
  return result;
}

function parseCsv(text) {
  const rows = [];
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  if (!headerLine) return rows;
  const headers = parseCsvLine(headerLine);
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function toCsv(rows) {
  const headers = [
    "priority",
    "lane",
    "chart",
    "version",
    "base",
    "current_result",
    "reason",
    "next_step_type",
    "rerun_readiness",
    "diagnosis",
    "rerun_command",
    "followup",
    "support_artifact",
    "receipt",
    "related_lifecycle_result",
    "related_lifecycle_receipt",
  ];
  if (rows.length === 0) return `${headers.join(",")}\n`;
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
