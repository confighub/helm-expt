#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  cubEnv,
  identityFor,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set([
  "--sync",
  "--hub-verify",
  "--generate",
  "--verify",
]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/sync-byo-helm-values-promotion-example.mjs --sync
  node scripts/sync-byo-helm-values-promotion-example.mjs --hub-verify
  node scripts/sync-byo-helm-values-promotion-example.mjs --generate
  node scripts/sync-byo-helm-values-promotion-example.mjs --verify`);
  process.exit(2);
}

const expectedOrg = "helm-catalog";
const baseSpace = "byo-nginx-ai-values-24-0-2-reviewed";
const developmentSpace = "byo-nginx-ai-values-24-0-2-development";
const stagingSpace = "byo-nginx-ai-values-24-0-2-staging";
const configurationUnit = "byo-nginx-ai-values";
const readmeUnit = "readme";
const expectedImage =
  "registry-1.docker.io/bitnami/nginx@sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f";
const promotionDescription =
  "Promote the four-replica NGINX review from development to staging";
const sourcePath = join(
  repoRoot,
  "data",
  "byo-helm-values-review",
  "reviewed-render.yaml",
);
const publicReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "public-oci-receipt.yaml",
);
const deploymentReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-deploy-proof",
  "receipt.yaml",
);
const policyPath = join(
  repoRoot,
  "config-catalog",
  "policies",
  "catalog-standard.yaml",
);
const receiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-promotion-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "byo-helm-values-promotion-proof",
  "summary.md",
);
const readmePath = (space) => join(
  repoRoot,
  "data",
  "helm-catalog-readmes",
  "units",
  space,
  "readme.yaml",
);

const sourceDocs = parseDocs(readFileSync(sourcePath, "utf8"));
const publicReceipt = readYaml(publicReceiptPath);
const deploymentReceipt = readYaml(deploymentReceiptPath);
const policy = readYaml(policyPath);
const expectedCheckSlugs = policy.spec.baseline.checks
  .map((item) => item.trigger.split("/").at(-1))
  .sort();
const publicReference = publicReceipt.spec.artifact.reference;
const publicDigest = publicReceipt.spec.artifact.digest;

verifyInputs();

if (mode === "--sync") {
  check(
    process.env.HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROMOTION === "1",
    "set HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROMOTION=1 to update the live promotion example",
  );
  assertContext();
  const preview = ensureChain();
  const receipt = collectReceipt(preview);
  verifyReceipt(receipt);
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyLiveAgainstReceipt(receipt);
  console.log(`synchronized ${baseSpace} -> ${developmentSpace} -> ${stagingSpace}`);
} else {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  if (mode === "--hub-verify") {
    assertContext();
    verifyLiveAgainstReceipt(receipt);
    console.log("verified the live bring-your-own development and staging chain");
  } else if (mode === "--generate") {
    write(summaryPath, renderSummary(receipt));
    console.log(`wrote ${relativeRepo(summaryPath)}`);
  } else {
    check(
      existsSync(summaryPath)
        && readFileSync(summaryPath, "utf8") === renderSummary(receipt),
      `${relativeRepo(summaryPath)} is stale`,
    );
    console.log("verified the bring-your-own Helm values promotion receipt");
  }
}

function verifyInputs() {
  check(sourceDocs.length === 5, "reviewed NGINX render must contain five objects");
  check(
    publicReceipt.kind === "PublicOciReceipt"
      && publicReceipt.status?.result === "pass"
      && publicReceipt.spec?.artifact?.anonymousPull === "pass"
      && /^sha256:[a-f0-9]{64}$/.test(publicDigest),
    "public bring-your-own OCI receipt is missing or not pass",
  );
  check(
    deploymentReceipt.kind === "BringYourOwnHelmValuesDeploymentReceipt"
      && deploymentReceipt.status?.result === "pass"
      && deploymentReceipt.spec?.source?.publicOci?.digest === publicDigest,
    "first-deployment receipt is missing or does not use the reviewed OCI",
  );
  for (const space of [baseSpace, developmentSpace, stagingSpace]) {
    check(
      existsSync(readmePath(space)),
      `${relativeRepo(readmePath(space))} is missing; run npm run helm-catalog-readmes`,
    );
  }
}

function ensureChain() {
  const base = inspectSpace(baseSpace);
  checkBase(base);

  if (!spacePresent(developmentSpace)) {
    cub([
      "variant",
      "create",
      "development",
      baseSpace,
      "--space-pattern",
      `template:${developmentSpace}`,
      "--environment",
      "Development",
      "--namespace",
      "nginx-development",
      "--wait",
    ], { timeout: 420_000, inherit: true });
  }

  if (!spacePresent(stagingSpace)) {
    const development = inspectSpace(developmentSpace);
    if (development.deployment.replicas !== 3) {
      setReplicas(developmentSpace, 3, "Prepare the three-replica staging baseline");
    }
    cub([
      "variant",
      "create",
      "staging",
      developmentSpace,
      "--space-pattern",
      `template:${stagingSpace}`,
      "--environment",
      "Staging",
      "--namespace",
      "nginx-staging",
      "--wait",
    ], { timeout: 420_000, inherit: true });
  }

  ensureIndependentReadme(stagingSpace);
  ensureIndependentReadme(developmentSpace);

  let development = inspectSpace(developmentSpace);
  if (development.deployment.replicas !== 4) {
    check(
      development.deployment.replicas === 3,
      `development has ${development.deployment.replicas} replicas; expected 3 or 4`,
    );
    checkExactConfiguration(development, "nginx-development", 3);
    setReplicas(
      developmentSpace,
      4,
      "Test four replicas in development before promoting to staging",
    );
    development = inspectSpace(developmentSpace);
  }
  check(development.deployment.replicas === 4, "development replica change failed");

  let staging = inspectSpace(stagingSpace);
  const stagingNeedsPromotion =
    staging.configuration.upstreamRevision !== development.configuration.headRevision;
  let preview = previousPreview();
  if (stagingNeedsPromotion) {
    checkExactConfiguration(staging, "nginx-staging", 3);
    const before = {
      dataHash: staging.configuration.dataHash,
      headRevision: staging.configuration.headRevision,
      replicas: staging.deployment.replicas,
    };
    const output = cub([
      "variant",
      "promote",
      stagingSpace,
      "--dry-run",
      "-o",
      "mutations",
    ], { timeout: 240_000 });
    staging = inspectSpace(stagingSpace);
    check(
      staging.configuration.dataHash === before.dataHash
        && staging.configuration.headRevision === before.headRevision
        && staging.deployment.replicas === before.replicas,
      "promotion dry-run changed the stored staging configuration",
    );
    preview = {
      command: `cub variant promote ${stagingSpace} --dry-run -o mutations`,
      result: "pass",
      outputBytes: Buffer.byteLength(output),
      output: output.trim() ? "present" : "empty",
      storedDataUnchanged: true,
      stagingRevisionBefore: before.headRevision,
      note: output.trim()
        ? "The CLI returned a mutation preview."
        : "The command left stored data unchanged but printed no mutation preview.",
    };
    cub([
      "variant",
      "promote",
      stagingSpace,
      "--change-desc",
      promotionDescription,
    ], { timeout: 300_000, inherit: true });
    staging = inspectSpace(stagingSpace);
  }

  ensureIndependentReadme(developmentSpace);
  ensureIndependentReadme(stagingSpace);
  check(
    staging.deployment.replicas === 4
      && staging.configuration.upstreamRevision
        === inspectSpace(developmentSpace).configuration.headRevision,
    "staging did not catch up with the four-replica development revision",
  );
  return preview;
}

function previousPreview() {
  check(
    existsSync(receiptPath),
    "promotion is already complete but no preview receipt exists; recreate the staging example before claiming preview evidence",
  );
  const receipt = readYaml(receiptPath);
  check(
    receipt.kind === "BringYourOwnHelmValuesPromotionReceipt"
      && receipt.status?.result === "pass",
    "existing promotion receipt cannot supply the previous preview evidence",
  );
  return receipt.spec?.preview ?? {};
}

function setReplicas(space, replicas, description) {
  cub([
    "run",
    "set-replicas",
    "--space",
    space,
    "--unit",
    configurationUnit,
    "--replicas",
    String(replicas),
    "--change-desc",
    description,
    "--wait",
  ], { timeout: 240_000, inherit: true });
}

function ensureIndependentReadme(space) {
  let listed = listUnits(space);
  let readme = listed.find((item) => item.Slug === readmeUnit);
  if (readme && (readme.FromLinkID ?? []).length) {
    cub([
      "unit",
      "delete",
      readmeUnit,
      "--space",
      space,
      "--quiet",
    ]);
    readme = null;
  }
  const source = readFileSync(readmePath(space), "utf8");
  if (readme && storedData(readme) === source) return;
  cub([
    "unit",
    readme ? "update" : "create",
    "--space",
    space,
    readmeUnit,
    readmePath(space),
    "--change-desc",
    `Explain ${space}`,
    "--label",
    "helm-expt.confighub.com/readme=true",
    "--label",
    `helm-expt.confighub.com/source-space=${space}`,
    "--quiet",
  ]);
}

function collectReceipt(preview) {
  const base = inspectSpace(baseSpace);
  const development = inspectSpace(developmentSpace);
  const staging = inspectSpace(stagingSpace);
  checkBase(base);
  checkDevelopment(base, development);
  checkStaging(development, staging);

  const developmentRevision = findRevision(
    development.revisions,
    (revision) =>
      revision.Source === "Invoke"
      && revision.Description?.includes("four replicas"),
    "development four-replica revision",
  );
  const stagingRevision = findRevision(
    staging.revisions,
    (revision) =>
      revision.Source === "UpgradeUnit"
      && revision.Description === promotionDescription,
    "staging promotion revision",
  );

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BringYourOwnHelmValuesPromotionReceipt",
    metadata: {
      name: "byo-nginx-ai-values-24-0-2-development-to-staging",
    },
    spec: {
      observedAt: new Date().toISOString(),
      organization: expectedOrg,
      source: {
        chart: "bitnami/nginx",
        version: "24.0.2",
        publicOci: {
          reference: publicReference,
          digest: publicDigest,
        },
        firstDeploymentReceipt: relativeRepo(deploymentReceiptPath),
      },
      chain: {
        base: receiptSpace(base),
        development: receiptSpace(development),
        staging: receiptSpace(staging),
      },
      change: {
        resource: "apps/v1 Deployment/nginx",
        field: "spec.replicas",
        baseValue: 3,
        developmentValue: 4,
        stagingBeforePromotion: 3,
        stagingAfterPromotion: 4,
        developmentRevision: revisionRecord(developmentRevision),
      },
      preview,
      promotion: {
        command: `cub variant promote ${stagingSpace}`,
        result: "pass",
        stagingRevision: revisionRecord(stagingRevision),
        upstreamRevisionMatched: true,
        pendingAfter: staging.upgradableUnitCount,
        namespacePreserved: staging.deployment.namespace === "nginx-staging",
      },
      documentation: {
        oneReadmePerSpace: true,
        readmesIndependentOfConfigurationLinks: true,
      },
      limits: [
        "The dry-run command left staging unchanged but printed no useful mutation preview. That CLI limitation remains open.",
        "This receipt proves one development-to-staging field promotion in ConfigHub.",
        "The reviewed three-replica base and the promoted four-replica staging result were each deployed through Argo CD in separate live runs.",
        "Rollback, chart upgrade, Flux delivery, and fleet rollout have not run for this configuration.",
      ],
    },
    status: {
      result: "pass",
      claim: "The exact reviewed OCI result remained unchanged as the base, development changed NGINX from three to four replicas, and ConfigHub promoted that change to staging while preserving the staging namespace.",
    },
  };
}

function inspectSpace(spaceSlug) {
  const response = cubJson(["space", "get", spaceSlug, "-o", "json"]);
  const space = response.Space;
  const units = listUnits(spaceSlug);
  const configuration = units.find((item) => item.Slug === configurationUnit);
  const readme = units.find((item) => item.Slug === readmeUnit);
  check(configuration, `${spaceSlug} has no ${configurationUnit} Unit`);
  check(readme, `${spaceSlug} has no readme Unit`);
  const docs = parseDocs(storedData(configuration));
  const deployment = docs.find(
    (doc) => doc.kind === "Deployment" && doc.metadata?.name === "nginx",
  );
  const service = docs.find(
    (doc) => doc.kind === "Service" && doc.metadata?.name === "nginx",
  );
  check(deployment && service, `${spaceSlug} has no NGINX Deployment and Service`);
  const container = deployment.spec?.template?.spec?.containers?.find(
    (item) => item.name === "nginx",
  );
  const revisions = cubJson([
    "revision",
    "list",
    "--space",
    spaceSlug,
    configurationUnit,
    "-o",
    "json",
  ]).map((item) => item.Revision ?? item);
  return {
    slug: spaceSlug,
    id: space.SpaceID,
    labels: space.Labels ?? {},
    upstreamSpaceId: String(space.Annotations?.UpstreamSpaceID ?? ""),
    upgradableUnitCount: Number(response.UpgradableUnitCount ?? 0),
    policy: {
      triggerFilterId: space.TriggerFilterID,
      checks: selectedTriggerSlugs(space),
    },
    configuration: {
      id: configuration.UnitID,
      dataHash: configuration.DataHash,
      headRevision: Number(configuration.HeadRevisionNum ?? 0),
      upstreamRevision: Number(configuration.UpstreamRevisionNum ?? 0),
      fromLinkIds: configuration.FromLinkID ?? [],
      mutationSources: configuration.MutationSources ?? [],
    },
    readme: {
      id: readme.UnitID,
      dataHash: readme.DataHash,
      fromLinkIds: readme.FromLinkID ?? [],
    },
    objectCount: docs.length,
    objectIdentities: docs.map(identityFor).sort(),
    objectSetSha256: objectSetSha256(docs),
    deployment: {
      namespace: String(deployment.metadata?.namespace ?? ""),
      replicas: Number(deployment.spec?.replicas ?? 1),
      image: String(container?.image ?? ""),
      secretRef: String(
        container?.envFrom?.find((item) => item.secretRef)?.secretRef?.name ?? "",
      ),
      runAsNonRoot: container?.securityContext?.runAsNonRoot,
      allowPrivilegeEscalation:
        container?.securityContext?.allowPrivilegeEscalation,
      readOnlyRootFilesystem:
        container?.securityContext?.readOnlyRootFilesystem,
    },
    serviceType: String(service.spec?.type ?? ""),
    externalSource: String(space.Annotations?.ExternalSource ?? ""),
    externalSourceDigest: normalizeDigest(
      space.Annotations?.ExternalSourceDigest,
    ),
    revisions,
  };
}

function checkBase(base) {
  checkSpaceShape(base, {
    variant: "reviewed",
    namespace: "nginx",
    replicas: 3,
    fromLinks: 0,
  });
  check(
    base.externalSource === publicReference
      && base.externalSourceDigest === publicDigest,
    "base no longer records the reviewed public OCI and digest",
  );
  check(
    base.upstreamSpaceId === "",
    "reviewed base unexpectedly has an upstream Space",
  );
  checkExactConfiguration(base, "nginx", 3);
}

function checkDevelopment(base, development) {
  checkSpaceShape(development, {
    variant: "development",
    namespace: "nginx-development",
    replicas: 4,
    fromLinks: 1,
  });
  check(
    development.upstreamSpaceId === base.id,
    "development does not point to the reviewed base",
  );
  checkExactConfiguration(development, "nginx-development", 4);
}

function checkStaging(development, staging) {
  checkSpaceShape(staging, {
    variant: "staging",
    namespace: "nginx-staging",
    replicas: 4,
    fromLinks: 1,
  });
  check(
    staging.upstreamSpaceId === development.id,
    "staging does not point to development",
  );
  check(
    staging.configuration.upstreamRevision
      === development.configuration.headRevision,
    "staging has not caught up with the development configuration revision",
  );
  check(staging.upgradableUnitCount === 0, "staging still has a pending change");
  const replicaMutation = staging.configuration.mutationSources.find(
    (source) =>
      source.Resource?.ResourceType === "apps/v1/Deployment"
      && source.PathMutationMap?.["spec.replicas"]?.Value?.trim() === "4",
  );
  check(replicaMutation, "staging does not record the promoted replica mutation");
  checkExactConfiguration(staging, "nginx-staging", 4);
}

function checkSpaceShape(record, expected) {
  check(record.labels.Variant === expected.variant, `${record.slug} variant label changed`);
  check(
    record.deployment.namespace === expected.namespace,
    `${record.slug} namespace changed`,
  );
  check(
    record.deployment.replicas === expected.replicas,
    `${record.slug} replica count changed`,
  );
  check(record.objectCount === 5, `${record.slug} must contain five objects`);
  check(
    record.configuration.fromLinkIds.length === expected.fromLinks,
    `${record.slug} configuration link count changed`,
  );
  check(
    record.readme.fromLinkIds.length === 0,
    `${record.slug} README must not be inherited through the configuration chain`,
  );
  check(
    record.deployment.image === expectedImage
      && record.deployment.secretRef === "ai-provider-credentials"
      && record.deployment.runAsNonRoot === true
      && record.deployment.allowPrivilegeEscalation === false
      && record.deployment.readOnlyRootFilesystem === true
      && record.serviceType === "ClusterIP",
    `${record.slug} lost one of the reviewed NGINX safety choices`,
  );
  check(
    sameSet(record.policy.checks, expectedCheckSlugs),
    `${record.slug} does not select the catalog-standard checks`,
  );
}

function checkExactConfiguration(record, namespace, replicas) {
  const expected = objectSetSha256(variantDocs(sourceDocs, namespace, replicas));
  check(
    record.objectSetSha256 === expected,
    `${record.slug} contains changes outside its namespace and replica settings`,
  );
}

function receiptSpace(record) {
  return {
    space: record.slug,
    id: record.id,
    variant: record.labels.Variant,
    environment: record.labels.Environment ?? "",
    upstreamSpaceId: record.upstreamSpaceId,
    namespace: record.deployment.namespace,
    replicas: record.deployment.replicas,
    objectCount: record.objectCount,
    objectIdentities: record.objectIdentities,
    objectSetSha256: record.objectSetSha256,
    configurationUnit: {
      slug: configurationUnit,
      id: record.configuration.id,
      dataHash: record.configuration.dataHash,
      headRevision: record.configuration.headRevision,
      upstreamRevision: record.configuration.upstreamRevision,
      fromLinkIds: record.configuration.fromLinkIds,
    },
    readmeUnit: {
      slug: readmeUnit,
      id: record.readme.id,
      dataHash: record.readme.dataHash,
      fromLinkIds: record.readme.fromLinkIds,
    },
    policy: record.policy,
    pendingUpstreamChanges: record.upgradableUnitCount,
  };
}

function revisionRecord(revision) {
  return {
    id: revision.RevisionID,
    number: Number(revision.RevisionNum),
    source: revision.Source,
    description: revision.Description,
    createdAt: revision.CreatedAt,
  };
}

function findRevision(revisions, predicate, label) {
  const revision = revisions.find(predicate);
  check(revision, `missing ${label}`);
  return revision;
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "BringYourOwnHelmValuesPromotionReceipt"
      && receipt.status?.result === "pass",
    "bring-your-own promotion receipt did not pass",
  );
  check(
    receipt.spec?.source?.publicOci?.reference === publicReference
      && receipt.spec?.source?.publicOci?.digest === publicDigest,
    "promotion receipt source changed",
  );
  const chain = receipt.spec?.chain;
  check(
    chain?.base?.space === baseSpace
      && chain.base.replicas === 3
      && chain.base.namespace === "nginx"
      && chain.development?.space === developmentSpace
      && chain.development.replicas === 4
      && chain.development.namespace === "nginx-development"
      && chain.development.upstreamSpaceId === chain.base.id
      && chain.staging?.space === stagingSpace
      && chain.staging.replicas === 4
      && chain.staging.namespace === "nginx-staging"
      && chain.staging.upstreamSpaceId === chain.development.id
      && chain.staging.configurationUnit.upstreamRevision
        === chain.development.configurationUnit.headRevision,
    "promotion chain changed",
  );
  for (const lane of [chain.base, chain.development, chain.staging]) {
    check(
      lane.objectCount === 5
        && lane.readmeUnit.fromLinkIds.length === 0
        && sameSet(lane.policy.checks, expectedCheckSlugs),
      `${lane.space} evidence changed`,
    );
  }
  check(
    chain.base.objectSetSha256
      === objectSetSha256(variantDocs(sourceDocs, "nginx", 3))
      && chain.development.objectSetSha256
        === objectSetSha256(variantDocs(sourceDocs, "nginx-development", 4))
      && chain.staging.objectSetSha256
        === objectSetSha256(variantDocs(sourceDocs, "nginx-staging", 4)),
    "promotion receipt contains an unexpected object change",
  );
  check(
    receipt.spec?.change?.field === "spec.replicas"
      && receipt.spec.change.baseValue === 3
      && receipt.spec.change.developmentValue === 4
      && receipt.spec.change.stagingBeforePromotion === 3
      && receipt.spec.change.stagingAfterPromotion === 4,
    "recorded replica change changed",
  );
  check(
    receipt.spec?.preview?.result === "pass"
      && receipt.spec.preview.output === "empty"
      && receipt.spec.preview.outputBytes === 0
      && receipt.spec.preview.storedDataUnchanged === true,
    "promotion preview evidence changed",
  );
  check(
    receipt.spec?.promotion?.result === "pass"
      && receipt.spec.promotion.stagingRevision?.source === "UpgradeUnit"
      && receipt.spec.promotion.stagingRevision?.description
        === promotionDescription
      && receipt.spec.promotion.upstreamRevisionMatched === true
      && receipt.spec.promotion.pendingAfter === 0
      && receipt.spec.promotion.namespacePreserved === true,
    "promotion result changed",
  );
  check(
    receipt.spec?.documentation?.oneReadmePerSpace === true
      && receipt.spec.documentation.readmesIndependentOfConfigurationLinks === true,
    "README ownership evidence changed",
  );
  const serialized = JSON.stringify(receipt);
  check(
    !serialized.includes("proof-only-not-a-real-key"),
    "promotion receipt contains a Secret value",
  );
}

function verifyLiveAgainstReceipt(receipt) {
  const records = {
    base: inspectSpace(baseSpace),
    development: inspectSpace(developmentSpace),
    staging: inspectSpace(stagingSpace),
  };
  checkBase(records.base);
  checkDevelopment(records.base, records.development);
  checkStaging(records.development, records.staging);
  for (const key of Object.keys(records)) {
    const live = receiptSpace(records[key]);
    const saved = receipt.spec.chain[key];
    check(
      live.id === saved.id
        && live.configurationUnit.id === saved.configurationUnit.id
        && live.configurationUnit.dataHash === saved.configurationUnit.dataHash
        && live.configurationUnit.headRevision
          === saved.configurationUnit.headRevision
        && live.readmeUnit.id === saved.readmeUnit.id
        && live.readmeUnit.dataHash === saved.readmeUnit.dataHash,
      `${saved.space} drifted from the promotion receipt`,
    );
  }
}

function renderSummary(receipt) {
  const chain = receipt.spec.chain;
  return `# Promote the reviewed Helm result

This example starts with the reviewed NGINX configuration produced from a
supplied Helm values file. The saved base stays at three replicas. Development
changes the real Deployment to four replicas, and staging receives that change
through ConfigHub promotion.

## What happened

| Step | Space | Namespace | Replicas | Result |
| --- | --- | --- | ---: | --- |
| Saved reviewed base | \`${chain.base.space}\` | \`${chain.base.namespace}\` | ${chain.base.replicas} | unchanged |
| Development change | \`${chain.development.space}\` | \`${chain.development.namespace}\` | ${chain.development.replicas} | recorded revision |
| Staging promotion | \`${chain.staging.space}\` | \`${chain.staging.namespace}\` | ${chain.staging.replicas} | pass |

The staging configuration Unit points to development revision
\`${chain.staging.configurationUnit.upstreamRevision}\`, has no pending upstream
change, and records the promoted \`spec.replicas: 4\` mutation. The pinned
container image, existing-Secret reference, security settings, and ClusterIP
Service stayed in place.

The reviewed base still records the public input:

\`${receipt.spec.source.publicOci.reference}@${receipt.spec.source.publicOci.digest}\`

## README ownership

Each Space has one README. The development and staging README Units are not
linked through the application promotion chain, so improving the explanation
does not create a pending application change.

## Promotion preview limitation

\`${receipt.spec.preview.command}\` left the stored staging configuration
unchanged, but the CLI printed no mutation preview. The real promotion is
visible in staging revision \`${receipt.spec.promotion.stagingRevision.number}\`
with source \`${receipt.spec.promotion.stagingRevision.source}\`.

## Run or verify it

\`\`\`bash
HELM_EXPT_ALLOW_BYO_HELM_VALUES_PROMOTION=1 \\
CUB_CONTEXT=river-bear \\
npm run byo-helm-values:promotion-sync

CUB_CONTEXT=river-bear npm run byo-helm-values:promotion-hub-verify
\`\`\`

## Limits

${receipt.spec.limits.map((item) => `- ${item}`).join("\n")}

Receipt: [\`${relativeRepo(receiptPath)}\`](../../${relativeRepo(receiptPath)})
`;
}

function listUnits(space) {
  return cubJson(["unit", "list", "--space", space, "-o", "json"])
    .map((item) => item.Unit ?? item)
    .map((item) => cubJson([
      "unit",
      "get",
      "--space",
      space,
      item.Slug,
      "-o",
      "json",
    ]).Unit);
}

function selectedTriggerSlugs(space) {
  const selected = new Set(space.TriggerIDs ?? []);
  return cubJson(["trigger", "list", "--space", "platform", "-o", "json"])
    .map((item) => item.Trigger ?? item)
    .filter((item) => selected.has(item.TriggerID))
    .map((item) => item.Slug)
    .sort();
}

function storedData(unit) {
  check(unit.Data, `${unit.SpaceSlug}/${unit.Slug} has no data`);
  return Buffer.from(unit.Data, "base64").toString("utf8");
}

function assertContext() {
  const context = process.env.CUB_CONTEXT?.trim();
  check(context, "set CUB_CONTEXT to the helm-catalog context");
  const current = cubJson(["context", "get", context, "-o", "json"]);
  check(
    current.metadata?.organizationName === expectedOrg,
    `refusing to run in ${current.metadata?.organizationName ?? "unknown"}; expected ${expectedOrg}`,
  );
}

function spacePresent(space) {
  return cubTry(["space", "get", space, "-o", "json"]).ok;
}

function cub(args, options = {}) {
  return command("cub", args, {
    ...options,
    env: cubEnv(),
  });
}

function cubTry(args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: cubEnv(),
  });
}

function cubJson(args, options = {}) {
  return JSON.parse(cub(args, options));
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 180_000,
    maxBuffer: 256 * 1024 * 1024,
  });
  check(
    result.status === 0,
    `${commandName} ${args.join(" ")} failed: ${sanitizeError(result.stderr)}`,
  );
  return result.stdout ?? "";
}

function tryCommand(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 180_000,
    maxBuffer: 256 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    output: result.stdout ?? "",
    error: result.stderr ?? "",
  };
}

function normalizeDigest(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/sha256:[a-f0-9]{64}/);
  return match?.[0] ?? "";
}

function variantDocs(docs, namespace, replicas) {
  return structuredClone(docs).map((doc) => {
    if (doc.metadata?.namespace) doc.metadata.namespace = namespace;
    if (doc.kind === "Deployment" && doc.metadata?.name === "nginx") {
      doc.spec.replicas = replicas;
    }
    return doc;
  });
}

function objectSetSha256(docs) {
  return sha256(JSON.stringify(
    docs
      .map((doc) => [identityFor(doc), doc])
      .sort(([left], [right]) => left.localeCompare(right)),
  ));
}

function sameSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function sanitizeError(value) {
  return String(value ?? "")
    .replace(/[A-Za-z0-9+/=]{80,}/g, "[redacted]")
    .trim();
}
