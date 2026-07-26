#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  parseDocs,
  readYaml,
  repoRoot,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--receipt-verify";
const sourcePath = join(
  repoRoot,
  "config-catalog",
  "demonstrations",
  "nginx-fleet-registry-migration.yaml",
);
const receiptPath = join(
  repoRoot,
  "data",
  "fleet-promotion",
  "live-nginx-registry-migration.yaml",
);
const demo = readYaml(sourcePath);

function cub(args) {
  return execFileSync("cub", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 50,
  });
}

function cubJson(args) {
  return JSON.parse(cub([...args, "-o", "json"]));
}

function assertOrg() {
  const context = cub(["context", "get"]);
  if (!context.includes(demo.spec.organization)) {
    throw new Error(
      `expected ConfigHub organization '${demo.spec.organization}'; run cub auth switch ${demo.spec.organization}`,
    );
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function same(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function relevantImages(object) {
  const podSpec = object?.spec?.template?.spec ?? {};
  const containers = [
    ...(podSpec.initContainers ?? []),
    ...(podSpec.containers ?? []),
  ];
  return demo.spec.workload.containers
    .map((name) => {
      const container = containers.find((item) => item.name === name);
      return { name, image: container?.image ?? "" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function migrationRevisions(space) {
  return cubJson([
    "revision",
    "list",
    demo.spec.workload.unit,
    "--space",
    space,
  ])
    .map((row) => row.Revision)
    .filter((revision) => String(revision.Description ?? "").toLowerCase().includes("registry migration"))
    .map((revision) => ({
      revision: revision.RevisionNum,
      source: revision.Source,
      description: revision.Description,
      createdAt: revision.CreatedAt,
    }))
    .sort((a, b) => a.revision - b.revision);
}

function upstreamLink(space) {
  const row = cubJson(["link", "list", "--space", space]).find((item) => (
    item.FromUnit?.Slug === demo.spec.workload.unit
    && item.ToSpace?.Slug === demo.spec.base.space
  ));
  if (!row) return null;
  return {
    updateType: row.Link.UpdateType,
    upstreamSpace: row.ToSpace.Slug,
    upstreamUnit: row.ToUnit.Slug,
  };
}

function collectSpace(expected, isBase, findings) {
  const result = cubJson(["space", "get", expected.space]);
  const space = result.Space;
  const docs = parseDocs(cub([
    "unit",
    "data",
    demo.spec.workload.unit,
    "--space",
    expected.space,
  ]));
  const object = docs[0];
  const images = relevantImages(object);
  const expectedImage = isBase
    ? demo.spec.migration.currentImage
    : demo.spec.migration[expected.image === "current" ? "currentImage" : "previousImage"];
  const upgradableUnits = Number(result.UpgradableUnitCount ?? 0);
  const revisions = migrationRevisions(expected.space);
  const link = isBase ? null : upstreamLink(expected.space);

  if (!object) findings.push(`${expected.space} is missing ${demo.spec.workload.unit}`);
  for (const image of images) {
    if (!image.image) findings.push(`${expected.space} is missing container ${image.name}`);
    if (image.image !== expectedImage) {
      findings.push(`${expected.space}/${image.name} has unexpected image ${image.image || "(missing)"}`);
    }
    if (!image.image.endsWith(`@${demo.spec.workload.digest}`)) {
      findings.push(`${expected.space}/${image.name} does not keep the recorded digest`);
    }
  }
  if (Number(object?.spec?.replicas) !== expected.replicas) {
    findings.push(`${expected.space} has ${object?.spec?.replicas ?? "no"} replicas; expected ${expected.replicas}`);
  }
  if (result.TriggerFilter?.Slug !== expected.filter) {
    findings.push(`${expected.space} uses filter ${result.TriggerFilter?.Slug ?? "(none)"}; expected ${expected.filter}`);
  }
  if (space.Labels?.ApplyPolicyProfile !== "catalog-standard") {
    findings.push(`${expected.space} is missing ApplyPolicyProfile=catalog-standard`);
  }
  if (space.Labels?.Exhibit !== "fleet") {
    findings.push(`${expected.space} is not labeled as the fleet exhibit`);
  }
  if (!isBase) {
    if (space.Labels?.Environment !== expected.environment) {
      findings.push(`${expected.space} environment label drifted`);
    }
    if ((space.Labels?.Region ?? "") !== (expected.region ?? "")) {
      findings.push(`${expected.space} region label drifted`);
    }
    if (upgradableUnits !== expected.pendingUpstreamUnits) {
      findings.push(`${expected.space} has ${upgradableUnits} pending upstream Unit(s); expected ${expected.pendingUpstreamUnits}`);
    }
    if (!link || link.updateType !== "UpgradeUnit") {
      findings.push(`${expected.space} is missing its UpgradeUnit link to the base`);
    }
    const promotedRevision = revisions.some((revision) => revision.source === "UpgradeUnit");
    if (promotedRevision !== expected.promoted) {
      findings.push(`${expected.space} promotion history does not match promoted=${expected.promoted}`);
    }
  } else if (revisions.filter((revision) => revision.source === "Invoke").length !== 2) {
    findings.push(`${expected.space} should have two recorded image edits on the base`);
  }

  return {
    space: expected.space,
    environment: isBase ? "Base" : expected.environment,
    region: expected.region ?? "",
    filter: result.TriggerFilter?.Slug ?? "",
    replicas: Number(object?.spec?.replicas ?? 0),
    images,
    pendingUpstreamUnits: upgradableUnits,
    upstream: link,
    migrationRevisions: revisions,
  };
}

function collectLive() {
  const findings = [];
  const base = collectSpace(demo.spec.base, true, findings);
  const variants = demo.spec.variants.map((variant) => collectSpace(variant, false, findings));
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "FleetPromotionLiveReceipt",
    metadata: {
      name: demo.metadata.name,
    },
    spec: {
      organization: demo.spec.organization,
      source: demo.spec.source,
      verifiedAt: new Date().toISOString(),
      workload: {
        unit: demo.spec.workload.unit,
        digest: demo.spec.workload.digest,
      },
      base,
      variants,
    },
    status: {
      result: findings.length ? "fail" : "pass",
      findings,
      limits: demo.status.limits,
    },
  };
  return { findings, receipt };
}

function comparable(receipt) {
  return {
    apiVersion: receipt.apiVersion,
    kind: receipt.kind,
    metadata: receipt.metadata,
    organization: receipt.spec.organization,
    source: receipt.spec.source,
    workload: receipt.spec.workload,
    base: receipt.spec.base,
    variants: receipt.spec.variants,
    result: receipt.status.result,
    findings: receipt.status.findings,
    limits: receipt.status.limits,
  };
}

function verifyReceipt(receipt) {
  const failures = [];
  if (receipt?.kind !== "FleetPromotionLiveReceipt") failures.push("receipt kind is invalid");
  if (receipt?.metadata?.name !== demo.metadata.name) failures.push("receipt name drifted");
  if (receipt?.spec?.organization !== demo.spec.organization) failures.push("receipt organization drifted");
  if (!same(receipt?.spec?.source, demo.spec.source)) failures.push("receipt source record drifted");
  if (receipt?.status?.result !== "pass" || (receipt?.status?.findings ?? []).length) {
    failures.push("receipt did not pass");
  }
  if (!String(receipt?.spec?.verifiedAt ?? "").startsWith(demo.status.lastRecorded)) {
    failures.push("receipt date does not match the demonstration status");
  }

  const expectedSpaces = [demo.spec.base.space, ...demo.spec.variants.map((variant) => variant.space)].sort();
  const recordedSpaces = [
    receipt?.spec?.base?.space,
    ...(receipt?.spec?.variants ?? []).map((variant) => variant.space),
  ].sort();
  if (!same(recordedSpaces, expectedSpaces)) failures.push("receipt Space set drifted");
  if (receipt?.spec?.workload?.digest !== demo.spec.workload.digest) failures.push("receipt digest drifted");

  for (const expected of demo.spec.variants) {
    const recorded = receipt?.spec?.variants?.find((variant) => variant.space === expected.space);
    if (!recorded) continue;
    const expectedImage = demo.spec.migration[expected.image === "current" ? "currentImage" : "previousImage"];
    if (!recorded.images.every((image) => image.image === expectedImage)) {
      failures.push(`${expected.space} image result drifted`);
    }
    if (recorded.filter !== expected.filter) failures.push(`${expected.space} policy result drifted`);
    if (recorded.replicas !== expected.replicas) failures.push(`${expected.space} replica result drifted`);
    if (recorded.pendingUpstreamUnits !== expected.pendingUpstreamUnits) {
      failures.push(`${expected.space} pending promotion result drifted`);
    }
  }
  if (!demo.status.evidence.includes("data/fleet-promotion/live-nginx-registry-migration.yaml")) {
    failures.push("demonstration source does not link the receipt");
  }
  return failures;
}

function printResult(receipt) {
  console.log(`base: ${receipt.spec.base.space}`);
  for (const variant of receipt.spec.variants) {
    const host = variant.images[0]?.image.split("/")[0] ?? "(missing)";
    console.log(
      `${variant.space}: ${host}, replicas=${variant.replicas}, pending=${variant.pendingUpstreamUnits}, filter=${variant.filter}`,
    );
  }
}

if (mode === "--receipt-verify") {
  if (!existsSync(receiptPath)) throw new Error(`missing ${receiptPath}`);
  const receipt = readYaml(receiptPath);
  const failures = verifyReceipt(receipt);
  if (failures.length) throw new Error(failures.join("\n"));
  printResult(receipt);
  console.log("verified committed Nginx fleet-promotion receipt");
  process.exit(0);
}

if (mode === "--record") {
  assertOrg();
  const { findings, receipt } = collectLive();
  printResult(receipt);
  if (findings.length) throw new Error(findings.join("\n"));
  writeYaml(receiptPath, receipt);
  console.log("recorded live Nginx fleet-promotion result");
  process.exit(0);
}

if (mode === "--verify") {
  assertOrg();
  if (!existsSync(receiptPath)) throw new Error(`missing ${receiptPath}; run --record after a clean live check`);
  const committed = readYaml(receiptPath);
  const receiptFailures = verifyReceipt(committed);
  const { findings, receipt: live } = collectLive();
  printResult(live);
  if (!same(comparable(live), comparable(committed))) {
    findings.push("current live fleet result differs from the committed receipt");
  }
  if (receiptFailures.length || findings.length) {
    throw new Error([...receiptFailures, ...findings].join("\n"));
  }
  console.log("verified live Nginx fleet-promotion result against the committed receipt");
  process.exit(0);
}

console.error(
  "usage: node scripts/verify-helm-org-fleet-promotion.mjs [--record|--verify|--receipt-verify]",
);
process.exit(2);
