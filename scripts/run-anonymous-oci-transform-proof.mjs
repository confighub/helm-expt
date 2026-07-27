#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  check,
  command,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";
import {
  applyFieldChange,
  objectSetSha256,
  runChecks,
  transformConfigOci,
} from "./transform-config-oci.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set(["--run", "--generate", "--verify"]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/run-anonymous-oci-transform-proof.mjs --run
  node scripts/run-anonymous-oci-transform-proof.mjs --generate
  node scripts/run-anonymous-oci-transform-proof.mjs --verify`);
  process.exit(2);
}

const publicReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "public-oci-receipt.yaml",
);
const sourceObjectsPath = join(
  repoRoot,
  "data",
  "byo-helm-values-review",
  "reviewed-render.yaml",
);
const committedExampleRoot = join(
  repoRoot,
  "examples",
  "anonymous-oci-transform",
);
const committedReceiptPath = join(
  repoRoot,
  "runs",
  "anonymous-oci-transform-proof",
  "receipt.yaml",
);
const committedSummaryPath = join(
  repoRoot,
  "data",
  "anonymous-oci-transform-proof",
  "summary.md",
);
const artifactRoot = process.env.HELM_EXPT_PROOF_ARTIFACT_DIR
  ? resolve(repoRoot, process.env.HELM_EXPT_PROOF_ARTIFACT_DIR)
  : null;
const exampleRoot = artifactRoot ?? committedExampleRoot;
const layoutRoot = join(exampleRoot, "output-layout");
const reviewedRoot = join(exampleRoot, "reviewed-output");
const receiptPath = artifactRoot
  ? join(artifactRoot, "receipt.yaml")
  : committedReceiptPath;
const summaryPath = artifactRoot
  ? join(artifactRoot, "summary.md")
  : committedSummaryPath;
const sourceReference =
  "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/byo-nginx-ai-values@sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683";
const outputTag = "replicas-4";
const changeOptions = {
  object: "Deployment/nginx",
  namespace: "nginx",
  field: "spec.replicas",
  value: 4,
};

if (mode === "--run") {
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyProof(receipt, layoutRoot, reviewedRoot);
  console.log(`wrote ${displayPath(receiptPath)}: ${receipt.status.result}`);
} else if (mode === "--generate") {
  const receipt = readYaml(committedReceiptPath);
  verifyProof(receipt, join(committedExampleRoot, "output-layout"), join(committedExampleRoot, "reviewed-output"));
  write(committedSummaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(committedSummaryPath)}`);
} else {
  check(
    existsSync(committedReceiptPath),
    `${relativeRepo(committedReceiptPath)} is missing; run the proof`,
  );
  check(
    existsSync(committedSummaryPath),
    `${relativeRepo(committedSummaryPath)} is missing; run the generator`,
  );
  const receipt = readYaml(committedReceiptPath);
  verifyProof(
    receipt,
    join(committedExampleRoot, "output-layout"),
    join(committedExampleRoot, "reviewed-output"),
  );
  check(
    readFileSync(committedSummaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(committedSummaryPath)} is stale; run npm run anonymous-oci-transform:generate`,
  );
  console.log("verified the anonymous OCI-to-OCI transformation proof");
}

function runProof() {
  const publicReceipt = readYaml(publicReceiptPath);
  verifyPublicReceipt(publicReceipt);
  mkdirSync(exampleRoot, { recursive: true });
  rmSync(reviewedRoot, { recursive: true, force: true });

  const report = transformConfigOci({
    source: sourceReference,
    output: `oci-layout:${layoutRoot}:${outputTag}`,
    ...changeOptions,
    description: "Reviewed NGINX configuration with four replicas",
    replaceOutput: true,
    context: {
      chart: "bitnami/nginx",
      chartVersion: "24.0.2",
      values: "examples/byo-helm-values/reviewed-values.yaml",
      review: "data/byo-helm-values-review/review.yaml",
    },
  });
  check(report.input.anonymousPull, "the input did not use the anonymous pull path");
  check(report.output.pullBack === "pass", "the transformation pull-back did not pass");

  mkdirSync(reviewedRoot, { recursive: true });
  command("oras", [
    "pull",
    "--oci-layout",
    `${layoutRoot}:${outputTag}`,
    "--output",
    reviewedRoot,
    "--no-tty",
  ]);

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AnonymousOciTransformProofReceipt",
    metadata: {
      name: "byo-nginx-ai-values-replicas-4",
    },
    spec: {
      observedAt: new Date().toISOString(),
      pathway: "OCI -> work -> OCI",
      sourceContext: {
        chart: "bitnami/nginx",
        chartVersion: "24.0.2",
        values: "examples/byo-helm-values/reviewed-values.yaml",
        review: "data/byo-helm-values-review/review.yaml",
      },
      input: {
        reference: sourceReference,
        manifestDigest: report.input.resolvedDigest,
        artifactType: report.input.artifactType,
        objectCount: report.input.objectCount,
        objectSetSha256: report.input.objectSetSha256,
        anonymousPull: "pass",
        registryCredentials: "empty auth map",
        publicationReceipt: relativeRepo(publicReceiptPath),
      },
      change: report.change,
      checks: report.checks,
      output: {
        kind: "local OCI image layout",
        tag: outputTag,
        committedLayout: artifactRoot
          ? "output-layout"
          : relativeRepo(layoutRoot),
        reviewedFiles: artifactRoot
          ? "reviewed-output"
          : relativeRepo(reviewedRoot),
        manifestDigest: report.output.manifestDigest,
        artifactType: report.output.artifactType,
        objectCount: report.output.objectCount,
        objectSetSha256: report.output.objectSetSha256,
        pullBack: report.output.pullBack,
        sourceRecord: "records/source.json",
        changeRecord: "records/change.json",
        checkRecord: "records/checks.json",
      },
      ConfigHub: {
        used: false,
        account: false,
        server: false,
        Space: false,
        Unit: false,
        variant: false,
      },
      limits: report.limits,
    },
    status: {
      result: report.status.result,
      claim:
        "With no ConfigHub account or server, the public five-object NGINX OCI was pulled at its recorded digest, changed only from three to four replicas, checked, rebuilt as a new OCI image layout, and pulled back to the reviewed object set.",
    },
  };
  verifyProof(receipt, layoutRoot, reviewedRoot);
  return receipt;
}

function verifyProof(receipt, currentLayoutRoot, currentReviewedRoot) {
  check(
    receipt.kind === "AnonymousOciTransformProofReceipt",
    "anonymous OCI transformation receipt kind changed",
  );
  check(
    receipt.metadata?.name === "byo-nginx-ai-values-replicas-4",
    "anonymous OCI transformation receipt identity changed",
  );
  check(
    ["pass", "pass-with-warnings"].includes(receipt.status?.result),
    "anonymous OCI transformation proof did not pass",
  );
  check(
    receipt.spec?.pathway === "OCI -> work -> OCI",
    "anonymous OCI transformation pathway changed",
  );
  check(
    receipt.spec?.input?.reference === sourceReference,
    "anonymous OCI transformation source changed",
  );
  check(
    receipt.spec?.input?.anonymousPull === "pass"
      && receipt.spec?.input?.registryCredentials === "empty auth map",
    "anonymous OCI transformation lost its credential-free pull evidence",
  );
  check(
    Object.values(receipt.spec?.ConfigHub ?? {}).every((value) => value === false),
    "anonymous OCI transformation must not use ConfigHub state",
  );

  const publicReceipt = readYaml(publicReceiptPath);
  verifyPublicReceipt(publicReceipt);
  const sourceDocs = parseDocs(readFileSync(sourceObjectsPath, "utf8"));
  const sourceHash = objectSetSha256(sourceDocs);
  check(
    sourceHash === publicReceipt.spec.artifact.objectSetSha256,
    "the committed reviewed NGINX objects differ from the public OCI receipt",
  );
  check(
    receipt.spec.input.manifestDigest === publicReceipt.spec.artifact.digest,
    "the transformation input digest differs from the public OCI receipt",
  );
  check(
    receipt.spec.input.objectSetSha256 === sourceHash,
    "the transformation input object hash differs from the reviewed source",
  );

  const expectedDocs = structuredClone(sourceDocs);
  const expectedChange = applyFieldChange(expectedDocs, changeOptions);
  const expectedOutputHash = objectSetSha256(expectedDocs);
  check(
    stableJson(receipt.spec.change) === stableJson(expectedChange),
    "the recorded change is not Deployment/nginx replicas 3 -> 4",
  );
  check(
    receipt.spec.output.objectSetSha256 === expectedOutputHash,
    "the output object hash is not the expected one-field change",
  );
  const expectedChecks = {
    decision: runChecks(sourceDocs, expectedDocs, expectedChange).some(
        (item) => item.result === "warn",
      )
      ? "allow-with-warnings"
      : "allow",
    results: runChecks(sourceDocs, expectedDocs, expectedChange),
  };
  check(
    stableJson(receipt.spec.checks) === stableJson(expectedChecks),
    "the transformation check results changed",
  );

  check(
    existsSync(currentLayoutRoot),
    `${displayPath(currentLayoutRoot)} is missing`,
  );
  check(
    existsSync(join(currentReviewedRoot, "manifests", "release-objects.yaml")),
    `${displayPath(currentReviewedRoot)} is missing the reviewed manifest`,
  );
  const reviewedDocs = parseDocs(
    readFileSync(
      join(currentReviewedRoot, "manifests", "release-objects.yaml"),
      "utf8",
    ),
  );
  check(
    objectSetSha256(reviewedDocs) === expectedOutputHash,
    "the reviewed output files differ from the expected object set",
  );
  const sourceRecord = readJson(
    join(currentReviewedRoot, "records", "source.json"),
  );
  const changeRecord = readJson(
    join(currentReviewedRoot, "records", "change.json"),
  );
  const checkRecord = readJson(
    join(currentReviewedRoot, "records", "checks.json"),
  );
  check(
    sourceRecord.input?.reference === sourceReference
      && sourceRecord.input?.resolvedDigest === publicReceipt.spec.artifact.digest
      && sourceRecord.input?.objectSetSha256 === sourceHash,
    "the output source record lost the input identity",
  );
  check(
    stableJson(changeRecord.changes) === stableJson([expectedChange])
      && changeRecord.sourceObjectSetSha256 === sourceHash
      && changeRecord.outputObjectSetSha256 === expectedOutputHash,
    "the output change record differs from the reviewed change",
  );
  check(
    stableJson(checkRecord) === stableJson({
      schemaVersion: 1,
      decision: expectedChecks.decision,
      checks: expectedChecks.results,
    }),
    "the output check record differs from the receipt",
  );

  const layoutReference = `${currentLayoutRoot}:${outputTag}`;
  const resolvedDigest = command("oras", [
    "resolve",
    "--oci-layout",
    layoutReference,
  ]).trim();
  check(
    resolvedDigest === receipt.spec.output.manifestDigest,
    "the committed output OCI digest differs from the receipt",
  );
  const manifest = JSON.parse(
    command("oras", [
      "manifest",
      "fetch",
      "--oci-layout",
      layoutReference,
    ]),
  );
  check(
    manifest.artifactType === "application/vnd.confighub.kubernetes.config.v1",
    "the output OCI artifact type changed",
  );
  check(
    manifest.annotations?.["org.opencontainers.image.base.digest"]
      === publicReceipt.spec.artifact.digest,
    "the output OCI manifest lost the source digest",
  );

  const pullRoot = mkdtempSync(join(tmpdir(), "helm-expt-transform-verify-"));
  try {
    command("oras", [
      "pull",
      "--oci-layout",
      layoutReference,
      "--output",
      pullRoot,
      "--no-tty",
    ]);
    const pulledDocs = parseDocs(
      readFileSync(join(pullRoot, "manifests", "release-objects.yaml"), "utf8"),
    );
    check(
      objectSetSha256(pulledDocs) === expectedOutputHash,
      "the committed OCI pull-back differs from the reviewed objects",
    );
    check(
      stableJson(readJson(join(pullRoot, "records", "source.json")))
        === stableJson(sourceRecord)
      && stableJson(readJson(join(pullRoot, "records", "change.json")))
        === stableJson(changeRecord)
      && stableJson(readJson(join(pullRoot, "records", "checks.json")))
        === stableJson(checkRecord),
      "the committed OCI pull-back changed its records",
    );
  } finally {
    rmSync(pullRoot, { recursive: true, force: true });
  }

  check(
    receipt.spec.output.pullBack === "pass"
      && receipt.spec.output.objectCount === 5,
    "the transformation lost its five-object pull-back result",
  );
  check(
    receipt.spec.limits.some((item) =>
      item.includes("local OCI image layout")
    ),
    "the receipt must say that registry publication is separate",
  );
  verifySecondGenerationPreservesRecords(currentLayoutRoot);
}

function verifyPublicReceipt(receipt) {
  check(receipt.kind === "PublicOciReceipt", "public OCI receipt kind changed");
  check(receipt.status?.result === "pass", "public OCI receipt did not pass");
  check(
    receipt.spec?.artifact?.digest
      === "sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683",
    "public NGINX OCI digest changed",
  );
  check(
    receipt.spec?.artifact?.anonymousPull === "pass",
    "public NGINX OCI is not recorded as anonymously pullable",
  );
}

function verifySecondGenerationPreservesRecords(currentLayoutRoot) {
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-transform-chain-"));
  const secondLayout = join(workRoot, "output-layout");
  const pulledRoot = join(workRoot, "pulled");
  try {
    const report = transformConfigOci({
      source: `oci-layout:${currentLayoutRoot}:${outputTag}`,
      output: `oci-layout:${secondLayout}:replicas-5`,
      object: "Deployment/nginx",
      namespace: "nginx",
      field: "spec.replicas",
      value: 5,
    });
    check(
      stableJson(report.input.companionFiles) === stableJson([
        "records/change.json",
        "records/checks.json",
        "records/source.json",
      ]),
      "a second transformation did not find the first output records",
    );
    mkdirSync(pulledRoot, { recursive: true });
    command("oras", [
      "pull",
      "--oci-layout",
      `${secondLayout}:replicas-5`,
      "--output",
      pulledRoot,
      "--no-tty",
    ]);
    for (const name of ["change.json", "checks.json", "source.json"]) {
      check(
        readFileSync(join(pulledRoot, "records", "input", "records", name), "utf8")
          === readFileSync(
            join(
              currentLayoutRoot,
              "..",
              "reviewed-output",
              "records",
              name,
            ),
            "utf8",
          ),
        `a second transformation did not preserve records/${name}`,
      );
    }
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

function renderSummary(receipt) {
  const resultLabel = receipt.status.result === "pass-with-warnings"
    ? "Passed with one warning."
    : "Passed.";
  const checkRows = receipt.spec.checks.results
    .map((item) =>
      `| \`${item.id}\` | ${item.result} | ${item.detail} |`
    )
    .join("\n");
  return `# Anonymous OCI-to-OCI change

This test starts with a public OCI package containing five reviewed NGINX
objects. It pulls the package without registry credentials, changes the NGINX
Deployment from three replicas to four, runs checks, and writes a new local OCI
image layout. No ConfigHub account or server is involved.

## Result

**${resultLabel}** ${receipt.status.claim}

| Item | Recorded result |
|---|---|
| Input | \`${receipt.spec.input.reference}\` |
| Input objects | ${receipt.spec.input.objectCount} at \`${receipt.spec.input.objectSetSha256}\` |
| Change | \`${receipt.spec.change.object} ${receipt.spec.change.field}\`: ${receipt.spec.change.before} to ${receipt.spec.change.after} |
| Output OCI | \`${receipt.spec.output.manifestDigest}\` |
| Output objects | ${receipt.spec.output.objectCount} at \`${receipt.spec.output.objectSetSha256}\` |
| Pull-back comparison | ${receipt.spec.output.pullBack} |

## Checks

| Check | Result | What it found |
|---|---|---|
${checkRows}

The external Secret warning is expected. The package refers to
\`nginx/ai-provider-credentials\`, so that Secret must be supplied before
deployment. The warning stays with the output records.

## Repeat it

\`\`\`bash
npm run oci:transform -- \\
  ${receipt.spec.input.reference} \\
  --object Deployment/nginx \\
  --namespace nginx \\
  --field spec.replicas \\
  --value 4 \\
  --output oci-layout:./nginx-replicas-4:reviewed
\`\`\`

The command writes Kubernetes YAML, a source record, the exact field change,
and the check results into the new OCI image. It then pulls the image back and
compares the objects and records.

## Evidence

- Receipt: [\`${relativeRepo(committedReceiptPath)}\`](../../${relativeRepo(committedReceiptPath)})
- Reviewed Kubernetes YAML: [\`examples/anonymous-oci-transform/reviewed-output/manifests/release-objects.yaml\`](../../examples/anonymous-oci-transform/reviewed-output/manifests/release-objects.yaml)
- Source record: [\`examples/anonymous-oci-transform/reviewed-output/records/source.json\`](../../examples/anonymous-oci-transform/reviewed-output/records/source.json)
- Change record: [\`examples/anonymous-oci-transform/reviewed-output/records/change.json\`](../../examples/anonymous-oci-transform/reviewed-output/records/change.json)
- Check record: [\`examples/anonymous-oci-transform/reviewed-output/records/checks.json\`](../../examples/anonymous-oci-transform/reviewed-output/records/checks.json)
- OCI image index: [\`examples/anonymous-oci-transform/output-layout/index.json\`](../../examples/anonymous-oci-transform/output-layout/index.json)
- Input publication receipt: [\`${relativeRepo(publicReceiptPath)}\`](../../${relativeRepo(publicReceiptPath)})

## Limits

${receipt.spec.limits.map((item) => `- ${item}`).join("\n")}

The output is committed as a local OCI image layout. Publishing it to a registry,
uploading it to ConfigHub, or deploying it to Kubernetes are separate actions.
`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function displayPath(path) {
  return path.startsWith(repoRoot) ? relativeRepo(path) : path;
}
