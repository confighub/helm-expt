#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  readYamlText,
  repoRoot,
  runCub,
  sha256File,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const cubContext = process.env.CUB_CONTEXT ?? "";
if (!["--verify", "--hub-verify"].includes(mode)) {
  console.error("Usage: node scripts/verify-sveltos-example.mjs [--verify|--hub-verify]");
  process.exit(1);
}

const root = join(repoRoot, "examples", "sveltos", "kyverno-fleet");
const profilePath = join(root, "clusterprofile.yaml");
const sourceLockPath = join(root, "source-lock.yaml");
const receiptPath = join(root, "live-receipt.yaml");
const readmePath = join(root, "README.md");
const readmeUnitPath = join(root, "readme.yaml");

const profile = readYaml(profilePath);
const sourceLock = readYaml(sourceLockPath);
const receipt = readYaml(receiptPath);
const readmeUnit = readYaml(readmeUnitPath);
const readmeText = readFileSync(readmePath, "utf8").trimEnd();

check(profile.apiVersion === "config.projectsveltos.io/v1beta1", "Sveltos apiVersion changed");
check(profile.kind === "ClusterProfile", "Sveltos example must be a ClusterProfile");
check(profile.metadata?.name === "kyverno-staging", "Sveltos ClusterProfile name changed");
check(
  profile.spec?.clusterSelector?.matchLabels?.environment === "staging",
  "Sveltos cluster selector changed",
);
check(
  profile.spec?.syncMode === "ContinuousWithDriftDetection",
  "Sveltos drift mode changed",
);
check(profile.spec?.helmCharts?.length === 1, "Sveltos example must contain one Helm chart");
const chart = profile.spec.helmCharts[0];
check(chart.repositoryURL === "https://kyverno.github.io/kyverno/", "Kyverno repository changed");
check(chart.chartName === "kyverno/kyverno", "Kyverno chart name changed");
check(String(chart.chartVersion) === "3.8.1", "Kyverno chart version changed");
check(chart.releaseName === "kyverno", "Kyverno release name changed");
check(chart.releaseNamespace === "kyverno", "Kyverno namespace changed");
const values = readYamlText(chart.values);
check(values.admissionController?.replicas === 3, "Kyverno admission replica setting changed");
check(values.replicaCount === undefined, "Sveltos example contains an unused generic replicaCount");

check(sourceLock.spec?.sveltos?.version === "v1.12.0", "Sveltos source version changed");
check(
  sourceLock.spec?.sveltos?.addonControllerCommit ===
    "b528b72dedf369566470709796d23d93fa1827b1",
  "Sveltos addon-controller commit changed",
);
check(
  sourceLock.spec?.sveltos?.manifestSha256 ===
    "7ce065d86662c9cc431c07021d5b1cbe812b00f7ddde57dc465a44b03f5a7280",
  "Sveltos manifest checksum changed",
);
check(
  sourceLock.spec?.sveltosctl?.darwinArm64Sha256 ===
    "7a33043ceb0043f6f0e9b52bd9a6b79de8a4dc555d9f6e023a5a0ad5e3ac21f9",
  "sveltosctl checksum changed",
);

check(receipt.kind === "SveltosFleetReceipt", "Sveltos receipt kind changed");
check(receipt.spec?.source?.rawSha256 === sha256File(profilePath), "Sveltos source hash changed");
const canonicalSource = canonicalHash(readFileSync(profilePath, "utf8"));
check(
  receipt.spec?.source?.canonicalSha256 === canonicalSource,
  "Sveltos canonical source hash changed",
);
check(receipt.spec?.source?.serverSideDryRun === "pass", "Sveltos API validation must stay recorded");
check(receipt.spec?.configHub?.unit?.canonicalObjectMatchesSource === true, "ConfigHub source match changed");
check(receipt.spec?.configHub?.policy?.profile === "catalog-standard", "Sveltos policy profile changed");
check(receipt.spec?.management?.helmFeatureStatus === "Provisioned", "Sveltos Helm result changed");
check(receipt.spec?.workload?.helmRelease?.chart === "kyverno-3.8.1", "live Kyverno chart changed");
check(receipt.spec?.workload?.deployments?.length === 4, "live Kyverno deployment count changed");
check(
  receipt.spec.workload.deployments.every((item) => item.desired === item.available),
  "a recorded Kyverno deployment is not available",
);
check(receipt.spec?.driftTest?.result === "pass", "Sveltos drift test must stay recorded");
check(receipt.spec?.driftTest?.changedReplicas === 1, "Sveltos drift fixture changed");
check(receipt.spec?.driftTest?.restoredReplicas === 3, "Sveltos drift recovery changed");
check(receipt.status?.result === "partial", "Sveltos overall result must remain partial");
check(receipt.status?.automatedConfigHubDelivery === "not-run", "automated delivery is overclaimed");
check(receipt.status?.multiClusterPromotionWave === "not-run", "fleet promotion is overclaimed");
check(
  readmeText.includes("What remains manual"),
  "Sveltos README must explain the manual handoff",
);
check(readmeUnit.kind === "HelmCatalogDemoReadme", "Sveltos README Unit kind changed");
check(
  readmeUnit.spec?.space === receipt.spec.configHub.space.slug,
  "Sveltos README Unit points at the wrong Space",
);
check(
  readmeUnit.spec?.markdown === readmeText,
  "Sveltos README Unit markdown differs from README.md",
);

if (mode === "--hub-verify") verifyHub();

console.log(
  mode === "--hub-verify"
    ? "verified live ConfigHub Sveltos Space, source object, README, and baseline policy"
    : "verified Sveltos v1.12.0 Kyverno fleet receipt and source lock",
);

function verifyHub() {
  const spaceSlug = receipt.spec.configHub.space.slug;
  const space = JSON.parse(runHub(["space", "get", spaceSlug, "-o", "json"])).Space;
  check(space.SpaceID === receipt.spec.configHub.space.id, "live Sveltos Space ID changed");
  check(
    space.TriggerFilterID === receipt.spec.configHub.policy.filterId,
    "live Sveltos policy filter changed",
  );
  check(space.Labels?.ApplyPolicyProfile === "catalog-standard", "live Sveltos policy label changed");

  const unit = JSON.parse(
    runHub(["unit", "get", receipt.spec.configHub.unit.slug, "--space", spaceSlug, "-o", "json"]),
  ).Unit;
  check(unit.UnitID === receipt.spec.configHub.unit.id, "live Sveltos Unit ID changed");
  check(unit.DataHash === receipt.spec.configHub.unit.dataHash, "live Sveltos Unit data hash changed");
  const unitText = Buffer.from(unit.Data, "base64").toString("utf8");
  check(canonicalHash(unitText) === receipt.spec.source.canonicalSha256, "live Sveltos Unit differs from source");

  const readme = JSON.parse(runHub(["unit", "get", "readme", "--space", spaceSlug, "-o", "json"])).Unit;
  check(readme.UnitID === receipt.spec.configHub.readme.id, "live Sveltos README Unit ID changed");
  check(
    readme.DataHash === receipt.spec.configHub.readme.dataHash,
    "live Sveltos README Unit data hash changed",
  );
  const liveReadmeUnit = readYamlText(Buffer.from(readme.Data, "base64").toString("utf8"));
  check(
    liveReadmeUnit.spec?.markdown === readmeText,
    "live Sveltos README text differs from source",
  );

  const units = JSON.parse(runHub(["unit", "list", "--space", spaceSlug, "--quiet", "-o", "json"]));
  const readmeSlugs = units
    .map((item) => item.Unit?.Slug)
    .filter((slug) => slug?.toLowerCase().includes("readme"));
  check(
    readmeSlugs.length === 1 && readmeSlugs[0] === "readme",
    `live Sveltos Space has README Units: ${readmeSlugs.join(", ") || "(none)"}`,
  );
}

function runHub(args) {
  return runCub(cubContext ? ["--context", cubContext, ...args] : args);
}

function canonicalHash(text) {
  return createHash("sha256").update(JSON.stringify(parseDocs(text))).digest("hex");
}
