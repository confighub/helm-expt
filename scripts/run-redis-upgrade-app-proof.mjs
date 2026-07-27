#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  cubEnv,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set(["--run", "--generate", "--verify"]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/run-redis-upgrade-app-proof.mjs --run
  node scripts/run-redis-upgrade-app-proof.mjs --generate
  node scripts/run-redis-upgrade-app-proof.mjs --verify`);
  process.exit(2);
}

const oldVersion = "25.5.3";
const oldAppVersion = "8.6.3";
const candidateVersion = "27.0.0";
const candidateAppVersion = "8.8.0";
const baseName = "reuse-existing-secret";
const namespace = "redis";
const oldPackage = `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:${oldVersion}`;
const candidatePackage = `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:${candidateVersion}`;
const expectedImage = "registry-1.docker.io/bitnami/redis@sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const deployableLayerType = "application/vnd.oci.image.layer.v1.tar+gzip";
const receiptPath = join(repoRoot, "runs", "redis-upgrade-app-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "redis-upgrade-app-proof", "summary.md");
const observationRoot = join(repoRoot, "runs", "redis-upgrade-app-proof", "observations");
const observationDesiredPath = join(observationRoot, "staging-desired.yaml");
const rollbackObservationDesiredPath = join(observationRoot, "staging-rollback-desired.yaml");

if (mode === "--run") {
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  if (receipt.status.result === "pass") {
    validateReceipt(receipt);
    console.log(`wrote Redis Upgrade App proof -> ${relativeRepo(receiptPath)} result=pass`);
    process.exit(0);
  }
  console.error(`Redis Upgrade App proof blocked: ${receipt.status.error ?? "unknown error"}`);
  process.exit(1);
}

check(
  existsSync(receiptPath),
  `${relativeRepo(receiptPath)} is missing; run npm run redis-upgrade-app:run`,
);
const receipt = readYaml(receiptPath);
validateReceipt(receipt);
const summary = renderSummary(receipt);

if (mode === "--generate") {
  write(summaryPath, summary);
  console.log(`wrote Redis Upgrade App summary -> ${relativeRepo(summaryPath)}`);
} else {
  check(
    existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summary,
    `${relativeRepo(summaryPath)} is stale; run npm run redis-upgrade-app:generate`,
  );
  console.log("verified Redis Upgrade App proof");
}

function runProof() {
  assertScratchContext();
  for (const [tool, args] of [
    ["cub", ["version"]],
    ["docker", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["oras", ["version"]],
    ["cub-scout", ["version"]],
  ]) {
    check(tryCommand(tool, args).ok, `${tool} is required for the Redis Upgrade App proof`);
  }

  const observedAt = new Date().toISOString();
  const suffix = `${observedAt.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const runName = `hx-redis-upgrade-${suffix}`;
  const baseSpace = `${runName}-base`;
  const developmentSpace = `${runName}-dev`;
  const stagingSpace = `${runName}-staging`;
  const clusterA = `${runName}-a`;
  const clusterB = `${runName}-b`;
  const registryName = `${runName}-registry`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-redis-upgrade-"));
  const installerWork = join(workRoot, "installer");
  const createdSpaces = [];
  const clustersUp = [];
  let registryUp = false;
  let failure = "";

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "RedisUpgradeAppReceipt",
    metadata: {
      name: "bitnami-redis-reuse-existing-secret-25-5-3-to-27-0-0",
    },
    spec: {
      observedAt,
      source: {
        chart: "bitnami/redis",
        base: baseName,
        namespace,
        current: {
          version: oldVersion,
          appVersion: oldAppVersion,
          package: oldPackage,
          digest: "",
        },
        candidate: {
          version: candidateVersion,
          appVersion: candidateAppVersion,
          package: candidatePackage,
          digest: "",
        },
      },
      prerequisite: {
        kind: "Secret",
        namespace,
        name: "redis-existing-secret",
        key: "redis-password",
        packageContainsCredential: false,
        handling: "created out of band on each throwaway target; credential bytes are not written to this repository or receipt",
        result: "not-run",
      },
      configHub: {
        import: { result: "not-run" },
        userChange: {
          resource: "StatefulSet/redis-replicas",
          field: "spec.replicas",
          chartDefault: 3,
          recordedValue: 2,
          result: "not-run",
        },
        chain: {
          path: "base -> development -> staging",
          result: "not-run",
        },
        candidatePlan: { result: "not-run" },
        reconcile: { result: "not-run" },
        impact: { result: "not-run" },
        promotions: {
          development: { result: "not-run" },
          staging: { result: "not-run" },
        },
        rollback: { result: "not-run" },
      },
      delivery: {
        configHubRelease: { result: "not-run" },
        portableOci: { result: "not-run" },
        fleet: {
          size: 2,
          result: "not-run",
          targets: [],
        },
        rollbackRelease: { result: "not-run" },
        rollbackOci: { result: "not-run" },
        rollbackFleet: {
          size: 2,
          result: "not-run",
          targets: [],
        },
      },
      run: {
        clusterCommand: "cub cluster up",
        organizationPurpose: "ephemeral scratch organization",
        targetShape: "two throwaway cub-managed kind clusters with Argo CD",
        cleanup: {
          baseSpace: "pending",
          developmentSpace: "pending",
          stagingSpace: "pending",
          clusterA: "pending",
          clusterB: "pending",
          sourceRegistry: "pending",
          localFiles: "pending",
        },
      },
      limits: [
        "The required Redis Secret was created separately on each throwaway cluster. The workload OCI does not contain the password.",
        "cub variant promote --dry-run -o mutations returned no text in this run. The proof checked that the dry run changed no stored data, but it does not claim that the current CLI shows a useful mutation preview.",
        "The portable output OCI used a temporary local registry. Public registry publication is a separate receipt.",
        "The OCI keeps the reviewed ConfigHub objects. The cub-scout input removes only explicit null fields that the Kubernetes API omits before comparison.",
        "The rollback restored the desired Kubernetes objects and checked workload health. It did not restore database data or exercise an irreversible migration.",
        "This proves one Redis base, one post-render field change, two environment promotions, one manifest rollback, and two throwaway clusters. It does not prove every chart upgrade, rollback, or production scale.",
        "The cub-scout observations were recorded locally and were not submitted to ConfigHub observation storage.",
      ],
    },
    status: {
      result: "blocked",
      claim: "",
    },
  };

  try {
    receipt.spec.source.current.digest = resolvePublicPackage(oldPackage);
    receipt.spec.source.candidate.digest = resolvePublicPackage(candidatePackage);

    cub([
      "installer",
      "setup",
      "--pull",
      oldPackage,
      "--base",
      baseName,
      "--namespace",
      namespace,
      "--work-dir",
      installerWork,
      "--non-interactive",
    ], { timeout: 420_000 });
    check(
      countYamlFiles(join(installerWork, "out", "manifests")) === 14,
      "the current package did not render 14 manifest files",
    );

    cub([
      "installer",
      "upload",
      "--work-dir",
      installerWork,
      "--space",
      baseSpace,
      "--component",
      "redis-upgrade",
      "--variant",
      "base",
      "--layer",
      "Platform",
      "--owner",
      "Platform",
    ], { timeout: 600_000 });
    createdSpaces.push(baseSpace);
    const imported = inspectRedisSpace(baseSpace);
    check(imported.objectCount === 14, "the current package did not create 14 Kubernetes object Units");
    check(imported.chartVersion === oldVersion, "the imported base has the wrong chart version");
    check(imported.appVersion === oldAppVersion, "the imported base has the wrong Redis version");
    check(imported.replicas === 3, "the imported base did not begin with the chart's three replicas");
    receipt.spec.configHub.import = {
      result: "pass",
      space: baseSpace,
      objectCount: imported.objectCount,
      unitCount: imported.unitCount,
      chartVersion: imported.chartVersion,
      appVersion: imported.appVersion,
      replicas: imported.replicas,
    };

    cub([
      "run",
      "set-replicas",
      "--space",
      baseSpace,
      "--unit",
      imported.replicaUnit,
      "--replicas",
      "2",
      "--change-desc",
      "Keep two Redis replicas through chart upgrades",
      "--wait",
    ], { timeout: 300_000 });
    const changed = inspectRedisSpace(baseSpace);
    check(changed.replicas === 2, "the recorded replica change did not persist");
    receipt.spec.configHub.userChange.result = "pass";

    clusterUp(clusterA);
    clustersUp.push(clusterA);
    const firstTarget = `${clusterA}-cluster/oci`;

    cub([
      "variant",
      "create",
      "development",
      baseSpace,
      "--space-pattern",
      `template:${developmentSpace}`,
      "--environment",
      "Development",
      "--target",
      firstTarget,
      "--wait",
    ], { timeout: 480_000 });
    createdSpaces.push(developmentSpace);
    cub([
      "variant",
      "create",
      "staging",
      developmentSpace,
      "--space-pattern",
      `template:${stagingSpace}`,
      "--environment",
      "Staging",
      "--target",
      firstTarget,
      "--wait",
    ], { timeout: 480_000 });
    createdSpaces.push(stagingSpace);
    const developmentBefore = inspectRedisSpace(developmentSpace);
    const stagingBefore = inspectRedisSpace(stagingSpace);
    check(
      developmentBefore.chartVersion === oldVersion
        && stagingBefore.chartVersion === oldVersion
        && developmentBefore.replicas === 2
        && stagingBefore.replicas === 2,
      "the environment variants did not clone the recorded current configuration",
    );
    const stagingRollbackBaseline = snapshotSpaceUnits(stagingSpace);
    receipt.spec.configHub.chain = {
      path: "base -> development -> staging",
      result: "pass",
      base: variantLink(baseSpace),
      development: variantLink(developmentSpace),
      staging: variantLink(stagingSpace),
    };

    cub([
      "installer",
      "setup",
      "--pull",
      candidatePackage,
      "--base",
      baseName,
      "--namespace",
      namespace,
      "--work-dir",
      installerWork,
      "--non-interactive",
    ], { timeout: 420_000 });
    check(
      countYamlFiles(join(installerWork, "out", "manifests")) === 14,
      "the candidate package did not render 14 manifest files",
    );
    const candidatePlan = cub([
      "installer",
      "plan",
      "--work-dir",
      installerWork,
    ], { timeout: 420_000 });
    const planCounts = parsePlanCounts(candidatePlan);
    check(
      planCounts.add === 0 && planCounts.change === 13 && planCounts.delete === 0,
      `unexpected candidate plan: ${planCounts.add} add, ${planCounts.change} change, ${planCounts.delete} delete`,
    );
    check(
      !candidatePlan.includes("spec.replicas"),
      "the candidate plan tried to replace the recorded replica count",
    );
    check(
      candidatePlan.includes(`redis-${oldVersion}`)
        && candidatePlan.includes(`redis-${candidateVersion}`),
      "the candidate plan did not show the chart-version change",
    );
    receipt.spec.configHub.candidatePlan = {
      result: "pass",
      add: planCounts.add,
      change: planCounts.change,
      delete: planCounts.delete,
      recordedStateProtected: true,
      chartVersionChangeShown: true,
      replicaResetProposed: false,
      outputSha256: sha256(candidatePlan),
    };

    cub([
      "installer",
      "upload",
      "--work-dir",
      installerWork,
      "--yes",
    ], { timeout: 600_000 });
    const reconciled = inspectRedisSpace(baseSpace);
    check(
      reconciled.chartVersion === candidateVersion
        && reconciled.appVersion === candidateAppVersion
        && reconciled.replicas === 2,
      "the candidate reconcile did not keep the recorded replica change",
    );
    receipt.spec.configHub.reconcile = {
      result: "pass",
      chartVersionBefore: oldVersion,
      chartVersionAfter: reconciled.chartVersion,
      appVersionBefore: oldAppVersion,
      appVersionAfter: reconciled.appVersion,
      recordedReplicasBefore: 2,
      recordedReplicasAfter: reconciled.replicas,
      objectCount: reconciled.objectCount,
      image: reconciled.image,
    };

    const developmentImpact = waitForRedisSpace(
      developmentSpace,
      (state) => state.upgradableUnitCount > 0,
      "development did not report its pending upstream upgrade",
    );
    const stagingImpact = inspectRedisSpace(stagingSpace);
    check(
      developmentImpact.chartVersion === oldVersion
        && stagingImpact.chartVersion === oldVersion
        && developmentImpact.upgradableUnitCount > 0
        && stagingImpact.upgradableUnitCount === 0,
      "the downstream upgrade impact was not visible before promotion",
    );
    receipt.spec.configHub.impact = {
      result: "pass",
      affectedSpaces: 2,
      explanation: "Development is directly behind the base. Staging is behind development, so it becomes pending after the development wave completes.",
      spaces: [
        {
          space: developmentSpace,
          currentChartVersion: developmentImpact.chartVersion,
          pendingUnits: developmentImpact.upgradableUnitCount,
          wave: 1,
        },
        {
          space: stagingSpace,
          currentChartVersion: stagingImpact.chartVersion,
          pendingUnits: stagingImpact.upgradableUnitCount,
          wave: 2,
        },
      ],
    };

    receipt.spec.configHub.promotions.development = promoteRedisVariant({
      space: developmentSpace,
      downstreamSpace: stagingSpace,
      description: "Promote Redis 27.0.0 to development",
    });
    receipt.spec.configHub.impact.spaces[1].pendingUnitsAfterDevelopment =
      receipt.spec.configHub.promotions.development.downstreamPendingUnitsAfter;
    receipt.spec.configHub.promotions.staging = promoteRedisVariant({
      space: stagingSpace,
      description: "Promote Redis 27.0.0 to staging",
    });

    const staged = inspectRedisSpace(stagingSpace);
    check(
      staged.chartVersion === candidateVersion
        && staged.appVersion === candidateAppVersion
        && staged.replicas === 2
        && staged.upgradableUnitCount === 0,
      "staging did not reach the reviewed candidate configuration",
    );

    receipt.spec.delivery.configHubRelease = {
      result: "pass",
      ...publishRelease(stagingSpace),
    };

    const registry = startRegistry(registryName);
    registryUp = true;
    const portable = publishSpaceOci({
      workRoot,
      space: stagingSpace,
      registryHost: registry.host,
      clusterRegistryHost: registry.clusterHost,
      outputName: "candidate",
      tag: "candidate",
    });
    mkdirSync(observationRoot, { recursive: true });
    writeFileSync(observationDesiredPath, portable.observationYaml);
    receipt.spec.delivery.portableOci = {
      result: "pass",
      reference: portable.reference,
      digest: portable.digest,
      objectCount: portable.objectCount,
      yamlSha256: portable.yamlSha256,
      pulledYamlSha256: portable.pulledYamlSha256,
      observationYamlSha256: sha256(portable.observationYaml),
      observationNormalization: "remove explicit null fields that the Kubernetes API omits",
      objectsMatched: true,
    };

    const targets = [];
    for (const [clusterName, slot] of [
      [clusterA, "target-a"],
      [clusterB, "target-b"],
    ]) {
      if (!clusterPresent(clusterName)) {
        clusterUp(clusterName);
        clustersUp.push(clusterName);
      }
      stageRedisSecret(clusterName);
      const application = addApplication({
        clusterName,
        appName: "redis-staging",
        unitName: "redis-staging-app",
        sourceReference: portable.clusterReference,
        targetRevision: portable.tag,
        namespace,
        workRoot,
      });
      const runtime = waitForRedisApplication({
        clusterName,
        appName: "redis-staging",
        expectedDigest: portable.digest,
        expectedChartVersion: candidateVersion,
        expectedAppVersion: candidateAppVersion,
        expectedReplicas: 2,
      });
      check(runtime.result === "pass", `${clusterName} Redis rollout did not pass: ${runtime.reason}`);
      const observations = collectScoutObservations({
        clusterName,
        slot,
        desiredPath: observationDesiredPath,
      });
      targets.push({
        cluster: clusterName,
        application,
        runtime,
        observations,
      });
    }
    check(
      targets.every((target) => target.runtime.revision === portable.digest),
      "the Argo applications did not report the reviewed OCI digest",
    );
    receipt.spec.prerequisite.result = "pass";
    receipt.spec.delivery.fleet = {
      size: 2,
      result: "pass",
      sameReleaseDigest: true,
      digest: portable.digest,
      targets,
    };

    receipt.spec.configHub.rollback = restoreSpaceRevisions({
      space: stagingSpace,
      baseline: stagingRollbackBaseline,
      changeSet: "rollback-to-25-5-3",
    });
    const rolledBack = inspectRedisSpace(stagingSpace);
    check(
      rolledBack.chartVersion === oldVersion
        && rolledBack.appVersion === oldAppVersion
        && rolledBack.replicas === 2,
      "staging did not return to the pre-upgrade Redis configuration",
    );

    receipt.spec.delivery.rollbackRelease = {
      result: "pass",
      ...publishRelease(stagingSpace),
    };
    const rollbackPortable = publishSpaceOci({
      workRoot,
      space: stagingSpace,
      registryHost: registry.host,
      clusterRegistryHost: registry.clusterHost,
      outputName: "rollback",
      tag: "rollback",
    });
    writeFileSync(rollbackObservationDesiredPath, rollbackPortable.observationYaml);
    receipt.spec.delivery.rollbackOci = {
      result: "pass",
      reference: rollbackPortable.reference,
      digest: rollbackPortable.digest,
      objectCount: rollbackPortable.objectCount,
      yamlSha256: rollbackPortable.yamlSha256,
      pulledYamlSha256: rollbackPortable.pulledYamlSha256,
      observationYamlSha256: sha256(rollbackPortable.observationYaml),
      observationNormalization: "remove explicit null fields that the Kubernetes API omits",
      objectsMatched: true,
    };

    const rollbackTargets = [];
    for (const [clusterName, slot] of [
      [clusterA, "target-a-rollback"],
      [clusterB, "target-b-rollback"],
    ]) {
      const application = updateApplication({
        clusterName,
        appName: "redis-staging",
        unitName: "redis-staging-app",
        sourceReference: rollbackPortable.clusterReference,
        targetRevision: rollbackPortable.tag,
        namespace,
        workRoot,
      });
      const runtime = waitForRedisApplication({
        clusterName,
        appName: "redis-staging",
        expectedDigest: rollbackPortable.digest,
        expectedChartVersion: oldVersion,
        expectedAppVersion: oldAppVersion,
        expectedReplicas: 2,
      });
      check(runtime.result === "pass", `${clusterName} Redis rollback did not pass: ${runtime.reason}`);
      const observations = collectScoutObservations({
        clusterName,
        slot,
        desiredPath: rollbackObservationDesiredPath,
      });
      rollbackTargets.push({
        cluster: clusterName,
        application,
        runtime,
        observations,
      });
    }
    check(
      rollbackTargets.every((target) => target.runtime.revision === rollbackPortable.digest),
      "the Argo applications did not report the rollback OCI digest",
    );
    receipt.spec.delivery.rollbackFleet = {
      size: 2,
      result: "pass",
      sameReleaseDigest: true,
      digest: rollbackPortable.digest,
      targets: rollbackTargets,
    };
    receipt.status.result = "pass";
    receipt.status.claim = "A Redis chart upgrade from 25.5.3 to 27.0.0 kept a recorded post-render replica change, exposed two affected environment variants, promoted the candidate through development and staging, and reconciled the same reviewed OCI digest on two Argo CD clusters. The test then restored the exact pre-upgrade staging revisions, published a separate rollback OCI, and reconciled both clusters back to chart 25.5.3 with two replicas. Both forward and rollback states passed exact-object, workload-convergence, and PONG checks.";
  } catch (error) {
    failure = sanitizeError(error);
    receipt.status.result = "blocked";
    receipt.status.claim = "The Redis Upgrade App proof did not complete.";
    receipt.status.error = failure;
  } finally {
    for (const [space, key] of [
      [stagingSpace, "stagingSpace"],
      [developmentSpace, "developmentSpace"],
      [baseSpace, "baseSpace"],
    ]) {
      if (createdSpaces.includes(space) || spacePresent(space)) {
        cubTry(["space", "delete", space, "--recursive-force"], { timeout: 300_000 });
      }
      receipt.spec.run.cleanup[key] = waitUntil(() => !spacePresent(space), 30)
        ? "pass"
        : "fail";
    }
    for (const [clusterName, key] of [
      [clusterB, "clusterB"],
      [clusterA, "clusterA"],
    ]) {
      if (clustersUp.includes(clusterName) || clusterPresent(clusterName)) {
        clusterDown(clusterName);
      }
      receipt.spec.run.cleanup[key] = waitUntil(() => clusterAbsent(clusterName), 40)
        ? "pass"
        : "fail";
    }
    if (registryUp || dockerContainerPresent(registryName)) {
      tryCommand("docker", ["rm", "-f", registryName], { timeout: 120_000 });
    }
    receipt.spec.run.cleanup.sourceRegistry = dockerContainerPresent(registryName)
      ? "fail"
      : "pass";
    rmSync(workRoot, { recursive: true, force: true });
    receipt.spec.run.cleanup.localFiles = [
      clusterKubeconfig(clusterA),
      clusterKubeconfig(clusterB),
      clusterEnv(clusterA),
      clusterEnv(clusterB),
    ].every((path) => !existsSync(path))
      ? "pass"
      : "fail";
  }

  if (!Object.values(receipt.spec.run.cleanup).every((result) => result === "pass")) {
    receipt.status.result = "blocked";
    receipt.status.error = [receipt.status.error, "scratch cleanup did not pass"]
      .filter(Boolean)
      .join("; ");
  }
  if (failure) console.error(`Redis Upgrade App proof blocked: ${failure}`);
  return receipt;
}

function resolvePublicPackage(reference) {
  const result = command("oras", ["resolve", reference.replace(/^oci:\/\//, "")]);
  const digest = normalizeDigest(result.output);
  check(digest, `${reference} did not resolve to a manifest digest`);
  return digest;
}

function countYamlFiles(directory) {
  if (!existsSync(directory)) return 0;
  return readdirSync(directory)
    .filter((name) => /\.ya?ml$/i.test(name))
    .length;
}

function parsePlanCounts(output) {
  const match = output.match(/Plan:\s+(\d+)\s+to add,\s+(\d+)\s+to change,\s+(\d+)\s+to delete\./);
  check(match, "cub installer plan did not report add/change/delete counts");
  return {
    add: Number(match[1]),
    change: Number(match[2]),
    delete: Number(match[3]),
  };
}

function inspectRedisSpace(space) {
  const spaceResponse = cubJson(["space", "get", space, "-o", "json"]);
  const unitSlugs = listUnitSlugs(space);
  const documents = unitSlugs.flatMap((slug) =>
    parseDocs(cub(["unit", "data", slug, "--space", space]))
      .map((document) => ({ slug, document })));
  const kubernetes = documents.filter(({ slug, document }) =>
    slug !== "installer-record"
    && document.apiVersion
    && document.kind
    && document.metadata?.name);
  const replica = kubernetes.find(({ document }) =>
    document.kind === "StatefulSet"
    && document.metadata?.name === "redis-replicas");
  const master = kubernetes.find(({ document }) =>
    document.kind === "StatefulSet"
    && document.metadata?.name === "redis-master");
  check(replica && master, `${space} is missing the Redis StatefulSets`);
  const chartLabel = String(replica.document.metadata?.labels?.["helm.sh/chart"] ?? "");
  const chartVersion = chartLabel.replace(/^redis-/, "");
  return {
    unitCount: unitSlugs.length,
    objectCount: kubernetes.length,
    replicaUnit: replica.slug,
    chartVersion,
    appVersion: String(replica.document.metadata?.labels?.["app.kubernetes.io/version"] ?? ""),
    replicas: Number(replica.document.spec?.replicas ?? 1),
    image: String(replica.document.spec?.template?.spec?.containers?.[0]?.image ?? ""),
    masterImage: String(master.document.spec?.template?.spec?.containers?.[0]?.image ?? ""),
    upgradableUnitCount: Number(spaceResponse.UpgradableUnitCount ?? 0),
  };
}

function snapshotSpaceUnits(space) {
  const response = cubJson(["unit", "list", "--space", space, "-o", "json"]);
  const rows = Array.isArray(response) ? response : response.Units ?? response.units ?? [];
  const units = rows
    .map((row) => row.Unit ?? row.unit ?? row)
    .filter((unit) => unit?.Slug ?? unit?.slug)
    .map((unit) => {
      const slug = String(unit.Slug ?? unit.slug);
      const data = cub(["unit", "data", slug, "--space", space]);
      return {
        slug,
        headRevision: Number(unit.HeadRevisionNum ?? unit.headRevisionNum ?? 0),
        dataSha256: sha256(data),
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));
  check(units.length === 15, `${space} did not contain 14 objects and one installer record`);
  check(
    units.every((unit) => unit.headRevision > 0 && /^[a-f0-9]{64}$/.test(unit.dataSha256)),
    `${space} did not return complete Unit revision metadata`,
  );
  return units;
}

function restoreSpaceRevisions({
  space,
  baseline,
  changeSet,
}) {
  const before = snapshotSpaceUnits(space);
  const baselineBySlug = new Map(baseline.map((unit) => [unit.slug, unit]));
  const changed = before.filter((unit) => {
    const prior = baselineBySlug.get(unit.slug);
    check(prior, `${unit.slug} was not present in the rollback baseline`);
    return unit.dataSha256 !== prior.dataSha256;
  });
  check(changed.length > 0, `${space} had no changed Units to restore`);

  const created = cubJson([
    "changeset",
    "create",
    "--space",
    space,
    changeSet,
    "--description",
    `Restore the reviewed Redis ${oldVersion} staging configuration`,
    "-o",
    "json",
  ]);
  const createdChangeSet = created.ChangeSet ?? created.changeset ?? created;
  const changeSetId = String(
    createdChangeSet.ChangeSetID
      ?? createdChangeSet.changeSetId
      ?? createdChangeSet.ID
      ?? createdChangeSet.id
      ?? "",
  );
  check(changeSetId, "ConfigHub did not return an ID for the rollback ChangeSet");

  for (const unit of changed) {
    const prior = baselineBySlug.get(unit.slug);
    cub([
      "unit",
      "update",
      unit.slug,
      "--space",
      space,
      "--restore",
      String(prior.headRevision),
      "--changeset",
      changeSet,
      "--change-desc",
      `Restore ${unit.slug} to its reviewed pre-upgrade revision`,
      "--quiet",
    ], { timeout: 300_000 });
  }

  const after = snapshotSpaceUnits(space);
  const afterBySlug = new Map(after.map((unit) => [unit.slug, unit]));
  for (const prior of baseline) {
    const restored = afterBySlug.get(prior.slug);
    check(restored, `${prior.slug} disappeared during rollback`);
    check(
      restored.dataSha256 === prior.dataSha256,
      `${prior.slug} does not match its pre-upgrade data after rollback`,
    );
  }
  const recorded = cubJson([
    "changeset",
    "get",
    "--space",
    space,
    changeSet,
    "-o",
    "json",
  ]);
  const recordedChangeSet = recorded.ChangeSet ?? recorded.changeset ?? recorded;
  check(
    String(recordedChangeSet.ChangeSetID ?? recordedChangeSet.changeSetId ?? "") === changeSetId,
    "the rollback ChangeSet could not be read back",
  );

  return {
    result: "pass",
    space,
    changeSet,
    changeSetId,
    restoredUnitCount: changed.length,
    unchangedUnitCount: baseline.length - changed.length,
    chartVersionBefore: candidateVersion,
    chartVersionAfter: oldVersion,
    appVersionBefore: candidateAppVersion,
    appVersionAfter: oldAppVersion,
    recordedReplicasBefore: 2,
    recordedReplicasAfter: 2,
    restoredUnits: changed.map((unit) => {
      const prior = baselineBySlug.get(unit.slug);
      const restored = afterBySlug.get(unit.slug);
      return {
        slug: unit.slug,
        priorRevision: prior.headRevision,
        candidateRevision: unit.headRevision,
        rollbackRevision: restored.headRevision,
        dataSha256: restored.dataSha256,
      };
    }),
  };
}

function waitForRedisSpace(space, predicate, errorMessage) {
  let state = inspectRedisSpace(space);
  for (let attempt = 0; attempt < 30 && !predicate(state); attempt += 1) {
    sleep(1000);
    state = inspectRedisSpace(space);
  }
  check(predicate(state), errorMessage);
  return state;
}

function variantLink(space) {
  const response = cubJson(["space", "get", space, "-o", "json"]);
  return {
    space,
    variant: String(response.Space?.Labels?.Variant ?? ""),
    environment: String(response.Space?.Labels?.Environment ?? ""),
    upstreamSpaceId: String(response.Space?.Annotations?.UpstreamSpaceID ?? ""),
  };
}

function promoteRedisVariant({
  space,
  downstreamSpace = "",
  description,
}) {
  const before = inspectRedisSpace(space);
  check(
    before.chartVersion === oldVersion
      && before.replicas === 2
      && before.upgradableUnitCount > 0,
    `${space} was not waiting on the reviewed upgrade`,
  );
  const downstreamBefore = downstreamSpace ? inspectRedisSpace(downstreamSpace) : null;
  const preview = cub([
    "variant",
    "promote",
    space,
    "--dry-run",
    "-o",
    "mutations",
  ], { timeout: 300_000 });
  const afterPreview = inspectRedisSpace(space);
  check(
    afterPreview.chartVersion === oldVersion && afterPreview.replicas === 2,
    `${space} dry run changed stored data`,
  );
  if (downstreamSpace) {
    const downstreamAfterPreview = inspectRedisSpace(downstreamSpace);
    check(
      downstreamAfterPreview.chartVersion === downstreamBefore.chartVersion
        && downstreamAfterPreview.replicas === downstreamBefore.replicas,
      `${downstreamSpace} changed before its own promotion`,
    );
  }
  cub([
    "variant",
    "promote",
    space,
    "--change-desc",
    description,
  ], { timeout: 420_000 });
  const after = inspectRedisSpace(space);
  check(
    after.chartVersion === candidateVersion
      && after.appVersion === candidateAppVersion
      && after.replicas === 2
      && after.upgradableUnitCount === 0,
    `${space} did not reach the reviewed candidate after promotion`,
  );
  const downstreamAfter = downstreamSpace
    ? waitForRedisSpace(
      downstreamSpace,
      (state) => state.upgradableUnitCount > 0,
      `${downstreamSpace} did not become pending after ${space} was promoted`,
    )
    : null;
  return {
    result: "pass",
    space,
    beforeChartVersion: before.chartVersion,
    afterChartVersion: after.chartVersion,
    recordedReplicasBefore: before.replicas,
    recordedReplicasAfter: after.replicas,
    pendingUnitsBefore: before.upgradableUnitCount,
    pendingUnitsAfter: after.upgradableUnitCount,
    downstreamPendingUnitsAfter: downstreamAfter?.upgradableUnitCount ?? 0,
    preview: {
      storageUnchanged: true,
      outputBytes: Buffer.byteLength(preview),
      outputSha256: sha256(preview),
      disposition: preview.trim() ? "pass" : "watch",
      note: preview.trim()
        ? "The command returned a mutation preview."
        : "The command returned no text; this is a known CLI presentation gap.",
    },
  };
}

function publishRelease(space) {
  const response = cubJson(["release", "publish", space, "-o", "json"], {
    timeout: 360_000,
  });
  const release = response.Release ?? response.release ?? response;
  const manifestDigest = normalizeDigest(release.ManifestDigest ?? release.manifestDigest);
  check(manifestDigest, `${space} release publish returned no manifest digest`);
  return {
    space,
    reference: `oci://oci.hub.confighub.com:443/space/${space}:latest`,
    manifestDigest,
    bundleDigest: normalizeDigest(release.Digest ?? release.digest),
    releaseId: String(release.ReleaseID ?? release.releaseId ?? ""),
  };
}

function startRegistry(name) {
  const started = tryCommand("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "-p",
    "127.0.0.1::5000",
    "registry:2",
  ], { timeout: 120_000 });
  check(started.ok, `could not start the temporary OCI registry: ${started.error}`);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const port = tryCommand("docker", ["port", name, "5000/tcp"]);
    const match = port.output.match(/127\.0\.0\.1:(\d+)/);
    if (match) {
      const host = `127.0.0.1:${match[1]}`;
      if (tryCommand("curl", ["-fsS", `http://${host}/v2/`]).ok) {
        return {
          host,
          clusterHost: `host.docker.internal:${match[1]}`,
        };
      }
    }
    sleep(1000);
  }
  throw new Error("temporary OCI registry did not publish a host port");
}

function publishSpaceOci({
  workRoot,
  space,
  registryHost,
  clusterRegistryHost,
  outputName,
  tag,
}) {
  const outputRoot = join(workRoot, `portable-output-${outputName}`);
  const pullRoot = join(workRoot, `portable-output-${outputName}-pulled`);
  const outputFile = join(outputRoot, "release-objects.yaml");
  const bundleFile = join(outputRoot, "bundle.tar.gz");
  mkdirSync(outputRoot, { recursive: true });
  const exported = exportSpaceObjects(space);
  writeFileSync(outputFile, exported.yaml);
  command("tar", ["-czf", bundleFile, "release-objects.yaml"], {
    cwd: outputRoot,
    timeout: 120_000,
  });
  const repository = "reviewed-redis-staging";
  const localReference = `${registryHost}/${repository}:${tag}`;
  command("oras", [
    "push",
    "--plain-http",
    "--artifact-type",
    artifactType,
    "--format",
    "json",
    localReference,
    `bundle.tar.gz:${deployableLayerType}`,
  ], { cwd: outputRoot, timeout: 180_000 });
  const descriptor = command("oras", [
    "manifest",
    "fetch",
    "--plain-http",
    "--descriptor",
    localReference,
  ], { timeout: 120_000 });
  const digest = normalizeDigest(JSON.parse(descriptor.output).digest);
  check(digest, "portable staging OCI has no manifest digest");
  command("oras", [
    "pull",
    "--plain-http",
    "--output",
    pullRoot,
    `${registryHost}/${repository}@${digest}`,
  ], { timeout: 120_000 });
  const pulledBundle = join(pullRoot, "bundle.tar.gz");
  check(existsSync(pulledBundle), "pulled portable staging OCI is missing bundle.tar.gz");
  command("tar", ["-xzf", pulledBundle, "-C", pullRoot], { timeout: 120_000 });
  const pulledFile = join(pullRoot, "release-objects.yaml");
  check(existsSync(pulledFile), "pulled portable staging OCI is missing release-objects.yaml");
  const pulledYaml = readFileSync(pulledFile, "utf8");
  check(
    canonicalDocuments(exported.yaml) === canonicalDocuments(pulledYaml),
    "pulled portable staging OCI differs from the staged ConfigHub Units",
  );
  return {
    reference: `oci://${localReference}`,
    clusterReference: `oci://${clusterRegistryHost}/${repository}`,
    tag,
    digest,
    objectCount: exported.objectCount,
    yamlSha256: sha256(exported.yaml),
    pulledYamlSha256: sha256(pulledYaml),
    desiredYaml: exported.yaml,
    observationYaml: `${parseDocs(exported.yaml)
      .map((document) => JSON.stringify(pruneNulls(document), null, 2))
      .join("\n---\n")}\n`,
  };
}

function exportSpaceObjects(space) {
  const documents = listUnitSlugs(space)
    .filter((slug) => slug !== "installer-record")
    .flatMap((slug) => parseDocs(cub(["unit", "data", slug, "--space", space])))
    .filter((document) =>
      document.apiVersion
      && document.kind
      && document.metadata?.name)
    .sort((left, right) => objectIdentity(left).localeCompare(objectIdentity(right)));
  check(documents.length === 14, `${space} did not export 14 Kubernetes objects`);
  return {
    objectCount: documents.length,
    yaml: `${documents.map((document) => JSON.stringify(document, null, 2)).join("\n---\n")}\n`,
  };
}

function canonicalDocuments(yaml) {
  return JSON.stringify(
    parseDocs(yaml)
      .filter((document) =>
        document.apiVersion
        && document.kind
        && document.metadata?.name)
      .sort((left, right) => objectIdentity(left).localeCompare(objectIdentity(right))),
  );
}

function pruneNulls(value) {
  if (Array.isArray(value)) return value.map(pruneNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, child]) =>
        child !== null
        && child !== undefined
        && !key.startsWith("$comment$"))
      .map(([key, child]) => [key, pruneNulls(child)]),
  );
}

function stageRedisSecret(clusterName) {
  kubectl(clusterName, ["create", "namespace", namespace], { allowAlreadyExists: true });
  const password = randomBytes(32).toString("base64url");
  const secret = JSON.stringify({
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: "redis-existing-secret",
      namespace,
    },
    type: "Opaque",
    stringData: {
      "redis-password": password,
    },
  });
  kubectl(clusterName, ["apply", "-f", "-"], { input: secret });
}

function addApplication({
  clusterName,
  appName,
  unitName,
  sourceReference,
  targetRevision,
  namespace: destinationNamespace,
  workRoot,
}) {
  const clusterSpace = `${clusterName}-cluster`;
  const target = `${clusterSpace}/oci`;
  const appPath = join(workRoot, `${clusterName}-${appName}.yaml`);
  writeFileSync(appPath, applicationYaml({
    appName,
    sourceReference,
    targetRevision,
    namespace: destinationNamespace,
  }));
  configureAnonymousOci(clusterName, new URL(sourceReference).host, workRoot);
  cub([
    "unit",
    "create",
    "--space",
    clusterSpace,
    unitName,
    appPath,
    "--target",
    target,
    "--change-desc",
    `Create ${appName} from the reviewed Redis upgrade`,
  ], { timeout: 240_000 });
  const rootRelease = publishRelease(clusterSpace);
  kubectl(clusterName, [
    "annotate",
    "application",
    clusterSpace,
    "-n",
    "argocd",
    "argocd.argoproj.io/refresh=hard",
    "--overwrite",
  ]);
  return {
    name: appName,
    unit: `${clusterSpace}/${unitName}`,
    source: sourceReference,
    targetRevision,
    destinationNamespace,
    clusterRootReleaseDigest: rootRelease.manifestDigest,
  };
}

function updateApplication({
  clusterName,
  appName,
  unitName,
  sourceReference,
  targetRevision,
  namespace: destinationNamespace,
  workRoot,
}) {
  const clusterSpace = `${clusterName}-cluster`;
  const appPath = join(workRoot, `${clusterName}-${appName}-${targetRevision}.yaml`);
  writeFileSync(appPath, applicationYaml({
    appName,
    sourceReference,
    targetRevision,
    namespace: destinationNamespace,
  }));
  cub([
    "unit",
    "update",
    "--space",
    clusterSpace,
    unitName,
    appPath,
    "--change-desc",
    `Point ${appName} at the reviewed Redis rollback`,
  ], { timeout: 240_000 });
  const rootRelease = publishRelease(clusterSpace);
  kubectl(clusterName, [
    "annotate",
    "application",
    clusterSpace,
    "-n",
    "argocd",
    "argocd.argoproj.io/refresh=hard",
    "--overwrite",
  ]);
  return {
    name: appName,
    unit: `${clusterSpace}/${unitName}`,
    source: sourceReference,
    targetRevision,
    destinationNamespace,
    clusterRootReleaseDigest: rootRelease.manifestDigest,
  };
}

function applicationYaml({
  appName,
  sourceReference,
  targetRevision,
  namespace: destinationNamespace,
}) {
  return `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${appName}
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ${sourceReference}
    targetRevision: ${targetRevision}
    path: .
  destination:
    server: https://kubernetes.default.svc
    namespace: ${destinationNamespace}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
`;
}

function configureAnonymousOci(clusterName, registryHost, workRoot) {
  const secretPath = join(workRoot, `${clusterName}-anonymous-oci.yaml`);
  writeFileSync(secretPath, `apiVersion: v1
kind: Secret
metadata:
  name: helm-expt-anonymous-oci
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repo-creds
type: Opaque
stringData:
  url: oci://${registryHost}
  type: oci
  enableOCI: "true"
  insecureOCIForceHttp: "true"
`);
  kubectl(clusterName, ["apply", "-f", secretPath]);
}

function waitForRedisApplication({
  clusterName,
  appName,
  expectedDigest,
  expectedChartVersion,
  expectedAppVersion,
  expectedReplicas,
}) {
  let last = {
    sync: "",
    health: "",
    revision: "",
    masterReady: 0,
    replicaReady: 0,
    image: "",
    chartVersion: "",
    appVersion: "",
    ping: "",
  };
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const app = kubectlTry(clusterName, [
      "get",
      "application",
      appName,
      "-n",
      "argocd",
      "-o",
      "json",
    ]);
    const master = kubectlTry(clusterName, [
      "get",
      "statefulset",
      "redis-master",
      "-n",
      namespace,
      "-o",
      "json",
    ]);
    const replicas = kubectlTry(clusterName, [
      "get",
      "statefulset",
      "redis-replicas",
      "-n",
      namespace,
      "-o",
      "json",
    ]);
    if (app.ok && master.ok && replicas.ok) {
      const appObject = JSON.parse(app.output);
      const masterObject = JSON.parse(master.output);
      const replicaObject = JSON.parse(replicas.output);
      const ping = kubectlTry(clusterName, [
        "exec",
        "-n",
        namespace,
        "redis-master-0",
        "--",
        "sh",
        "-c",
        "REDISCLI_AUTH=\"$(cat /opt/bitnami/redis/secrets/redis-password)\" redis-cli ping",
      ]);
      last = {
        sync: String(appObject.status?.sync?.status ?? ""),
        health: String(appObject.status?.health?.status ?? ""),
        revision: normalizeDigest(appObject.status?.sync?.revision ?? ""),
        masterReady: Number(masterObject.status?.readyReplicas ?? 0),
        replicaReady: Number(replicaObject.status?.readyReplicas ?? 0),
        image: String(replicaObject.spec?.template?.spec?.containers?.[0]?.image ?? ""),
        chartVersion: String(replicaObject.metadata?.labels?.["helm.sh/chart"] ?? "")
          .replace(/^redis-/, ""),
        appVersion: String(replicaObject.metadata?.labels?.["app.kubernetes.io/version"] ?? ""),
        ping: ping.ok ? ping.output.trim() : "",
      };
      if (
        last.sync === "Synced"
        && last.health === "Healthy"
        && last.revision === expectedDigest
        && last.masterReady === 1
        && last.replicaReady === expectedReplicas
        && last.image === expectedImage
        && last.chartVersion === expectedChartVersion
        && last.appVersion === expectedAppVersion
        && last.ping === "PONG"
      ) {
        return {
          result: "pass",
          application: appName,
          namespace,
          sync: last.sync,
          health: last.health,
          revision: last.revision,
          masterReady: "1/1",
          replicasReady: `${expectedReplicas}/${expectedReplicas}`,
          image: last.image,
          chartVersion: last.chartVersion,
          appVersion: last.appVersion,
          ping: last.ping,
        };
      }
    }
    sleep(5000);
  }
  return {
    result: "blocked",
    reason: `sync=${last.sync || "missing"}; health=${last.health || "missing"}; revision=${last.revision || "missing"}; chart=${last.chartVersion || "missing"}; app=${last.appVersion || "missing"}; master=${last.masterReady}/1; replicas=${last.replicaReady}/${expectedReplicas}; image=${last.image || "missing"}; ping=${last.ping || "missing"}`,
  };
}

function collectScoutObservations({
  clusterName,
  slot,
  desiredPath,
}) {
  const env = {
    ...process.env,
    CLUSTER_NAME: clusterName,
    CUB_SCOUT_OFFLINE: "true",
    KUBECONFIG: clusterKubeconfig(clusterName),
  };
  const objectSetPath = join(observationRoot, `${slot}-object-set.json`);
  const workloadsPath = join(observationRoot, `${slot}-workloads.json`);
  runScoutReceipt({
    env,
    predicate: "object-set-matches",
    outputPath: objectSetPath,
    desiredPath,
  });
  runScoutReceipt({
    env,
    predicate: "workloads-converged",
    outputPath: workloadsPath,
    desiredPath,
  });
  const objectSet = readScoutReceipt(objectSetPath, "object-set-matches");
  const workloads = readScoutReceipt(workloadsPath, "workloads-converged");
  return {
    objectSet: summarizeScoutReceipt(objectSetPath, objectSet, "objectSet"),
    workloads: summarizeScoutReceipt(workloadsPath, workloads, "workloads"),
  };
}

function runScoutReceipt({
  env,
  predicate,
  outputPath,
  desiredPath,
}) {
  const args = [
    "receipt",
    "verify",
    "--file",
    relativeRepo(desiredPath),
    "--scope",
    `namespace/${namespace}`,
    "--predicate",
    predicate,
    "--format",
    "json",
    "--out",
    relativeRepo(outputPath),
    "--fail-on",
    "any-non-pass",
    "--ttl",
    "1h",
  ];
  if (predicate === "object-set-matches") {
    args.push("--normalization-profile", "k8s-zero-defaults/v1");
  }
  command("cub-scout", args, { env, timeout: 240_000 });
  command("cub-scout", ["receipt", "validate", relativeRepo(outputPath)], {
    env,
    timeout: 120_000,
  });
}

function readScoutReceipt(path, predicateName) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
  const receipt = JSON.parse(readFileSync(path, "utf8"));
  check(
    receipt._type === "https://in-toto.io/Statement/v1"
      && receipt.predicateType === "https://cub-scout.dev/receipt/v1"
      && receipt.predicate?.predicateName === predicateName
      && receipt.predicate?.verdict === "PASS"
      && /^sha256:[a-f0-9]{64}$/.test(receipt.predicate?.fingerprint ?? ""),
    `${relativeRepo(path)} is not a passing cub-scout ${predicateName} receipt`,
  );
  return receipt;
}

function summarizeScoutReceipt(path, receipt, key) {
  const evidence = receipt.predicate.evidence[key];
  return {
    result: "pass",
    receipt: relativeRepo(path),
    fingerprint: receipt.predicate.fingerprint,
    desiredDigest: evidence.desiredDigest,
    liveDigest: evidence.liveDigest,
    summary: evidence.summary,
    expiresAt: receipt.predicate.freshness.expiresAt,
  };
}

function clusterUp(name) {
  const result = spawnSync(
    "cub",
    ["cluster", "up", "--name", name, "--no-ports"],
    {
      cwd: repoRoot,
      env: cubEnv(),
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 900_000,
      maxBuffer: 1024 * 1024 * 50,
    },
  );
  check(
    result.status === 0 || clusterPresent(name),
    `cub cluster up failed for ${name}: ${sanitizeError(result.stderr)}`,
  );
}

function clusterDown(name) {
  const result = tryCommand(
    "cub",
    ["cluster", "down", "--name", name, "--force"],
    { timeout: 600_000, env: cubEnv() },
  );
  if (!result.ok && clusterPresent(name)) {
    tryCommand("kind", ["delete", "cluster", "--name", name], {
      timeout: 180_000,
    });
  }
  if (spacePresent(`${name}-cluster`)) {
    cubTry(["space", "delete", `${name}-cluster`, "--recursive-force"], {
      timeout: 300_000,
    });
  }
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function clusterAbsent(name) {
  return !clusterPresent(name)
    && !spacePresent(`${name}-cluster`)
    && !existsSync(clusterKubeconfig(name))
    && !existsSync(clusterEnv(name));
}

function clusterKubeconfig(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.kubeconfig`);
}

function clusterEnv(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.env`);
}

function kubectl(clusterName, args, options = {}) {
  const result = tryCommand(
    "kubectl",
    [
      "--kubeconfig",
      clusterKubeconfig(clusterName),
      "--context",
      `kind-${clusterName}`,
      ...args,
    ],
    {
      timeout: options.timeout ?? 180_000,
      input: options.input,
    },
  );
  if (
    options.allowAlreadyExists
    && !result.ok
    && result.error.includes("AlreadyExists")
  ) {
    return result;
  }
  check(result.ok, `kubectl ${args.slice(0, 3).join(" ")} failed: ${result.error}`);
  return result;
}

function kubectlTry(clusterName, args) {
  return tryCommand(
    "kubectl",
    [
      "--kubeconfig",
      clusterKubeconfig(clusterName),
      "--context",
      `kind-${clusterName}`,
      ...args,
    ],
    { timeout: 180_000 },
  );
}

function listUnitSlugs(space) {
  const response = cubJson(["unit", "list", "--space", space, "-o", "json"]);
  const rows = Array.isArray(response) ? response : response.Units ?? response.units ?? [];
  const slugs = rows
    .map((row) => row.Unit?.Slug ?? row.unit?.slug ?? row.Slug ?? row.slug)
    .filter(Boolean)
    .sort();
  check(slugs.length > 0, `${space} has no Units`);
  return slugs;
}

function spacePresent(space) {
  return cubTry(["space", "get", space, "-o", "json"]).ok;
}

function dockerContainerPresent(name) {
  const result = tryCommand("docker", [
    "ps",
    "-a",
    "--filter",
    `name=^/${name}$`,
    "--format",
    "{{.Names}}",
  ]);
  return result.ok && result.output.trim() === name;
}

function assertScratchContext() {
  check(
    process.env.HELM_EXPT_ALLOW_SCRATCH_ORG === "1",
    "set HELM_EXPT_ALLOW_SCRATCH_ORG=1 to acknowledge that this creates and removes scratch ConfigHub Spaces and clusters",
  );
  check(
    process.env.CUB_CONTEXT,
    "set CUB_CONTEXT to an authenticated scratch organization context",
  );
  const context = cub(["context", "get"]);
  check(
    !context.includes("helm-catalog"),
    "refusing to run the scratch proof in the maintained helm-catalog organization",
  );
}

function cub(args, options = {}) {
  const result = command("cub", args, {
    ...options,
    env: cubEnv(),
  });
  return result.output;
}

function cubTry(args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: cubEnv(),
  });
}

function cubJson(args, options = {}) {
  const output = cub(args, options);
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`cub returned invalid JSON for ${args.slice(0, 3).join(" ")}`);
  }
}

function command(file, args, options = {}) {
  const result = tryCommand(file, args, options);
  if (!result.ok) {
    throw new Error(`${file} ${args.slice(0, 4).join(" ")} failed: ${result.error}`);
  }
  return result;
}

function tryCommand(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    input: options.input,
    stdio: options.input === undefined
      ? ["ignore", "pipe", "pipe"]
      : ["pipe", "pipe", "pipe"],
    timeout: options.timeout ?? 120_000,
    maxBuffer: 1024 * 1024 * 100,
  });
  return {
    ok: result.status === 0,
    output: result.stdout ?? "",
    error: sanitizeError(
      result.error?.message
      ?? result.stderr
      ?? result.stdout
      ?? `exit ${result.status}`,
    ),
  };
}

function normalizeDigest(value) {
  return String(value ?? "").match(/sha256:[a-f0-9]{64}/)?.[0] ?? "";
}

function sanitizeError(value) {
  return String(value ?? "")
    .replace(/(?i:password|token|secret)\s*[:=]\s*\S+/g, "$1=<redacted>")
    .replace(/[A-Za-z0-9_-]{40,}/g, "<redacted-long-value>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function objectIdentity(document) {
  return [
    document.apiVersion ?? "",
    document.kind ?? "",
    document.metadata?.namespace ?? "",
    document.metadata?.name ?? "",
  ].join("|");
}

function sleep(milliseconds) {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    milliseconds,
  );
}

function waitUntil(predicate, tries, gapMs = 1000) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (predicate()) return true;
    sleep(gapMs);
  }
  return predicate();
}

function validateReceipt(receipt) {
  check(receipt.kind === "RedisUpgradeAppReceipt", "Redis Upgrade App receipt kind changed");
  check(receipt.status?.result === "pass", "Redis Upgrade App proof is not pass");
  check(
    /^sha256:[a-f0-9]{64}$/.test(receipt.spec?.source?.current?.digest ?? "")
      && /^sha256:[a-f0-9]{64}$/.test(receipt.spec?.source?.candidate?.digest ?? ""),
    "the public package digests are missing",
  );
  check(receipt.spec?.prerequisite?.result === "pass", "the external Secret was not handled");
  check(receipt.spec?.configHub?.import?.result === "pass", "the current package import did not pass");
  check(receipt.spec?.configHub?.userChange?.result === "pass", "the recorded replica change did not pass");
  check(receipt.spec?.configHub?.chain?.result === "pass", "the environment chain did not pass");
  check(
    receipt.spec?.configHub?.candidatePlan?.result === "pass"
      && receipt.spec.configHub.candidatePlan.replicaResetProposed === false,
    "the candidate plan did not protect the recorded replica change",
  );
  check(
    receipt.spec?.configHub?.reconcile?.result === "pass"
      && receipt.spec.configHub.reconcile.chartVersionAfter === candidateVersion
      && receipt.spec.configHub.reconcile.recordedReplicasAfter === 2,
    "the candidate reconcile did not pass",
  );
  check(
    receipt.spec?.configHub?.impact?.result === "pass"
      && receipt.spec.configHub.impact.affectedSpaces === 2
      && receipt.spec.configHub.impact.spaces?.[0]?.pendingUnits > 0
      && receipt.spec.configHub.impact.spaces?.[1]?.pendingUnits === 0
      && receipt.spec.configHub.impact.spaces?.[1]?.pendingUnitsAfterDevelopment > 0,
    "the downstream impact was not recorded",
  );
  for (const environment of ["development", "staging"]) {
    const promotion = receipt.spec?.configHub?.promotions?.[environment];
    check(
      promotion?.result === "pass"
        && promotion.afterChartVersion === candidateVersion
        && promotion.recordedReplicasAfter === 2
        && promotion.preview.storageUnchanged === true,
      `${environment} promotion did not pass`,
    );
  }
  check(
    receipt.spec?.delivery?.configHubRelease?.result === "pass",
    "the ConfigHub release did not pass",
  );
  check(
    receipt.spec?.delivery?.portableOci?.result === "pass"
      && receipt.spec.delivery.portableOci.objectCount === 14
      && /^sha256:[a-f0-9]{64}$/.test(receipt.spec.delivery.portableOci.digest ?? ""),
    "the portable OCI did not pass",
  );
  check(
    receipt.spec?.delivery?.fleet?.result === "pass"
      && receipt.spec.delivery.fleet.size === 2
      && receipt.spec.delivery.fleet.sameReleaseDigest === true
      && receipt.spec.delivery.fleet.targets?.length === 2,
    "the two-target rollout did not pass",
  );
  for (const target of receipt.spec.delivery.fleet.targets) {
    check(
      target.runtime?.result === "pass"
        && target.runtime.sync === "Synced"
        && target.runtime.health === "Healthy"
        && target.runtime.masterReady === "1/1"
        && target.runtime.replicasReady === "2/2"
        && target.runtime.chartVersion === candidateVersion
        && target.runtime.appVersion === candidateAppVersion
        && target.runtime.ping === "PONG",
      `${target.cluster} runtime did not pass`,
    );
    for (const [observation, predicate] of [
      [target.observations?.objectSet, "object-set-matches"],
      [target.observations?.workloads, "workloads-converged"],
    ]) {
      check(observation?.result === "pass", `${target.cluster} ${predicate} did not pass`);
      const stored = readScoutReceipt(join(repoRoot, observation.receipt), predicate);
      check(
        stored.predicate.fingerprint === observation.fingerprint,
        `${observation.receipt} fingerprint differs from the main receipt`,
      );
    }
  }
  check(
    receipt.spec?.configHub?.rollback?.result === "pass"
      && receipt.spec.configHub.rollback.restoredUnitCount > 0
      && receipt.spec.configHub.rollback.chartVersionAfter === oldVersion
      && receipt.spec.configHub.rollback.appVersionAfter === oldAppVersion
      && receipt.spec.configHub.rollback.recordedReplicasAfter === 2
      && receipt.spec.configHub.rollback.changeSetId,
    "the ConfigHub rollback did not restore the recorded pre-upgrade revisions",
  );
  check(
    receipt.spec?.delivery?.rollbackRelease?.result === "pass",
    "the ConfigHub rollback release did not pass",
  );
  check(
    receipt.spec?.delivery?.rollbackOci?.result === "pass"
      && receipt.spec.delivery.rollbackOci.objectCount === 14
      && /^sha256:[a-f0-9]{64}$/.test(receipt.spec.delivery.rollbackOci.digest ?? ""),
    "the rollback OCI did not pass",
  );
  check(
    receipt.spec?.delivery?.rollbackFleet?.result === "pass"
      && receipt.spec.delivery.rollbackFleet.size === 2
      && receipt.spec.delivery.rollbackFleet.sameReleaseDigest === true
      && receipt.spec.delivery.rollbackFleet.targets?.length === 2,
    "the two-target rollback rollout did not pass",
  );
  for (const target of receipt.spec.delivery.rollbackFleet.targets) {
    check(
      target.runtime?.result === "pass"
        && target.runtime.sync === "Synced"
        && target.runtime.health === "Healthy"
        && target.runtime.masterReady === "1/1"
        && target.runtime.replicasReady === "2/2"
        && target.runtime.chartVersion === oldVersion
        && target.runtime.appVersion === oldAppVersion
        && target.runtime.ping === "PONG",
      `${target.cluster} rollback runtime did not pass`,
    );
    for (const [observation, predicate] of [
      [target.observations?.objectSet, "object-set-matches"],
      [target.observations?.workloads, "workloads-converged"],
    ]) {
      check(observation?.result === "pass", `${target.cluster} rollback ${predicate} did not pass`);
      const stored = readScoutReceipt(join(repoRoot, observation.receipt), predicate);
      check(
        stored.predicate.fingerprint === observation.fingerprint,
        `${observation.receipt} fingerprint differs from the main receipt`,
      );
    }
  }
  check(
    Object.values(receipt.spec?.run?.cleanup ?? {}).every((result) => result === "pass"),
    "Redis Upgrade App cleanup did not pass",
  );
  check(
    !JSON.stringify(receipt).match(/\bcub\s+(?:lk|install)\b/),
    "Redis Upgrade App receipt contains a retired command",
  );
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  const unchangedUnitLabel = spec.configHub.rollback.unchangedUnitCount === 1
    ? "Unit was"
    : "Units were";
  const rows = spec.delivery.fleet.targets
    .map((target) => `| \`${target.cluster}\` | ${target.runtime.chartVersion} | ${target.runtime.sync} | ${target.runtime.health} | ${target.runtime.masterReady} | ${target.runtime.replicasReady} | ${target.runtime.ping} | [objects](../../${target.observations.objectSet.receipt}) | [workloads](../../${target.observations.workloads.receipt}) |`)
    .join("\n");
  const rollbackRows = spec.delivery.rollbackFleet.targets
    .map((target) => `| \`${target.cluster}\` | ${target.runtime.chartVersion} | ${target.runtime.sync} | ${target.runtime.health} | ${target.runtime.masterReady} | ${target.runtime.replicasReady} | ${target.runtime.ping} | [objects](../../${target.observations.objectSet.receipt}) | [workloads](../../${target.observations.workloads.receipt}) |`)
    .join("\n");
  return `# Redis upgrade and rollback

This live test starts from the public Redis \`${oldVersion}\` installer package.
It records a change from three replicas to two, prepares Redis
\`${candidateVersion}\`, and checks that the upgrade does not put the replica count
back to the chart default. ConfigHub then promotes the candidate through development
and staging. The reviewed staging configuration is packaged once and reconciled by
Argo CD on two throwaway clusters.

The test then restores the exact staging Unit revisions recorded before the promotion.
It publishes that restored configuration as a separate OCI artifact and checks both
clusters again. This is a rollback of desired Kubernetes configuration. It does not
claim to reverse database data or an irreversible migration.

## Result

**${receipt.status.result}.** ${receipt.status.claim}

| Step | Result | What was checked |
| --- | --- | --- |
| Resolve the public packages | pass | \`${oldVersion}\` is \`${spec.source.current.digest}\`; \`${candidateVersion}\` is \`${spec.source.candidate.digest}\`. |
| Import the current package | ${spec.configHub.import.result} | ${spec.configHub.import.objectCount} Kubernetes objects, Redis ${spec.configHub.import.appVersion}, chart ${spec.configHub.import.chartVersion}. |
| Record the user change | ${spec.configHub.userChange.result} | \`StatefulSet/redis-replicas spec.replicas\` changed from ${spec.configHub.userChange.chartDefault} to ${spec.configHub.userChange.recordedValue}. |
| Check the candidate plan | ${spec.configHub.candidatePlan.result} | ${spec.configHub.candidatePlan.add} add, ${spec.configHub.candidatePlan.change} change, ${spec.configHub.candidatePlan.delete} delete; no replica reset proposed. |
| Reconcile the base | ${spec.configHub.reconcile.result} | Chart ${spec.configHub.reconcile.chartVersionBefore} became ${spec.configHub.reconcile.chartVersionAfter}; Redis ${spec.configHub.reconcile.appVersionBefore} became ${spec.configHub.reconcile.appVersionAfter}; replicas stayed ${spec.configHub.reconcile.recordedReplicasAfter}. |
| Show downstream impact | ${spec.configHub.impact.result} | ${spec.configHub.impact.affectedSpaces} environment Spaces are in the path: development was pending first, and staging became pending after the development wave. |
| Promote development | ${spec.configHub.promotions.development.result} | Chart ${spec.configHub.promotions.development.afterChartVersion}; replicas ${spec.configHub.promotions.development.recordedReplicasAfter}; dry run left stored data unchanged. |
| Promote staging | ${spec.configHub.promotions.staging.result} | Chart ${spec.configHub.promotions.staging.afterChartVersion}; replicas ${spec.configHub.promotions.staging.recordedReplicasAfter}; dry run left stored data unchanged. |
| Publish the ConfigHub release | ${spec.delivery.configHubRelease.result} | \`${spec.delivery.configHubRelease.manifestDigest}\`. |
| Build and pull the portable OCI | ${spec.delivery.portableOci.result} | ${spec.delivery.portableOci.objectCount} objects at \`${spec.delivery.portableOci.digest}\`; pulled files matched the reviewed staging files. |
| Roll out to two clusters | ${spec.delivery.fleet.result} | Both Argo CD applications reported the same OCI digest and both Redis installations became ready. |
| Restore the prior revisions | ${spec.configHub.rollback.result} | ${spec.configHub.rollback.restoredUnitCount} changed Units were restored under ChangeSet \`${spec.configHub.rollback.changeSet}\`; ${spec.configHub.rollback.unchangedUnitCount} unchanged ${unchangedUnitLabel} left alone. |
| Publish the rollback OCI | ${spec.delivery.rollbackOci.result} | ${spec.delivery.rollbackOci.objectCount} objects at \`${spec.delivery.rollbackOci.digest}\`; pulled files matched the restored staging Units. |
| Reconcile the rollback | ${spec.delivery.rollbackFleet.result} | Both Argo CD applications reported the rollback digest and both Redis installations became ready on chart ${spec.configHub.rollback.chartVersionAfter}. |

## Candidate results

| Cluster | Chart | Argo sync | Argo health | Master | Replicas | Redis check | Exact objects | Current workloads |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Rollback results

| Cluster | Chart | Argo sync | Argo health | Master | Replicas | Redis check | Exact objects | Current workloads |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rollbackRows}

## The Secret is separate

The selected \`${baseName}\` configuration refers to
\`${namespace}/redis-existing-secret\`, key \`redis-password\`. The package and
portable workload OCI do not contain that password. This test created a different
temporary Secret on each target through standard input. No credential bytes were
written to the repository or receipt.

## One current CLI gap

\`cub variant promote --dry-run -o mutations\` returned no text for both promotions.
The command changed no stored data, and the real promotions completed, but the empty
preview is not useful to a person reviewing the upgrade. This receipt records that as
a known presentation gap rather than describing the preview as complete.

## What this proves

- A public installer package can become a recorded ConfigHub base.
- A change to the rendered Kubernetes objects can remain in place when a newer chart
  package is reconciled.
- ConfigHub can show which environment variants are waiting for the candidate and
  promote them in order.
- The reviewed result can leave ConfigHub as OCI and reconcile at the same digest on
  two Argo CD clusters.
- A named ChangeSet can restore the staging Units to their exact pre-upgrade
  revisions while retaining the two-replica edit.
- The restored result can be published as a separate OCI artifact and reconciled by
  the same two Argo CD clusters.
- Both clusters matched the reviewed object set, reached one ready Redis master and
  two ready replicas, and returned \`PONG\` before and after rollback.

## Limits

${spec.limits.map((limit) => `- ${limit}`).join("\n")}

Receipt: [\`${relativeRepo(receiptPath)}\`](../../${relativeRepo(receiptPath)}).
`;
}
