#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const variant = argument("--variant") ?? process.env.HELM_EXPT_EKSINF_VARIANT ?? "workshop-proof";
const receiptPath = join(repoRoot, "runs", "eks-inference-sandbox-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "eks-inference-sandbox-proof", "summary.md");
const components = [
  { name: "platform-profile", plane: "confighub", release: false },
  { name: "ack-controllers", plane: "management", release: true },
  { name: "aws-network", plane: "management", release: true },
  { name: "eks-cluster", plane: "management", release: true },
  { name: "karpenter-aws", plane: "management", release: true },
  { name: "karpenter", plane: "workload", release: true },
  { name: "gpu-runtime", plane: "workload", release: true },
  { name: "inference-workloads", plane: "workload", release: true },
];
const targetSpecs = [
  {
    plane: "management",
    space: `${variant}-mgmt`,
    appsSpace: `${variant}-mgmt-argo-apps`,
    apps: [
      `ack-controllers-${variant}`,
      `aws-network-${variant}`,
      `eks-cluster-${variant}`,
      `karpenter-aws-${variant}`,
    ],
  },
  {
    plane: "workload",
    space: `${variant}-workload`,
    appsSpace: `${variant}-workload-argo-apps`,
    apps: [
      `gpu-runtime-${variant}`,
      `inference-workloads-${variant}`,
      `karpenter-${variant}`,
    ],
  },
];

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run the generator`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run eks-inference-sandbox:generate`,
  );
  console.log("verified EKS inference ConfigHub sandbox proof");
} else {
  console.error(`Usage: node ${relativeRepo(import.meta.filename)} --run|--generate|--verify [--variant <name>]`);
  process.exitCode = 2;
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(context, "set CUB_CONTEXT to an authenticated ConfigHub context");
  check(commandWorks("cub", ["version"]), "cub is required for the EKS inference sandbox proof");

  const contextInfo = cubJson(context, ["context", "get", context, "-o", "json"]);
  check(
    contextInfo.metadata?.organizationName === "helm-catalog",
    `expected the helm-catalog organization, found ${contextInfo.metadata?.organizationName ?? "unknown"}`,
  );
  const versions = parseVersions(cubText(context, ["version"]));
  const plugin = parsePluginVersion(cubText(context, ["eksinf", "version"]));
  const records = [];

  for (const component of components) {
    const expectedSource = expectedBundle(component.name);
    const baseSlug = `${component.name}-base`;
    const variantSlug = `${component.name}-${variant}`;
    const baseSpace = cubJson(context, ["space", "get", baseSlug, "-o", "json"]).Space;
    const variantSpace = cubJson(context, ["space", "get", variantSlug, "-o", "json"]).Space;
    const baseSource = externalSource(baseSpace);
    const variantSource = externalSource(variantSpace);
    const baseUnits = units(context, baseSlug);
    const variantUnits = units(context, variantSlug);
    const baseUnitIds = new Set(baseUnits.map((unit) => unit.UnitID));
    const links = linkRows(context, variantSlug);
    const upgradeLinks = links.filter((link) => link.UpdateType === "UpgradeUnit");
    const profileLinks = links.filter((link) => link.UpdateType === "TransformPaths");
    const placeholderHits = variantUnits.reduce(
      (count, unit) => count + occurrences(cubText(context, ["unit", "data", unit.Slug, "--space", variantSlug]), "confighubplaceholder"),
      0,
    );
    const latestRelease = component.release ? release(context, variantSlug) : null;

    check(baseSource.digest === expectedSource.digest, `${baseSlug} has the wrong source digest`);
    check(variantSource.digest === expectedSource.digest, `${variantSlug} has the wrong source digest`);
    check(baseSource.ref === expectedSource.ref, `${baseSlug} has the wrong source reference`);
    check(variantSource.ref === expectedSource.ref, `${variantSlug} has the wrong source reference`);
    check(
      variantSpace.Annotations?.UpstreamSpaceID === baseSpace.SpaceID,
      `${variantSlug} does not point at ${baseSlug}`,
    );
    check(baseUnits.length > 0, `${baseSlug} has no Units`);
    check(baseUnits.length === variantUnits.length, `${variantSlug} does not contain the base Unit set`);
    check(
      variantUnits.every((unit) => baseUnitIds.has(unit.UpstreamUnitID)),
      `${variantSlug} contains a Unit that is not derived from ${baseSlug}`,
    );
    check(upgradeLinks.length === baseUnits.length, `${variantSlug} does not have one upgrade link per Unit`);
    check(
      upgradeLinks.every(
        (link) => link.DownstreamLastMergedRevisionNum === link.UpstreamLastMergedRevisionNum,
      ),
      `${variantSlug} has an outstanding base update`,
    );
    check(placeholderHits === 0, `${variantSlug} still contains confighubplaceholder`);
    if (component.release) {
      check(latestRelease.Published === true, `${variantSlug} has no published Release`);
      check(latestRelease.UnitCount === variantUnits.length, `${variantSlug} Release has the wrong Unit count`);
    } else {
      check(!variantSpace.ReleaseTargetID, `${variantSlug} should not have a delivery target`);
    }

    records.push({
      component: component.name,
      plane: component.plane,
      source: expectedSource,
      base: {
        space: baseSlug,
        spaceId: baseSpace.SpaceID,
        unitCount: baseUnits.length,
        unitHashes: unitHashes(baseUnits),
      },
      variant: {
        space: variantSlug,
        spaceId: variantSpace.SpaceID,
        upstreamSpaceId: variantSpace.Annotations.UpstreamSpaceID,
        unitCount: variantUnits.length,
        unitHashes: unitHashes(variantUnits),
        upgradeLinkCount: upgradeLinks.length,
        upgradeLinksCurrent: true,
        profileLinkCount: profileLinks.length,
        profilePathCount: profileLinks.reduce(
          (count, link) => count + (link.DownstreamPaths?.length ?? 0) + (link.DownstreamSetters?.length ?? 0),
          0,
        ),
        placeholderHits,
      },
      release: latestRelease
        ? {
            number: latestRelease.ReleaseNum,
            digest: latestRelease.Digest,
            manifestDigest: latestRelease.ManifestDigest,
            unitCount: latestRelease.UnitCount,
            published: latestRelease.Published,
            createdAt: latestRelease.CreatedAt,
          }
        : null,
    });
  }

  const targets = targetSpecs.map((spec) => inspectTarget(context, spec));
  const releaseCount = records.filter((record) => record.release?.published).length;
  const profileLinkCount = records.reduce((count, record) => count + record.variant.profileLinkCount, 0);
  const profilePathCount = records.reduce((count, record) => count + record.variant.profilePathCount, 0);
  check(releaseCount === 7, `expected seven published Releases, found ${releaseCount}`);
  check(profileLinkCount === 8, `expected eight profile links, found ${profileLinkCount}`);
  check(profilePathCount === 27, `expected 27 linked paths, found ${profilePathCount}`);

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "EksInferenceSandboxProofReceipt",
    metadata: {
      name: `eks-inference-${variant}`,
    },
    spec: {
      recordedAt: new Date().toISOString(),
      context: {
        name: context,
        organization: contextInfo.metadata.organizationName,
      },
      tools: {
        cubClient: versions.client,
        confighubServer: versions.server,
        eksInferencePlugin: plugin.version,
        eksInferenceCommit: plugin.commit,
      },
      sandbox: {
        name: variant,
        components: records,
        targets,
        totals: {
          baseSpaces: records.length,
          derivedSpaces: records.length,
          publishedReleases: releaseCount,
          profileLinks: profileLinkCount,
          linkedPaths: profilePathCount,
          targetSpaces: targets.length,
          argoApplicationRecords: targets.reduce((count, target) => count + target.argoApplications.length, 0),
          unresolvedPlaceholders: records.reduce((count, record) => count + record.variant.placeholderHits, 0),
        },
      },
      dataBoundary: {
        recorded: [
          "public Space and Unit identifiers",
          "public OCI references and digests",
          "Unit data hashes and revision numbers",
          "link counts and merged revision numbers",
          "target type, gate definition, and Release digests",
        ],
        excluded: [
          "authentication tokens",
          "worker credentials",
          "Unit contents",
          "cloud credentials",
        ],
      },
      limits: [
        "This run created and inspected configuration records in ConfigHub; it did not create an AWS account, VPC, EKS cluster, Kubernetes workload, GPU node, or model endpoint.",
        "The OCI targets published Releases for later consumption. No Argo CD or Flux controller pulled them in this proof.",
        "The no-placeholders gate was attached and its configuration was inspected. This receipt does not claim a rejected mutation was exercised.",
      ],
    },
    status: {
      result: "pass",
      sourceDigests: "pass",
      derivedVariants: "pass",
      profileLinks: "pass",
      placeholderResolution: "pass",
      releasePublication: "pass",
      sandboxTargets: "pass",
      claim: "ConfigHub retained eight exact EKS inference bundle sources, created eight linked sandbox variants, resolved all recorded placeholders, and published seven OCI Releases without creating cloud or Kubernetes infrastructure.",
    },
  };

  verifyReceipt(receipt);
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function inspectTarget(context, spec) {
  const space = cubJson(context, ["space", "get", spec.space, "-o", "json"]).Space;
  const targetRows = cubJson(context, ["target", "list", "--space", spec.space, "-o", "json"]);
  const triggerRows = cubJson(context, ["trigger", "list", "--space", spec.space, "-o", "json"]);
  const target = targetRows[0]?.Target;
  const triggers = triggerRows.map((row) => row.Trigger);
  const apps = units(context, spec.appsSpace).map((unit) => unit.Slug).sort();
  check(space.Labels?.Mode === "sandbox", `${spec.space} is not labeled as a sandbox`);
  check(targetRows.length === 1, `${spec.space} must have one target`);
  check(target.ProviderType === "OCI", `${spec.space} target is not OCI`);
  check(target.ToolchainType === "Any", `${spec.space} target is not toolchain-neutral`);
  check(triggers.length === 1, `${spec.space} must have one sandbox gate`);
  check(triggers[0].FunctionName === "vet-placeholders", `${spec.space} has the wrong gate`);
  check(triggers[0].Validating === true, `${spec.space} placeholder gate is not blocking`);
  check(JSON.stringify(apps) === JSON.stringify([...spec.apps].sort()), `${spec.appsSpace} has the wrong app set`);
  return {
    plane: spec.plane,
    space: spec.space,
    spaceId: space.SpaceID,
    mode: space.Labels.Mode,
    target: {
      slug: target.Slug,
      providerType: target.ProviderType,
      toolchainType: target.ToolchainType,
      triggerCount: target.TriggerIDs?.length ?? 0,
    },
    gate: {
      slug: triggers[0].Slug,
      function: triggers[0].FunctionName,
      event: triggers[0].Event,
      validating: triggers[0].Validating,
      description: triggers[0].Description,
    },
    argoAppsSpace: spec.appsSpace,
    argoApplications: apps,
  };
}

function expectedBundle(component) {
  const path = join(
    repoRoot,
    "data",
    "certified-bundles",
    "receipts",
    "eks-inference",
    component,
    "receipt.yaml",
  );
  const receipt = readYaml(path);
  return {
    ref: `oci://${receipt.spec.bundle.reference.replace(/^oci:\/\//, "").replace(/:latest$/, "")}`,
    digest: receipt.spec.bundle.manifestDigest,
    receipt: relativeRepo(path),
  };
}

function units(context, space) {
  return cubJson(context, ["unit", "list", "--space", space, "-o", "json"])
    .map((row) => row.Unit)
    .sort((left, right) => left.Slug.localeCompare(right.Slug));
}

function unitHashes(rows) {
  return rows.map((unit) => ({
    slug: unit.Slug,
    dataHash: unit.DataHash,
    headRevision: unit.HeadRevisionNum,
    upstreamUnitId: unit.UpstreamUnitID ?? null,
    upstreamRevision: unit.UpstreamRevisionNum ?? null,
  }));
}

function linkRows(context, space) {
  return cubJson(context, ["link", "list", "--space", space, "-o", "json"]).map((row) => row.Link);
}

function release(context, space) {
  const rows = cubJson(context, ["release", "list", "--space", space, "-o", "json"])
    .map((row) => row.Release)
    .sort((left, right) => right.ReleaseNum - left.ReleaseNum);
  check(rows.length > 0, `${space} has no Release`);
  return rows[0];
}

function externalSource(space) {
  const raw = space.Annotations?.["confighub.com/external-source"];
  check(raw, `${space.Slug} has no confighub.com/external-source annotation`);
  const values = JSON.parse(raw);
  check(values.length === 1, `${space.Slug} must have one external source`);
  return values[0];
}

function verifyReceipt(receipt) {
  check(receipt.apiVersion === "catalog.confighub.com/v1alpha1", "unexpected receipt apiVersion");
  check(receipt.kind === "EksInferenceSandboxProofReceipt", "unexpected receipt kind");
  check(receipt.status?.result === "pass", "sandbox proof did not pass");
  check(receipt.spec?.context?.organization === "helm-catalog", "proof did not use helm-catalog");
  const records = receipt.spec?.sandbox?.components ?? [];
  check(records.length === components.length, "receipt must contain all eight components");
  for (const expected of components) {
    const record = records.find((candidate) => candidate.component === expected.name);
    check(record, `receipt is missing ${expected.name}`);
    const source = expectedBundle(expected.name);
    check(record.source.ref === source.ref, `${expected.name} source reference is stale`);
    check(record.source.digest === source.digest, `${expected.name} source digest is stale`);
    check(record.source.receipt === source.receipt, `${expected.name} receipt link is stale`);
    check(record.base.unitCount > 0, `${expected.name} base has no Units`);
    check(record.base.unitCount === record.variant.unitCount, `${expected.name} Unit counts differ`);
    check(record.variant.upstreamSpaceId === record.base.spaceId, `${expected.name} base link is wrong`);
    check(record.variant.upgradeLinkCount === record.base.unitCount, `${expected.name} upgrade links differ`);
    check(record.variant.upgradeLinksCurrent === true, `${expected.name} has an outstanding base update`);
    check(record.variant.placeholderHits === 0, `${expected.name} has an unresolved placeholder`);
    if (expected.release) {
      check(record.release?.published === true, `${expected.name} Release is missing`);
      check(record.release.unitCount === record.variant.unitCount, `${expected.name} Release Unit count differs`);
    } else {
      check(record.release === null, `${expected.name} should not publish a Release`);
    }
  }
  const totals = receipt.spec.sandbox.totals;
  check(totals.baseSpaces === 8, "expected eight base Spaces");
  check(totals.derivedSpaces === 8, "expected eight derived Spaces");
  check(totals.publishedReleases === 7, "expected seven published Releases");
  check(totals.profileLinks === 8, "expected eight profile links");
  check(totals.linkedPaths === 27, "expected 27 linked paths");
  check(totals.targetSpaces === 2, "expected two sandbox target Spaces");
  check(totals.argoApplicationRecords === 7, "expected seven Argo Application records");
  check(totals.unresolvedPlaceholders === 0, "sandbox retains unresolved placeholders");
  const targets = receipt.spec.sandbox.targets ?? [];
  check(targets.length === 2, "receipt must contain two targets");
  for (const target of targets) {
    check(target.mode === "sandbox", `${target.space} is not a sandbox`);
    check(target.target.providerType === "OCI", `${target.space} is not an OCI target`);
    check(target.target.toolchainType === "Any", `${target.space} is not toolchain-neutral`);
    check(target.gate.function === "vet-placeholders", `${target.space} has the wrong gate`);
    check(target.gate.validating === true, `${target.space} gate is not blocking`);
  }
  const serialized = JSON.stringify(receipt);
  check(!/ch_[a-z0-9]{20,}/i.test(serialized), "receipt contains a token or worker credential");
  check(receipt.spec.limits.length >= 3, "receipt must state its proof limits");
}

function renderSummary(receipt) {
  const sandbox = receipt.spec.sandbox;
  const lines = [];
  lines.push("# EKS inference ConfigHub sandbox proof");
  lines.push("");
  lines.push("This receipt checks the configuration-only path for the eight-component EKS inference example.");
  lines.push("");
  lines.push(
    `On ${receipt.spec.recordedAt}, the live ConfigHub organization held all eight public OCI bundle sources at their recorded digests, a linked \`${sandbox.name}\` variant for each component, 27 configured destination fields filled from the shared profile, and seven published OCI Releases.`,
  );
  lines.push("");
  lines.push("## What was checked");
  lines.push("");
  lines.push("| Component | Plane | Units | Profile links | Linked paths | Release | Exact source |");
  lines.push("| --- | --- | ---: | ---: | ---: | --- | --- |");
  for (const record of sandbox.components) {
    lines.push(
      `| ${record.component} | ${record.plane} | ${record.variant.unitCount} | ${record.variant.profileLinkCount} | ${record.variant.profilePathCount} | ${record.release ? `#${record.release.number} \`${record.release.digest}\`` : "not deployable"} | [receipt](../certified-bundles/${record.source.receipt.replace("data/certified-bundles/", "")}) |`,
    );
  }
  lines.push("");
  lines.push(
    `The management and workload targets are OCI targets. Each has a blocking \`vet-placeholders\` check, and the two Argo CD record Spaces name the ${sandbox.totals.argoApplicationRecords} component Releases a controller would consume.`,
  );
  lines.push("");
  lines.push("## What this does not prove");
  lines.push("");
  for (const limit of receipt.spec.limits) lines.push(`- ${limit}`);
  lines.push("");
  lines.push(
    "The next proof must take one of these exact Releases through a real Argo CD or Flux controller. AWS provisioning, GPU readiness, and a model response remain separate later results.",
  );
  lines.push("");
  lines.push(
    `Source receipt: [${relativeRepo(receiptPath)}](https://github.com/confighub/helm-expt/blob/main/${relativeRepo(receiptPath)})`,
  );
  lines.push("");
  return lines.join("\n");
}

function cubJson(context, args) {
  return JSON.parse(cubText(context, args));
}

function cubText(context, args) {
  return execFileSync("cub", args, {
    cwd: repoRoot,
    env: { ...process.env, CUB_CONTEXT: context, CONFIGHUB_AGENT: "1" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 200,
  });
}

function commandWorks(command, args) {
  try {
    execFileSync(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function parseVersions(output) {
  const client = output.match(/Client Version:\s*\n\s*Version:\s*(v[^\s]+)/)?.[1] ?? "unknown";
  const server = output.match(/Server Version:[\s\S]*?Version:\s*(v[^\s]+)/)?.[1] ?? "unknown";
  return { client, server };
}

function parsePluginVersion(output) {
  return {
    version: output.match(/^eksinf\s+(\S+)/m)?.[1] ?? "unknown",
    commit: output.match(/^\s*commit:\s*(\S+)/m)?.[1] ?? "unknown",
  };
}

function occurrences(text, value) {
  return text.toLowerCase().split(value.toLowerCase()).length - 1;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
