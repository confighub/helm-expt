#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";
import { objectSetSha256 } from "./transform-config-oci.mjs";
import { verifyTimoniPolicyHistory } from "./lib/timoni-policy-history.mjs";

const mode = process.argv[2] ?? "--verify";
const modes = new Set(["--publish", "--public-verify", "--hub-sync", "--hub-verify", "--generate", "--verify", "--self-test"]);
check(modes.has(mode), "use --publish, --public-verify, --hub-sync, --hub-verify, --generate, --verify, or --self-test");

const context = process.env.CUB_CONTEXT ?? "river-bear";
const organization = "helm-catalog";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const repository = "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/timoni-redis-config";
const taggedReference = `${repository}:8.10.1-default`;
const exampleRoot = join(repoRoot, "examples", "timoni", "redis-8-10-1");
const objectsPath = join(exampleRoot, "rendered", "release-objects.yaml");
const sourcePath = join(exampleRoot, "source-lock.yaml");
const routePath = join(exampleRoot, "lifecycle-route-intent.yaml");
const verdictPath = join(exampleRoot, "flattening-safety-verdict.yaml");
const materializationPath = join(exampleRoot, "generation-receipt.yaml");
const baseRecordPath = join(repoRoot, "data", "base-variant-records", "records", "timoni-redis-8-10-1-default.yaml");
const proofRoot = join(repoRoot, "runs", "timoni-redis-catalog-proof");
const publicReceiptPath = join(proofRoot, "public-oci-receipt.yaml");
const legacyHubReceiptPath = join(proofRoot, "confighub-receipt.yaml");
// New runs must not overwrite the exact historical witness.
const currentHubReceiptPath = join(proofRoot, "confighub-policy-bound-receipt.yaml");
const hubReceiptPath = mode === "--hub-sync" || existsSync(currentHubReceiptPath)
  ? currentHubReceiptPath : legacyHubReceiptPath;
const summaryPath = join(repoRoot, "data", "timoni-redis-catalog-proof", "summary.md");
const baseSpace = "timoni-redis-8-10-1-base";
const devSpace = "timoni-redis-8-10-1-dev";
const filterRef = "platform/helm-catalog-checks";
const policyPath = join(repoRoot, "config-catalog", "policies", "catalog-standard.yaml");
const policyText = readFileSync(policyPath, "utf8");
const policy = readYaml(policyPath);
const expectedChecks = policy.spec.baseline.checks.map((item) => item.trigger.split("/").at(-1)).sort();
const sourceObjects = parseDocs(readFileSync(objectsPath, "utf8"));
const sourceObjectSetSha256 = objectSetSha256(sourceObjects);
const sourceObjectKeys = new Set(sourceObjects.map(objectKey));

verifyLocalInputs();

if (mode === "--self-test") {
  await import("./test-timoni-policy-history.mjs");
  const payload = createPayload();
  try {
    const payloadObjects = parseDocs(readFileSync(join(payload.root, "manifests", "release-objects.yaml"), "utf8"));
    check(objectSetSha256(payloadObjects) === sourceObjectSetSha256, "self-test payload changed the object set");
    check(Object.keys(payload.recordHashes).length === 6, "self-test payload must contain six companion records");
    for (const [name, digest] of Object.entries(payload.recordHashes)) {
      check(sha256(readFileSync(join(payload.root, "records", name))) === digest, `self-test payload hash changed for ${name}`);
    }
  } finally {
    rmSync(payload.root, { recursive: true, force: true });
  }
  console.log("verified the Timoni Redis literal-configuration OCI payload locally");
} else if (mode === "--publish") {
  check(process.env.HELM_EXPT_ALLOW_TIMONI_OCI_PUBLISH === "1", "set HELM_EXPT_ALLOW_TIMONI_OCI_PUBLISH=1 before publishing");
  const payload = createPayload();
  try {
    command("oras", [
      "push",
      "--artifact-type", artifactType,
      stripOci(taggedReference),
      "manifests/release-objects.yaml:application/vnd.cncf.kubernetes.manifest.v1+yaml",
      "records/source-and-intent.json:application/vnd.confighub.record.v1+json",
      "records/lifecycle-route-intent.json:application/vnd.confighub.record.v1+json",
      "records/flattening-verdict.json:application/vnd.confighub.record.v1+json",
      "records/materialization-receipt.json:application/vnd.confighub.record.v1+json",
      "records/base-variant-record.json:application/vnd.confighub.record.v1+json",
      "records/catalog-index.json:application/vnd.confighub.record.v1+json",
    ], { cwd: payload.root, inherit: true, timeout: 420_000 });
    const descriptor = JSON.parse(command("oras", ["manifest", "fetch", "--descriptor", stripOci(taggedReference)]).output);
    const immutableReference = `${repository}@${descriptor.digest}`;
    const pulled = verifyAnonymousPull(immutableReference, payload);
    mkdirSync(proofRoot, { recursive: true });
    writeYaml(publicReceiptPath, publicReceipt(descriptor.digest, payload, pulled));
  } finally {
    rmSync(payload.root, { recursive: true, force: true });
  }
  verifyPublicReceipt(true);
  writeSummary();
  console.log(`published and anonymously verified ${taggedReference}`);
} else if (mode === "--public-verify") {
  verifyPublicReceipt(true);
  console.log("verified the public Timoni Redis configuration OCI by anonymous pull");
} else if (mode === "--hub-sync") {
  check(process.env.HELM_EXPT_ALLOW_TIMONI_HUB_SYNC === "1", "set HELM_EXPT_ALLOW_TIMONI_HUB_SYNC=1 before changing the live demo org");
  assertOrg();
  const publicReceipt = verifyPublicReceipt(false);
  syncBase(publicReceipt.spec.artifact.immutableReference);
  syncPolicy(baseSpace);
  if (!spaceExists(devSpace)) {
    const result = cubTry(["variant", "create", "dev", baseSpace, "--environment", "Development", "--space-pattern", `template:${devSpace}`, "--allow-exists", "--quiet"]);
    check(spaceExists(devSpace), `could not create ${devSpace}: ${result.error || result.output}`);
  }
  syncDerivedWorkloadOnly();
  syncPolicy(devSpace);
  upsertReadme(baseSpace);
  upsertReadme(devSpace);
  mkdirSync(proofRoot, { recursive: true });
  writeYaml(hubReceiptPath, collectHubReceipt(publicReceipt));
  verifyHubReceipt(true);
  writeSummary();
  console.log(`synchronized ${baseSpace} and ${devSpace}`);
} else if (mode === "--hub-verify") {
  assertOrg();
  verifyHubReceipt(true);
  console.log("verified the Timoni Redis ConfigHub base and development variant");
} else if (mode === "--generate") {
  verifyPublicReceipt(false);
  verifyHubReceipt(false);
  writeSummary();
  console.log("wrote the Timoni Redis Catalog proof summary");
} else {
  verifyPublicReceipt(false);
  verifyHubReceipt(false);
  const expected = renderSummary();
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === expected, `${relativeRepo(summaryPath)} is stale`);
  console.log("verified Timoni Redis public OCI and ConfigHub retention receipts");
}

function verifyLocalInputs() {
  const materialization = readYaml(materializationPath);
  const baseRecord = readYaml(baseRecordPath);
  check(sourceObjects.length === 7, "Timoni Redis must contain seven exact objects");
  check(materialization.spec?.output?.fileSha256 === sha256(readFileSync(objectsPath)), "Timoni Redis YAML file hash changed");
  check(materialization.spec?.output?.objectSetSha256 === sourceObjectSetSha256, "Timoni Redis canonical object-set hash changed");
  check(baseRecord.spec?.configuration?.digest === sourceObjectSetSha256, "the BaseVariantRecord does not use the canonical object-set hash");
  check(baseRecord.spec?.baseVariant?.digestRole === "source-module-oci-manifest", "the source-module OCI digest role changed");
}

function createPayload() {
  const root = mkdtempSync(join(tmpdir(), "helm-expt-timoni-redis-oci-"));
  mkdirSync(join(root, "manifests"), { recursive: true });
  mkdirSync(join(root, "records"), { recursive: true });
  copyFileSync(objectsPath, join(root, "manifests", "release-objects.yaml"));
  const records = [
    ["source-and-intent.json", readYaml(sourcePath)],
    ["lifecycle-route-intent.json", readYaml(routePath)],
    ["flattening-verdict.json", readYaml(verdictPath)],
    ["materialization-receipt.json", readYaml(materializationPath)],
    ["base-variant-record.json", publicationSnapshotRecord(readYaml(baseRecordPath))],
  ];
  const recordHashes = {};
  for (const [name, record] of records) {
    const text = `${JSON.stringify(record, null, 2)}\n`;
    writeFileSync(join(root, "records", name), text);
    recordHashes[name] = sha256(text);
  }
  const index = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "LiteralConfigArtifactIndex",
    metadata: { name: "timoni-redis-8-10-1-default" },
    spec: {
      sourceModuleManifestDigest: readYaml(sourcePath).spec.source.manifestDigest,
      yamlFileSha256: sha256(readFileSync(objectsPath)),
      canonicalObjectSetSha256: sourceObjectSetSha256,
      objectCount: sourceObjects.length,
      records: recordHashes,
    },
  };
  const indexText = `${JSON.stringify(index, null, 2)}\n`;
  writeFileSync(join(root, "records", "catalog-index.json"), indexText);
  recordHashes["catalog-index.json"] = sha256(indexText);
  return { root, recordHashes };
}

function publicationSnapshotRecord(record) {
  const snapshot = structuredClone(record);
  snapshot.spec.delivery.literalConfigOci = { status: "awaits-publication" };
  snapshot.spec.delivery.configHubUpload = { status: "not-run-at-publication" };
  delete snapshot.spec.evidence.publicOciReceipt;
  delete snapshot.spec.evidence.configHubReceipt;
  snapshot.status.claim = "The immutable Timoni Redis 8.10.1 module produced seven exact Kubernetes objects and recorded the lifecycle work that plain YAML does not contain.";
  snapshot.status.limits = [
    "This is the base record at publication time. The public OCI digest and later ConfigHub receipts belong in the evolving Catalog record outside this artifact.",
    "Kubernetes admission, lifecycle execution, workload health, upgrade, rollback, and GitOps delivery have not run.",
  ];
  return snapshot;
}

function publicReceipt(manifestDigest, payload, pulled) {
  const source = readYaml(sourcePath).spec.source;
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "PublicOciReceipt",
    metadata: { name: "timoni-redis-8-10-1-default" },
    spec: {
      verifiedAt: new Date().toISOString(),
      role: "literal Kubernetes configuration produced from a Timoni module",
      artifact: {
        reference: taggedReference,
        immutableReference: `${repository}@${manifestDigest}`,
        digest: manifestDigest,
        artifactType,
        objectCount: sourceObjects.length,
        objectSetSha256: sourceObjectSetSha256,
        companionRecords: payload.recordHashes,
        authenticatedPush: "pass",
        anonymousPull: "pass",
      },
      source: {
        module: `${source.module}@${source.manifestDigest}`,
        moduleVersion: source.version,
        sourceRecord: relativeRepo(sourcePath),
        materializationReceipt: relativeRepo(materializationPath),
        routeIntent: relativeRepo(routePath),
      },
      pullBack: pulled,
    },
    status: {
      result: "pass",
      claim: "The seven exact Timoni Redis objects and their source, lifecycle, flattening, and materialization records are available in one public OCI at the recorded digest.",
      limits: [
        "This proves publication and anonymous pull-back. It does not prove Kubernetes admission, lifecycle execution, workload health, controller delivery, upgrade, or rollback.",
        "The source-module OCI and literal-configuration OCI have different roles and different digests.",
        "The base-variant-record companion is a publication-time snapshot. The current Catalog record can add this OCI digest and later ConfigHub receipts without changing the published artifact.",
      ],
    },
  };
}

function verifyAnonymousPull(reference, suppliedPayload) {
  const expectedPayload = suppliedPayload ?? createPayload();
  const removeExpectedPayload = !suppliedPayload;
  const work = mkdtempSync(join(tmpdir(), "helm-expt-timoni-redis-pull-"));
  try {
    const config = join(work, "config.json");
    const output = join(work, "pulled");
    writeFileSync(config, '{"auths":{}}\n');
    command("oras", ["pull", "--registry-config", config, "--output", output, "--no-tty", stripOci(reference)], { timeout: 420_000 });
    const docs = parseDocs(readFileSync(join(output, "manifests", "release-objects.yaml"), "utf8"));
    check(objectSetSha256(docs) === sourceObjectSetSha256, "anonymous pull changed the Timoni Redis object set");
    for (const [name, digest] of Object.entries(expectedPayload.recordHashes)) {
      check(sha256(readFileSync(join(output, "records", name))) === digest, `anonymous pull changed records/${name}`);
    }
    return { objectCount: docs.length, objectSetSha256: objectSetSha256(docs), companionRecordCount: Object.keys(expectedPayload.recordHashes).length };
  } finally {
    rmSync(work, { recursive: true, force: true });
    if (removeExpectedPayload) {
      rmSync(expectedPayload.root, { recursive: true, force: true });
    }
  }
}

function verifyPublicReceipt(pullLive) {
  check(existsSync(publicReceiptPath), `${relativeRepo(publicReceiptPath)} is missing`);
  const receipt = readYaml(publicReceiptPath);
  check(receipt.kind === "PublicOciReceipt" && receipt.status?.result === "pass", "Timoni Redis public OCI receipt is not a pass");
  check(receipt.spec?.artifact?.reference === taggedReference, "Timoni Redis OCI tag changed");
  check(receipt.spec?.artifact?.artifactType === artifactType, "Timoni Redis OCI artifact type changed");
  check(receipt.spec?.artifact?.objectCount === 7 && receipt.spec?.artifact?.objectSetSha256 === sourceObjectSetSha256, "Timoni Redis OCI object identity changed");
  check(/^sha256:[0-9a-f]{64}$/.test(receipt.spec?.artifact?.digest ?? ""), "Timoni Redis OCI manifest digest is invalid");
  const companionRecords = receipt.spec?.artifact?.companionRecords ?? {};
  check(Object.keys(companionRecords).length === 6, "Timoni Redis OCI companion-record count changed");
  check(Object.values(companionRecords).every((digest) => /^[0-9a-f]{64}$/.test(digest)), "Timoni Redis OCI companion-record hash is invalid");
  if (pullLive) verifyAnonymousPull(receipt.spec.artifact.immutableReference, { recordHashes: companionRecords });
  return receipt;
}

function syncBase(immutableReference) {
  cub([
    "variant", "upload", "--allow-exists",
    "--component", "timoni-redis-8-10-1",
    "--variant", "base",
    "--space", baseSpace,
    "--granularity", "per-resource",
    "--label", "SourceType=timoni",
    "--label", "InputFormat=LiteralOCI",
    "--label", "ResourceClass=user-workload",
    "--layer", "Application",
    "--owner", "Application",
    "--change-desc", "Retain the exact Timoni Redis objects from the public OCI",
    immutableReference,
  ], { inherit: true, timeout: 420_000 });
}

function syncPolicy(space) {
  cub(["space", "update", space, "--label", "ApplyPolicyProfile=catalog-standard", "--label", "SourceType=timoni", "--label", "InputFormat=LiteralOCI", "--label", "ResourceClass=user-workload", "--trigger-filter", filterRef, "--where-trigger", "-", "--quiet"]);
  cub(["space", "update", "--patch", space, "--refresh-triggers", "--quiet"]);
}

function syncDerivedWorkloadOnly() {
  const baseRows = listUnits(baseSpace);
  let devRows = listUnits(devSpace);
  for (const unit of devRows.filter((item) => item.Slug !== "readme" && !isWorkloadUnit(item))) {
    cub(["unit", "delete", "--space", devSpace, unit.Slug, "--quiet"]);
  }
  devRows = listUnits(devSpace);
  const currentKeys = new Set(
    devRows.filter(isWorkloadUnit).flatMap((unit) => parseDocs(unitText(unit)).map(objectKey)),
  );
  for (const upstream of baseRows.filter(isWorkloadUnit)) {
    const keys = parseDocs(unitText(upstream)).map(objectKey);
    if (keys.every((key) => currentKeys.has(key))) continue;
    cub([
      "unit", "create", "--space", devSpace, upstream.Slug,
      "--upstream-space", baseSpace, "--upstream-unit", upstream.Slug,
      "--allow-exists", "--wait=false", "--quiet",
    ]);
    keys.forEach((key) => currentKeys.add(key));
  }
}

function upsertReadme(space) {
  const path = join(repoRoot, "data", "helm-catalog-readmes", "units", space, "readme.yaml");
  check(existsSync(path), `${relativeRepo(path)} is missing; generate the Catalog READMEs first`);
  const exists = cubTry(["unit", "get", "--space", space, "readme", "-o", "name", "--quiet"]).ok;
  cub(["unit", exists ? "update" : "create", "--space", space, "readme", path, "--change-desc", "Explain this Timoni Redis example", "--label", "helm-expt.confighub.com/readme=true", "--label", `helm-expt.confighub.com/source-space=${space}`, "--quiet"]);
}

function collectHubReceipt(publicReceipt) {
  const base = inspectSpace(baseSpace, false);
  const dev = inspectSpace(devSpace, true);
  const external = JSON.parse(base.space.Annotations?.["confighub.com/external-source"] ?? "[]");
  check(external.some((item) => item.digest === publicReceipt.spec.artifact.digest), "the base Space did not record the public OCI digest");
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "TimoniRedisConfigHubReceipt",
    metadata: { name: "timoni-redis-8-10-1" },
    spec: {
      verifiedAt: new Date().toISOString(),
      organization,
      source: { immutableReference: publicReceipt.spec.artifact.immutableReference, objectSetSha256: sourceObjectSetSha256 },
      base: receiptSpace(base),
      development: receiptSpace(dev),
      variantRelationship: {
        upstreamSpaceId: base.space.SpaceID,
        downstreamSpaceId: dev.space.SpaceID,
        linkedUnits: dev.units.filter((unit) => unit.UpstreamSpaceID === base.space.SpaceID && unit.UpstreamUnitID).length,
        objectChange: "none",
        environmentLabel: dev.space.Labels?.Environment,
      },
      policy: { profile: "catalog-standard", definitionSha256: sha256(policyText), checks: expectedChecks },
      lifecycle: { routeIntent: relativeRepo(routePath), resolution: "not-run-no-destination-selected" },
    },
    status: {
      result: "pass",
      import: "pass",
      derivedVariant: "pass",
      routeExecution: "not-run",
      kubernetesApply: "not-run",
      argoCd: "not-run",
      flux: "not-run",
      claim: "ConfigHub retained the seven exact objects from the public Timoni Redis OCI and created a linked development variant with the same object set.",
      limits: [
        "No destination is selected, so the master-first wait, replica ordering, and optional PING test are not resolved or executed.",
        "The development variant currently changes environment metadata only; its Kubernetes objects intentionally match the base.",
      ],
    },
  };
}

function inspectSpace(spaceSlug, derived) {
  const all = listUnits(spaceSlug);
  const readmes = all.filter((unit) => unit.Slug === "readme");
  check(readmes.length === 1, `${spaceSlug} must contain one readme Unit`);
  const units = all.filter(isWorkloadUnit);
  const companionUnits = all.filter((unit) => unit.Slug !== "readme" && !isWorkloadUnit(unit));
  const docs = units.flatMap((unit) => parseDocs(unitText(unit)));
  check(objectSetSha256(docs) === sourceObjectSetSha256, `${spaceSlug} objects differ from the public OCI`);
  const space = all[0]?.Space ?? cubJson(["space", "get", spaceSlug, "-o", "json"]).Space;
  check(space.Labels?.ApplyPolicyProfile === "catalog-standard", `${spaceSlug} has no catalog-standard policy label`);
  check(derived ? space.Labels?.Variant === "dev" : space.Labels?.Variant === "base", `${spaceSlug} variant label changed`);
  if (derived) check(units.every((unit) => unit.UpstreamUnitID && unit.UpstreamSpaceID), `${spaceSlug} contains an unlinked workload Unit`);
  check(derived ? companionUnits.length === 0 : companionUnits.length === 6, `${spaceSlug} has an unexpected companion-record count`);
  return { space, units, companionUnits, readme: readmes[0], docs };
}

function receiptSpace(value) {
  return {
    slug: value.space.Slug,
    id: value.space.SpaceID,
    labels: value.space.Labels,
    objectCount: value.docs.length,
    objectSetSha256: objectSetSha256(value.docs),
    units: value.units.map((unit) => ({ slug: unit.Slug, id: unit.UnitID, dataHash: unit.DataHash, upstreamUnitId: unit.UpstreamUnitID ?? "" })),
    companionUnits: value.companionUnits.map((unit) => ({ slug: unit.Slug, id: unit.UnitID, dataHash: unit.DataHash })),
    readme: { id: value.readme.UnitID, dataHash: value.readme.DataHash },
  };
}

function verifyHubReceipt(checkLive) {
  check(existsSync(hubReceiptPath), `${relativeRepo(hubReceiptPath)} is missing`);
  const receipt = readYaml(hubReceiptPath);
  check(receipt.kind === "TimoniRedisConfigHubReceipt" && receipt.status?.result === "pass", "Timoni Redis ConfigHub receipt is not a pass");
  check(receipt.spec?.source?.objectSetSha256 === sourceObjectSetSha256, "Timoni Redis ConfigHub source hash changed");
  check(receipt.spec?.base?.objectCount === 7 && receipt.spec?.development?.objectCount === 7, "Timoni Redis ConfigHub object count changed");
  check(receipt.spec?.base?.objectSetSha256 === sourceObjectSetSha256 && receipt.spec?.development?.objectSetSha256 === sourceObjectSetSha256, "Timoni Redis ConfigHub object set changed");
  check(receipt.spec?.base?.companionUnits?.length === 6 && receipt.spec?.development?.companionUnits?.length === 0, "Timoni Redis companion records must remain on the base only");
  check(receipt.spec?.variantRelationship?.linkedUnits === 7 && receipt.spec?.variantRelationship?.objectChange === "none", "Timoni Redis development variant relationship changed");
  verifyTimoniPolicyHistory(readFileSync(hubReceiptPath, "utf8"), policyText, { requireCurrent: checkLive });
  check(receipt.status?.routeExecution === "not-run" && receipt.status?.argoCd === "not-run" && receipt.status?.flux === "not-run", "Timoni Redis receipt overclaims delivery");
  if (checkLive) {
    const current = collectHubReceipt(verifyPublicReceipt(false));
    for (const key of ["base", "development"]) {
      check(current.spec[key].id === receipt.spec[key].id, `${key} Space ID changed`);
      check(current.spec[key].units.every((unit) => receipt.spec[key].units.some((saved) => saved.id === unit.id && saved.dataHash === unit.dataHash)), `${key} Units drifted from the receipt`);
      check(current.spec[key].companionUnits.every((unit) => receipt.spec[key].companionUnits.some((saved) => saved.id === unit.id && saved.dataHash === unit.dataHash)), `${key} companion records drifted from the receipt`);
      check(current.spec[key].readme.id === receipt.spec[key].readme.id && current.spec[key].readme.dataHash === receipt.spec[key].readme.dataHash, `${key} README drifted from the receipt`);
    }
  }
  return receipt;
}

function writeSummary() {
  mkdirSync(join(repoRoot, "data", "timoni-redis-catalog-proof"), { recursive: true });
  write(summaryPath, renderSummary());
}

function renderSummary() {
  const publicReceipt = readYaml(publicReceiptPath);
  const hubReceipt = existsSync(hubReceiptPath)
    ? readYaml(hubReceiptPath)
    : null;
  const policyCoverage = hubReceipt
    ? verifyTimoniPolicyHistory(readFileSync(hubReceiptPath, "utf8"), policyText)
    : null;
  const policyNote = policyCoverage?.currentPolicyDefinition === "not-recorded"
    ? `The exact historical receipt remains bound to its recorded policy names. It does not bind the current policy definition. Added check names: ${policyCoverage.addedChecks.join(", ") || "none"}; removed check names: ${policyCoverage.removedChecks.join(", ") || "none"}. Current-policy coverage remains unrecorded until a fresh ConfigHub sync receipt exists.`
    : "The receipt binds the current policy definition by SHA-256.";
  const hubProgress = hubReceipt
    ? `- ConfigHub retained the same seven objects in \`${baseSpace}\`.\n- \`${devSpace}\` is a linked environment variant. It currently changes no Kubernetes field, so its object-set hash remains identical.`
    : "- ConfigHub retention has not run yet.";
  const hubEvidence = hubReceipt
    ? `- [ConfigHub receipt](../../${relativeRepo(hubReceiptPath)})\n`
    : "";
  const hubResult = hubReceipt
    ? `The ConfigHub receipt records ${hubReceipt.spec.variantRelationship.linkedUnits} linked workload Units in the development variant.`
    : "The public OCI receipt is complete. The ConfigHub receipt will be added after the exact artifact is retained.";
  return `# Timoni Redis Catalog proof\n\nThe Config Workshop Catalog retains Timoni Redis 8.10.1 as a source-neutral configuration example.\n\n## What now works\n\n- The immutable Timoni module is recorded separately from the Kubernetes objects it produced.\n- The seven exact objects are published as a public literal configuration OCI: \`${publicReceipt.spec.artifact.immutableReference}\`.\n- An anonymous pull reproduced object set \`${sourceObjectSetSha256}\`.\n${hubProgress}\n\n## Four different identities\n\n| Identity | Value |\n| --- | --- |\n| Source-module OCI manifest | \`${readYaml(sourcePath).spec.source.manifestDigest}\` |\n| Rendered YAML file | \`${sha256(readFileSync(objectsPath))}\` |\n| Canonical Kubernetes object set | \`${sourceObjectSetSha256}\` |\n| Literal configuration OCI manifest | \`${publicReceipt.spec.artifact.digest}\` |\n\nThese values answer different questions and must not be substituted for one another. The base record inside the OCI is the publication-time snapshot. The Catalog record outside the artifact can add the assigned OCI digest and later ConfigHub receipts.\n\n## What remains\n\nThe source says to apply the master objects first, wait for readiness, then apply the read-only replica. The optional PING test is disabled by default. No destination has been selected for the ConfigHub variant, so that lifecycle work has not run. Kubernetes admission, workload health, Argo CD, Flux, upgrade, and rollback remain not run.\n\n## Policy definition coverage\n\n${hubReceipt ? policyNote : "No ConfigHub policy receipt has been recorded."} Policy check names describe the referenced configuration; they are not individual check-execution results.\n\n## Evidence\n\n- [Source and intent](../../${relativeRepo(sourcePath)})\n- [Materialization receipt](../../${relativeRepo(materializationPath)})\n- [Lifecycle route intent](../../${relativeRepo(routePath)})\n- [Public OCI receipt](../../${relativeRepo(publicReceiptPath)})\n${hubEvidence}- [BaseVariantRecord](../../${relativeRepo(baseRecordPath)})\n\n${hubResult}\n`;
}

function assertOrg() {
  const value = JSON.parse(command("cub", ["context", "get", context, "-o", "json"]).output);
  check(value.metadata?.organizationName === organization, `context ${context} does not point at ${organization}`);
  cub(["auth", "status"]);
}

function spaceExists(space) {
  return cubTry(["space", "get", space, "-o", "name", "--quiet"]).ok;
}

function cub(args, options = {}) {
  return command("cub", ["--context", context, ...args], options);
}

function cubJson(args) {
  return JSON.parse(cub(args).output);
}

function listUnits(space) {
  const rows = cubJson(["unit", "list", "--space", space, "-o", "json"]);
  check(Array.isArray(rows), `${space}: cub unit list returned an unexpected shape`);
  return rows.map((row) => row.Unit ?? row);
}

// Configuration data is not a Unit field any more. It is read from the Unit's own
// data endpoint, which `cub unit data` calls, and it comes back as text. The read
// is cached per (Unit, DataHash) because the row no longer carries the document and
// the workload filters ask for the same Unit repeatedly.
const unitTextCache = new Map();

function unitText(unit) {
  const key = `${unit.UnitID}:${unit.DataHash ?? ""}`;
  const cached = unitTextCache.get(key);
  if (cached !== undefined) return cached;
  const space = unit.SpaceSlug || unit.SpaceID;
  const text = cub(["unit", "data", unit.UnitID ?? unit.Slug, "--space", space]).output;
  unitTextCache.set(key, text);
  return text;
}

function isWorkloadUnit(unit) {
  if (unit.Slug === "readme") return false;
  const docs = parseDocs(unitText(unit));
  return docs.length > 0 && docs.every((object) => sourceObjectKeys.has(objectKey(object)));
}

function objectKey(object) {
  return [object.apiVersion, object.kind, object.metadata?.namespace ?? "", object.metadata?.name ?? ""].join("|");
}

function cubTry(args) {
  const result = spawnSync("cub", ["--context", context, ...args], { cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 200, env: { ...process.env, CONFIGHUB_AGENT: "1" } });
  return { ok: result.status === 0, output: result.stdout ?? "", error: result.stderr ?? "" };
}

function command(name, args, options = {}) {
  const result = spawnSync(name, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    stdio: options.inherit ? ["ignore", "inherit", "inherit"] : ["ignore", "pipe", "pipe"],
    timeout: options.timeout,
  });
  if (result.status !== 0) throw new Error(`${name} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return { output: result.stdout ?? "" };
}

function stripOci(reference) {
  return reference.replace(/^oci:\/\//, "");
}

function sameSet(left, right) {
  return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}
