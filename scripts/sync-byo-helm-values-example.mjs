#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
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
import { join } from "node:path";

import {
  check,
  identityFor,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set([
  "--publish",
  "--public-verify",
  "--hub-sync",
  "--hub-capture",
  "--hub-verify",
  "--generate",
  "--verify",
]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/sync-byo-helm-values-example.mjs --publish
  node scripts/sync-byo-helm-values-example.mjs --public-verify
  node scripts/sync-byo-helm-values-example.mjs --hub-sync
  node scripts/sync-byo-helm-values-example.mjs --hub-capture
  node scripts/sync-byo-helm-values-example.mjs --hub-verify
  node scripts/sync-byo-helm-values-example.mjs --generate
  node scripts/sync-byo-helm-values-example.mjs --verify`);
  process.exit(2);
}

const scenarioPath = join(
  repoRoot,
  "config-catalog",
  "demonstrations",
  "byo-helm-values.yaml",
);
const localReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "receipt.yaml",
);
const publicReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "public-oci-receipt.yaml",
);
const hubReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "confighub-upload-receipt.yaml",
);
const deploymentReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-deploy-proof",
  "receipt.yaml",
);
const promotionReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-promotion-proof",
  "receipt.yaml",
);
const stagingDeploymentReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-staging-deploy-proof",
  "receipt.yaml",
);
const reviewedRenderPath = join(
  repoRoot,
  "data",
  "byo-helm-values-review",
  "reviewed-render.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "byo-helm-values-review",
  "public-and-confighub.md",
);
const readmeUnitPath = join(
  repoRoot,
  "data",
  "helm-catalog-readmes",
  "units",
  "byo-nginx-ai-values-24-0-2-reviewed",
  "readme.yaml",
);
const policyPath = join(
  repoRoot,
  "config-catalog",
  "policies",
  "catalog-standard.yaml",
);

const scenario = readYaml(scenarioPath);
const localReceipt = readYaml(localReceiptPath);
const policy = readYaml(policyPath);
const publicReference = scenario.spec.publicConfigurationOci;
const expectedDigest = localReceipt.spec.output.manifestDigest;
const expectedOrg = "helm-catalog";
const spaceSlug = "byo-nginx-ai-values-24-0-2-reviewed";
const readmeSlug = "readme";
const triggerFilterRef = "platform/helm-catalog-checks";
const expectedCheckSlugs = policy.spec.baseline.checks
  .map((item) => item.trigger.split("/").at(-1))
  .sort();
const expectedDocs = parseDocs(readFileSync(reviewedRenderPath, "utf8"));

verifyLocalInputs();

if (mode === "--publish") {
  check(
    process.env.HELM_EXPT_ALLOW_PUBLIC_BYO_OCI === "1",
    "set HELM_EXPT_ALLOW_PUBLIC_BYO_OCI=1 to publish the reviewed OCI",
  );
  const receipt = publish();
  writeYaml(publicReceiptPath, receipt);
  writeSummary();
  verifyPublicReceipt(receipt);
  console.log(`published and anonymously verified ${publicReference}`);
} else if (mode === "--public-verify") {
  const receipt = verifyPublicReceipt(readYaml(publicReceiptPath));
  verifyAnonymousPull(receipt.spec.artifact.reference, receipt.spec.artifact.digest);
  console.log("verified the public bring-your-own OCI by anonymous pull");
} else if (mode === "--hub-sync") {
  check(
    process.env.HELM_EXPT_ALLOW_BYO_HUB_SYNC === "1",
    "set HELM_EXPT_ALLOW_BYO_HUB_SYNC=1 to update the live demo Space",
  );
  assertOrg();
  verifyPublicReceipt(readYaml(publicReceiptPath));
  syncBaseVariant();
  syncPolicy();
  upsertReadme();
  const receipt = collectHubReceipt();
  writeYaml(hubReceiptPath, receipt);
  writeSummary();
  verifyHubReceipt(receipt);
  verifyLiveAgainstReceipt(receipt);
  console.log(`synchronized ${spaceSlug} in the ${expectedOrg} organization`);
} else if (mode === "--hub-capture") {
  check(
    process.env.HELM_EXPT_ALLOW_BYO_HUB_CAPTURE === "1",
    "set HELM_EXPT_ALLOW_BYO_HUB_CAPTURE=1 to refresh the live receipt without changing the configuration",
  );
  assertOrg();
  verifyPublicReceipt(readYaml(publicReceiptPath));
  upsertReadme();
  const receipt = collectHubReceipt();
  writeYaml(hubReceiptPath, receipt);
  writeSummary();
  verifyHubReceipt(receipt);
  verifyLiveAgainstReceipt(receipt);
  console.log(`captured current ${spaceSlug} evidence without reuploading the OCI`);
} else if (mode === "--hub-verify") {
  assertOrg();
  const receipt = verifyHubReceipt(readYaml(hubReceiptPath));
  verifyLiveAgainstReceipt(receipt);
  console.log(`verified live bring-your-own example ${spaceSlug}`);
} else if (mode === "--generate") {
  verifyPublicReceipt(readYaml(publicReceiptPath));
  verifyHubReceipt(readYaml(hubReceiptPath));
  writeSummary();
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  verifyPublicReceipt(readYaml(publicReceiptPath));
  verifyHubReceipt(readYaml(hubReceiptPath));
  check(
    existsSync(summaryPath)
      && readFileSync(summaryPath, "utf8") === renderSummary(),
    `${relativeRepo(summaryPath)} is stale`,
  );
  console.log("verified the public and ConfigHub bring-your-own receipts");
}

function verifyLocalInputs() {
  check(
    localReceipt.kind === "BringYourOwnHelmValuesProofReceipt"
      && localReceipt.status?.result === "pass",
    "local bring-your-own proof is missing or not pass",
  );
  check(expectedDocs.length === 5, "reviewed render must contain five objects");
  check(
    localReceipt.spec.reviewed.objectSetSha256 === objectSetSha256(expectedDocs),
    "reviewed object set differs from the local proof",
  );
  check(
    /^sha256:[a-f0-9]{64}$/.test(expectedDigest),
    "local proof has no OCI manifest digest",
  );
  check(existsSync(readmeUnitPath), "generated README Unit is missing");
}

function publish() {
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-byo-public-"));
  try {
    const layout = buildLayout(workRoot);
    check(
      layout.digest === expectedDigest,
      `rebuilt OCI digest ${layout.digest} differs from ${expectedDigest}`,
    );
    command("oras", [
      "cp",
      "--from-oci-layout",
      `${layout.root}:24.0.2-r001`,
      stripOci(publicReference),
    ], { inherit: true });
    const anonymous = verifyAnonymousPull(publicReference, expectedDigest);
    return {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "PublicOciReceipt",
      metadata: {
        name: "byo-nginx-ai-values-24-0-2-reviewed",
      },
      spec: {
        verifiedAt: new Date().toISOString(),
        registry: "Google Artifact Registry",
        project: "nth-fort-499605-q5",
        location: "europe-west1",
        repository: "helm-expt",
        artifact: {
          reference: publicReference,
          digest: expectedDigest,
          artifactType: "application/vnd.confighub.kubernetes.config.v1",
          objectCount: expectedDocs.length,
          objectSetSha256: objectSetSha256(expectedDocs),
          authenticatedPush: "pass",
          anonymousPull: anonymous.result,
        },
      },
      status: {
        result: "pass",
        claim: "The five reviewed NGINX objects are publicly pullable as one literal configuration OCI at the recorded digest.",
        limits: [
          "Public pullability does not prove ConfigHub upload, Kubernetes apply, workload health, promotion, or controller delivery.",
          "The OCI contains the reviewed Kubernetes objects. The chart, supplied values, review, and receipt remain linked repository records.",
        ],
      },
    };
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

function verifyAnonymousPull(reference, digest) {
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-byo-anonymous-"));
  try {
    const registryConfig = join(workRoot, "config.json");
    const layoutRoot = join(workRoot, "layout");
    writeFileSync(registryConfig, '{"auths":{}}\n');
    command("oras", [
      "cp",
      "--from-registry-config",
      registryConfig,
      "--to-oci-layout",
      stripOci(reference),
      `${layoutRoot}:24.0.2-r001`,
    ]);
    check(layoutDigest(layoutRoot) === digest, "anonymous OCI digest changed");
    const pulled = pullLayout(workRoot, layoutRoot);
    check(
      objectSetSha256(pulled) === objectSetSha256(expectedDocs),
      "anonymous OCI pull produced different Kubernetes objects",
    );
    return { result: "pass" };
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

function verifyPublicReceipt(receipt) {
  check(
    existsSync(publicReceiptPath),
    `${relativeRepo(publicReceiptPath)} is missing; publish the OCI`,
  );
  check(
    receipt.kind === "PublicOciReceipt"
      && receipt.status?.result === "pass"
      && receipt.spec?.artifact?.reference === publicReference
      && receipt.spec?.artifact?.digest === expectedDigest
      && receipt.spec?.artifact?.objectCount === 5
      && receipt.spec?.artifact?.objectSetSha256 === objectSetSha256(expectedDocs)
      && receipt.spec?.artifact?.authenticatedPush === "pass"
      && receipt.spec?.artifact?.anonymousPull === "pass",
    "public bring-your-own OCI receipt changed",
  );
  return receipt;
}

function syncBaseVariant() {
  cub([
    "variant",
    "upload",
    "--allow-exists",
    "--component",
    "byo-nginx-ai-values",
    "--variant",
    "reviewed",
    "--space",
    spaceSlug,
    "--granularity",
    "minimal",
    "--label",
    "SourceType=helm",
    "--label",
    "ResourceClass=user-workload",
    "--layer",
    "Application",
    "--owner",
    "Application",
    "--change-desc",
    "Import the reviewed NGINX configuration from supplied Helm values",
    publicReference,
  ], { inherit: true, timeout: 420_000 });
}

function syncPolicy() {
  cub([
    "space",
    "update",
    spaceSlug,
    "--label",
    "ApplyPolicyProfile=catalog-standard",
    "--label",
    "SourceType=helm",
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
    spaceSlug,
    "--refresh-triggers",
    "--quiet",
  ]);
}

function upsertReadme() {
  const existing = cubTry([
    "unit",
    "get",
    "--space",
    spaceSlug,
    readmeSlug,
    "-o",
    "json",
  ]);
  const action = existing.ok ? "update" : "create";
  cub([
    "unit",
    action,
    "--space",
    spaceSlug,
    readmeSlug,
    readmeUnitPath,
    "--change-desc",
    "Explain the bring-your-own Helm values example",
    "--label",
    "helm-expt.confighub.com/readme=true",
    "--label",
    `helm-expt.confighub.com/source-space=${spaceSlug}`,
    "--quiet",
  ]);
}

function collectHubReceipt() {
  const live = inspectLive();
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "ConfigHubUploadReceipt",
    metadata: {
      name: "byo-nginx-ai-values-24-0-2-reviewed",
    },
    spec: {
      organization: expectedOrg,
      verifiedAt: new Date().toISOString(),
      command: [
        "cub",
        "variant",
        "upload",
        "--component",
        "byo-nginx-ai-values",
        "--variant",
        "reviewed",
        "--space",
        spaceSlug,
        "--granularity",
        "minimal",
        publicReference,
      ],
      source: {
        reference: publicReference,
        digest: expectedDigest,
        reviewedValues: scenario.spec.reviewedValues,
        review: "data/byo-helm-values-review/review.yaml",
        localProof: relativeRepo(localReceiptPath),
        publicReceipt: relativeRepo(publicReceiptPath),
      },
      space: {
        slug: spaceSlug,
        id: live.space.SpaceID,
        labels: live.space.Labels,
        externalSource: live.space.Annotations?.ExternalSource,
        externalSourceDigest: live.space.Annotations?.ExternalSourceDigest,
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
        source: relativeRepo(readmeUnitPath),
      },
      objectCount: live.docs.length,
      objectSetSha256: objectSetSha256(live.docs),
      sourceObjectsMatched: true,
      requiredTargetResources: scenario.spec.requiredTargetResources,
      policy: {
        profile: policy.metadata.name,
        filter: triggerFilterRef,
        filterId: live.filter.FilterID,
        filterHash: String(live.filter.Hash ?? "").trim(),
        filterWhere: live.filter.Where,
        checks: live.triggerSlugs,
      },
      followOnEvidence: {
        firstDeployment: relativeRepo(deploymentReceiptPath),
        promotion: relativeRepo(promotionReceiptPath),
        stagingDeployment: relativeRepo(stagingDeploymentReceiptPath),
      },
    },
    status: {
      result: "pass",
      claim: "ConfigHub imported the five exact reviewed NGINX objects from the public OCI into one configuration Unit and attached the catalog checks.",
      apply: "not-run",
      promotion: "not-run",
      delivery: "not-run",
      limits: [
        "The required ai-provider-credentials Secret was not created or read.",
        "No target was assigned to this saved base. Kubernetes delivery and promotion are proved in the separate follow-on receipts named above.",
        "The catalog checks are attached, but this receipt does not claim that every policy is sufficient for every private chart.",
      ],
    },
  };
}

function inspectLive() {
  const space = cubJson([
    "space",
    "get",
    spaceSlug,
    "-o",
    "json",
  ]).Space;
  const listed = cubJson([
    "unit",
    "list",
    "--space",
    spaceSlug,
    "-o",
    "json",
  ]);
  const list = listed.Units ?? listed.units ?? listed;
  check(Array.isArray(list), "cub unit list returned an unexpected shape");
  const units = list
    .map((item) => item.Unit ?? item)
    .filter((item) => item.Slug !== readmeSlug)
    .map((item) => cubJson([
      "unit",
      "get",
      "--space",
      spaceSlug,
      item.Slug,
      "-o",
      "json",
    ]).Unit)
    .sort((left, right) => left.Slug.localeCompare(right.Slug));
  const readme = cubJson([
    "unit",
    "get",
    "--space",
    spaceSlug,
    readmeSlug,
    "-o",
    "json",
  ]).Unit;
  const docs = units.flatMap((unit) => parseDocs(storedData(unit)));
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
    "live Space is not using the catalog-standard filter",
  );
  const triggers = cubJson([
    "trigger",
    "list",
    "--space",
    filterSpace,
    "-o",
    "json",
  ]);
  const triggerList = triggers.Triggers ?? triggers.triggers ?? triggers;
  check(Array.isArray(triggerList), "cub trigger list returned an unexpected shape");
  const selectedTriggerIds = new Set(space.TriggerIDs ?? []);
  const triggerSlugs = triggerList
    .map((item) => item.Trigger ?? item)
    .filter((item) => selectedTriggerIds.has(item.TriggerID))
    .map((item) => item.Slug)
    .sort();
  check(
    sameSet(triggerSlugs, expectedCheckSlugs),
    "live Space does not select the catalog-standard checks",
  );
  return {
    space,
    filter,
    units,
    docs,
    readme,
    triggerSlugs,
  };
}

function verifyHubReceipt(receipt) {
  check(
    existsSync(hubReceiptPath),
    `${relativeRepo(hubReceiptPath)} is missing; sync the live Space`,
  );
  check(
    receipt.kind === "ConfigHubUploadReceipt"
      && receipt.status?.result === "pass"
      && receipt.spec?.organization === expectedOrg
      && receipt.spec?.space?.slug === spaceSlug
      && receipt.spec?.source?.reference === publicReference
      && normalizeDigest(receipt.spec?.source?.digest) === expectedDigest
      && receipt.spec?.objectCount === 5
      && receipt.spec?.objectSetSha256 === objectSetSha256(expectedDocs)
      && receipt.spec?.sourceObjectsMatched === true
      && receipt.spec?.units?.length === 1
      && receipt.spec?.policy?.filter === triggerFilterRef
      && receipt.spec?.policy?.filterId
      && receipt.spec?.policy?.filterHash
      && receipt.spec?.policy?.filterWhere === policy.spec.baseline.filterWhere
      && sameSet(receipt.spec?.policy?.checks ?? [], expectedCheckSlugs)
      && receipt.spec?.followOnEvidence?.firstDeployment
        === relativeRepo(deploymentReceiptPath)
      && receipt.spec?.followOnEvidence?.promotion
        === relativeRepo(promotionReceiptPath)
      && receipt.spec?.followOnEvidence?.stagingDeployment
        === relativeRepo(stagingDeploymentReceiptPath)
      && receipt.status?.apply === "not-run"
      && receipt.status?.promotion === "not-run"
      && receipt.status?.delivery === "not-run",
    "ConfigHub bring-your-own receipt changed",
  );
  return receipt;
}

function verifyLiveAgainstReceipt(receipt) {
  const live = inspectLive();
  check(live.space.SpaceID === receipt.spec.space.id, "live Space ID changed");
  check(
    live.space.Annotations?.ExternalSource === publicReference,
    "live Space OCI source changed",
  );
  check(
    normalizeDigest(live.space.Annotations?.ExternalSourceDigest)
      === expectedDigest,
    "live Space OCI digest changed",
  );
  check(
    objectSetSha256(live.docs) === objectSetSha256(expectedDocs),
    "live ConfigHub objects differ from the reviewed render",
  );
  check(
    live.units.length === receipt.spec.units.length
      && live.units.every((unit) => {
        const recorded = receipt.spec.units.find((item) => item.slug === unit.Slug);
        return recorded
          && recorded.id === unit.UnitID
          && recorded.dataHash === unit.DataHash;
      }),
    "live ConfigHub Units drifted from the receipt",
  );
  check(
    live.readme.UnitID === receipt.spec.readme.id
      && live.readme.DataHash === receipt.spec.readme.dataHash,
    "live README drifted from the receipt",
  );
  check(
    live.filter.FilterID === receipt.spec.policy.filterId
      && String(live.filter.Hash ?? "").trim() === receipt.spec.policy.filterHash
      && live.filter.Where === receipt.spec.policy.filterWhere,
    "live catalog-standard filter drifted from the receipt",
  );
  check(
    sameSet(live.triggerSlugs, receipt.spec.policy.checks),
    "live catalog checks drifted from the receipt",
  );
}

function buildLayout(workRoot) {
  const inputRoot = join(workRoot, "input");
  const layoutRoot = join(workRoot, "layout");
  mkdirSync(inputRoot, { recursive: true });
  const layers = expectedDocs.map((doc, index) => {
    const fileName = `${String(index + 1).padStart(2, "0")}-${safeName(identityFor(doc))}.yaml`;
    writeFileSync(join(inputRoot, fileName), `${toYaml(doc)}\n`);
    return `${fileName}:application/yaml`;
  });
  const result = JSON.parse(command(
    "oras",
    [
      "push",
      "--oci-layout",
      `${layoutRoot}:24.0.2-r001`,
      ...layers,
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
  return { root: layoutRoot, digest: result.digest };
}

function pullLayout(workRoot, layoutRoot) {
  const pulledRoot = join(workRoot, "pulled");
  command("oras", [
    "pull",
    "--oci-layout",
    `${layoutRoot}:24.0.2-r001`,
    "--output",
    pulledRoot,
  ]);
  return listFiles(pulledRoot)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")));
}

function layoutDigest(layoutRoot) {
  const index = JSON.parse(readFileSync(join(layoutRoot, "index.json"), "utf8"));
  check(index.manifests?.length === 1, "OCI layout must have one manifest");
  return index.manifests[0].digest;
}

function writeSummary() {
  write(summaryPath, renderSummary());
}

function renderSummary() {
  const publicReceipt = existsSync(publicReceiptPath)
    ? readYaml(publicReceiptPath)
    : null;
  const hubReceipt = existsSync(hubReceiptPath)
    ? readYaml(hubReceiptPath)
    : null;
  const deploymentReceipt = existsSync(deploymentReceiptPath)
    ? readYaml(deploymentReceiptPath)
    : null;
  const promotionReceipt = existsSync(promotionReceiptPath)
    ? readYaml(promotionReceiptPath)
    : null;
  const stagingDeploymentReceipt = existsSync(stagingDeploymentReceiptPath)
    ? readYaml(stagingDeploymentReceiptPath)
    : null;
  return `# Public OCI and ConfigHub upload

The reviewed NGINX configuration from the bring-your-own values example is
available as a public OCI package:

\`${publicReference}@${expectedDigest}\`

The package contains the same five Kubernetes objects as
[\`reviewed-render.yaml\`](./reviewed-render.yaml). An anonymous pull reproduced
the recorded object-set hash,
\`${localReceipt.spec.reviewed.objectSetSha256}\`.

ConfigHub imported that OCI into the \`${spaceSlug}\` Space in the
\`${expectedOrg}\` organization. One configuration Unit holds the five
Kubernetes objects, a separate README Unit explains the example, and the shared
catalog checks are attached. The source OCI reference and digest are recorded
on the Space.

## One exact handoff

The three checks below use the same five Kubernetes objects. The object-set
hash is calculated from the objects, so matching hashes show that the handoff
did not silently rerender or replace them.

| Checkpoint | Object-set SHA-256 | OCI source digest |
| --- | --- | --- |
| Reviewed locally and pulled back from local OCI | \`${localReceipt.spec.reviewed.objectSetSha256}\` | \`${expectedDigest}\` |
| Pulled anonymously from the public registry | \`${localReceipt.spec.reviewed.objectSetSha256}\` | \`${expectedDigest}\` |
| Read back from the saved ConfigHub base | \`${localReceipt.spec.reviewed.objectSetSha256}\` | \`${expectedDigest}\` |

This is the boundary between the public workshop and ConfigHub: review a
result locally, then save those exact objects when the team needs variants,
approvals, promotion, or release history.

After the base is saved, continue with the
[official ConfigHub tutorial](https://docs.confighub.com/get-started/tutorial/).
It shows the next steps: create a development deployment, make a change, add a
production deployment, and flow the reviewed change from base to development
to production.

## Current status

- Public OCI push: **${publicReceipt?.status?.result ?? "not-run"}**
- Anonymous pull: **${publicReceipt?.spec?.artifact?.anonymousPull ?? "not-run"}**
- ConfigHub base upload: **${hubReceipt?.status?.result ?? "not-run"}**
- Reviewed result through Argo CD: **${deploymentReceipt?.status?.result ?? "not-run"}**
- Development-to-staging promotion: **${promotionReceipt?.status?.result ?? "not-run"}**
- Promoted staging result through Argo CD: **${stagingDeploymentReceipt?.status?.result ?? "not-run"}**

## Records

- [Local render and review](./summary.md)
- [Public OCI receipt](../../${relativeRepo(publicReceiptPath)})
- [ConfigHub upload receipt](../../${relativeRepo(hubReceiptPath)})
- [First deployment result](../../data/byo-helm-values-deploy-proof/summary.md)
- [Development-to-staging promotion](../../data/byo-helm-values-promotion-proof/summary.md)
- [Promoted staging deployment](../../data/byo-helm-values-staging-deploy-proof/summary.md)
- [README used inside Hub](../../data/helm-catalog-readmes/spaces/${spaceSlug}/README.md)

The reviewed Deployment still requires the
\`nginx/ai-provider-credentials\` Secret. The live runs supplied a fake value
separately and did not record it. The reviewed result reached three ready
replicas, and the promoted staging result reached four ready replicas, through
Argo CD on throwaway kind clusters.
`;
}

function assertOrg() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(context, "set CUB_CONTEXT to an authenticated helm-catalog context");
  const info = cubJson(["context", "get", context, "-o", "json"]);
  check(
    info.metadata?.organizationName === expectedOrg,
    `refusing to run in ${info.metadata?.organizationName ?? "unknown"}; expected ${expectedOrg}`,
  );
}

function storedData(unit) {
  check(unit.Data, `${unit.SpaceSlug}/${unit.Slug} has no stored data`);
  return Buffer.from(unit.Data, "base64").toString("utf8");
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

function normalizeDigest(value) {
  const match = String(value ?? "").match(/sha256:[a-f0-9]{64}/i);
  return match ? match[0].toLowerCase() : "";
}

function stripOci(reference) {
  return reference.replace(/^oci:\/\//, "");
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
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "inherit"],
    maxBuffer: 256 * 1024 * 1024,
  });
}

function cub(args, options = {}) {
  return execFileSync("cub", args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      CUB_CONTEXT: process.env.CUB_CONTEXT,
    },
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "inherit"],
    timeout: options.timeout ?? 180_000,
    maxBuffer: 128 * 1024 * 1024,
  });
}

function cubTry(args) {
  const result = spawnSync("cub", args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      CUB_CONTEXT: process.env.CUB_CONTEXT,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180_000,
    maxBuffer: 128 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    output: result.stdout ?? "",
    error: result.stderr ?? "",
  };
}

function cubJson(args) {
  return JSON.parse(cub(args));
}
