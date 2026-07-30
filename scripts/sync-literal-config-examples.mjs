#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
import { objectSetSha256 } from "./transform-config-oci.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set([
  "--publish-oci",
  "--public-verify",
  "--hub-sync",
  "--hub-verify",
  "--generate",
  "--verify",
]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/sync-literal-config-examples.mjs --publish-oci
  node scripts/sync-literal-config-examples.mjs --public-verify
  node scripts/sync-literal-config-examples.mjs --hub-sync
  node scripts/sync-literal-config-examples.mjs --hub-verify
  node scripts/sync-literal-config-examples.mjs --generate
  node scripts/sync-literal-config-examples.mjs --verify`);
  process.exit(2);
}

const cubContext = process.env.CUB_CONTEXT ?? "river-bear";
const expectedOrg = "helm-catalog";
const triggerFilterRef = "platform/helm-catalog-checks";
const policyPath = join(
  repoRoot,
  "config-catalog",
  "policies",
  "catalog-standard.yaml",
);
const policy = readYaml(policyPath);
const expectedCheckSlugs = policy.spec.baseline.checks
  .map((item) => item.trigger.split("/").at(-1))
  .sort();

const transformExampleRoot = join(
  repoRoot,
  "examples",
  "anonymous-oci-transform",
);
const transformLayoutRoot = join(transformExampleRoot, "output-layout");
const transformOutputRoot = join(transformExampleRoot, "reviewed-output");
const transformReceiptPath = join(
  repoRoot,
  "runs",
  "anonymous-oci-transform-proof",
  "receipt.yaml",
);
const publicOciReceiptPath = join(
  repoRoot,
  "runs",
  "anonymous-oci-transform-proof",
  "public-oci-receipt.yaml",
);
const publicOciRepository =
  "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/nginx-replicas-4";
const publicOciReference = `${publicOciRepository}:reviewed-r001`;
const ociImporterCommit =
  "1e63db4bc767368203660579bfb0a282443c7505";
const ociImporterPullRequest = "https://github.com/confighub/sdk/pull/11";
const transformReceipt = readYaml(transformReceiptPath);
const expectedPublicDigest = transformReceipt.spec.output.manifestDigest;
const transformedDocs = parseDocs(
  readFileSync(
    join(transformOutputRoot, "manifests", "release-objects.yaml"),
    "utf8",
  ),
);

const plainYamlRoot = join(
  repoRoot,
  "examples",
  "plain-yaml",
  "acme-web",
);
const plainYamlDocs = yamlFiles(plainYamlRoot)
  .flatMap((path) => parseDocs(readFileSync(path, "utf8")));

const definitions = [
  {
    id: "plain-yaml",
    title: "Plain YAML to ConfigHub",
    component: "plain-yaml-acme-web",
    variant: "base",
    space: "plain-yaml-acme-web-base",
    inputFormat: "KubernetesYAML",
    sourceKind: "repository files",
    source: relativeRepo(plainYamlRoot),
    uploadInput: plainYamlRoot,
    docs: plainYamlDocs,
    receiptPath: join(
      repoRoot,
      "runs",
      "literal-yaml-upload-proof",
      "receipt.yaml",
    ),
    readmePath: join(
      repoRoot,
      "data",
      "helm-catalog-readmes",
      "units",
      "plain-yaml-acme-web-base",
      "readme.yaml",
    ),
    commandInput: "examples/plain-yaml/acme-web",
    claim:
      "ConfigHub stored the four exact Kubernetes objects supplied as plain YAML, with one Unit per object and no render step.",
  },
  {
    id: "existing-oci",
    title: "Existing OCI to ConfigHub",
    component: "existing-oci-nginx",
    variant: "replicas-4",
    space: "existing-oci-nginx-replicas-4",
    inputFormat: "LiteralOCI",
    sourceKind: "public literal configuration OCI",
    source: `${publicOciRepository}@${expectedPublicDigest}`,
    uploadInput: `${publicOciRepository}@${expectedPublicDigest}`,
    docs: transformedDocs,
    receiptPath: join(
      repoRoot,
      "runs",
      "existing-oci-upload-proof",
      "receipt.yaml",
    ),
    readmePath: join(
      repoRoot,
      "data",
      "helm-catalog-readmes",
      "units",
      "existing-oci-nginx-replicas-4",
      "readme.yaml",
    ),
    commandInput: `${publicOciRepository}@${expectedPublicDigest}`,
    claim:
      "ConfigHub stored the five exact Kubernetes objects pulled from the public OCI, recorded its immutable source digest, and did not rerender Helm.",
  },
];

verifyLocalInputs();

if (mode === "--publish-oci") {
  check(
    process.env.HELM_EXPT_ALLOW_PUBLIC_LITERAL_OCI === "1",
    "set HELM_EXPT_ALLOW_PUBLIC_LITERAL_OCI=1 to publish the reviewed OCI",
  );
  const receipt = publishOci();
  writeYaml(publicOciReceiptPath, receipt);
  verifyPublicReceipt(receipt);
  console.log(`published and anonymously verified ${publicOciReference}`);
} else if (mode === "--public-verify") {
  const receipt = verifyPublicReceipt(readYaml(publicOciReceiptPath));
  verifyAnonymousPull(receipt.spec.artifact.immutableReference);
  console.log("verified the permanent public OCI by anonymous pull");
} else if (mode === "--hub-sync") {
  check(
    process.env.HELM_EXPT_ALLOW_LITERAL_CONFIG_HUB_SYNC === "1",
    "set HELM_EXPT_ALLOW_LITERAL_CONFIG_HUB_SYNC=1 to update the live demo Spaces",
  );
  assertOrg();
  verifyPublicReceipt(readYaml(publicOciReceiptPath));
  const previousContext = currentContextName();
  try {
    if (previousContext !== cubContext) useContext(cubContext);
    for (const definition of definitions) {
      syncSpace(definition);
      syncPolicy(definition);
      upsertReadme(definition);
      const receipt = collectHubReceipt(definition);
      writeYaml(definition.receiptPath, receipt);
      verifyHubReceipt(definition, receipt);
      verifyLiveAgainstReceipt(definition, receipt);
      console.log(`synchronized ${definition.space}`);
    }
    writeSummary();
  } finally {
    if (previousContext !== cubContext) useContext(previousContext);
  }
} else if (mode === "--hub-verify") {
  assertOrg();
  verifyPublicReceipt(readYaml(publicOciReceiptPath));
  for (const definition of definitions) {
    const receipt = verifyHubReceipt(
      definition,
      readYaml(definition.receiptPath),
    );
    verifyLiveAgainstReceipt(definition, receipt);
    console.log(`verified live example ${definition.space}`);
  }
} else if (mode === "--generate") {
  verifyPublicReceipt(readYaml(publicOciReceiptPath));
  for (const definition of definitions) {
    verifyHubReceipt(definition, readYaml(definition.receiptPath));
  }
  writeSummary();
  console.log("wrote the literal configuration examples summary");
} else {
  verifyPublicReceipt(readYaml(publicOciReceiptPath));
  for (const definition of definitions) {
    verifyHubReceipt(definition, readYaml(definition.receiptPath));
  }
  const expected = renderSummary();
  check(
    existsSync(summaryPath())
      && readFileSync(summaryPath(), "utf8") === expected,
    `${relativeRepo(summaryPath())} is stale`,
  );
  console.log("verified the permanent plain-YAML and existing-OCI examples");
}

function verifyLocalInputs() {
  check(
    transformReceipt.kind === "AnonymousOciTransformProofReceipt"
      && ["pass", "pass-with-warnings"].includes(transformReceipt.status?.result),
    "the local OCI transformation receipt is missing or not pass",
  );
  check(
    /^sha256:[a-f0-9]{64}$/.test(expectedPublicDigest),
    "the local OCI transformation has no manifest digest",
  );
  check(transformedDocs.length === 5, "the transformed OCI must contain five objects");
  check(
    objectSetSha256(transformedDocs)
      === transformReceipt.spec.output.objectSetSha256,
    "the transformed files differ from the transformation receipt",
  );
  check(plainYamlDocs.length === 4, "the plain YAML example must contain four objects");
  check(
    sameSet(
      plainYamlDocs.map(identityFor),
      [
        "v1|ConfigMap|acme-web|acme-web-content",
        "v1|Namespace||acme-web",
        "apps/v1|Deployment|acme-web|acme-web",
        "v1|Service|acme-web|acme-web",
      ],
    ),
    "the plain YAML object inventory changed",
  );
  for (const definition of definitions) {
    check(
      existsSync(definition.readmePath),
      `${relativeRepo(definition.readmePath)} is missing; run npm run helm-catalog-readmes`,
    );
  }
  const immutableReference = `${publicOciRepository}@${expectedPublicDigest}`;
  for (const path of [
    join(repoRoot, "docs", "user", "inspect-oci-package.md"),
    join(repoRoot, "docs", "user", "transform-oci-package.md"),
  ]) {
    check(
      readFileSync(path, "utf8").includes(immutableReference),
      `${relativeRepo(path)} does not name the permanent OCI at its recorded digest`,
    );
  }
}

function publishOci() {
  command("oras", [
    "cp",
    "--from-oci-layout",
    `${transformLayoutRoot}:replicas-4`,
    stripOci(publicOciReference),
  ], { inherit: true, timeout: 420_000 });
  const descriptor = JSON.parse(command("oras", [
    "manifest",
    "fetch",
    "--descriptor",
    stripOci(publicOciReference),
  ]).output);
  check(
    descriptor.digest === expectedPublicDigest,
    `published digest ${descriptor.digest} differs from ${expectedPublicDigest}`,
  );
  const pulled = verifyAnonymousPull(
    `${publicOciRepository}@${expectedPublicDigest}`,
  );
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "PublicOciReceipt",
    metadata: {
      name: "nginx-replicas-4-reviewed",
    },
    spec: {
      verifiedAt: new Date().toISOString(),
      registry: "Google Artifact Registry",
      project: "nth-fort-499605-q5",
      location: "europe-west1",
      repository: "helm-expt",
      role: "reviewed literal Kubernetes configuration",
      artifact: {
        reference: publicOciReference,
        immutableReference: `${publicOciRepository}@${expectedPublicDigest}`,
        digest: expectedPublicDigest,
        artifactType: "application/vnd.confighub.kubernetes.config.v1",
        objectCount: transformedDocs.length,
        objectSetSha256: objectSetSha256(transformedDocs),
        companionRecords: pulled.recordHashes,
        authenticatedPush: "pass",
        anonymousPull: "pass",
      },
      source: {
        localLayout: "examples/anonymous-oci-transform/output-layout",
        reviewedFiles:
          "examples/anonymous-oci-transform/reviewed-output",
        transformationReceipt: relativeRepo(transformReceiptPath),
      },
    },
    status: {
      result: "pass",
      claim:
        "The reviewed five-object NGINX change is permanently available as a public OCI at the recorded digest, including its source, change, and check records.",
      limits: [
        "This publication receipt proves artifact identity and anonymous pull-back. It does not prove cluster admission, controller reconciliation, workload health, or a signature.",
        "The external Secret named by the NGINX Deployment is not stored in the public artifact.",
      ],
    },
  };
}

function verifyAnonymousPull(reference) {
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-public-literal-"));
  try {
    const registryConfig = join(workRoot, "config.json");
    const pulledRoot = join(workRoot, "pulled");
    writeFileSync(registryConfig, '{"auths":{}}\n');
    command("oras", [
      "pull",
      "--registry-config",
      registryConfig,
      "--output",
      pulledRoot,
      "--no-tty",
      stripOci(reference),
    ]);
    const pulledDocs = parseDocs(
      readFileSync(
        join(pulledRoot, "manifests", "release-objects.yaml"),
        "utf8",
      ),
    );
    check(
      objectSetSha256(pulledDocs) === objectSetSha256(transformedDocs),
      "the anonymous OCI pull produced different Kubernetes objects",
    );
    const recordHashes = {};
    for (const name of ["source.json", "change.json", "checks.json"]) {
      const pulled = join(pulledRoot, "records", name);
      const committed = join(transformOutputRoot, "records", name);
      check(existsSync(pulled), `the public OCI is missing records/${name}`);
      check(
        sha256(readFileSync(pulled)) === sha256(readFileSync(committed)),
        `the public OCI changed records/${name}`,
      );
      recordHashes[name] = sha256(readFileSync(pulled));
    }
    return {
      objectSetSha256: objectSetSha256(pulledDocs),
      recordHashes,
    };
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

function verifyPublicReceipt(receipt) {
  check(
    existsSync(publicOciReceiptPath),
    `${relativeRepo(publicOciReceiptPath)} is missing; publish the OCI`,
  );
  check(
    receipt.kind === "PublicOciReceipt"
      && receipt.status?.result === "pass"
      && receipt.spec?.role === "reviewed literal Kubernetes configuration"
      && receipt.spec?.artifact?.reference === publicOciReference
      && receipt.spec?.artifact?.immutableReference
        === `${publicOciRepository}@${expectedPublicDigest}`
      && receipt.spec?.artifact?.digest === expectedPublicDigest
      && receipt.spec?.artifact?.objectCount === 5
      && receipt.spec?.artifact?.objectSetSha256
        === objectSetSha256(transformedDocs)
      && receipt.spec?.artifact?.authenticatedPush === "pass"
      && receipt.spec?.artifact?.anonymousPull === "pass",
    "the permanent public OCI receipt changed",
  );
  for (const name of ["source.json", "change.json", "checks.json"]) {
    check(
      receipt.spec.artifact.companionRecords?.[name]
        === sha256(readFileSync(join(transformOutputRoot, "records", name))),
      `the public receipt lost records/${name}`,
    );
  }
  return receipt;
}

function syncSpace(definition) {
  const existing = cubTry([
    "space",
    "get",
    definition.space,
    "-o",
    "name",
    "--quiet",
  ]);
  if (existing.ok) {
    console.log(`reusing existing Space ${definition.space}`);
    return;
  }
  cub([
    "variant",
    "upload",
    "--allow-exists",
    "--component",
    definition.component,
    "--variant",
    definition.variant,
    "--space",
    definition.space,
    "--granularity",
    "per-resource",
    "--label",
    "SourceType=rendered-config",
    "--label",
    `InputFormat=${definition.inputFormat}`,
    "--label",
    "ResourceClass=user-workload",
    "--layer",
    "Application",
    "--owner",
    "Application",
    "--change-desc",
    definition.id === "plain-yaml"
      ? "Import the reviewed plain YAML application without rendering"
      : "Import the reviewed public OCI without rerendering Helm",
    definition.uploadInput,
  ], { inherit: true, timeout: 420_000 });
}

function syncPolicy(definition) {
  cub([
    "space",
    "update",
    definition.space,
    "--label",
    "ApplyPolicyProfile=catalog-standard",
    "--label",
    "SourceType=rendered-config",
    "--label",
    `InputFormat=${definition.inputFormat}`,
    "--label",
    "ResourceClass=user-workload",
    "--trigger-filter",
    triggerFilterRef,
    "--where-trigger",
    "-",
    "--quiet",
  ]);
  cub([
    "space",
    "update",
    "--patch",
    definition.space,
    "--refresh-triggers",
    "--quiet",
  ]);
}

function upsertReadme(definition) {
  const existing = cubTry([
    "unit",
    "get",
    "--space",
    definition.space,
    "readme",
    "-o",
    "name",
    "--quiet",
  ]);
  cub([
    "unit",
    existing.ok ? "update" : "create",
    "--space",
    definition.space,
    "readme",
    definition.readmePath,
    "--change-desc",
    `Explain the ${definition.title.toLowerCase()} example`,
    "--label",
    "helm-expt.confighub.com/readme=true",
    "--label",
    `helm-expt.confighub.com/source-space=${definition.space}`,
    "--quiet",
  ]);
}

function collectHubReceipt(definition) {
  const live = inspectLive(definition);
  const externalSources = externalSourceRecords(live.space);
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "LiteralConfigUploadReceipt",
    metadata: {
      name: definition.space,
    },
    spec: {
      organization: expectedOrg,
      verifiedAt: new Date().toISOString(),
      command: [
        "cub",
        "variant",
        "upload",
        "--component",
        definition.component,
        "--variant",
        definition.variant,
        "--space",
        definition.space,
        "--granularity",
        "per-resource",
        definition.commandInput,
      ],
      source: {
        kind: definition.sourceKind,
        reference: definition.source,
        objectCount: definition.docs.length,
        objectSetSha256: objectSetSha256(definition.docs),
        publicReceipt: definition.id === "existing-oci"
          ? relativeRepo(publicOciReceiptPath)
          : "",
        importer: definition.id === "existing-oci"
          ? {
            repository: "https://github.com/confighub/sdk",
            commit: ociImporterCommit,
            pullRequest: ociImporterPullRequest,
            releaseStatus:
              "merged after v0.2.5; awaiting the next cub release",
          }
          : {},
      },
      space: {
        slug: definition.space,
        id: live.space.SpaceID,
        labels: live.space.Labels,
        externalSource: externalSources[0]?.ref ?? "",
        externalSourceDigest: externalSources[0]?.digest ?? "",
        externalSourceGranularity:
          externalSources[0]?.granularity ?? "",
        triggerFilterId: live.space.TriggerFilterID,
      },
      units: live.units.map((unit) => ({
        slug: unit.Slug,
        id: unit.UnitID,
        dataHash: unit.DataHash,
        headRevision: unit.HeadRevisionNum,
        objectIdentities: parseDocs(storedData(unit)).map(identityFor),
      })),
      readme: {
        slug: live.readme.Slug,
        id: live.readme.UnitID,
        dataHash: live.readme.DataHash,
        headRevision: live.readme.HeadRevisionNum,
        source: relativeRepo(definition.readmePath),
      },
      storedObjectCount: live.docs.length,
      storedObjectSetSha256: objectSetSha256(live.docs),
      sourceObjectsMatched: true,
      renderStep: false,
      policy: {
        profile: policy.metadata.name,
        filter: triggerFilterRef,
        filterId: live.filter.FilterID,
        filterHash: String(live.filter.Hash ?? "").trim(),
        filterWhere: live.filter.Where,
        checks: live.triggerSlugs,
      },
    },
    status: {
      result: "pass",
      claim: definition.claim,
      apply: "not-run",
      delivery: "not-run",
      observation: "not-run",
      limits: [
        "This receipt proves the ConfigHub import boundary. It does not claim Kubernetes apply, controller delivery, workload health, promotion, or rollback.",
        "The README is a separate explanatory Unit and is excluded from the Kubernetes object comparison.",
        ...(definition.id === "existing-oci"
          ? [
            "Direct import of OCI packages with companion JSON records used the merged SDK fix recorded in this receipt. cub v0.2.5 users must extract manifests/release-objects.yaml first or wait for the next cub release.",
          ]
          : []),
      ],
    },
  };
}

function inspectLive(definition) {
  const space = cubJson([
    "space",
    "get",
    definition.space,
    "-o",
    "json",
  ]).Space;
  const listed = cubJson([
    "unit",
    "list",
    "--space",
    definition.space,
    "-o",
    "json",
  ]);
  const list = listed.Units ?? listed.units ?? listed;
  check(Array.isArray(list), "cub unit list returned an unexpected shape");
  const allUnits = list
    .map((item) => item.Unit ?? item)
    .map((item) => cubJson([
      "unit",
      "get",
      "--space",
      definition.space,
      item.Slug,
      "-o",
      "json",
    ]).Unit);
  const readmes = allUnits.filter((item) =>
    item.Slug.toLowerCase().includes("readme")
  );
  check(
    readmes.length === 1 && readmes[0].Slug === "readme",
    `${definition.space} must contain exactly one README Unit`,
  );
  const units = allUnits
    .filter((item) => item.Slug !== "readme")
    .sort((left, right) => left.Slug.localeCompare(right.Slug));
  const docs = units.flatMap((unit) => parseDocs(storedData(unit)));
  check(
    objectSetSha256(docs) === objectSetSha256(definition.docs),
    `${definition.space} stored objects differ from its source`,
  );
  const [filterSpace, filterSlug] = triggerFilterRef.split("/");
  const filter = cubJson([
    "filter",
    "get",
    "--space",
    filterSpace,
    filterSlug,
    "-o",
    "json",
  ]).Filter;
  check(
    space.TriggerFilterID === filter.FilterID,
    `${definition.space} is not using the catalog-standard filter`,
  );
  const triggerRows = cubJson([
    "trigger",
    "list",
    "--space",
    filterSpace,
    "-o",
    "json",
  ]);
  const triggerList =
    triggerRows.Triggers ?? triggerRows.triggers ?? triggerRows;
  const selectedIds = new Set(space.TriggerIDs ?? []);
  const triggerSlugs = triggerList
    .map((item) => item.Trigger ?? item)
    .filter((item) => selectedIds.has(item.TriggerID))
    .map((item) => item.Slug)
    .sort();
  check(
    sameSet(triggerSlugs, expectedCheckSlugs),
    `${definition.space} does not select the catalog-standard checks`,
  );
  return {
    space,
    units,
    docs,
    readme: readmes[0],
    filter,
    triggerSlugs,
  };
}

function verifyHubReceipt(definition, receipt) {
  check(
    existsSync(definition.receiptPath),
    `${relativeRepo(definition.receiptPath)} is missing; sync the live Space`,
  );
  check(
    receipt.kind === "LiteralConfigUploadReceipt"
      && receipt.status?.result === "pass"
      && receipt.spec?.organization === expectedOrg
      && receipt.spec?.space?.slug === definition.space
      && receipt.spec?.space?.labels?.InputFormat === definition.inputFormat
      && receipt.spec?.space?.labels?.SourceType === "rendered-config"
      && receipt.spec?.source?.kind === definition.sourceKind
      && receipt.spec?.source?.reference === definition.source
      && receipt.spec?.source?.objectCount === definition.docs.length
      && receipt.spec?.source?.objectSetSha256
        === objectSetSha256(definition.docs)
      && receipt.spec?.storedObjectCount === definition.docs.length
      && receipt.spec?.storedObjectSetSha256
        === objectSetSha256(definition.docs)
      && receipt.spec?.sourceObjectsMatched === true
      && receipt.spec?.renderStep === false
      && receipt.spec?.units?.length === definition.docs.length
      && receipt.spec?.readme?.slug === "readme"
      && receipt.spec?.readme?.source === relativeRepo(definition.readmePath)
      && receipt.spec?.policy?.filter === triggerFilterRef
      && receipt.spec?.policy?.filterId
      && receipt.spec?.policy?.filterHash
      && receipt.spec?.policy?.filterWhere === policy.spec.baseline.filterWhere
      && sameSet(receipt.spec?.policy?.checks ?? [], expectedCheckSlugs)
      && receipt.status?.apply === "not-run"
      && receipt.status?.delivery === "not-run"
      && receipt.status?.observation === "not-run",
    `${definition.title} receipt changed`,
  );
  if (definition.id === "existing-oci") {
    check(
      receipt.spec.space.externalSource === definition.source
        && receipt.spec.space.externalSourceDigest === expectedPublicDigest
        && receipt.spec.space.externalSourceGranularity === "per-resource"
        && receipt.spec.source.importer?.commit === ociImporterCommit
        && receipt.spec.source.importer?.pullRequest
          === ociImporterPullRequest,
      "the existing OCI Space lost its source reference or digest",
    );
  } else {
    check(
      !receipt.spec.space.externalSource
        && !receipt.spec.space.externalSourceDigest
        && !receipt.spec.space.externalSourceGranularity,
      "the plain YAML Space unexpectedly claims an OCI source",
    );
  }
  return receipt;
}

function verifyLiveAgainstReceipt(definition, receipt) {
  const live = inspectLive(definition);
  check(live.space.SpaceID === receipt.spec.space.id, "live Space ID changed");
  check(
    live.units.length === receipt.spec.units.length
      && live.units.every((unit) => {
        const recorded = receipt.spec.units.find(
          (item) => item.slug === unit.Slug,
        );
        return recorded
          && recorded.id === unit.UnitID
          && recorded.dataHash === unit.DataHash;
      }),
    `${definition.space} Units drifted from the receipt`,
  );
  check(
    live.readme.UnitID === receipt.spec.readme.id
      && live.readme.DataHash === receipt.spec.readme.dataHash,
    `${definition.space} README drifted from the receipt`,
  );
  check(
    live.filter.FilterID === receipt.spec.policy.filterId
      && String(live.filter.Hash ?? "").trim()
        === receipt.spec.policy.filterHash
      && live.filter.Where === receipt.spec.policy.filterWhere,
    `${definition.space} policy filter drifted from the receipt`,
  );
  check(
    sameSet(live.triggerSlugs, receipt.spec.policy.checks),
    `${definition.space} checks drifted from the receipt`,
  );
}

function writeSummary() {
  write(summaryPath(), renderSummary());
}

function summaryPath() {
  return join(
    repoRoot,
    "data",
    "literal-config-examples",
    "summary.md",
  );
}

function renderSummary() {
  const publicReceipt = readYaml(publicOciReceiptPath);
  const yamlReceipt = readYaml(definitions[0].receiptPath);
  const ociReceipt = readYaml(definitions[1].receiptPath);
  return `# Plain YAML and existing OCI examples

These two examples show that ConfigHub can start from exact Kubernetes objects.
Neither path rerenders Helm.

## Plain YAML

The [plain YAML fixture](../../examples/plain-yaml/acme-web/README.md) contains
one Namespace, ConfigMap, Deployment, and Service. ConfigHub stores one Unit per
object in the \`${definitions[0].space}\` Space.

The upload compared ${yamlReceipt.spec.storedObjectCount} stored objects with
the source files. Both object sets have hash
\`${yamlReceipt.spec.storedObjectSetSha256}\`.

## Existing OCI

The existing-OCI example starts with the reviewed NGINX replica change:

\`${publicReceipt.spec.artifact.immutableReference}\`

The artifact is public and pulls without registry credentials. It contains five
Kubernetes objects plus the source, change, and check records from the original
review. ConfigHub imports the same five objects into the
\`${definitions[1].space}\` Space and records the OCI source and digest.

The direct companion-record import used
[confighub/sdk PR #11](${ociImporterPullRequest}), now merged at
\`${ociImporterCommit}\`. It is newer than cub v0.2.5. Until the next cub release,
extract \`manifests/release-objects.yaml\` before upload.

## What is proved

| Check | Plain YAML | Existing OCI |
| --- | --- | --- |
| Source objects stored unchanged | ${yamlReceipt.spec.sourceObjectsMatched ? "pass" : "fail"} | ${ociReceipt.spec.sourceObjectsMatched ? "pass" : "fail"} |
| Helm rerender during upload | ${yamlReceipt.spec.renderStep ? "yes" : "no"} | ${ociReceipt.spec.renderStep ? "yes" : "no"} |
| One README Unit in the demo Space | pass | pass |
| Catalog checks attached | pass | pass |
| Public anonymous OCI pull | n/a | ${publicReceipt.spec.artifact.anonymousPull} |
| Kubernetes deployment | not run | not run |

## Evidence

- [Permanent public OCI receipt](../../${relativeRepo(publicOciReceiptPath)})
- [Plain YAML ConfigHub receipt](../../${relativeRepo(definitions[0].receiptPath)})
- [Existing OCI ConfigHub receipt](../../${relativeRepo(definitions[1].receiptPath)})
- [Plain YAML Space guide](../helm-catalog-readmes/spaces/${definitions[0].space}/README.md)
- [Existing OCI Space guide](../helm-catalog-readmes/spaces/${definitions[1].space}/README.md)

These are entry examples. Promotion, release OCI, controller delivery, and live
observations begin after the reviewed configuration has been saved in
ConfigHub.
`;
}

function assertOrg() {
  const context = JSON.parse(
    command("cub", ["context", "get", cubContext, "-o", "json"]).output,
  );
  check(
    context.metadata?.organizationName === expectedOrg,
    `context ${cubContext} points at ${context.metadata?.organizationName ?? "an unknown org"}, not ${expectedOrg}`,
  );
  const status = command("cub", [
    "--context",
    cubContext,
    "auth",
    "status",
  ]);
  check(status.status === 0, `context ${cubContext} is not authenticated`);
}

function currentContextName() {
  return JSON.parse(command("cub", ["context", "get", "-o", "json"]).output).name;
}

function useContext(name) {
  command("cub", ["context", "use", name]);
}

function yamlFiles(root) {
  return walkFiles(root).filter((path) => /\.ya?ml$/.test(path));
}

function walkFiles(root) {
  const files = [];
  for (const entry of readdirSync(root).sort()) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walkFiles(path));
    else if (stat.isFile()) files.push(path);
  }
  return files;
}

function storedData(unit) {
  return Buffer.from(unit.Data ?? "", "base64").toString("utf8");
}

function externalSourceRecords(space) {
  const encoded = space.Annotations?.["confighub.com/external-source"];
  if (!encoded) return [];
  const records = JSON.parse(encoded);
  check(
    Array.isArray(records)
      && records.every((item) =>
        typeof item.ref === "string"
        && typeof item.digest === "string"
        && typeof item.granularity === "string"
      ),
    `${space.Slug} has an invalid confighub.com/external-source annotation`,
  );
  return records;
}

function stripOci(reference) {
  return reference.replace(/^oci:\/\//, "");
}

function sameSet(left, right) {
  return left.length === right.length
    && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

function command(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
    stdio: options.inherit
      ? ["ignore", "inherit", "inherit"]
      : ["ignore", "pipe", "pipe"],
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    timeout: options.timeout,
  });
  if (result.status !== 0) {
    throw new Error(
      `${name} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return {
    output: result.stdout ?? "",
    status: result.status,
  };
}

function cub(args, options = {}) {
  return command(
    "cub",
    ["--context", cubContext, ...args],
    options,
  );
}

function cubTry(args) {
  const result = spawnSync(
    "cub",
    ["--context", cubContext, ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 200,
      env: { ...process.env, CONFIGHUB_AGENT: "1" },
    },
  );
  return {
    ok: result.status === 0,
    output: result.stdout ?? "",
    error: result.stderr ?? "",
  };
}

function cubJson(args) {
  return JSON.parse(cub(args).output);
}
