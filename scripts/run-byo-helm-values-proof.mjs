#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  canonicalObjectMaps,
  check,
  identityFor,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  sha256File,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-byo-helm-values-proof.mjs --run
  node scripts/run-byo-helm-values-proof.mjs --generate
  node scripts/run-byo-helm-values-proof.mjs --verify`);
  process.exit(2);
}

const scenarioPath = join(
  repoRoot,
  "config-catalog",
  "demonstrations",
  "byo-helm-values.yaml",
);
const outputRoot = join(repoRoot, "data", "byo-helm-values-review");
const proposedRenderPath = join(outputRoot, "proposed-render.yaml");
const reviewedRenderPath = join(outputRoot, "reviewed-render.yaml");
const reviewPath = join(outputRoot, "review.yaml");
const summaryPath = join(outputRoot, "summary.md");
const receiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "receipt.yaml",
);

if (mode === "--run") {
  run();
} else {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  if (mode === "--generate") {
    write(summaryPath, renderSummary(receipt));
    console.log(`wrote ${relativeRepo(summaryPath)}`);
  } else {
    check(
      readFileSync(summaryPath, "utf8") === renderSummary(receipt),
      `${relativeRepo(summaryPath)} is stale`,
    );
    console.log("verified the bring-your-own Helm values proof");
  }
}

function run() {
  check(
    process.env.HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROOF === "1",
    "set HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROOF=1 to run this networked proof",
  );
  for (const [tool, args] of [
    ["helm", ["version", "--short"]],
    ["oras", ["version"]],
  ]) {
    check(command(tool, args).trim(), `${tool} is required`);
  }

  const scenario = readYaml(scenarioPath);
  verifyScenario(scenario);
  const spec = scenario.spec;
  const sourceLockPath = join(repoRoot, spec.sourceLock);
  const baselineValuesPath = join(repoRoot, spec.baselineValues);
  const baselineObjectsPath = join(repoRoot, spec.baselineObjects);
  const proposedValuesPath = join(repoRoot, spec.proposedValues);
  const reviewedValuesPath = join(repoRoot, spec.reviewedValues);
  const sourceLock = readYaml(sourceLockPath);
  const baselineValuesRecord = readYaml(baselineValuesPath);
  const baselineValues = baselineValuesRecord.spec?.values;
  check(baselineValues, "baseline EffectiveValues record has no spec.values");

  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-byo-values-"));
  const chartArchive = join(
    workRoot,
    `${sourceLock.spec.chart}-${sourceLock.spec.version}.tgz`,
  );
  const baselineValuesFile = join(workRoot, "baseline-values.yaml");
  const cleanup = { localFiles: "pending" };
  let receipt;

  try {
    writeFileSync(baselineValuesFile, `${toYaml(baselineValues)}\n`);
    command("helm", [
      "pull",
      sourceLock.spec.chart,
      "--repo",
      sourceLock.spec.repositoryURL,
      "--version",
      sourceLock.spec.version,
      "--destination",
      workRoot,
    ]);
    check(existsSync(chartArchive), "Helm did not pull the locked chart archive");
    check(
      sha256File(chartArchive) === sourceLock.spec.packageSHA256,
      "the chart archive differs from source-lock.yaml",
    );
    check(
      statSync(chartArchive).size === Number(sourceLock.spec.packageBytes),
      "the chart archive byte count differs from source-lock.yaml",
    );

    const baselineText = renderChart(spec, chartArchive, baselineValuesFile);
    const proposedText = renderChart(spec, chartArchive, proposedValuesPath);
    const reviewedText = renderChart(spec, chartArchive, reviewedValuesPath);
    const committedBaselineText = readFileSync(baselineObjectsPath, "utf8");
    const semantic = canonicalObjectMaps(baselineText, committedBaselineText);
    const baselineDiffs = semanticDiffKeys(semantic);
    check(
      baselineDiffs.length === 0,
      `the fresh baseline render differs from the catalog: ${baselineDiffs.slice(0, 3).join(", ")}`,
    );

    const baselineDocs = parseDocs(baselineText);
    const proposedDocs = parseDocs(proposedText);
    const reviewedDocs = parseDocs(reviewedText);
    check(baselineDocs.length === 5, "expected five baseline NGINX objects");
    check(proposedDocs.length === 5, "expected five proposed NGINX objects");
    check(reviewedDocs.length === 5, "expected five reviewed NGINX objects");

    const proposalFindings = inspectRisks(proposedDocs);
    const reviewedFindings = inspectRisks(reviewedDocs);
    const expectedFindingIds = [...spec.expectedProposalFindings].sort();
    check(
      JSON.stringify(proposalFindings.map((item) => item.id).sort())
        === JSON.stringify(expectedFindingIds),
      `proposal findings changed: ${proposalFindings.map((item) => item.id).join(", ")}`,
    );
    check(
      reviewedFindings.length === 0,
      `reviewed values still have findings: ${reviewedFindings.map((item) => item.id).join(", ")}`,
    );

    const reviewedChanges = inspectReviewedChanges(reviewedDocs, spec);
    check(
      JSON.stringify(reviewedChanges.map((item) => item.id).sort())
        === JSON.stringify([...spec.expectedReviewedChanges].sort()),
      "reviewed change set differs from the scenario",
    );

    const proposedObjects = yamlDocuments(proposedDocs);
    const reviewedObjects = yamlDocuments(reviewedDocs);
    const proposedObjectHash = objectSetSha256(proposedDocs);
    const reviewedObjectHash = objectSetSha256(reviewedDocs);
    const oci = buildAndPullOci(workRoot, reviewedDocs);
    check(
      oci.pulledObjectsSha256 === reviewedObjectHash,
      "the objects pulled from the local OCI differ from the reviewed render",
    );

    const review = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "HelmValuesReview",
      metadata: {
        name: scenario.metadata.name,
      },
      spec: {
        request: spec.requestedChange,
        source: {
          chart: spec.chart,
          version: spec.version,
          releaseName: spec.releaseName,
          namespace: spec.namespace,
          kubeVersion: spec.kubeVersion,
          sourceLock: spec.sourceLock,
        },
        proposal: {
          values: spec.proposedValues,
          renderedObjects: relativeRepo(proposedRenderPath),
          findings: proposalFindings,
          decision: scenario.status.proposal,
        },
        reviewed: {
          values: spec.reviewedValues,
          renderedObjects: relativeRepo(reviewedRenderPath),
          changesKept: reviewedChanges,
          requiredTargetResources: spec.requiredTargetResources,
          decision: scenario.status.reviewed,
        },
      },
    };

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "BringYourOwnHelmValuesProofReceipt",
      metadata: {
        name: scenario.metadata.name,
      },
      spec: {
        recordedAt: new Date().toISOString(),
        source: {
          chart: spec.chart,
          version: spec.version,
          chartPackageSha256: sourceLock.spec.packageSHA256,
          chartPackageBytes: Number(sourceLock.spec.packageBytes),
          sourceLock: spec.sourceLock,
          releaseName: spec.releaseName,
          namespace: spec.namespace,
          kubeVersion: spec.kubeVersion,
        },
        baseline: {
          values: spec.baselineValues,
          valuesSha256: sha256File(baselineValuesPath),
          committedObjects: spec.baselineObjects,
          freshRenderMatchedCatalog: true,
          objectCount: baselineDocs.length,
        },
        proposal: {
          values: spec.proposedValues,
          valuesSha256: sha256File(proposedValuesPath),
          renderedObjects: relativeRepo(proposedRenderPath),
          renderedObjectsSha256: sha256(proposedObjects),
          objectSetSha256: proposedObjectHash,
          findings: proposalFindings,
          decision: scenario.status.proposal,
        },
        reviewed: {
          values: spec.reviewedValues,
          valuesSha256: sha256File(reviewedValuesPath),
          renderedObjects: relativeRepo(reviewedRenderPath),
          renderedObjectsSha256: sha256(reviewedObjects),
          objectSetSha256: reviewedObjectHash,
          changesKept: reviewedChanges,
          requiredTargetResources: spec.requiredTargetResources,
          decision: scenario.status.reviewed,
        },
        output: {
          type: "literal Kubernetes configuration OCI",
          localReference: "byo-nginx-ai-values:24.0.2-r001",
          publicReference: spec.publicConfigurationOci,
          manifestDigest: oci.manifestDigest,
          pullBack: "pass",
          pulledObjectsSha256: oci.pulledObjectsSha256,
          objectsMatched: true,
          publicPush: "not-run",
          configHubUpload: "not-run",
        },
        followOnEvidence: {
          publicAndConfigHub: "data/byo-helm-values-review/public-and-confighub.md",
          firstDeployment: "data/byo-helm-values-deploy-proof/summary.md",
          promotion: "data/byo-helm-values-promotion-proof/summary.md",
          stagingDeployment: "data/byo-helm-values-staging-deploy-proof/summary.md",
        },
        cleanup,
        limits: [
          "The proposed values are a deterministic fixture, not a transcript from a named AI model.",
          "The API key is deliberately fake. The check proves that a literal value reached a rendered Deployment.",
          "The reviewed package references an existing Secret that this proof does not create or read.",
          "This local receipt stops after the OCI pull-back comparison. Public registry publication and ConfigHub upload are separate follow-on checks.",
          "Separate receipts prove the first Argo CD deployment, development-to-staging promotion, and promoted staging deployment.",
        ],
      },
      status: {
        result: "pass",
        claim: "A supplied Helm values file was rendered before apply, compared with the checked catalog baseline, rejected for six concrete findings, corrected without losing the requested scale, and packaged as an OCI containing the same five reviewed Kubernetes objects.",
      },
    };

    write(proposedRenderPath, proposedObjects);
    write(reviewedRenderPath, reviewedObjects);
    writeYaml(reviewPath, review);
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
    cleanup.localFiles = "pass";
  }

  check(receipt, "the bring-your-own proof did not produce a receipt");
  receipt.spec.cleanup = cleanup;
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(outputRoot)}`);
}

function verifyScenario(scenario) {
  check(
    scenario.kind === "HelmValuesReviewScenario",
    "bring-your-own scenario kind changed",
  );
  const spec = scenario.spec;
  check(
    spec?.chart === "bitnami/nginx"
      && spec?.version === "24.0.2"
      && spec?.releaseName === "nginx"
      && spec?.namespace === "nginx",
    "bring-your-own scenario identity changed",
  );
  for (const path of [
    spec.sourceLock,
    spec.baselineValues,
    spec.baselineObjects,
    spec.proposedValues,
    spec.reviewedValues,
  ]) {
    check(existsSync(join(repoRoot, path)), `scenario input is missing: ${path}`);
  }
  check(
    spec.requiredTargetResources?.length === 1
      && spec.requiredTargetResources[0].kind === "Secret"
      && spec.requiredTargetResources[0].name === "ai-provider-credentials",
    "reviewed Secret prerequisite changed",
  );
  check(
    scenario.status?.proposal === "rejected"
      && scenario.status?.reviewed === "ready-for-upload"
      && scenario.status?.configHubUpload === "pass"
      && scenario.status?.kubernetesApply === "pass"
      && scenario.status?.argoDelivery === "pass"
      && scenario.status?.developmentChange === "pass"
      && scenario.status?.stagingPromotion === "pass"
      && scenario.status?.stagingDelivery === "pass"
      && scenario.status?.evidence?.firstDeployment
        === "runs/byo-helm-values-deploy-proof/receipt.yaml"
      && scenario.status?.evidence?.promotion
        === "runs/byo-helm-values-promotion-proof/receipt.yaml"
      && scenario.status?.evidence?.stagingDeployment
        === "runs/byo-helm-values-staging-deploy-proof/receipt.yaml",
    "scenario status boundary changed",
  );
}

function renderChart(spec, chartArchive, valuesPath) {
  return command("helm", [
    "template",
    spec.releaseName,
    chartArchive,
    "--namespace",
    spec.namespace,
    "--kube-version",
    spec.kubeVersion,
    "--include-crds",
    "--skip-tests",
    "--no-hooks",
    "--values",
    valuesPath,
  ]);
}

function inspectRisks(docs) {
  const findings = [];
  const deployment = findObject(docs, "Deployment", "nginx");
  const containers = [
    ...(deployment.spec?.template?.spec?.initContainers ?? []),
    ...(deployment.spec?.template?.spec?.containers ?? []),
  ];
  const appContainer = (deployment.spec?.template?.spec?.containers ?? [])
    .find((item) => item.name === "nginx");
  const key = (appContainer?.env ?? [])
    .find((item) => item.name === "AI_API_KEY");
  if (typeof key?.value === "string") {
    findings.push({
      id: "embedded-ai-api-key",
      object: "Deployment/nginx",
      path: "spec.template.spec.containers[name=nginx].env[name=AI_API_KEY].value",
      value: key.value,
      action: "Use an existing Secret reference instead of a literal key.",
    });
  }
  const mutableImages = [...new Set(
    containers
      .map((item) => item.image)
      .filter((image) => image && !image.includes("@sha256:")),
  )];
  if (mutableImages.length) {
    findings.push({
      id: "mutable-container-image",
      object: "Deployment/nginx",
      path: "spec.template.spec.*Containers[].image",
      value: mutableImages,
      action: "Restore the reviewed image digest.",
    });
  }
  const service = findObject(docs, "Service", "nginx");
  if (service.spec?.type === "LoadBalancer") {
    findings.push({
      id: "public-load-balancer",
      object: "Service/nginx",
      path: "spec.type",
      value: "LoadBalancer",
      action: "Keep ClusterIP unless external exposure is an explicit target decision.",
    });
  }
  for (const [id, keyName, unsafeValue, action] of [
    [
      "privilege-escalation-enabled",
      "allowPrivilegeEscalation",
      true,
      "Disable privilege escalation.",
    ],
    [
      "non-root-disabled",
      "runAsNonRoot",
      false,
      "Require the container to run as a non-root user.",
    ],
    [
      "writable-root-filesystem",
      "readOnlyRootFilesystem",
      false,
      "Restore the read-only root filesystem.",
    ],
  ]) {
    if (containers.some((item) => item.securityContext?.[keyName] === unsafeValue)) {
      findings.push({
        id,
        object: "Deployment/nginx",
        path: `spec.template.spec.*Containers[].securityContext.${keyName}`,
        value: unsafeValue,
        action,
      });
    }
  }
  return findings.sort((left, right) => left.id.localeCompare(right.id));
}

function inspectReviewedChanges(docs, spec) {
  const deployment = findObject(docs, "Deployment", "nginx");
  check(
    deployment.spec?.replicas === 3,
    "reviewed Deployment did not keep the requested three replicas",
  );
  const appContainer = (deployment.spec?.template?.spec?.containers ?? [])
    .find((item) => item.name === "nginx");
  const secretName = appContainer?.envFrom?.find((item) => item.secretRef)
    ?.secretRef?.name;
  check(
    secretName === spec.requiredTargetResources[0].name,
    "reviewed Deployment does not use the recorded Secret",
  );
  return [
    {
      id: "replicas-set-to-three",
      object: "Deployment/nginx",
      path: "spec.replicas",
      value: 3,
    },
    {
      id: "ai-api-key-moved-to-existing-secret",
      object: "Deployment/nginx",
      path: "spec.template.spec.containers[name=nginx].envFrom[].secretRef.name",
      value: secretName,
    },
  ];
}

function findObject(docs, kind, name) {
  const object = docs.find(
    (doc) => doc.kind === kind && doc.metadata?.name === name,
  );
  check(object, `${kind}/${name} is missing from the render`);
  return object;
}

function buildAndPullOci(workRoot, docs) {
  const inputRoot = join(workRoot, "oci-input");
  const layoutRoot = join(workRoot, "oci-layout");
  const pulledRoot = join(workRoot, "oci-pulled");
  mkdirSync(inputRoot, { recursive: true });
  const layerArgs = docs
    .map((doc, index) => {
      const fileName = `${String(index + 1).padStart(2, "0")}-${safeName(identityFor(doc))}.yaml`;
      writeFileSync(join(inputRoot, fileName), `${toYaml(doc)}\n`);
      return `${fileName}:application/yaml`;
    });
  const pushed = JSON.parse(command(
    "oras",
    [
      "push",
      "--oci-layout",
      `${layoutRoot}:24.0.2-r001`,
      ...layerArgs,
      "--artifact-type",
      "application/vnd.confighub.kubernetes.config.v1",
      "--annotation",
      "org.opencontainers.image.created=1970-01-01T00:00:00Z",
      "--annotation",
      "org.opencontainers.image.source=https://github.com/confighub/helm-expt",
      "--annotation",
      "org.opencontainers.image.title=Reviewed NGINX configuration from supplied Helm values",
      "--format",
      "json",
    ],
    { cwd: inputRoot },
  ));
  command(
    "oras",
    [
      "pull",
      "--oci-layout",
      `${layoutRoot}:24.0.2-r001`,
      "--output",
      pulledRoot,
    ],
    { cwd: inputRoot },
  );
  const pulledDocs = listFiles(pulledRoot)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")));
  return {
    manifestDigest: pushed.digest,
    pulledObjectsSha256: objectSetSha256(pulledDocs),
  };
}

function verifyReceipt(receipt) {
  check(
    existsSync(receiptPath),
    `${relativeRepo(receiptPath)} is missing; run the proof`,
  );
  check(
    existsSync(proposedRenderPath)
      && existsSync(reviewedRenderPath)
      && existsSync(reviewPath)
      && existsSync(summaryPath),
    "bring-your-own generated outputs are missing",
  );
  check(
    receipt.kind === "BringYourOwnHelmValuesProofReceipt"
      && receipt.status?.result === "pass",
    "bring-your-own proof did not pass",
  );
  const scenario = readYaml(scenarioPath);
  verifyScenario(scenario);
  const spec = receipt.spec;
  check(
    spec.source?.chart === scenario.spec.chart
      && spec.source?.version === scenario.spec.version
      && spec.source?.chartPackageSha256
        === readYaml(join(repoRoot, scenario.spec.sourceLock)).spec.packageSHA256,
    "receipt source differs from the scenario or source lock",
  );
  check(
    spec.baseline?.freshRenderMatchedCatalog === true
      && spec.baseline?.objectCount === 5,
    "catalog baseline comparison did not pass",
  );
  check(
    spec.proposal?.valuesSha256
      === sha256File(join(repoRoot, scenario.spec.proposedValues))
      && spec.proposal?.renderedObjectsSha256
        === sha256(readFileSync(proposedRenderPath, "utf8"))
      && JSON.stringify(spec.proposal.findings.map((item) => item.id).sort())
        === JSON.stringify([...scenario.spec.expectedProposalFindings].sort())
      && spec.proposal?.decision === "rejected",
    "proposal evidence changed",
  );
  check(
    spec.reviewed?.valuesSha256
      === sha256File(join(repoRoot, scenario.spec.reviewedValues))
      && spec.reviewed?.renderedObjectsSha256
        === sha256(readFileSync(reviewedRenderPath, "utf8"))
      && JSON.stringify(spec.reviewed.changesKept.map((item) => item.id).sort())
        === JSON.stringify([...scenario.spec.expectedReviewedChanges].sort())
      && spec.reviewed?.decision === "ready-for-upload",
    "reviewed evidence changed",
  );
  const reviewedDocs = parseDocs(readFileSync(reviewedRenderPath, "utf8"));
  check(inspectRisks(reviewedDocs).length === 0, "reviewed render has a risk finding");
  inspectReviewedChanges(reviewedDocs, scenario.spec);
  check(
    spec.output?.type === "literal Kubernetes configuration OCI"
      && /^sha256:[a-f0-9]{64}$/.test(spec.output?.manifestDigest ?? "")
      && spec.output?.pullBack === "pass"
      && spec.output?.objectsMatched === true
      && spec.output?.pulledObjectsSha256 === objectSetSha256(reviewedDocs),
    "local OCI round trip changed",
  );
  check(
    spec.output?.publicPush === "not-run"
      && spec.output?.configHubUpload === "not-run"
      && spec.cleanup?.localFiles === "pass",
    "receipt overstates publication, upload, or cleanup",
  );
  check(
    spec.followOnEvidence?.publicAndConfigHub
      === "data/byo-helm-values-review/public-and-confighub.md"
      && spec.followOnEvidence?.firstDeployment
        === "data/byo-helm-values-deploy-proof/summary.md"
      && spec.followOnEvidence?.promotion
        === "data/byo-helm-values-promotion-proof/summary.md"
      && spec.followOnEvidence?.stagingDeployment
        === "data/byo-helm-values-staging-deploy-proof/summary.md",
    "follow-on evidence links changed",
  );
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  return `# Bring your own Helm chart and values

This example starts with a chart and a values file supplied by a person or
coding agent. It renders the Kubernetes objects before applying them, compares
the result with the checked catalog configuration, and keeps the requested
change without keeping the unsafe parts.

## The request

${readYaml(scenarioPath).spec.requestedChange}

The supplied values produced five Kubernetes objects. The review rejected that
render for six concrete reasons:

${spec.proposal.findings.map((item) => `- **${plainFinding(item.id)}:** \`${item.object}\` at \`${item.path}\`. ${item.action}`).join("\n")}

## The reviewed result

The reviewed values keep three replicas. They restore the pinned image,
\`ClusterIP\` Service, non-root execution, disabled privilege escalation, and
read-only root filesystem. The literal API key is removed. The Deployment now
refers to the existing \`nginx/ai-provider-credentials\` Secret instead.

The reviewed render contains five objects and no remaining finding from this
example. Packaging those files as a local OCI produced
\`${spec.output.manifestDigest}\`. Pulling that OCI back produced the same
object-set hash, \`${spec.reviewed.objectSetSha256}\`.

## Open the files

- Proposed values: [\`${spec.proposal.values}\`](../../${spec.proposal.values})
- Proposed render: [\`${spec.proposal.renderedObjects}\`](./proposed-render.yaml)
- Reviewed values: [\`${spec.reviewed.values}\`](../../${spec.reviewed.values})
- Reviewed render: [\`${spec.reviewed.renderedObjects}\`](./reviewed-render.yaml)
- Structured review: [\`${relativeRepo(reviewPath)}\`](./review.yaml)
- Receipt: [\`${relativeRepo(receiptPath)}\`](../../${relativeRepo(receiptPath)})

## What happened next

This receipt covers the local review and OCI round trip. The same reviewed
objects were then published publicly, saved in ConfigHub, deployed through
Argo CD at three ready replicas, changed to four replicas in development,
promoted to staging, and deployed again at four ready replicas:

- [Public OCI and ConfigHub record](./public-and-confighub.md)
- [First Argo CD deployment](../byo-helm-values-deploy-proof/summary.md)
- [Development-to-staging promotion](../byo-helm-values-promotion-proof/summary.md)
- [Promoted staging deployment](../byo-helm-values-staging-deploy-proof/summary.md)

Rerun the proof with:

\`\`\`bash
HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROOF=1 npm run byo-helm-values:run
\`\`\`

## Limits

${spec.limits.map((line) => `- ${line}`).join("\n")}
`;
}

function plainFinding(id) {
  return {
    "embedded-ai-api-key": "API key embedded in the Deployment",
    "mutable-container-image": "container image no longer pinned by digest",
    "public-load-balancer": "Service exposed as a LoadBalancer",
    "privilege-escalation-enabled": "privilege escalation enabled",
    "non-root-disabled": "non-root execution disabled",
    "writable-root-filesystem": "root filesystem made writable",
  }[id] ?? id;
}

function semanticDiffKeys(semantic) {
  return [...new Set([
    ...Object.keys(semantic.helm),
    ...Object.keys(semantic.cub),
  ])].filter((key) => semantic.helm[key] !== semantic.cub[key]);
}

function objectSetSha256(docs) {
  return sha256(JSON.stringify(
    docs
      .map((doc) => [identityFor(doc), doc])
      .sort(([left], [right]) => left.localeCompare(right)),
  ));
}

function yamlDocuments(docs) {
  return `${docs.map((doc) => `---\n${toYaml(doc)}`).join("\n")}\n`;
}

function safeName(value) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function listFiles(root) {
  const files = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files;
}

function command(commandName, args, options = {}) {
  return execFileSync(commandName, args, {
    cwd: options.cwd ?? repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 256 * 1024 * 1024,
  });
}
