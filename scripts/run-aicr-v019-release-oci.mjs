#!/usr/bin/env node

import { execFileSync } from "node:child_process";
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
import { basename, join } from "node:path";
import { createHash } from "node:crypto";

import {
  check,
  listFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--publish", "--run", "--verify", "--self-test"].includes(mode), "use --publish, --run, --verify, or --self-test");

const context = process.env.CUB_CONTEXT ?? "river-bear";
const version = process.env.AICR_ARGOCD_VERSION?.trim() || "0.19.0";
check(["0.19.0", "0.20.0"].includes(version), `unsupported AICR version ${version}`);
const v020Entry = version === "0.20.0";
const versionSlug = `v${version.replaceAll(".", "-")}`;
const space = `aicr-eks-h100-training-kubeflow-${versionSlug}-argocd-${v020Entry ? "production" : "staging"}`;
const releaseSelection = v020Entry
  ? "production head revisions verified against the promotion receipt"
  : "head revisions";
const configurationUnit = "aicr-eks-h100-training-kubeflow";
const readmeUnit = "readme";
const registryHost = "oci.hub.confighub.com:443";
const exampleRoot = join(
  repoRoot,
  "examples",
  "aicr",
  `eks-h100-training-kubeflow-${versionSlug}`,
);
const contentRoot = join(exampleRoot, "confighub-release");
const configurationPath = join(contentRoot, `${configurationUnit}.yaml`);
const readmePath = join(contentRoot, "readme.yaml");
const receiptPath = join(exampleRoot, "confighub-release-oci-receipt.yaml");
const promotionReceiptPath = join(exampleRoot, "promotion-readiness-receipt.yaml");
const generationReceiptPath = join(exampleRoot, "generation-receipt.yaml");
const promotionReceipt = readYaml(promotionReceiptPath);
const releaseChainKey = v020Entry ? "production" : "staging";
const releaseChain = promotionReceipt.spec?.chain?.[releaseChainKey];
check(releaseChain, `promotion receipt has no ${releaseChainKey} record`);
const expectedConfigurationRevision = releaseChain.configurationUnit.headRevision;
const expectedReadmeRevision = releaseChain.readmeUnit.headRevision;

if (mode === "--publish") publish();
else if (mode === "--run") run();
else if (mode === "--self-test") selfTestRevisionWitness();
else verify();

function publish() {
  check(
    process.env.HELM_EXPT_ALLOW_AICR_RELEASE === "1",
    "set HELM_EXPT_ALLOW_AICR_RELEASE=1 to approve and publish the persistent AICR release",
  );
  const units = cubJson(["unit", "list", "--space", space, "-o", "json"]);
  const configRecord = unitRecord(units, configurationUnit);
  const readmeRecord = unitRecord(units, readmeUnit);
  check(
    configRecord.Unit.HeadRevisionNum === expectedConfigurationRevision,
    `${releaseChainKey} configuration head changed before approval`,
  );
  check(
    readmeRecord.Unit.HeadRevisionNum === expectedReadmeRevision,
    `${releaseChainKey} README head changed before approval`,
  );

  // ConfigHub v0.3 approves the current head only. The checks above bind that
  // head to the exact revisions recorded by the promotion receipt.
  if (Object.keys(configRecord.Unit.ApplyGates ?? {}).length > 0) {
    cubText([
      "unit",
      "approve",
      "--space",
      space,
      configurationUnit,
      "--wait",
      "--quiet",
    ]);
  }
  if (Object.keys(readmeRecord.Unit.ApplyGates ?? {}).length > 0) {
    cubText([
      "unit",
      "approve",
      "--space",
      space,
      readmeUnit,
      "--wait",
      "--quiet",
    ]);
  }

  const approvedUnits = cubJson(["unit", "list", "--space", space, "-o", "json"]);
  const approvedConfig = unitRecord(approvedUnits, configurationUnit);
  const approvedReadme = unitRecord(approvedUnits, readmeUnit);
  check(
    approvedConfig.Unit.HeadRevisionNum === expectedConfigurationRevision
      && approvedReadme.Unit.HeadRevisionNum === expectedReadmeRevision,
    `${releaseChainKey} heads changed during approval`,
  );
  check(
    Object.keys(approvedConfig.Unit.ApplyGates ?? {}).length === 0
      && Object.keys(approvedReadme.Unit.ApplyGates ?? {}).length === 0,
    `${releaseChainKey} approval gates did not clear`,
  );
  const args = [
    "release",
    "publish",
    space,
    "--label",
    "SourceType=aicr",
    "--label",
    `SourceVersion=${version}`,
    "-o",
    "json",
  ];
  const published = JSON.parse(cubText(args));
  const release = published.Release ?? published;
  check(
    /^sha256:[0-9a-f]{64}$/.test(release.ManifestDigest ?? ""),
    "ConfigHub release publish returned no manifest digest",
  );
  run();
}

function run() {
  const units = cubJson(["unit", "list", "--space", space, "-o", "json"]);
  const configRecord = unitRecord(units, configurationUnit);
  const readmeRecord = unitRecord(units, readmeUnit);
  check(
    configRecord.Unit.HeadRevisionNum === expectedConfigurationRevision,
    `${releaseChainKey} configuration head changed`,
  );
  check(
    readmeRecord.Unit.HeadRevisionNum === expectedReadmeRevision,
    `${releaseChainKey} README head changed`,
  );
  check(
    Object.keys(configRecord.Unit.ApplyGates ?? {}).length === 0,
    `${releaseChainKey} configuration still has an outstanding apply gate`,
  );
  check(
    Object.keys(readmeRecord.Unit.ApplyGates ?? {}).length === 0,
    `${releaseChainKey} README still has an outstanding apply gate`,
  );

  const release = latestRelease();
  const releaseRecord = cubJson([
    "release",
    "get",
    "--space",
    space,
    release.ReleaseID,
    "-o",
    "json",
  ]);
  check(releaseRecord.Release.Published === true, "latest AICR release is not published");
  check(releaseRecord.Release.ManifestDigest === release.ManifestDigest, "release manifest changed");

  const work = mkdtempSync(join(tmpdir(), `helm-expt-aicr-${versionSlug}-release-`));
  try {
    const registryConfig = join(work, "registry.json");
    const pullRoot = join(work, "pull");
    const extractRoot = join(work, "extract");
    const worker = configRecord.BridgeWorker;
    const workerSpace = spaceSlugForId(worker.SpaceID);
    const password = cubText(["worker", "get-secret", "--space", workerSpace, worker.Slug]).trim();
    check(password.length > 20, "release worker returned no OCI credential");
    const auth = Buffer.from(`${worker.BridgeWorkerID}:${password}`).toString("base64");
    writeFileSync(
      registryConfig,
      JSON.stringify({
        auths: {
          [registryHost]: {
            username: worker.BridgeWorkerID,
            password,
            auth,
          },
        },
      }),
      { mode: 0o600 },
    );

    const reference = `${registryHost}/space/${space}@${release.ManifestDigest}`;
    const resolved = command("oras", ["resolve", reference, "--registry-config", registryConfig]).trim();
    check(resolved === release.ManifestDigest, "OCI registry resolved a different release digest");
    command("mkdir", [pullRoot]);
    command("oras", ["pull", reference, "--registry-config", registryConfig, "--output", pullRoot]);
    const archives = listFiles(pullRoot).filter((path) => path.endsWith(".tar.gz"));
    check(archives.length === 1, `expected one release archive, found ${archives.length}`);
    command("mkdir", [extractRoot]);
    command("tar", ["-xzf", archives[0], "-C", extractRoot]);
    const files = listFiles(extractRoot);
    const pulledConfig = files.find((path) => basename(path) === `${configurationUnit}.yaml`);
    const pulledReadme = files.find((path) => basename(path) === "readme.yaml");
    check(pulledConfig && pulledReadme && files.length === 2, "release OCI file set changed");
    mkdirSync(contentRoot, { recursive: true });
    copyFileSync(pulledConfig, configurationPath);
    copyFileSync(pulledReadme, readmePath);

    const comparison = inspectConfiguration(configurationPath);
    const readme = inspectReadme(readmePath);
    const receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "ConfigHubReleaseOciReceipt",
      metadata: {
        name: `aicr-eks-h100-training-kubeflow-${versionSlug}-${releaseChainKey}`,
      },
      spec: {
        checkedAt: new Date().toISOString(),
        organization: "helm-catalog",
        space: {
          slug: space,
          id: releaseRecord.Space.SpaceID,
        },
        approval: {
          requiredGate: "platform/require-approval/vet-approvedby",
          configuration: {
            unit: configurationUnit,
            id: configRecord.Unit.UnitID,
            revision: configRecord.Unit.HeadRevisionNum,
            outstandingApplyGates: 0,
          },
          readme: {
            unit: readmeUnit,
            id: readmeRecord.Unit.UnitID,
            revision: readmeRecord.Unit.HeadRevisionNum,
            outstandingApplyGates: 0,
          },
        },
        release: {
          id: release.ReleaseID,
          number: release.ReleaseNum,
          tag: releaseRecord.Tag.Slug,
          reference: `oci://${registryHost}/space/${space}@${release.ManifestDigest}`,
          manifestDigest: release.ManifestDigest,
          bundleDigest: release.Digest,
          unitCount: release.UnitCount,
          published: release.Published,
          revision: releaseSelection,
          resolvedManifestDigest: resolved,
        },
        content: {
          files: [
            fileRecord(configurationPath),
            fileRecord(readmePath),
          ],
          configuration: comparison,
          readme,
        },
        evidence: {
          promotionReceipt: relativeRepo(promotionReceiptPath),
          configuration: relativeRepo(configurationPath),
          readme: relativeRepo(readmePath),
        },
        limits: [
          "This proves approval, ConfigHub release publication, an authenticated pull by exact manifest digest, and the contents of that release.",
          "Promotion moved the reviewed configuration between ConfigHub environments. This separate publication created the deployable OCI release.",
          "It does not prove Argo CD reconciliation, EKS or H100 readiness, a training or NIM request, Flux delivery, fleet rollout, observation, or rollback.",
        ],
      },
      status: {
        result: "pass",
        approval: "pass",
        releasePublish: "pass",
        registryPull: "pass",
        manifestDigestMatched: "pass",
        promotedConfigurationMatched: "pass",
        argoCdReconciliation: "not-run",
        eksH100Runtime: "not-run",
        fluxDelivery: "not-run",
        fleetRollout: "not-run",
        rollback: "not-run",
      },
    };
    writeYaml(receiptPath, receipt);
    if (v020Entry) {
      const generationReceipt = readYaml(generationReceiptPath);
      generationReceipt.status.configHubReleaseOci = "pass";
      writeYaml(generationReceiptPath, generationReceipt);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  verify();
  console.log(`wrote ${relativeRepo(receiptPath)}`);
}

function verify() {
  check(existsSync(receiptPath), `AICR v${version} release OCI receipt is missing; run --run`);
  check(existsSync(configurationPath) && existsSync(readmePath), "retained release files are missing");
  const receipt = readYaml(receiptPath);
  check(receipt.kind === "ConfigHubReleaseOciReceipt", "release receipt kind changed");
  check(receipt.spec?.space?.slug === space, "release receipt Space changed");
  check(receipt.spec?.release?.published === true, "release receipt is not published");
  check(
    /^sha256:[0-9a-f]{64}$/.test(receipt.spec?.release?.manifestDigest ?? "")
      && receipt.spec.release.resolvedManifestDigest === receipt.spec.release.manifestDigest,
    "release OCI digest resolution did not pass",
  );
  check(receipt.spec?.release?.unitCount === 2, "release must contain the configuration and README Units");
  const byPath = new Map(receipt.spec.content.files.map((item) => [item.path, item]));
  for (const path of [configurationPath, readmePath]) {
    const item = byPath.get(relativeRepo(path));
    check(item, `release receipt omits ${relativeRepo(path)}`);
    check(item.sha256 === sha256(readFileSync(path)), `${relativeRepo(path)} digest changed`);
  }
  const comparison = inspectConfiguration(configurationPath);
  check(comparison.objectCount === 17, "release configuration no longer contains 17 Applications");
  check(
    comparison.canonicalDataSha256
      === releaseChain.canonicalDataSha256,
    `release configuration differs from the promoted ${releaseChainKey} object set`,
  );
  check(comparison.originAnnotationCount === 17, "release provenance annotations changed");
  const revision = retainedReadmeRevision(receipt, releaseChain.readmeUnit, !v020Entry);
  const readme = inspectReadme(readmePath, revision);
  check(readme.kind === "HelmCatalogDemoReadme", "release README shape changed");
  check(receipt.status?.promotedConfigurationMatched === "pass", "release comparison is not pass");
  check(receipt.status?.argoCdReconciliation === "not-run", "receipt must not claim Argo CD reconciliation");
  check(receipt.status?.eksH100Runtime === "not-run", "receipt must not claim H100 runtime evidence");
  console.log(`verified the approved AICR v${version} ConfigHub release OCI`);
}

function latestRelease() {
  const releases = cubJson(["release", "list", "--space", space, "-o", "json"])
    .map((record) => record.Release ?? record)
    .filter((release) => release.Published === true)
    .sort((left, right) => right.ReleaseNum - left.ReleaseNum);
  check(
    releases.length > 0,
    `${releaseChainKey} has no published release; approve both Units and publish it first`,
  );
  return releases[0];
}

function unitRecord(records, slug) {
  const record = records.find((candidate) => candidate.Unit?.Slug === slug);
  check(record, `${space} has no ${slug} Unit`);
  return record;
}

function spaceSlugForId(id) {
  const record = cubJson(["space", "list", "-o", "json"])
    .find((candidate) => candidate.Space?.SpaceID === id);
  check(record, `cannot resolve worker Space ${id}`);
  return record.Space.Slug;
}

function inspectConfiguration(path) {
  const docs = parseDocs(readFileSync(path, "utf8"));
  let originAnnotationCount = 0;
  for (const doc of docs) {
    check(doc.kind === "Application", "release configuration contains a non-Application object");
    const origin = doc.metadata?.annotations?.["confighub.com/origin"];
    check(origin, `${doc.metadata?.name}: release object has no ConfigHub origin`);
    const parsed = JSON.parse(origin);
    check(parsed.spaceSlug === space, `${doc.metadata?.name}: origin Space changed`);
    check(parsed.unitSlug === configurationUnit, `${doc.metadata?.name}: origin Unit changed`);
    check(
      parsed.revisionNum === expectedConfigurationRevision,
      `${doc.metadata?.name}: origin revision changed`,
    );
    originAnnotationCount += 1;
    delete doc.metadata.annotations["confighub.com/origin"];
    if (Object.keys(doc.metadata.annotations).length === 0) delete doc.metadata.annotations;
  }
  return {
    objectCount: docs.length,
    canonicalDataSha256: hash(canonicalDocs(docs)),
    expectedStagingDataSha256: promotionReceipt.spec.chain.staging.canonicalDataSha256,
    originAnnotationCount,
  };
}

// v0.19 predates headRevision in promotion receipts. Its separately captured
// release approval is the revision witness for offline verification only.
// Live publish/run paths still require the promotion receipt's explicit head.
function retainedReadmeRevision(receipt, promotedUnit, allowLegacy) {
  const approval = receipt.spec?.approval?.readme;
  check(approval?.unit === readmeUnit && approval?.id === promotedUnit.id,
    "README approval Unit does not match the promotion receipt");
  check(Number.isInteger(approval.revision) && approval.revision > 0
    && approval.outstandingApplyGates === 0,
    "README approval lacks an approved positive revision");
  if (promotedUnit.headRevision === undefined) {
    check(allowLegacy, "README promotion receipt lacks headRevision");
    return approval.revision;
  }
  check(approval.revision === promotedUnit.headRevision,
    "README approval revision differs from the promotion receipt");
  return promotedUnit.headRevision;
}

function selfTestRevisionWitness() {
  const unit = { id: "readme-unit" };
  const receipt = { spec: { approval: { readme: {
    unit: readmeUnit, id: unit.id, revision: 9, outstandingApplyGates: 0,
  } } } };
  check(retainedReadmeRevision(receipt, unit, true) === 9, "legacy approval witness rejected");
  check(retainedReadmeRevision(receipt, { ...unit, headRevision: 9 }, false) === 9,
    "current promotion witness rejected");
  const reject = (candidate, promoted, legacy) => {
    let rejected = false;
    try { retainedReadmeRevision(candidate, promoted, legacy); } catch { rejected = true; }
    check(rejected, "invalid README revision witness accepted");
  };
  reject(receipt, unit, false);
  reject(receipt, { ...unit, headRevision: 8 }, false);
  reject(receipt, { id: "another-unit" }, true);
  for (const delta of [{ revision: 0 }, { revision: "9" }, { outstandingApplyGates: 1 }, { unit: "another-unit" }]) {
    const changed = structuredClone(receipt);
    Object.assign(changed.spec.approval.readme, delta);
    reject(changed, unit, true);
  }
  reject({ spec: {} }, unit, true);
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-readme-origin-"));
  try {
    const path = join(temp, "readme.yaml");
    const original = parseDocs(readFileSync(readmePath, "utf8"))[0];
    const originalOrigin = JSON.parse(original.metadata.annotations["confighub.com/origin"]);
    inspectReadme(readmePath, originalOrigin.revisionNum);
    for (const delta of [{ revisionNum: originalOrigin.revisionNum + 1 }, { unitId: "another-unit" }]) {
      const doc = structuredClone(original);
      const origin = { ...originalOrigin };
      Object.assign(origin, delta);
      doc.metadata.annotations["confighub.com/origin"] = JSON.stringify(origin);
      writeYaml(path, doc);
      let rejected = false;
      try { inspectReadme(path, originalOrigin.revisionNum); } catch (error) { rejected = error.message === "README origin changed"; }
      check(rejected, "tampered README origin accepted");
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  console.log("self-test passed: legacy/current README witnesses, eight invalid approvals, and two tampered origins");
}

function inspectReadme(path, expectedRevision = expectedReadmeRevision) {
  const docs = parseDocs(readFileSync(path, "utf8"));
  check(docs.length === 1, "release README must contain one record");
  const doc = docs[0];
  const origin = JSON.parse(doc.metadata?.annotations?.["confighub.com/origin"] ?? "null");
  check(
    origin?.spaceSlug === space
      && origin?.unitSlug === readmeUnit
      && origin?.unitId === releaseChain.readmeUnit.id
      && origin?.revisionNum === expectedRevision,
    "README origin changed",
  );
  return {
    kind: doc.kind,
    title: doc.spec?.title,
    originRevision: origin.revisionNum,
  };
}

function canonicalDocs(docs) {
  return JSON.stringify(
    docs
      .map((doc) => ({
        identity: [
          doc.apiVersion ?? "",
          doc.kind ?? "",
          doc.metadata?.namespace ?? "",
          doc.metadata?.name ?? "",
        ].join("|"),
        doc,
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );
}

function fileRecord(path) {
  return {
    path: relativeRepo(path),
    sha256: sha256(readFileSync(path)),
  };
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cubJson(args) {
  return JSON.parse(cubText([...args]));
}

function cubText(args) {
  return command("cub", ["--context", context, ...args]);
}

function command(binary, args) {
  return execFileSync(binary, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
    timeout: 300_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
