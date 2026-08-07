#!/usr/bin/env node

// Live config-plane proof for the CPU starter: import the derived starter as a
// ConfigHub base variant, create a development variant, and apply the recorded
// gp3 cloud residue's override (gp3 to the cluster-default standard class) as
// a reviewed change with a dry-run preview first.
//
// The proof mirrors the training entry's variant proof: a temporary local OCI
// registry carries the starter as one ConfigHub literal-configuration
// artifact, `cub variant upload` imports it, and every claim is checked
// against the committed starter bytes. The receipt binds the run to the
// starter's committed platform digest, so the chain AICR release pins ->
// training index -> starter derivation -> this live import is one line.
//
// Boundary: config-plane only. The run starts no Kubernetes cluster, delivers
// nothing, and claims no workload behavior. Scratch Spaces are deleted at the
// end and the receipt refuses to verify unless cleanup passed.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  readYamlText,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const exampleRoot = join(repoRoot, "examples", "aicr", "cpu-starter");
const trainingIndexPath = join(
  repoRoot,
  "examples",
  "aicr",
  "eks-h100-training-kubeflow",
  "digest-index",
  "platform-index.json",
);
const receiptPath = join(repoRoot, "runs", "aicr-cpu-starter-variant", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-cpu-starter-variant", "summary.md");
const repository = "aicr-cpu-starter";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const kpsIdentity = "argoproj.io/v1alpha1|Application|argocd|kube-prometheus-stack";
const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-cpu-starter-variant-proof.mjs --run
  node scripts/run-aicr-cpu-starter-variant-proof.mjs --generate
  node scripts/run-aicr-cpu-starter-variant-proof.mjs --verify
  node scripts/run-aicr-cpu-starter-variant-proof.mjs --self-test`);
  process.exit(2);
}

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-starter-variant:generate`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-starter-variant:generate`,
  );
  console.log("verified the CPU starter ConfigHub variant proof");
} else {
  selfTest();
  console.log("verified the CPU starter variant receipt checks against fake surfaces");
}

// loadExpectations reads the committed starter surfaces the receipt must
// match: the platform digest, the derivation source, and the canonical
// Application set. A root override exists only so the self-test can run
// against fake surfaces.
function loadExpectations(rootOverride) {
  const root = rootOverride ?? exampleRoot;
  const index = JSON.parse(readFileSync(join(root, "digest-index", "platform-index.json"), "utf8"));
  const platformDigest = index.spec?.platformDigest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(platformDigest), "the starter digest index records no platform digest");
  const derivedFrom = index.spec?.derivedFrom ?? {};
  const renderedRoot = join(root, "argocd-rendered");
  const docs = listFiles(renderedRoot)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")))
    .map(stripCommentMetadata);
  check(docs.length > 0, "the starter has no rendered Applications");
  const waves = docs
    .map((doc) => Number(doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION]))
    .sort((left, right) => left - right);
  return {
    platformDigest,
    derivedFrom,
    docs,
    applicationCount: docs.length,
    waves,
    canonicalDataSha256: sha256(canonicalDocs(docs)),
  };
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_SCRATCH_ORG === "1",
    "set HELM_EXPT_ALLOW_SCRATCH_ORG=1 to confirm this live scratch run",
  );
  check(context, "set CUB_CONTEXT to an authenticated scratch ConfigHub context");
  check(context !== "river-bear", "refusing to run the scratch proof in the persistent helm-catalog context");
  for (const tool of ["cub", "docker", "oras"]) {
    check(tryCommand(tool, ["version"]).ok, `${tool} is required for the CPU starter variant proof`);
  }

  const expectations = loadExpectations();
  check(expectations.applicationCount === 7, "the committed starter no longer holds seven Applications");
  const trainingIndex = JSON.parse(readFileSync(trainingIndexPath, "utf8"));
  check(
    expectations.derivedFrom.platformDigest === trainingIndex.spec?.platformDigest,
    "the starter derivation no longer matches the training entry's platform digest",
  );
  const kpsCommitted = docByIdentity(expectations.docs, kpsIdentity);
  check(kpsCommitted, "the committed starter has no kube-prometheus-stack Application");
  const committedValues = String(kpsCommitted.spec?.source?.helm?.values ?? "");
  const gp3Line = committedValues.split("\n").find((line) => /^\s*storageClassName: gp3$/.test(line));
  check(gp3Line, "the committed starter values no longer contain the recorded gp3 residue");
  const replacementLine = gp3Line.replace("gp3", "standard");
  check(
    expectations.docs.filter((doc) => JSON.stringify(doc).includes("gp3")).length === 1,
    "the gp3 residue is no longer confined to one Application",
  );

  const contextInfo = jsonCommand("cub", ["context", "get", context, "-o", "json"]);
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString());
  const component = `hx-aicr-starter-${runId}`;
  const spaces = { base: `${component}-base`, dev: `${component}-dev`, staging: `${component}-staging` };
  const container = `helm-expt-aicr-starter-${runId}`;
  const createdSpaces = [];
  let registryStarted = false;
  let receipt;
  const cleanup = {
    stagingSpace: "not-created",
    devSpace: "not-created",
    baseSpace: "not-created",
    registry: "not-started",
  };

  try {
    for (const slug of Object.values(spaces)) {
      check(
        !cubTry(context, ["space", "get", slug, "-o", "json"]).ok,
        `refusing to reuse existing scratch Space ${slug}`,
      );
    }

    command("docker", ["run", "-d", "--rm", "--name", container, "-p", "127.0.0.1::5000", "registry:2"]);
    registryStarted = true;
    cleanup.registry = "pending";
    const portOutput = command("docker", ["port", container, "5000/tcp"]).trim();
    const registryPort = portOutput.match(/:(\d+)$/)?.[1] ?? "";
    check(registryPort, `could not determine the temporary registry port from ${portOutput}`);
    const registry = `localhost:${registryPort}`;
    waitForRegistry(registry);

    const registryRef = `${registry}/${repository}:0.14.0`;
    const renderedRoot = join(exampleRoot, "argocd-rendered");
    const templateFiles = listFiles(join(renderedRoot, "templates"))
      .map((path) => relativeRepo(path).slice(`${relativeRepo(renderedRoot)}/`.length))
      .sort();
    command(
      "oras",
      [
        "push",
        "--plain-http",
        "--artifact-type",
        artifactType,
        registryRef,
        ...templateFiles.map((file) => `${file}:application/yaml`),
      ],
      { cwd: renderedRoot },
    );
    const pushedDigest = command("oras", ["resolve", "--plain-http", registryRef]).trim();
    check(/^sha256:[0-9a-f]{64}$/.test(pushedDigest), `oras resolve returned no digest: ${pushedDigest}`);

    cub(context, [
      "variant",
      "upload",
      "--component",
      component,
      "--variant",
      "base",
      "--space",
      spaces.base,
      "--granularity",
      "minimal",
      "--label",
      "SourceType=aicr-derived",
      "--label",
      "ResourceClass=system-configuration",
      "--layer",
      "Platform",
      "--owner",
      "Platform",
      "--change-desc",
      "Upload the derived AICR CPU starter as the base variant",
      `oci://${registryRef}`,
    ], { timeout: 420_000 });
    createdSpaces.push(spaces.base);
    cleanup.baseSpace = "pending";

    const baseBefore = inspectVariant(context, spaces.base, component);
    verifyStarterSet(baseBefore.docs, expectations, "base");
    check(
      canonicalDocs(baseBefore.docs) === canonicalDocs(expectations.docs),
      "ConfigHub base Unit differs from the committed starter Application files",
    );
    const externalSources = JSON.parse(
      baseBefore.space.Annotations?.["confighub.com/external-source"] ?? "[]",
    );
    check(
      externalSources.length === 1
        && externalSources[0].digest === pushedDigest
        && externalSources[0].ref === `oci://${registryRef}`,
      "ConfigHub base Space did not record the exact starter OCI source and digest",
    );

    cub(context, [
      "variant",
      "create",
      "dev",
      spaces.base,
      "--space-pattern",
      `template:${spaces.dev}`,
      "--environment",
      "Dev",
      "--region",
      "demo",
      "--wait",
      "--timeout",
      "10m",
    ], { timeout: 660_000 });
    createdSpaces.push(spaces.dev);
    cleanup.devSpace = "pending";

    const devBefore = inspectVariant(context, spaces.dev, component);
    check(
      canonicalDocs(devBefore.docs) === canonicalDocs(baseBefore.docs),
      `the development variant does not match the uploaded base (${changedDocs(baseBefore.docs, devBefore.docs).join(", ") || "no changed identity"})`,
    );

    cub(context, [
      "variant",
      "create",
      "staging",
      spaces.dev,
      "--space-pattern",
      `template:${spaces.staging}`,
      "--environment",
      "Staging",
      "--region",
      "demo",
      "--wait",
      "--timeout",
      "10m",
    ], { timeout: 660_000 });
    createdSpaces.push(spaces.staging);
    cleanup.stagingSpace = "pending";
    const stagingBefore = inspectVariant(context, spaces.staging, component);
    check(
      canonicalDocs(stagingBefore.docs) === canonicalDocs(devBefore.docs),
      "the staging variant does not match the development variant it was created from",
    );

    const changeArgs = [
      "run",
      "search-replace",
      "--space",
      spaces.dev,
      "--unit",
      component,
      "--search-value",
      gp3Line,
      "--replace-value",
      replacementLine,
    ];
    const dryRunOutput = cub(context, [...changeArgs, "--dry-run", "-o", "mutations"]);
    check(
      dryRunOutput.includes("kube-prometheus-stack"),
      "ConfigHub dry run did not name the kube-prometheus-stack Application",
    );
    const devAfterDryRun = inspectVariant(context, spaces.dev, component);
    check(
      canonicalDocs(devAfterDryRun.docs) === canonicalDocs(devBefore.docs),
      "ConfigHub search-replace dry run changed the dev Unit",
    );

    cub(context, [
      ...changeArgs,
      "--change-desc",
      "Override the AWS gp3 storage class with the cluster default for the CPU starter",
      "--wait",
    ], { timeout: 660_000 });
    const devChanged = inspectVariant(context, spaces.dev, component);
    const changedIdentities = changedDocs(devBefore.docs, devChanged.docs);
    check(
      JSON.stringify(changedIdentities) === JSON.stringify([kpsIdentity]),
      `expected one changed Application, found ${changedIdentities.join(", ") || "none"}`,
    );
    assertStorageClass(devChanged.docs, "standard", "dev");
    check(
      !JSON.stringify(devChanged.docs).includes("gp3"),
      "the development variant still contains the gp3 storage class",
    );

    const stagingBeforePromotion = inspectVariant(context, spaces.staging, component);
    check(
      canonicalDocs(stagingBeforePromotion.docs) === canonicalDocs(stagingBefore.docs),
      "staging changed before the promotion",
    );
    const promotionDryRunOutput = cub(context, ["variant", "promote", spaces.staging, "--dry-run"]);
    check(
      /1\s+unit/i.test(promotionDryRunOutput),
      `the promotion dry run did not report one Unit: ${promotionDryRunOutput.trim()}`,
    );
    const stagingAfterPromotionDryRun = inspectVariant(context, spaces.staging, component);
    check(
      canonicalDocs(stagingAfterPromotionDryRun.docs) === canonicalDocs(stagingBeforePromotion.docs),
      "the promotion dry run changed staging",
    );

    cub(context, [
      "variant",
      "promote",
      spaces.staging,
      "--change-desc",
      "Promote the reviewed storage-class override to staging",
    ], { timeout: 660_000 });
    const stagingPromoted = inspectVariant(context, spaces.staging, component);
    assertStorageClass(stagingPromoted.docs, "standard", "staging");
    check(
      canonicalDocs(stagingPromoted.docs) === canonicalDocs(devChanged.docs),
      "the promoted staging Unit does not match the reviewed dev Unit",
    );

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrCpuStarterVariantProofReceipt",
      metadata: { name: "aicr-cpu-starter-v0-14-0-variant" },
      spec: {
        recordedAt: new Date().toISOString(),
        context: {
          name: context,
          organization: contextInfo.metadata?.organizationName ?? "unknown",
          purpose: "temporary scratch proof",
        },
        source: {
          format: "derived CPU starter literal configuration OCI",
          committedEntry: relativeRepo(exampleRoot),
          starterPlatformDigest: expectations.platformDigest,
          derivedFromEntry: expectations.derivedFrom.entry,
          derivedFromPlatformDigest: expectations.derivedFrom.platformDigest,
          temporaryReference: `oci://${registryRef}`,
          digest: pushedDigest,
          applicationCount: expectations.applicationCount,
          syncWaves: expectations.waves,
          exactSourceObjectsMatched: true,
          canonicalDataSha256: expectations.canonicalDataSha256,
        },
        variants: {
          base: variantRecord(baseBefore),
          dev: variantRecord(devChanged),
          staging: variantRecord(stagingPromoted),
        },
        change: {
          resource: kpsIdentity,
          path: "spec.source.helm.values prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName",
          before: "gp3",
          after: "standard",
          searchValue: gp3Line,
          replaceValue: replacementLine,
          changedApplicationCount: changedIdentities.length,
          changedApplications: changedIdentities,
          devDryRun: "pass",
          devDryRunLeftDataUnchanged: true,
          devUpdate: "pass",
        },
        promotion: {
          path: "base -> dev -> staging",
          dryRun: "pass",
          dryRunReportedUnitCount: 1,
          dryRunLeftStagingUnchanged: true,
          result: "pass",
          stagingMatchesReviewedDev: true,
        },
        cleanup,
        limits: [
          "This run used a temporary local registry; it does not prove public registry publication.",
          "This run started no Kubernetes cluster. It does not prove Argo CD delivery, application health, or any workload behavior.",
          "The scratch organization did not run the helm-catalog apply-policy Triggers, so this receipt does not prove policy execution.",
          "This receipt proves one derived-starter import, one reviewed storage-class override in a development variant, and one dev-to-staging promotion of that reviewed change.",
        ],
      },
      status: {
        result: "pass",
        ociImport: "pass",
        exactApplicationSet: "pass",
        derivedVariant: "pass",
        changeDryRun: "pass",
        change: "pass",
        promotionDryRun: "pass",
        promotion: "pass",
        claim:
          "ConfigHub imported the seven derived CPU starter Applications as a base variant, kept them byte-faithful, applied the recorded gp3 residue's override to the cluster-default storage class in a development variant with a dry-run preview, previewed the staging promotion without changing staging, and promoted the same reviewed configuration to staging with matching data.",
      },
    };
  } finally {
    for (const [key, slug] of [
      ["stagingSpace", spaces.staging],
      ["devSpace", spaces.dev],
      ["baseSpace", spaces.base],
    ]) {
      const exists = cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      if (!exists) {
        cleanup[key] = createdSpaces.includes(slug) ? "fail" : "not-created";
        continue;
      }
      const deleted = cubTry(context, ["space", "delete", slug, "--recursive-force", "--quiet"]);
      const absent = !cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      cleanup[key] = deleted.ok && absent ? "pass" : "fail";
    }
    if (registryStarted) {
      const stopped = tryCommand("docker", ["stop", container]);
      const absent = waitForContainerRemoval(container);
      cleanup.registry = stopped.ok && absent ? "pass" : "fail";
    }
  }

  check(receipt, "the CPU starter variant proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `the CPU starter variant proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(readYaml(receiptPath), loadExpectations());
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function verifyStarterSet(docs, expectations, label) {
  check(
    docs.length === expectations.applicationCount,
    `${label} must contain ${expectations.applicationCount} Argo CD Applications`,
  );
  check(
    docs.every(
      (doc) => doc.apiVersion === "argoproj.io/v1alpha1"
        && doc.kind === "Application"
        && doc.metadata?.namespace === "argocd",
    ),
    `${label} contains an object that is not an Argo CD Application in argocd`,
  );
  const waves = docs
    .map((doc) => Number(doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION]))
    .sort((left, right) => left - right);
  check(JSON.stringify(waves) === JSON.stringify(expectations.waves), `${label} sync waves changed`);
}

function assertStorageClass(docs, expected, label) {
  const application = docByIdentity(docs, kpsIdentity);
  check(application, `${label} kube-prometheus-stack Application is missing`);
  const values = readYamlText(application.spec?.source?.helm?.values ?? "");
  const storageClass = values?.prometheus?.prometheusSpec?.storageSpec?.volumeClaimTemplate?.spec?.storageClassName;
  check(
    storageClass === expected,
    `${label} Prometheus storage class is ${storageClass}, expected ${expected}`,
  );
}

function inspectVariant(context, spaceSlug, unitSlug) {
  const spaceResponse = cubJson(context, ["space", "get", spaceSlug, "-o", "json"]);
  const unitResponse = cubJson(context, ["unit", "get", unitSlug, "--space", spaceSlug, "-o", "json"]);
  const data = cub(context, ["unit", "data", unitSlug, "--space", spaceSlug]);
  const docs = parseDocs(data).map(stripCommentMetadata);
  return {
    space: spaceResponse.Space,
    unit: unitResponse.Unit,
    fromLink: unitResponse.FromLink?.[0] ?? null,
    docs,
    dataSha256: sha256(canonicalDocs(docs)),
  };
}

function variantRecord(variant) {
  return {
    space: variant.space.Slug,
    spaceId: variant.space.SpaceID,
    variant: variant.space.Labels?.Variant ?? "",
    environment: variant.space.Labels?.Environment ?? "",
    unit: variant.unit.Slug,
    unitId: variant.unit.UnitID,
    headRevision: variant.unit.HeadRevisionNum,
    upstreamRevision: variant.unit.UpstreamRevisionNum ?? null,
    upstreamUnitId: variant.unit.UpstreamUnitID ?? null,
    upgradeLinkId: variant.fromLink?.LinkID ?? null,
    dataHash: variant.unit.DataHash,
    canonicalDataSha256: variant.dataSha256,
  };
}

function verifyReceipt(receipt, expectations) {
  check(receipt.kind === "AicrCpuStarterVariantProofReceipt", "CPU starter variant receipt kind changed");
  check(receipt.status?.result === "pass", "CPU starter variant proof is not pass");
  for (const lane of ["ociImport", "exactApplicationSet", "derivedVariant", "changeDryRun", "change", "promotionDryRun", "promotion"]) {
    check(receipt.status?.[lane] === "pass", `CPU starter variant receipt lane ${lane} did not pass`);
  }
  check(
    receipt.spec?.source?.starterPlatformDigest === expectations.platformDigest,
    "CPU starter variant receipt no longer matches the committed starter platform digest",
  );
  check(
    receipt.spec?.source?.derivedFromPlatformDigest === expectations.derivedFrom.platformDigest,
    "CPU starter variant receipt no longer matches the training-entry derivation digest",
  );
  check(
    receipt.spec?.source?.canonicalDataSha256 === expectations.canonicalDataSha256,
    "CPU starter variant receipt canonical data differs from the committed starter files",
  );
  check(
    receipt.spec?.source?.applicationCount === expectations.applicationCount,
    "CPU starter variant receipt Application count changed",
  );
  check(
    JSON.stringify(receipt.spec?.source?.syncWaves) === JSON.stringify(expectations.waves),
    "CPU starter variant receipt sync waves changed",
  );
  check(
    receipt.spec?.variants?.base?.canonicalDataSha256 === expectations.canonicalDataSha256,
    "the imported base variant did not match the committed starter bytes",
  );
  check(
    receipt.spec?.variants?.dev?.dataHash
      && receipt.spec?.variants?.dev?.dataHash !== receipt.spec?.variants?.base?.dataHash,
    "the development variant records no reviewed change against the base",
  );
  check(
    receipt.spec?.change?.changedApplicationCount === 1
      && receipt.spec?.change?.changedApplications?.[0] === kpsIdentity,
    "the CPU starter change must touch only kube-prometheus-stack",
  );
  check(
    receipt.spec?.change?.before === "gp3" && receipt.spec?.change?.after === "standard",
    "the CPU starter change no longer records the gp3-to-standard override",
  );
  check(
    receipt.spec?.change?.devDryRun === "pass"
      && receipt.spec?.change?.devDryRunLeftDataUnchanged === true
      && receipt.spec?.change?.devUpdate === "pass",
    "the CPU starter dev change evidence is incomplete",
  );
  check(
    receipt.spec?.promotion?.path === "base -> dev -> staging"
      && receipt.spec?.promotion?.dryRun === "pass"
      && receipt.spec?.promotion?.dryRunReportedUnitCount === 1
      && receipt.spec?.promotion?.dryRunLeftStagingUnchanged === true
      && receipt.spec?.promotion?.result === "pass"
      && receipt.spec?.promotion?.stagingMatchesReviewedDev === true,
    "the CPU starter promotion evidence is incomplete",
  );
  check(
    receipt.spec?.variants?.staging?.canonicalDataSha256
      && receipt.spec?.variants?.staging?.canonicalDataSha256
        === receipt.spec?.variants?.dev?.canonicalDataSha256,
    "the promoted staging variant does not carry the reviewed dev configuration",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "the CPU starter variant proof cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("started no Kubernetes cluster")),
    "the CPU starter variant receipt must say that no cluster delivery was tested",
  );
  check(
    !Number.isNaN(Date.parse(receipt.spec?.recordedAt ?? "")),
    "the CPU starter variant receipt records no valid timestamp",
  );
}

function renderSummary(receipt) {
  const source = receipt.spec.source;
  const change = receipt.spec.change;
  return `# CPU starter ConfigHub variant proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the scratch proof with \`npm run aicr-starter-variant:run\`;
verify it without external access with \`npm run aicr-starter-variant:verify\`.

ConfigHub imported the derived CPU starter (${source.applicationCount} Argo CD
Applications) as a base variant from a temporary OCI reference and kept it
byte-faithful: the base Unit's canonical data matched the committed starter
files exactly. The starter's committed platform digest at the time of the run
was \`${source.starterPlatformDigest}\`, itself derived from the training
entry's \`${source.derivedFromPlatformDigest}\`.

Development and staging variants were created from the base, and the one
recorded cloud residue was overridden as a reviewed change in development:
the Prometheus storage class moved from \`${change.before}\` to
\`${change.after}\`. ConfigHub's dry run named the affected Application and
left the stored configuration unchanged; the real change touched exactly
${change.changedApplicationCount} Application (\`kube-prometheus-stack\`).

The staging promotion was previewed first: the dry run reported one Unit and
left staging unchanged. The real promotion then copied the reviewed
development configuration to staging, and the two variants recorded the same
canonical data.

The proof ran in the scratch organization \`${receipt.spec.context.organization}\`
on ${receipt.spec.recordedAt}. All three scratch Spaces and the temporary
registry were removed afterward.

## Limits

${receipt.spec.limits.map((limit) => `- ${limit}`).join("\n")}
`;
}

// The self-test exercises the receipt verifier against fake surfaces only: a
// fake starter tree with its own digest index, and a fake receipt consistent
// with it. It proves the verifier accepts the consistent receipt and refuses
// digest, canonical-data, change-scope, and cleanup regressions.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-starter-variant-self-test-"));
  try {
    const root = join(scratch, "starter");
    const template = [
      "apiVersion: argoproj.io/v1alpha1",
      "kind: Application",
      "metadata:",
      "  annotations:",
      `    ${SYNC_WAVE_ANNOTATION}: "0"`,
      "  name: kube-prometheus-stack",
      "  namespace: argocd",
      "spec:",
      "  destination:",
      "    namespace: monitoring",
      "    server: https://kubernetes.default.svc",
      "  source:",
      "    chart: kube-prometheus-stack",
      "    repoURL: https://charts.invalid/fixture",
      "    targetRevision: 1.2.3",
      "    helm:",
      "      values: |-",
      "        prometheus:",
      "          prometheusSpec:",
      "            storageSpec:",
      "              volumeClaimTemplate:",
      "                spec:",
      "                  storageClassName: gp3",
      "",
    ].join("\n");
    write(join(root, "argocd-rendered", "templates", "kube-prometheus-stack.yaml"), template);
    const fixtureDigest = `sha256:${"6".repeat(64)}`;
    const trainingDigest = `sha256:${"7".repeat(64)}`;
    write(
      join(root, "digest-index", "platform-index.json"),
      `${JSON.stringify({
        spec: {
          platformDigest: fixtureDigest,
          derivedFrom: { entry: "fixture-training", platformDigest: trainingDigest },
        },
      }, null, 2)}\n`,
    );
    const expectations = loadExpectations(root);
    check(expectations.applicationCount === 1, "self-test fixture expectations are wrong");

    const receipt = () => ({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrCpuStarterVariantProofReceipt",
      metadata: { name: "fixture" },
      spec: {
        recordedAt: "1970-01-01T00:00:00.000Z",
        context: { name: "fixture", organization: "fixture-org", purpose: "temporary scratch proof" },
        source: {
          starterPlatformDigest: fixtureDigest,
          derivedFromPlatformDigest: trainingDigest,
          canonicalDataSha256: expectations.canonicalDataSha256,
          applicationCount: 1,
          syncWaves: [0],
        },
        variants: {
          base: { dataHash: "hash-base", canonicalDataSha256: expectations.canonicalDataSha256 },
          dev: { dataHash: "hash-dev", canonicalDataSha256: "sha-reviewed" },
          staging: { dataHash: "hash-staging", canonicalDataSha256: "sha-reviewed" },
        },
        change: {
          changedApplicationCount: 1,
          changedApplications: [kpsIdentity],
          before: "gp3",
          after: "standard",
          devDryRun: "pass",
          devDryRunLeftDataUnchanged: true,
          devUpdate: "pass",
        },
        promotion: {
          path: "base -> dev -> staging",
          dryRun: "pass",
          dryRunReportedUnitCount: 1,
          dryRunLeftStagingUnchanged: true,
          result: "pass",
          stagingMatchesReviewedDev: true,
        },
        cleanup: { stagingSpace: "pass", devSpace: "pass", baseSpace: "pass", registry: "pass" },
        limits: ["This run started no Kubernetes cluster. It does not prove delivery."],
      },
      status: {
        result: "pass",
        ociImport: "pass",
        exactApplicationSet: "pass",
        derivedVariant: "pass",
        changeDryRun: "pass",
        change: "pass",
        promotionDryRun: "pass",
        promotion: "pass",
      },
    });

    verifyReceipt(receipt(), expectations);

    const refusals = [
      [(r) => (r.spec.source.starterPlatformDigest = `sha256:${"9".repeat(64)}`), /committed starter platform digest/],
      [(r) => (r.spec.source.canonicalDataSha256 = "not-the-sha"), /canonical data differs/],
      [(r) => (r.spec.change.changedApplications = ["other|identity"]), /touch only kube-prometheus-stack/],
      [(r) => (r.spec.cleanup.devSpace = "fail"), /cleanup did not pass/],
      [(r) => (r.spec.variants.dev.dataHash = "hash-base"), /records no reviewed change/],
      [(r) => (r.spec.promotion.stagingMatchesReviewedDev = false), /promotion evidence is incomplete/],
      [(r) => (r.spec.variants.staging.canonicalDataSha256 = "sha-other"), /does not carry the reviewed dev configuration/],
      [(r) => (r.spec.limits = []), /no cluster delivery/],
    ];
    for (const [mutate, pattern] of refusals) {
      const mutated = receipt();
      mutate(mutated);
      check(fails(() => verifyReceipt(mutated, expectations), pattern), `self-test accepted a receipt violating ${pattern}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function changedDocs(before, after) {
  const left = docMap(before);
  const right = docMap(after);
  const identities = [...new Set([...left.keys(), ...right.keys()])].sort();
  return identities.filter((identityKey) => left.get(identityKey) !== right.get(identityKey));
}

function docMap(docs) {
  return new Map(docs.map((doc) => [identity(doc), JSON.stringify(doc)]));
}

function docByIdentity(docs, wanted) {
  return docs.find((doc) => identity(doc) === wanted);
}

function stripCommentMetadata(value) {
  if (Array.isArray(value)) return value.map(stripCommentMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("$comment$"))
      .map(([key, child]) => [key, stripCommentMetadata(child)]),
  );
}

function canonicalDocs(docs) {
  return JSON.stringify(
    docs
      .map((doc) => ({ identity: identity(doc), document: doc }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );
}

function identity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function waitForRegistry(registry) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (tryCommand("curl", ["-fsS", `http://${registry}/v2/`]).ok) return;
    command("sleep", ["0.25"]);
  }
  throw new Error(`temporary registry ${registry} did not become ready`);
}

function waitForContainerRemoval(container) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const name = command("docker", [
      "ps",
      "-a",
      "--filter",
      `name=^/${container}$`,
      "--format",
      "{{.Names}}",
    ]).trim();
    if (!name) return true;
    command("sleep", ["0.1"]);
  }
  return false;
}

function cub(context, args, options = {}) {
  return command("cub", args, {
    ...options,
    env: { ...process.env, CONFIGHUB_AGENT: "1", CUB_CONTEXT: context },
  });
}

function cubTry(context, args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: { ...process.env, CONFIGHUB_AGENT: "1", CUB_CONTEXT: context },
  });
}

function cubJson(context, args) {
  return JSON.parse(cub(context, args));
}

function jsonCommand(file, args) {
  return JSON.parse(command(file, args));
}

function command(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });
}

function tryCommand(file, args, options = {}) {
  try {
    return { ok: true, out: command(file, args, options) };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
    };
  }
}

function safeRunId(value) {
  const compact = String(value)
    .replace(/\D/g, "")
    .slice(0, 14);
  check(compact.length >= 8, "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits");
  return compact;
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
