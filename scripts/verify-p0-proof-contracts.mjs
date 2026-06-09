import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { readYaml, repoRoot, sha256, sha256File } from "./lib/proof-common.mjs";

const requiredSchemas = [
  "common-defs.schema.json",
  "helm-plan.schema.json",
  "effective-values.schema.json",
  "capability-profile.schema.json",
  "generated-fact-receipt.schema.json",
  "observation-receipt.schema.json",
  "upgrade-rollback-receipt.schema.json",
  "variant-revision.schema.json",
  "render-receipt.schema.json",
  "helm-equivalence-receipt.schema.json",
  "scan-receipt.schema.json",
  "install-gate.schema.json",
];

const p0Issues = ["#4", "#5", "#6", "#7", "#24", "#25", "#27", "#28", "#29", "#30"];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function repoPath(...parts) {
  return join(repoRoot, ...parts);
}

function rel(path) {
  return relative(repoRoot, path).replaceAll("\\", "/");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function walk(root, predicate = () => true, result = []) {
  if (!existsSync(root)) return result;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) walk(fullPath, predicate, result);
    else if (predicate(fullPath)) result.push(fullPath);
  }
  return result.sort();
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function canonicalText(value) {
  return JSON.stringify(canonical(value));
}

function capabilityDigest(profile) {
  const { digest, ...digestInput } = profile;
  return `sha256:${sha256(canonicalText(digestInput))}`;
}

function verifySchemas() {
  for (const schemaFile of requiredSchemas) {
    const schemaPath = repoPath("schemas", schemaFile);
    check(existsSync(schemaPath), `missing schema: ${rel(schemaPath)}`);
    const schema = readJson(schemaPath);
    check(schema.$schema, `${rel(schemaPath)} missing $schema`);
    check(schema.title, `${rel(schemaPath)} missing title`);
    check(schema.type === "object", `${rel(schemaPath)} must describe an object`);
    if (schemaFile !== "common-defs.schema.json") {
      check(Array.isArray(schema.required), `${rel(schemaPath)} missing required array`);
      for (const field of ["apiVersion", "kind", "spec"]) {
        check(schema.required.includes(field), `${rel(schemaPath)} must require ${field}`);
      }
    }
  }
}

function verifyArtifactKind(path, expectedKinds) {
  const doc = readYaml(path);
  const expected = Array.isArray(expectedKinds) ? expectedKinds : [expectedKinds];
  check(doc.apiVersion === "helm-expt.confighub.com/v1alpha1", `${rel(path)} apiVersion mismatch`);
  check(expected.includes(doc.kind), `${rel(path)} kind ${doc.kind} not in ${expected.join(", ")}`);
  check(doc.metadata?.name, `${rel(path)} missing metadata.name`);
  check(doc.spec, `${rel(path)} missing spec`);
  return doc;
}

function verifyCapabilityProfiles() {
  const catalogPath = repoPath("data", "capability-profiles", "catalog.yaml");
  check(existsSync(catalogPath), `missing capability profile catalog: ${rel(catalogPath)}`);
  const catalog = readYaml(catalogPath);
  check(catalog.kind === "CapabilityProfileCatalog", "capability catalog kind must be CapabilityProfileCatalog");
  const profiles = catalog.spec?.profiles ?? [];
  check(profiles.length >= 4, "capability catalog must contain at least four bounded profiles");
  const names = new Set();
  for (const profile of profiles) {
    check(profile.name, "capability profile missing name");
    check(!names.has(profile.name), `duplicate capability profile: ${profile.name}`);
    names.add(profile.name);
    check(profile.kubeVersion, `${profile.name} missing kubeVersion`);
    check(Array.isArray(profile.apiVersions), `${profile.name} missing apiVersions`);
    check(profile.apiVersions.length > 0, `${profile.name} has no apiVersions`);
    const expected = capabilityDigest(profile);
    check(profile.digest === expected, `${profile.name} digest mismatch: expected ${expected}, got ${profile.digest}`);
  }
  for (const required of ["k8s-1.30-default", "k8s-1.30-monitoring-operator", "k8s-1.30-gateway-api"]) {
    check(names.has(required), `missing required capability profile: ${required}`);
  }
}

function capabilityProfilesByName() {
  const catalog = readYaml(repoPath("data", "capability-profiles", "catalog.yaml"));
  return new Map((catalog.spec?.profiles ?? []).map((profile) => [profile.name, profile]));
}

function verifyDocs() {
  const freshnessPath = repoPath("docs", "reference", "observation-freshness-slo.md");
  const p0Path = repoPath("docs", "planning", "archive", "p0-major-issue-status.md");
  const issueBacklogPath = repoPath("docs", "planning", "issue-backlog.md");
  const capabilityPath = repoPath("docs", "reference", "capability-profile-catalog.md");
  const generatedFactPath = repoPath("docs", "reference", "generated-fact-receipts.md");
  const upgradePath = repoPath("docs", "reference", "upgrade-rollback-receipts.md");
  check(existsSync(freshnessPath), "missing observation freshness SLO doc");
  check(existsSync(p0Path), "missing archived P0 major issue status doc");
  check(existsSync(issueBacklogPath), "missing issue backlog doc");
  check(existsSync(capabilityPath), "missing capability profile catalog doc");
  check(existsSync(generatedFactPath), "missing generated fact receipt doc");
  check(existsSync(upgradePath), "missing upgrade/rollback receipt doc");
  const freshness = readFileSync(freshnessPath, "utf8");
  for (const phrase of ["fresh", "stale", "failed", "unknown", "not-observed", "drifted", "observedAt", "freshnessTTL", "payload digest"]) {
    check(freshness.includes(phrase), `freshness SLO missing ${phrase}`);
  }
  const capabilityDoc = readFileSync(capabilityPath, "utf8").toLowerCase();
  for (const phrase of ["synthetic profiles", "bulk", "adversarial", "unknown profile", "stored digest"]) {
    check(capabilityDoc.includes(phrase), `capability profile doc missing ${phrase}`);
  }
  const p0Status = `${readFileSync(p0Path, "utf8")}\n${readFileSync(issueBacklogPath, "utf8")}`;
  for (const issue of p0Issues) {
    check(p0Status.includes(issue), `P0 status doc missing ${issue}`);
  }
}

function verifyCorpusContracts() {
  const helmPlans = walk(repoPath("recipes"), (path) => path.endsWith("/helm-plan.yaml"));
  const valueModels = walk(repoPath("recipes"), (path) => path.endsWith("/value-model.yaml"));
  const effectiveValues = walk(repoPath("recipes"), (path) => /\/effective-values.*\.yaml$/.test(path));
  const renderReceipts = walk(repoPath("recipes"), (path) => path.endsWith("/receipts/render-receipt.yaml"));
  const helmEquivalenceReceipts = walk(repoPath("recipes"), (path) => path.endsWith("/receipts/helm-equivalence-receipt.yaml"));
  const scanReceipts = walk(repoPath("recipes"), (path) => path.endsWith("/receipts/scan-receipt.yaml"));
  const installGates = walk(repoPath("recipes"), (path) => path.endsWith("/receipts/install-gate.yaml"));
  const variantRevisions = walk(repoPath("recipes"), (path) => path.endsWith("/variant-revision.yaml"));
  const generatedFactReceipts = walk(repoPath("recipes"), (path) => path.endsWith("/receipts/generated-fact-receipt.yaml"));
  const upgradeRollbackReceipts = walk(repoPath("recipes"), (path) =>
    path.endsWith("/upgrade-simulation-receipt.yaml") || path.endsWith("/rollback-simulation-receipt.yaml"),
  );
  const liveReceipts = walk(repoPath("runs"), (path) => /observation-receipt\.(yaml|json)$/.test(path));
  const catalogStatuses = walk(repoPath("recipes"), (path) => path.endsWith("/catalog-status.yaml"));
  const supportedCatalogCharts = catalogStatuses
    .map((path) => ({ path, root: dirname(path), status: readYaml(path) }))
    .filter((item) => item.status.spec?.status === "catalog-supported");

  check(helmPlans.length >= 100, `expected at least 100 HelmPlan artifacts, found ${helmPlans.length}`);
  check(valueModels.length >= 100, `expected at least 100 value models, found ${valueModels.length}`);
  check(effectiveValues.length >= 100, `expected at least 100 effective-values artifacts, found ${effectiveValues.length}`);
  check(renderReceipts.length >= 120, `expected at least 120 render receipts, found ${renderReceipts.length}`);
  check(helmEquivalenceReceipts.length >= 120, `expected at least 120 Helm equivalence receipts, found ${helmEquivalenceReceipts.length}`);
  check(scanReceipts.length >= 120, `expected at least 120 scan receipts, found ${scanReceipts.length}`);
  check(installGates.length >= 120, `expected at least 120 install gates, found ${installGates.length}`);
  check(liveReceipts.length >= 20, `expected at least 20 live observation receipts, found ${liveReceipts.length}`);
  check(generatedFactReceipts.length >= 1, "expected at least one generated fact receipt");
  check(upgradeRollbackReceipts.length >= 2, "expected Redis upgrade and rollback simulation receipts");
  check(supportedCatalogCharts.length === 20, `expected 20 catalog-supported charts, found ${supportedCatalogCharts.length}`);

  for (const path of helmPlans) verifyArtifactKind(path, "HelmPlan");
  for (const path of effectiveValues) verifyArtifactKind(path, "EffectiveValues");
  for (const path of variantRevisions) verifyArtifactKind(path, "VariantRevision");
  for (const path of renderReceipts) verifyArtifactKind(path, "RenderReceipt");
  for (const path of helmEquivalenceReceipts) verifyArtifactKind(path, "HelmEquivalenceReceipt");
  for (const path of scanReceipts) verifyArtifactKind(path, "ScanReceipt");
  for (const path of installGates) verifyArtifactKind(path, "InstallGate");
  for (const path of generatedFactReceipts) verifyArtifactKind(path, "GeneratedFactReceipt");
  for (const path of upgradeRollbackReceipts) verifyArtifactKind(path, ["UpgradeSimulationReceipt", "RollbackSimulationReceipt"]);
  for (const path of liveReceipts) verifyArtifactKind(path, "ObservationReceipt");

  for (const item of supportedCatalogCharts) {
    const reportPath = join(item.root, "helm-pain-report.yaml");
    check(existsSync(reportPath), `${rel(reportPath)} missing Helm pain report`);
    const report = verifyArtifactKind(reportPath, "HelmPainReport");
    check(report.spec?.chart?.name === item.status.spec?.chart, `${rel(reportPath)} chart name does not match catalog status`);
    check(String(report.spec?.chart?.version) === String(item.status.spec?.version), `${rel(reportPath)} chart version does not match catalog status`);
    check(
      [
        "no-unhandled-pain-points-for-supported-scopes",
        "has-strict-live-witness-blockers-for-supported-scopes",
      ].includes(report.spec?.supportedScopeStatus),
      `${rel(reportPath)} must state supported scope pain status`,
    );
    for (const variant of item.status.spec?.supportedVariants ?? []) {
      check((report.spec?.supportedVariants ?? []).includes(variant), `${rel(reportPath)} missing supported variant ${variant}`);
    }
    const reportPainPoints = report.spec?.painPoints ?? [];
    check(reportPainPoints.length > 0, `${rel(reportPath)} must enumerate Helm pain points`);
    check(report.spec?.answerForSkepticalHelmUser, `${rel(reportPath)} missing skeptical Helm user answer`);
    const painPointIds = new Set();
    for (const point of reportPainPoints) {
      check(point.id, `${rel(reportPath)} has pain point without id`);
      check(!painPointIds.has(point.id), `${rel(reportPath)} has duplicate pain point id ${point.id}`);
      painPointIds.add(point.id);
      for (const field of ["detectedPainPoint", "configHubHome", "disposition", "linkedReceipt"]) {
        check(point[field], `${rel(reportPath)} pain point ${point.id} missing ${field}`);
      }
      check(
        existsSync(join(item.root, point.linkedReceipt)) || existsSync(repoPath(point.linkedReceipt)),
        `${rel(reportPath)} pain point ${point.id} links missing artifact ${point.linkedReceipt}`,
      );
    }
  }

  const profiles = capabilityProfilesByName();
  for (const path of renderReceipts) {
    const receipt = readYaml(path);
    const ref = receipt.spec?.inputs?.capabilityProfileRef;
    if (!ref) continue;
    const profileName = ref.split("#")[1];
    const profile = profiles.get(profileName);
    check(profile, `${rel(path)} references unknown capability profile ${profileName}`);
    check(receipt.spec?.inputs?.capabilityProfileSHA256 === profile.digest, `${rel(path)} capability profile digest mismatch`);
  }

  for (const path of liveReceipts) {
    const receipt = readYaml(path);
    check(receipt.spec?.observer?.name, `${rel(path)} missing observer.name`);
    check(receipt.spec?.observer?.method, `${rel(path)} missing observer.method`);
    check(receipt.spec?.target?.kind, `${rel(path)} missing target.kind`);
    check(receipt.spec?.target?.name, `${rel(path)} missing target.name`);
    check(receipt.spec?.observedAt, `${rel(path)} missing observedAt`);
    check(receipt.spec?.freshnessTTL, `${rel(path)} missing freshnessTTL`);
    check(receipt.spec?.result, `${rel(path)} missing result`);
    check(receipt.spec?.renderedObjectSetSHA256, `${rel(path)} missing renderedObjectSetSHA256`);
    const checks = receipt.spec?.checks ?? [];
    check(checks.length > 0, `${rel(path)} missing checks`);
    const hasPayloadDigest =
      Boolean(receipt.spec?.payloadDigest) ||
      Boolean(receipt.spec?.kubectlObjects?.sha256) ||
      checks.some((item) => item.evidenceSHA256);
    check(hasPayloadDigest, `${rel(path)} missing payload/check evidence digest`);
  }

  const redisPlan = readYaml(repoPath("recipes", "bitnami", "redis", "25.5.3", "helm-plan.yaml"));
  const redisPainReport = readYaml(repoPath("recipes", "bitnami", "redis", "25.5.3", "helm-pain-report.yaml"));
  const redisDiagnostics = readYaml(repoPath("recipes", "bitnami", "redis", "25.5.3", "values-diagnostics.yaml"));
  const redisValueSourceMap = readYaml(repoPath("recipes", "bitnami", "redis", "25.5.3", "value-source-map.yaml"));
  const redisGeneratedFact = readYaml(
    repoPath("recipes", "bitnami", "redis", "25.5.3", "revisions", "default", "r001", "receipts", "generated-fact-receipt.yaml"),
  );
  const redisDefaultRevision = readYaml(
    repoPath("recipes", "bitnami", "redis", "25.5.3", "revisions", "default", "r001", "variant-revision.yaml"),
  );
  const redisDefaultRender = readYaml(
    repoPath("recipes", "bitnami", "redis", "25.5.3", "revisions", "default", "r001", "receipts", "render-receipt.yaml"),
  );
  const redisReuseRevision = readYaml(
    repoPath("recipes", "bitnami", "redis", "25.5.3", "revisions", "reuse-existing-secret", "r001", "variant-revision.yaml"),
  );
  const redisUpgradeReceipt = readYaml(
    repoPath(
      "recipes",
      "bitnami",
      "redis",
      "25.5.3",
      "operations",
      "default-to-reuse-existing-secret",
      "upgrade-simulation-receipt.yaml",
    ),
  );
  const redisRollbackReceipt = readYaml(
    repoPath(
      "recipes",
      "bitnami",
      "redis",
      "25.5.3",
      "operations",
      "reuse-existing-secret-to-default",
      "rollback-simulation-receipt.yaml",
    ),
  );

  check(redisPlan.kind === "HelmPlan", "Redis helm-plan kind mismatch");
  check(redisPlan.spec?.readiness?.variants?.includes("default"), "Redis HelmPlan missing default variant");
  check(redisPlan.spec?.readiness?.variants?.includes("reuse-existing-secret"), "Redis HelmPlan missing reuse-existing-secret variant");
  check(redisPlan.spec?.reports?.painReport === "helm-pain-report.yaml", "Redis HelmPlan must link pain report");
  check(redisPlan.spec?.reports?.valuesDiagnostics === "values-diagnostics.yaml", "Redis HelmPlan must link values diagnostics");
  check(redisPlan.spec?.reports?.valueSourceMap === "value-source-map.yaml", "Redis HelmPlan must link value source map");

  const redisValues = readYaml(repoPath("recipes", "bitnami", "redis", "25.5.3", "effective-values.yaml"));
  check(redisValues.kind === "EffectiveValues", "Redis effective-values kind mismatch");
  check(redisValues.spec?.files?.[0]?.sha256, "Redis effective-values missing file sha");
  check(redisValues.spec?.provenance?.some((entry) => entry.path === "auth.password"), "Redis effective-values must explain auth.password provenance");

  const redisValueModel = readYaml(repoPath("recipes", "bitnami", "redis", "25.5.3", "value-model.yaml"));
  check(redisValueModel.kind === "ValueModel", "Redis value-model kind mismatch");
  check((redisValueModel.spec?.checkedValues ?? []).length >= 3, "Redis value-model should record checked values");
  for (const field of ["unknownValues", "deadValues", "ignoredValues"]) {
    check(redisValueModel.spec?.[field], `Redis value-model missing ${field}`);
  }
  check(redisValueModel.spec?.diagnostics === "values-diagnostics.yaml", "Redis value-model must link values diagnostics");
  check(redisValueModel.spec?.valueSourceMap === "value-source-map.yaml", "Redis value-model must link value source map");

  check(redisPainReport.kind === "HelmPainReport", "Redis pain report kind mismatch");
  check(redisPainReport.spec?.defaultPathStatus === "no-unhandled-pain-points", "Redis pain report must have no default unhandled pain points");
  const painPoints = redisPainReport.spec?.painPoints ?? [];
  check(painPoints.length >= 7, "Redis pain report should enumerate the first proof pain points");
  for (const point of painPoints) {
    check(point.detectedPainPoint, `Redis pain point ${point.id} missing detectedPainPoint`);
    check(point.configHubHome, `Redis pain point ${point.id} missing configHubHome`);
    check(point.disposition, `Redis pain point ${point.id} missing disposition`);
    check(point.linkedReceipt, `Redis pain point ${point.id} missing linkedReceipt`);
  }

  check(redisDiagnostics.kind === "ValuesDiagnostics", "Redis values diagnostics kind mismatch");
  const wrongKeyFinding = redisDiagnostics.spec?.deadIgnoredUnknownValues?.findings?.find((finding) => finding.path === "auth.passwrod");
  check(wrongKeyFinding?.classification === "unknown-value-path", "Redis diagnostics must flag synthetic wrong value path");
  check(redisDiagnostics.spec?.syntheticTests?.[0]?.result === "pass", "Redis diagnostics synthetic test must pass");

  check(redisValueSourceMap.kind === "ValueSourceMap", "Redis value source map kind mismatch");
  const sourceIds = new Set((redisValueSourceMap.spec?.entries ?? []).map((entry) => entry.id));
  for (const required of ["replica-count", "release-name", "namespace", "redis-password"]) {
    check(sourceIds.has(required), `Redis value source map missing ${required}`);
  }

  const generatedFacts = (redisGeneratedFact.spec?.facts ?? []).map((fact) => ({
    name: fact.name,
    kind: fact.kind,
    digest: fact.digest,
    storedAs: fact.storedAs,
    valuePath: fact.valuePath,
  }));
  const generatedFactsDigest = sha256(canonicalText(generatedFacts));
  check(redisGeneratedFact.kind === "GeneratedFactReceipt", "Redis generated fact receipt kind mismatch");
  check(
    redisGeneratedFact.spec?.generatedFactsSHA256 === generatedFactsDigest,
    `Redis generated fact bundle digest mismatch: expected ${generatedFactsDigest}`,
  );
  check(
    redisDefaultRevision.spec?.digestInputs?.generatedFactsSHA256 === generatedFactsDigest,
    "Redis default variant revision must bind generated facts",
  );
  check(
    redisDefaultRender.spec?.inputs?.generatedFactsSHA256 === generatedFactsDigest,
    "Redis default render receipt must bind generated facts",
  );
  check(
    redisDefaultRender.spec?.inputs?.capabilityProfileRef === "data/capability-profiles/catalog.yaml#k8s-1.30-default",
    "Redis render receipt must bind named capability profile",
  );
  check(
    redisDefaultRevision.spec?.digestInputs?.capabilityProfileSHA256 === "sha256:c1f8a4eb20154228a391f2a61565160634fbeb5dcf1079065543dd0a2ff3dfbf",
    "Redis default variant revision must bind capability profile digest",
  );
  check(
    redisReuseRevision.spec?.digestInputs?.capabilityProfileSHA256 === "sha256:c1f8a4eb20154228a391f2a61565160634fbeb5dcf1079065543dd0a2ff3dfbf",
    "Redis reuse variant revision must bind capability profile digest",
  );

  const diffDigest = `sha256:${sha256File(repoPath("recipes", "bitnami", "redis", "25.5.3", "diffs", "default-to-reuse-existing-secret.yaml"))}`;
  check(redisUpgradeReceipt.kind === "UpgradeSimulationReceipt", "Redis upgrade simulation receipt kind mismatch");
  check(redisRollbackReceipt.kind === "RollbackSimulationReceipt", "Redis rollback simulation receipt kind mismatch");
  check(redisUpgradeReceipt.spec?.diffDigest === diffDigest, "Redis upgrade simulation diff digest mismatch");
  check(redisRollbackReceipt.spec?.diffDigest === diffDigest, "Redis rollback simulation diff digest mismatch");
  check((redisUpgradeReceipt.spec?.requiredOperatorDecisions ?? []).length > 0, "Redis upgrade simulation must record operator decisions");
  check((redisRollbackReceipt.spec?.requiredOperatorDecisions ?? []).length > 0, "Redis rollback simulation must record operator decisions");
}

function verifyAdversarialAndScaleData() {
  for (const path of [
    repoPath("data", "adversarial10", "corpus.yaml"),
    repoPath("data", "adversarial10", "proof-readiness.csv"),
    repoPath("data", "adversarial10", "control-point-summary.csv"),
    repoPath("data", "adversarial10", "matrix.xlsx"),
    repoPath("data", "adversarial10", "summary.md"),
    repoPath("data", "top500-catalog-analysis", "review.csv"),
    repoPath("data", "top500-catalog-analysis", "summary.md"),
  ]) {
    check(existsSync(path), `missing scale proof artifact: ${rel(path)}`);
  }
  const adversarialCsv = readFileSync(repoPath("data", "adversarial10", "proof-readiness.csv"), "utf8").trim().split("\n");
  check(adversarialCsv.length >= 11, "adversarial10 proof-readiness should include header plus 10 rows");
  const controlCsv = readFileSync(repoPath("data", "adversarial10", "control-point-summary.csv"), "utf8").trim().split("\n");
  check(controlCsv.length >= 2, "adversarial10 control-point summary should include at least one control point");
  const matrix = readFileSync(repoPath("data", "adversarial10", "matrix.xlsx"));
  check(matrix[0] === 0x50 && matrix[1] === 0x4b, "adversarial10 matrix.xlsx must be a ZIP/XLSX file");
  const top500Review = readFileSync(repoPath("data", "top500-catalog-analysis", "review.csv"), "utf8").trim().split("\n");
  check(top500Review.length >= 501, "top500 catalog analysis should include header plus 500 rows");
}

verifySchemas();
verifyCapabilityProfiles();
verifyDocs();
verifyCorpusContracts();
verifyAdversarialAndScaleData();

console.log("verified P0 proof contracts: schemas, capability profiles, freshness SLO, corpus invariants, and scale data");
