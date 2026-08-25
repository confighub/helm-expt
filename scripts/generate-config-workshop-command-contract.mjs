#!/usr/bin/env node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { check, readYamlText, relativeRepo, repoRoot, serializeYaml, write } from "./lib/proof-common.mjs";
import { composeWorkshopResult, loadObjectInput } from "./lib/config-workshop-result.mjs";

const mode = process.argv[2] ?? "--generate";
const allowedModes = new Set(["--generate", "--verify", "--refresh-scans", "--run-local", "--self-test"]);
if (!allowedModes.has(mode)) {
  console.log("Usage: node scripts/generate-config-workshop-command-contract.mjs --generate|--verify|--refresh-scans|--run-local|--self-test");
  process.exit(1);
}

const outputRoot = join(repoRoot, "data", "config-workshop-command-contract");
const literalScanPath = join(outputRoot, "kubernetes-yaml", "cub-check.json");
const helmScanPath = join(repoRoot, "runs", "config-catalog-policy-functional-proof", "reviewed-cub-check.json");
const promotedCandidatePath = join(outputRoot, "helm", "promoted-candidate.yaml");
const promotedScanPath = join(outputRoot, "helm", "promoted-cub-check.json");
const promotedCandidateText = buildPromotedCandidate();

if (["--generate", "--refresh-scans"].includes(mode)) write(promotedCandidatePath, promotedCandidateText);
else check(readFileSync(promotedCandidatePath, "utf8") === promotedCandidateText, `${relativeRepo(promotedCandidatePath)} is stale`);
if (mode === "--refresh-scans") refreshScans();
if (mode === "--run-local") {
  runLocalCommands();
  process.exit(0);
}
if (mode === "--self-test") {
  runSelfTest();
  process.exit(0);
}

const cases = buildCases();
const promoted = composePromotedCase(cases.find((item) => item.id === "helm"));
const contract = buildContract(cases);
const outputs = new Map([
  [join(outputRoot, "command-map.json"), `${JSON.stringify(contract, null, 2)}\n`],
  [join(outputRoot, "summary.md"), buildSummary(contract)],
  ...cases.map((item) => [join(outputRoot, item.id, "workshop-result.json"), item.composed.text]),
  [join(outputRoot, "helm", "promoted-workshop-result.json"), promoted.composed.text],
  [join(outputRoot, "helm", "promotion-review.json"), `${JSON.stringify(buildPromotionReview(cases[0], promoted), null, 2)}\n`],
]);

if (["--generate", "--refresh-scans"].includes(mode)) {
  for (const [path, content] of outputs) write(path, content);
  console.log(`wrote Config Workshop command contract (${outputs.size} files)`);
} else {
  for (const [path, expected] of outputs) {
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run workshop:commands:generate`);
  }
  console.log("verified Config Workshop command contract for Helm and Kubernetes YAML");
}

function buildCases() {
  return [
    composeCase({
      id: "helm",
      label: "Helm values written with AI",
      sourceType: "helm",
      sourceIdentity: "bitnami/nginx",
      sourceVersion: "24.0.2",
      candidate: "data/byo-helm-values-review/reviewed-render.yaml",
      comparison: "data/byo-helm-values-review/proposed-render.yaml",
      scan: "runs/config-catalog-policy-functional-proof/reviewed-cub-check.json",
      sourceRecord: "config-catalog/config-workshop-command-contract/helm-source-and-intent.yaml",
      configurationDecision: "config-catalog/review-decisions/byo-nginx-ai-values-24-0-2-reviewed.yaml",
      valuesSummary: "examples/byo-helm-values/reviewed-values.yaml",
      catalogUrl: "https://confighub.github.io/helm-expt/site/charts/bitnami-nginx-24-0-2.html",
      question: "What did the Helm values written with AI change, and is the reviewed result ready to keep?",
    }),
    composeCase({
      id: "kubernetes-yaml",
      label: "Existing Kubernetes YAML",
      sourceType: "kubernetes-yaml",
      sourceIdentity: "examples/plain-yaml/acme-web",
      sourceVersion: "source-r001",
      candidate: "examples/plain-yaml/acme-web",
      comparison: "",
      scan: "data/config-workshop-command-contract/kubernetes-yaml/cub-check.json",
      sourceRecord: "data/base-variant-records/records/kubernetes-yaml-acme-web-base.yaml",
      valuesSummary: "Literal Kubernetes YAML; materialization is a no-op.",
      catalogUrl: "https://confighub.github.io/helm-expt/site/examples.html#plain-yaml",
      question: "Is this existing Kubernetes YAML ready to retain and vary?",
    }),
  ];
}

function composeCase(definition) {
  const scan = JSON.parse(readFileSync(join(repoRoot, definition.scan), "utf8"));
  const composed = composeWorkshopResult({
    candidatePath: join(repoRoot, definition.candidate),
    cubCheckPath: join(repoRoot, definition.scan),
    sourceType: definition.sourceType,
    sourceIdentity: definition.sourceIdentity,
    sourceVersion: definition.sourceVersion,
    visibility: "public",
    comparisonPath: definition.comparison ? join(repoRoot, definition.comparison) : "",
    sourceRecordPath: join(repoRoot, definition.sourceRecord),
    configurationDecisionPath: definition.configurationDecision
      ? join(repoRoot, definition.configurationDecision)
      : "",
    catalogUrl: definition.catalogUrl,
    questionCode: "config-check",
    question: definition.question,
    valuesSummary: definition.valuesSummary,
    createdAt: scan.provenance.scan_time,
  });
  return { ...definition, composed };
}

function composePromotedCase(base) {
  const scan = JSON.parse(readFileSync(promotedScanPath, "utf8"));
  const composed = composeWorkshopResult({
    candidatePath: promotedCandidatePath,
    cubCheckPath: promotedScanPath,
    sourceType: base.sourceType,
    sourceIdentity: base.sourceIdentity,
    sourceVersion: base.sourceVersion,
    visibility: "public",
    comparisonPath: join(repoRoot, base.candidate),
    sourceRecordPath: join(repoRoot, base.sourceRecord),
    catalogUrl: base.catalogUrl,
    questionCode: "promotion-check",
    question: "Can I promote this four-replica NGINX configuration to staging?",
    valuesSummary: "ConfigHub change: replicas 3 to 4 and emptyDir sizeLimit 512Mi.",
    createdAt: scan.provenance.scan_time,
  });
  return { id: "helm-promoted", scan: relativeRepo(promotedScanPath), composed };
}

function buildPromotionReview(base, promoted) {
  const current = objectSetRecord(base.composed);
  const candidate = objectSetRecord(promoted.composed);
  const comparison = promoted.composed.review.spec.comparison;
  return {
    apiVersion: "workshop.confighub.com/v1alpha2",
    kind: "PromotionReview",
    metadata: { createdAt: promoted.composed.result.metadata.createdAt },
    spec: {
      change: {
        question: "Can I promote this four-replica NGINX configuration to staging?",
        summary: "Increase replicas from three to four and bound the temporary emptyDir to 512Mi.",
      },
      current,
      candidate,
      comparison,
      sourceAware: {
        source: "bitnami/nginx@24.0.2 with reviewed Helm values",
        sourceControlled: "The chart and reviewed values produced the retained three-replica base.",
        configHubControlled: ["apps/v1 Deployment/nginx spec.replicas", "apps/v1 Deployment/nginx spec.template.spec.volumes[name=empty-dir].emptyDir.sizeLimit"],
        targetSupplied: ["Secret nginx/ai-provider-credentials"],
      },
      lifecycle: promoted.composed.review.spec.lifecycle,
      destinationPreflight: {
        destinations: ["staging"],
        namespaces: ["nginx"],
        namespaceHandling: "preserve-source-namespaces",
        prerequisites: { requiredSecrets: ["nginx/ai-provider-credentials"] },
        lifecycleResolution: { status: "recheck-at-destination", routes: [] },
        delivery: { route: "ConfigHub release OCI to Argo CD", status: "not-run-for-this-candidate" },
        checks: [
          { id: "local-cub-check", status: "pass", note: "cub check reported no finding for the exact candidate object set.", evidence: [relativeRepo(promotedScanPath)] },
          { id: "required-secret", status: "not-run", note: "Check the named Secret at the staging destination before release." },
          { id: "managed-validation", status: "not-run", note: "Run ConfigHub validation against the retained candidate revision." },
          { id: "live-convergence", status: "not-run", note: "Observe Argo CD and the workload after release." },
        ],
      },
      targets: { selected: ["staging"], liveFactsSupplied: false },
      browserChecks: {
        status: "pass",
        candidateObjectSetSha256: candidate.objectSetSha256,
        localReceipt: relativeRepo(promotedScanPath),
      },
      testsRequired: [
        "Confirm Secret nginx/ai-provider-credentials exists at the destination.",
        "Run revision-bound ConfigHub validation.",
        "Preview the promotion mutations before execution.",
        "Publish and observe the exact release before calling staging converged.",
      ],
      nextAction: "Retain the exact candidate in ConfigHub, bind its object-set hash to the change record, and run a promotion preview.",
      configHubPlan: {
        baseSpace: "workshop-contract-nginx-base",
        destinationSpace: "workshop-contract-nginx-staging",
        objectSetAnnotation: `workshop.confighub.com/object-set-sha256=${candidate.objectSetSha256}`,
        proof: "runs/config-workshop-command-contract/receipt.yaml",
      },
    },
  };
}

function objectSetRecord(composed) {
  const candidate = composed.result.spec.candidate;
  return {
    name: candidate.content.path,
    sha256: candidate.content.sha256,
    objectCount: candidate.objectSet.objectCount,
    objectSetSha256: candidate.objectSet.sha256,
    objectSetHashAlgorithm: candidate.objectSet.algorithm,
    objects: composed.review.spec.candidate.objects,
  };
}

function buildContract(items) {
  return {
    apiVersion: "workshop.confighub.com/v1alpha1",
    kind: "CommandContract",
    metadata: {
      name: "config-workshop-three-jobs",
      generatedAt: new Date(Math.max(...items.map((item) => Date.parse(item.composed.result.metadata.createdAt)))).toISOString(),
    },
    spec: {
      purpose: "Use released cub commands and one WorkshopResult record for the same three jobs shown on the website.",
      objectIdentity: {
        algorithm: "cub-scan-canonical-json-v1",
        rule: "The file hash identifies exact bytes. The object-set hash identifies the accepted Kubernetes objects across file names and document order.",
        configHubAnnotation: "workshop.confighub.com/object-set-sha256",
      },
      jobs: [
        job("need-configuration", "I need a configuration. How should I run this?", "charts/index.html", "Select an exact source and starting configuration before changing it."),
        job("check-configuration", "I have a configuration. Is it right?", "ask.html#check-my-config", "Keep exact objects, findings, omitted checks, and source context in workshop-result.json."),
        job("promote-configuration", "I have an accepted configuration. Can I promote it?", "promote.html", "Retain the accepted object-set hash in ConfigHub, then preview the linked downstream promotion."),
      ],
      examples: items.map(exampleCommands),
      boundaries: [
        "cub check is local advisory evidence. ConfigHub validation remains a separate managed control.",
        "A promotion command is a preview until destination checks and the promotion itself have run.",
        "Helm materialization does real work. Literal Kubernetes YAML is already materialized, so that stage is recorded as a no-op.",
        "The public OCI digest, exact file hash, canonical object-set hash, and ConfigHub data hash have different roles.",
      ],
    },
  };
}

function job(id, question, page, result) {
  return { id, question, website: `https://confighub.github.io/helm-expt/site/${page}`, result };
}

function exampleCommands(item) {
  const hash = item.composed.candidateIdentity.sha256;
  const annotation = `workshop.confighub.com/object-set-sha256=${hash}`;
  const helm = item.id === "helm";
  const component = helm ? "byo-nginx-ai-values" : "acme-web";
  const variant = helm ? "reviewed" : "base";
  const space = helm ? "byo-nginx-ai-values-24-0-2-reviewed" : "plain-yaml-acme-web-base";
  const downstream = helm ? "byo-nginx-ai-values-24-0-2-staging" : "plain-yaml-acme-web-staging";
  const resultPath = `data/config-workshop-command-contract/${item.id}/workshop-result.json`;
  const workingObjects = helm ? "./rendered" : "examples/plain-yaml/acme-web";
  return {
    id: item.id,
    label: item.label,
    source: {
      type: item.sourceType,
      identity: item.sourceIdentity,
      version: item.sourceVersion,
      sourceAndIntent: item.sourceRecord,
    },
    acceptedObjectSet: item.composed.candidateIdentity,
    workshopResult: resultPath,
    stages: {
      select: helm
        ? stage("real-work", "cub installer inspect oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2 --json", "Read the maintained package choices without downloading or installing the package.")
        : stage("recorded-no-op", "find examples/plain-yaml/acme-web -name '*.yaml' -maxdepth 1 -print", "The supplied directory is already the selected source."),
      materialize: helm
        ? stage("real-work", "cub helm template nginx nginx --repo https://charts.bitnami.com/bitnami --version 24.0.2 --namespace nginx --values examples/byo-helm-values/reviewed-values.yaml --output-dir ./rendered", "Helm turns the pinned chart and values into Kubernetes objects.")
        : stage("recorded-no-op", "find examples/plain-yaml/acme-web -maxdepth 1 -name '*.yaml' -print", "The source already contains Kubernetes objects, so checking can start without rendering."),
      check: {
        status: "local-advisory",
        command: `cub check --format json --output cub-check.json ${workingObjects}`,
        receipt: item.scan,
      },
      record: {
        status: "machine-readable",
        command: `node scripts/create-config-workshop-result.mjs --candidate ${workingObjects} --cub-check cub-check.json --source-type ${item.sourceType} --source ${item.sourceIdentity} --source-version ${item.sourceVersion} --source-record ${item.sourceRecord}${item.configurationDecision ? ` --configuration-decision ${item.configurationDecision}` : ""} --output workshop-result.json`,
        output: resultPath,
        committedEvidence: {
          candidate: item.candidate,
          cubCheck: item.scan,
        },
      },
      retain: {
        status: "managed-dry-run-first",
        dryRun: `cub variant upload --dry-run --component ${component} --variant ${variant} --space ${space} --granularity minimal --annotation ${annotation} ${workingObjects}`,
        execute: `cub variant upload --component ${component} --variant ${variant} --space ${space} --granularity minimal --annotation ${annotation} ${workingObjects}`,
        bindAcceptedIdentity: `cub unit update ${component} --space ${space} --annotation ${annotation} --change-desc "Bind the accepted object set"`,
      },
      vary: {
        status: helm ? "proved-existing-chain" : "command-contract-only",
        command: `cub variant create staging ${space} --space-pattern template:${downstream} --environment Staging --unit-annotation ${annotation}`,
      },
      promote: {
        status: helm ? "proved-existing-chain" : "command-contract-only",
        command: `cub variant promote ${downstream} --dry-run -o mutations`,
        acceptedObjectSetSha256: hash,
      },
      release: {
        status: "requires-release-target-and-gates",
        command: `cub release publish ${downstream}`,
        note: "Publish only after the destination Space has a release target and its required checks and approvals pass.",
      },
    },
    evidence: helm
      ? [
          "data/config-review-decision-chain/summary.md",
          "runs/byo-helm-values-proof/confighub-upload-receipt.yaml",
          "runs/byo-helm-values-promotion-proof/receipt.yaml",
          "runs/byo-helm-values-staging-deploy-proof/receipt.yaml",
          "runs/config-workshop-command-contract/receipt.yaml",
        ]
      : ["data/literal-config-examples/summary.md", "runs/literal-yaml-upload-proof/receipt.yaml"],
    currentLimit: helm
      ? "The retained base carries the canonical object-set annotation. Each derived variant still needs its own identity because a namespace or field change produces a different object set."
      : "Checking and ConfigHub retention are proved. A linked staging promotion and delivery have not run for this example.",
  };
}

function stage(status, command, note) {
  return { status, command, note };
}

function buildSummary(contract) {
  const rows = contract.spec.examples.map((item) => `| ${item.label} | ${item.source.type} | ${item.acceptedObjectSet.objectCount} | \`${item.acceptedObjectSet.sha256}\` |`).join("\n");
  return `# The same three jobs on the website and command line

1. **I need a configuration. How should I run this?**
2. **I have a configuration. Is it right?**
3. **I have an accepted configuration. Can I promote it?**

Source-specific tools do the first stage. \`cub check\` checks the exact
Kubernetes objects locally. \`workshop-result.json\` keeps the source, exact file
hash, canonical object-set hash, findings, omitted checks, and next action.
ConfigHub begins when the accepted result must be retained, shared, varied,
promoted, released, or compared with a live system.

| Example | Source | Objects | Accepted object-set hash |
| --- | --- | ---: | --- |
${rows}

The object-set hash uses \`${contract.spec.objectIdentity.algorithm}\`. A file
hash identifies exact bytes. The object-set hash identifies the Kubernetes
objects across file names and document order. OCI and ConfigHub records keep
their own identities.

The Helm example materializes, checks, retains, varies, and promotes one reviewed
NGINX result. The exact command proof stops before release publication and delivery;
those checks remain separate. The Kubernetes YAML example records materialization
as a no-op and uses the same check and result contract. Its managed promotion has
not run.

- [Complete generated commands and statuses](command-map.json)
- [Helm WorkshopResult](helm/workshop-result.json)
- [Kubernetes YAML WorkshopResult](kubernetes-yaml/workshop-result.json)
- [Live NGINX retention and promotion proof](live-promotion.md)

Run \`npm run workshop:commands:run-local\` to execute the released Helm and
\`cub check\` commands in a temporary directory and compare the resulting object
set with this committed record.

## Boundaries

${contract.spec.boundaries.map((item) => `- ${item}`).join("\n")}
`;
}

function refreshScans() {
  mkdirSync(join(outputRoot, "kubernetes-yaml"), { recursive: true });
  for (const [input, output] of [
    [join(repoRoot, "examples", "plain-yaml", "acme-web"), literalScanPath],
    [promotedCandidatePath, promotedScanPath],
  ]) {
    const result = spawnSync("cub", ["check", "--format", "json", "--output", output, input], { cwd: repoRoot, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`cub check failed:\n${result.stdout}\n${result.stderr}`);
    if (result.stdout.trim()) console.log(result.stdout.trim());
    if (result.stderr.trim()) console.error(result.stderr.trim());
  }
}

function runLocalCommands() {
  const root = mkdtempSync(join(tmpdir(), "config-workshop-command-run-"));
  try {
    const rendered = join(root, "rendered");
    const scanPath = join(root, "cub-check.json");
    run("cub", [
      "helm", "template", "nginx", "nginx",
      "--repo", "https://charts.bitnami.com/bitnami",
      "--version", "24.0.2",
      "--namespace", "nginx",
      "--values", "examples/byo-helm-values/reviewed-values.yaml",
      "--output-dir", rendered,
    ]);
    run("cub", ["check", "--format", "json", "--output", scanPath, rendered]);
    const composed = composeWorkshopResult({
      candidatePath: rendered,
      cubCheckPath: scanPath,
      sourceType: "helm",
      sourceIdentity: "bitnami/nginx",
      sourceVersion: "24.0.2",
      sourceRecordPath: join(repoRoot, "config-catalog", "config-workshop-command-contract", "helm-source-and-intent.yaml"),
      configurationDecisionPath: join(repoRoot, "config-catalog", "review-decisions", "byo-nginx-ai-values-24-0-2-reviewed.yaml"),
      createdAt: JSON.parse(readFileSync(scanPath, "utf8")).provenance.scan_time,
    });
    const committed = JSON.parse(readFileSync(join(outputRoot, "helm", "workshop-result.json"), "utf8"));
    check(composed.candidateIdentity.sha256 === committed.spec.candidate.objectSet.sha256, "released cub commands produced a different Helm object set");
    check(composed.candidateIdentity.objectCount === committed.spec.candidate.objectSet.objectCount, "released cub commands produced a different Helm object count");
    console.log(`ran released cub commands: ${composed.candidateIdentity.objectCount} objects, ${composed.candidateIdentity.sha256}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  if (result.stdout.trim()) console.log(result.stdout.trim());
  if (result.stderr.trim()) console.error(result.stderr.trim());
}

function buildPromotedCandidate() {
  const source = readYamlText(readFileSync(join(repoRoot, "data", "byo-helm-values-review", "reviewed-render.yaml"), "utf8"));
  const documents = Array.isArray(source) ? source : [source];
  const deployment = documents.find((document) => document.kind === "Deployment" && document.metadata?.name === "nginx");
  check(deployment, "reviewed NGINX source has no Deployment/nginx");
  deployment.spec.replicas = 4;
  const emptyDir = deployment.spec?.template?.spec?.volumes?.find((volume) => volume.name === "empty-dir")?.emptyDir;
  check(emptyDir, "reviewed NGINX source has no empty-dir volume");
  emptyDir.sizeLimit = "512Mi";
  return documents.map((document) => serializeYaml(document).trimEnd()).join("\n---\n") + "\n";
}

function runSelfTest() {
  const root = mkdtempSync(join(tmpdir(), "config-workshop-command-contract-"));
  try {
    const scan = JSON.parse(readFileSync(helmScanPath, "utf8"));
    scan.input.object_set_sha256 = `sha256:${"0".repeat(64)}`;
    const badScan = join(root, "mismatched.json");
    writeFileSync(badScan, `${JSON.stringify(scan, null, 2)}\n`);
    let rejected = false;
    try {
      composeWorkshopResult({
        candidatePath: join(repoRoot, "data", "byo-helm-values-review", "reviewed-render.yaml"),
        cubCheckPath: badScan,
        sourceType: "helm",
        sourceIdentity: "bitnami/nginx",
        sourceVersion: "24.0.2",
        createdAt: scan.provenance.scan_time,
      });
    } catch (error) {
      rejected = String(error.message).includes("does not describe the candidate objects");
    }
    check(rejected, "self-test: a mismatched cub check result must be rejected");

    const decision = readFileSync(
      join(repoRoot, "config-catalog", "review-decisions", "byo-nginx-ai-values-24-0-2-reviewed.yaml"),
      "utf8",
    ).replace(
      "sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397",
      `sha256:${"1".repeat(64)}`,
    );
    const badDecision = join(root, "mismatched-decision.yaml");
    writeFileSync(badDecision, decision);
    rejected = false;
    try {
      composeWorkshopResult({
        candidatePath: join(repoRoot, "data", "byo-helm-values-review", "reviewed-render.yaml"),
        cubCheckPath: helmScanPath,
        sourceType: "helm",
        sourceIdentity: "bitnami/nginx",
        sourceVersion: "24.0.2",
        configurationDecisionPath: badDecision,
        createdAt: scan.provenance.scan_time,
      });
    } catch (error) {
      rejected = String(error.message).includes("does not describe the candidate objects");
    }
    check(rejected, "self-test: a mismatched configuration decision must be rejected");
    console.log("verified command-contract self-test rejects mismatched object sets");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
