#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";

import {
  check,
  identityFor,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const committedReceiptPath = join(
  repoRoot,
  "runs",
  "anonymous-oci-ci-proof",
  "receipt.yaml",
);
const committedSummaryPath = join(
  repoRoot,
  "data",
  "anonymous-oci-ci-proof",
  "summary.md",
);
const artifactRoot = process.env.HELM_EXPT_PROOF_ARTIFACT_DIR
  ? resolve(repoRoot, process.env.HELM_EXPT_PROOF_ARTIFACT_DIR)
  : null;
const receiptPath = artifactRoot
  ? join(artifactRoot, "receipt.yaml")
  : committedReceiptPath;
const summaryPath = artifactRoot
  ? join(artifactRoot, "summary.md")
  : committedSummaryPath;
const publicationReceiptPath = join(
  repoRoot,
  "runs",
  "installer-oci",
  "bitnami-nginx",
  "24.0.2",
  "installer-package-publication-receipt.yaml",
);
const sourceReference =
  "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2";
const chart = "bitnami/nginx";
const version = "24.0.2";
const base = "http-clusterip";
const namespace = "nginx";
const expectedObjectKinds = [
  "Deployment",
  "Namespace",
  "NetworkPolicy",
  "PodDisruptionBudget",
  "Service",
  "ServiceAccount",
];

if (mode === "--run") {
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`wrote ${displayPath(receiptPath)}: ${receipt.status.result}`);
  if (receipt.status.result !== "pass") process.exitCode = 1;
} else if (mode === "--verify") {
  check(
    existsSync(committedReceiptPath),
    `${relativeRepo(committedReceiptPath)} is missing`,
  );
  const receipt = readYaml(committedReceiptPath);
  verifyReceipt(receipt);
  check(
    existsSync(committedSummaryPath)
      && readFileSync(committedSummaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(committedSummaryPath)} is stale`,
  );
  console.log("verified anonymous OCI CI proof");
} else {
  console.log(`Usage:
  node scripts/run-anonymous-oci-ci-proof.mjs --run
  node scripts/run-anonymous-oci-ci-proof.mjs --verify`);
}

function runProof() {
  check(
    process.env.GITHUB_ACTIONS === "true"
      || process.env.HELM_EXPT_ALLOW_LOCAL_CI_PROOF === "1",
    "this proof must run in GitHub Actions; set HELM_EXPT_ALLOW_LOCAL_CI_PROOF=1 only for local script testing",
  );
  check(
    artifactRoot,
    "set HELM_EXPT_PROOF_ARTIFACT_DIR so the receipt and OCI layout can be uploaded together",
  );
  const publication = readYaml(publicationReceiptPath);
  const expectedSourceDigest = publicationManifestDigest(publication);
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-anonymous-ci-"));
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AnonymousOciCiProofReceipt",
    metadata: {
      name: `public-nginx-work-oci-${process.env.GITHUB_RUN_ID ?? "local-test"}`,
    },
    spec: {
      observedAt: new Date().toISOString(),
      pathway: "OCI -> work -> OCI",
      executionMode: "ci-job",
      source: {
        chart,
        version,
        base,
        namespace,
        reference: sourceReference,
        expectedManifestDigest: expectedSourceDigest,
        observedManifestDigest: "",
        anonymousPull: "not-run",
        publicationReceipt: relativeRepo(publicationReceiptPath),
      },
      environment: {
        provider: process.env.GITHUB_ACTIONS === "true"
          ? "GitHub Actions"
          : "local CI-proof simulation",
        repository: process.env.GITHUB_REPOSITORY ?? "",
        workflow: process.env.GITHUB_WORKFLOW ?? "",
        runId: process.env.GITHUB_RUN_ID ?? "",
        runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
        runUrl: githubRunUrl(),
        commit: process.env.GITHUB_SHA ?? gitHead(),
        runnerOs: process.env.RUNNER_OS ?? process.platform,
        runnerArch: process.env.RUNNER_ARCH ?? process.arch,
        cubVersion: command("cub", ["version"]),
        installerVersion: command("cub", ["installer", "version"]),
        installerCommit: pluginCommit(),
        kustomizeVersion: command("kustomize", ["version"]),
        orasVersion: firstLine(command("oras", ["version"])),
      },
      credentials: {
        configHubTokenFiles: [],
        configHubContexts: [],
        emptyLocalContextNames: [],
        configHubCredentialEnvironmentVariables: [],
      },
      work: {
        actions: [
          "pull the public installer OCI anonymously",
          "render the http-clusterip preset with cub installer",
          "inspect the exact Kubernetes objects",
          "package the reviewed files as an OCI image layout",
          "pull the OCI layout back and compare the objects",
        ],
        objectCount: 0,
        objectKinds: [],
        reviewedObjectsSha256: "",
      },
      output: {
        kind: "local OCI image layout",
        reference: "output-layout:ci-proof",
        manifestDigest: "",
        artifactType: "application/vnd.confighub.config.v1",
        workflowArtifactPath: "output-layout",
        pullBack: "not-run",
        pulledObjectsSha256: "",
        objectsMatched: false,
      },
      limits: [
        "The output is an OCI image layout uploaded as a GitHub Actions artifact, not a public registry package.",
        "This run uses no ConfigHub account, saved history, variant, approval, cluster, or delivery controller.",
        "A hosted public service that performs this work remains planned, not shipped.",
        "This NGINX preset has no Helm hooks or CRDs. Configurations with lifecycle work still need their recorded routes.",
      ],
    },
    status: {
      result: "blocked",
      claim: "",
      error: "",
    },
  };

  try {
    validatePublication(publication);
    receipt.spec.credentials = inspectConfigHubCredentials();

    const descriptor = JSON.parse(
      command("oras", [
        "manifest",
        "fetch",
        "--descriptor",
        stripOci(sourceReference),
      ]),
    );
    receipt.spec.source.observedManifestDigest = descriptor.digest ?? "";
    check(
      receipt.spec.source.observedManifestDigest === expectedSourceDigest,
      "the anonymously resolved source digest differs from the publication receipt",
    );
    receipt.spec.source.anonymousPull = "pass";

    const rendered = renderPackage(workRoot);
    receipt.spec.work.objectCount = rendered.docs.length;
    receipt.spec.work.objectKinds = rendered.objectKinds;
    receipt.spec.work.reviewedObjectsSha256 = rendered.objectsSha256;

    const output = createAndPullOciLayout(workRoot, rendered.bundleRoot);
    mkdirSync(artifactRoot, { recursive: true });
    cpSync(output.layoutRoot, join(artifactRoot, "output-layout"), {
      recursive: true,
    });
    receipt.spec.output.manifestDigest = output.manifestDigest;
    receipt.spec.output.pullBack = "pass";
    receipt.spec.output.pulledObjectsSha256 = output.pulledObjectsSha256;
    receipt.spec.output.objectsMatched =
      output.pulledObjectsSha256 === rendered.objectsSha256;
    check(
      receipt.spec.output.objectsMatched,
      "the objects pulled from the output OCI layout differ from the reviewed objects",
    );

    receipt.status.result = "pass";
    receipt.status.claim =
      "A GitHub Actions job with no ConfigHub credentials anonymously pulled the public NGINX installer package, rendered and inspected six Kubernetes objects, packaged them as OCI, and pulled back the same object set.";
  } catch (error) {
    receipt.status.error = sanitizeError(error);
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
  return receipt;
}

function validatePublication(receipt) {
  check(
    receipt.kind === "InstallerPackagePublicationReceipt",
    "the NGINX installer publication receipt kind changed",
  );
  check(
    receipt.spec?.ref === sourceReference,
    "the NGINX installer publication reference changed",
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(publicationManifestDigest(receipt)),
    "the NGINX installer publication receipt has no manifest digest",
  );
}

function publicationManifestDigest(receipt) {
  return String(receipt.spec?.outputs?.push ?? "").match(
    /manifest:\s*(sha256:[0-9a-f]{64})/,
  )?.[1] ?? "";
}

function inspectConfigHubCredentials() {
  const tokenRoot = join(process.env.HOME ?? "", ".confighub", "tokens");
  const tokenFiles = existsSync(tokenRoot)
    ? listFiles(tokenRoot).map((path) => relative(tokenRoot, path))
    : [];
  const credentialVariables = [
    "CUB_CONTEXT",
    "CONFIGHUB_CONTEXT",
    "CONFIGHUB_TOKEN",
    "CONFIGHUB_ACCESS_TOKEN",
  ].filter((name) => process.env[name]);
  const contextOutput = command("cub", ["context", "list", "-o", "json"]).trim();
  const parsed = contextOutput ? JSON.parse(contextOutput) : null;
  const contexts = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  const accountContexts = contexts.filter((context) =>
    context?.coordinate?.organizationID
    || context?.coordinate?.user
    || context?.token);
  const emptyLocalContextNames = contexts
    .filter((context) => !accountContexts.includes(context))
    .map((context) => context?.name ?? "")
    .filter(Boolean);

  check(tokenFiles.length === 0, "the CI home contains ConfigHub token files");
  check(
    credentialVariables.length === 0,
    "the CI job exposes ConfigHub credential environment variables",
  );
  check(
    accountContexts.length === 0,
    "the CI cub context contains ConfigHub account details",
  );
  return {
    configHubTokenFiles: tokenFiles,
    configHubContexts: accountContexts,
    emptyLocalContextNames,
    configHubCredentialEnvironmentVariables: credentialVariables,
  };
}

function renderPackage(workRoot) {
  const renderRoot = join(workRoot, "render");
  command("cub", [
    "installer",
    "setup",
    "--pull",
    sourceReference,
    "--base",
    base,
    "--work-dir",
    renderRoot,
    "--non-interactive",
    "--namespace",
    namespace,
  ]);
  const manifestsRoot = join(renderRoot, "out", "manifests");
  check(existsSync(manifestsRoot), "cub installer produced no manifests directory");
  const manifestFiles = listFiles(manifestsRoot)
    .filter((path) => path.endsWith(".yaml"))
    .sort();
  const docs = manifestFiles.flatMap((path) =>
    parseDocs(readFileSync(path, "utf8")));
  const objectKinds = docs.map((doc) => doc.kind).sort();
  check(docs.length === 6, `expected 6 NGINX objects, found ${docs.length}`);
  check(
    JSON.stringify(objectKinds) === JSON.stringify([...expectedObjectKinds].sort()),
    `the NGINX object kinds changed: ${objectKinds.join(", ")}`,
  );

  const bundleRoot = join(workRoot, "reviewed-files");
  const bundleManifests = join(bundleRoot, "manifests");
  mkdirSync(bundleManifests, { recursive: true });
  for (const path of manifestFiles) {
    cpSync(path, join(bundleManifests, basename(path)));
  }
  return {
    bundleRoot,
    docs,
    objectKinds,
    objectsSha256: objectSetSha256(docs),
  };
}

function createAndPullOciLayout(workRoot, bundleRoot) {
  const push = JSON.parse(
    command(
      "oras",
      [
        "push",
        "--oci-layout",
        "output-layout:ci-proof",
        `${basename(bundleRoot)}/:application/vnd.confighub.config.layer.v1.tar`,
        "--artifact-type",
        "application/vnd.confighub.config.v1",
        "--format",
        "json",
      ],
      { cwd: workRoot },
    ),
  );
  const pullRoot = join(workRoot, "pulled");
  command(
    "oras",
    [
      "pull",
      "--oci-layout",
      "output-layout:ci-proof",
      "--output",
      basename(pullRoot),
    ],
    { cwd: workRoot },
  );
  const pulledManifests = join(
    pullRoot,
    basename(bundleRoot),
    "manifests",
  );
  check(existsSync(pulledManifests), "the output OCI pull has no manifests");
  const pulledDocs = listFiles(pulledManifests)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")));
  return {
    layoutRoot: join(workRoot, "output-layout"),
    manifestDigest: push.digest ?? "",
    pulledObjectsSha256: objectSetSha256(pulledDocs),
  };
}

function objectSetSha256(docs) {
  const ordered = docs
    .map((doc) => [identityFor(doc), doc])
    .sort(([left], [right]) => left.localeCompare(right));
  return sha256(JSON.stringify(ordered));
}

function verifyReceipt(receipt) {
  check(
    receipt.apiVersion === "catalog.confighub.com/v1alpha1"
      && receipt.kind === "AnonymousOciCiProofReceipt",
    "anonymous OCI CI receipt identity changed",
  );
  check(receipt.status?.result === "pass", "anonymous OCI CI proof did not pass");
  check(
    receipt.spec?.pathway === "OCI -> work -> OCI"
      && receipt.spec?.executionMode === "ci-job",
    "anonymous OCI CI receipt lost its flow or execution mode",
  );
  check(
    receipt.spec?.source?.reference === sourceReference
      && receipt.spec?.source?.anonymousPull === "pass"
      && receipt.spec?.source?.observedManifestDigest
        === receipt.spec?.source?.expectedManifestDigest,
    "anonymous OCI CI source pull did not pass at the recorded digest",
  );
  check(
    receipt.spec?.credentials?.configHubTokenFiles?.length === 0
      && receipt.spec?.credentials?.configHubContexts?.length === 0
      && receipt.spec?.credentials?.configHubCredentialEnvironmentVariables?.length === 0,
    "anonymous OCI CI proof used ConfigHub account state",
  );
  check(
    receipt.spec?.work?.objectCount === 6
      && receipt.spec?.work?.objectKinds?.length === 6
      && /^[0-9a-f]{64}$/.test(receipt.spec?.work?.reviewedObjectsSha256 ?? ""),
    "anonymous OCI CI proof lost its reviewed NGINX object set",
  );
  check(
    /^sha256:[0-9a-f]{64}$/.test(receipt.spec?.output?.manifestDigest ?? "")
      && receipt.spec?.output?.workflowArtifactPath === "output-layout"
      && receipt.spec?.output?.pullBack === "pass"
      && receipt.spec?.output?.objectsMatched === true
      && receipt.spec?.output?.pulledObjectsSha256
        === receipt.spec?.work?.reviewedObjectsSha256,
    "anonymous OCI CI output did not reproduce the reviewed objects",
  );
  check(
    receipt.spec?.limits?.some((line) =>
      line.includes("not a public registry package"))
      && receipt.spec?.limits?.some((line) =>
        line.includes("hosted public service")),
    "anonymous OCI CI receipt must keep its registry and hosted-service limits",
  );
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  return `# Anonymous OCI work in CI

This run checks that the public configuration tools can be used inside a CI job
without a ConfigHub account.

## Result

**${receipt.status.result.toUpperCase()}.** ${receipt.status.claim}

The job pulled [${chart}@${version}](${spec.source.reference}) at
\`${spec.source.observedManifestDigest}\`, selected the \`${base}\` preset, and
rendered ${spec.work.objectCount} Kubernetes objects:
${spec.work.objectKinds.map((kind) => `\`${kind}\``).join(", ")}.

It then packaged those reviewed files as a local OCI image layout. Pulling that
layout back produced the same object-set hash,
\`${spec.work.reviewedObjectsSha256}\`. The output manifest digest was
\`${spec.output.manifestDigest}\`.

## Where it ran

- Provider: ${spec.environment.provider}
- Workflow: ${spec.environment.workflow || "local script test"}
- Run: ${spec.environment.runUrl || "not recorded"}
- Commit: \`${spec.environment.commit}\`
- Installer source: \`${spec.environment.installerCommit}\`

## What this proves

This is the \`OCI -> work -> OCI\` shape running as a CI job. The work is
anonymous: the job had no ConfigHub token, account context, saved history,
variant, approval, or release.

The same public tools can also be used as \`OCI -> work\` when a job only needs
to inspect or test a package, or as \`work -> OCI\` when the starting point is a
repository rather than an existing OCI package.

## Limits

${spec.limits.map((line) => `- ${line}`).join("\n")}
`;
}

function command(commandName, args, options = {}) {
  return execFileSync(commandName, args, {
    cwd: options.cwd ?? repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 200,
  });
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

function stripOci(reference) {
  return reference.replace(/^oci:\/\//, "");
}

function pluginCommit() {
  if (process.env.INSTALLER_COMMIT) return process.env.INSTALLER_COMMIT;
  const pluginRoot = join(
    process.env.HOME ?? "",
    ".confighub",
    "plugins",
    "installer",
  );
  return command("git", ["-C", pluginRoot, "rev-parse", "HEAD"]).trim();
}

function gitHead() {
  return command("git", ["rev-parse", "HEAD"]).trim();
}

function githubRunUrl() {
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  return repository && runId
    ? `https://github.com/${repository}/actions/runs/${runId}`
    : "";
}

function firstLine(value) {
  return value.trim().split("\n")[0] ?? "";
}

function sanitizeError(error) {
  return String(error?.message ?? error)
    .replaceAll(process.env.HOME ?? "", "<home>")
    .replaceAll(repoRoot, "<repo>")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function displayPath(path) {
  return path.startsWith(repoRoot) ? relativeRepo(path) : path;
}
