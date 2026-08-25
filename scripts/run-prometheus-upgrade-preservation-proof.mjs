#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set(["--run", "--generate", "--verify"]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/run-prometheus-upgrade-preservation-proof.mjs --run
  node scripts/run-prometheus-upgrade-preservation-proof.mjs --generate
  node scripts/run-prometheus-upgrade-preservation-proof.mjs --verify`);
  process.exit(2);
}

const chart = "prometheus-community/prometheus";
const baseName = "server-only-ephemeral";
const namespace = "monitoring";
const current = {
  version: "29.8.0",
  appVersion: "v3.11.3",
  ref: "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-prometheus@sha256:5cf6400c75d1cafc06fee5ddaada47651926bdab3a9d674a9f966540b29edd26",
  manifestDigest: "sha256:5cf6400c75d1cafc06fee5ddaada47651926bdab3a9d674a9f966540b29edd26",
  layerDigest: "sha256:ac86e0bf7ec6ab8d8e8c66298fb32791be696756480116fe833a4459e5bcc9e1",
};
const candidate = {
  version: "29.9.0",
  appVersion: "v3.12.0",
  ref: "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-prometheus@sha256:e68a4d9604798ee51833670ba84c20ebe4c7f8eea17d9f35cb8a7e64a4c434cc",
  manifestDigest: "sha256:e68a4d9604798ee51833670ba84c20ebe4c7f8eea17d9f35cb8a7e64a4c434cc",
  layerDigest: "sha256:05ad4d8e8867b8240e1e1f5fa8efd112469e689651c72dbcbc62466a1b96e4e9",
};
const deploymentUnit = "deployment-monitoring-prometheus-server";
const receiptPath = join(repoRoot, "runs", "prometheus-upgrade-preservation-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "prometheus-upgrade-preservation-proof", "summary.md");

if (mode === "--run") {
  const receipt = runProof();
  validateReceipt(receipt);
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote Prometheus upgrade preservation proof -> ${relativeRepo(receiptPath)}`);
  process.exit(0);
}

check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
const receipt = readYaml(receiptPath);
validateReceipt(receipt);
const summary = renderSummary(receipt);

if (mode === "--generate") {
  write(summaryPath, summary);
  console.log(`wrote Prometheus upgrade preservation summary -> ${relativeRepo(summaryPath)}`);
} else {
  check(
    existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summary,
    `${relativeRepo(summaryPath)} is stale; run npm run prometheus-upgrade-preservation:generate`,
  );
  console.log("verified Prometheus upgrade preservation proof");
}

function runProof() {
  const contextInfo = cubJson(["context", "get", "-o", "json"]);
  check(
    contextInfo.metadata?.organizationName === "helm-catalog",
    "the live proof must use the helm-catalog ConfigHub organization",
  );
  const versions = parseCubVersions(cub(["version"]));
  check(versionAtLeast(versions.client, "0.2.34"), `cub 0.2.34 or newer is required; found ${versions.client}`);
  const installerVersion = cub(["installer", "version"]).trim();
  check(installerVersion, "the cub installer plugin is required");

  const recordedAt = new Date().toISOString();
  const runId = recordedAt.replaceAll(/[^0-9]/g, "").slice(0, 14);
  const spaces = {
    base: `hx-prometheus-upgrade-${runId}-base`,
    staging: `hx-prometheus-upgrade-${runId}-staging`,
  };
  const workDir = mkdtempSync(join(tmpdir(), "helm-expt-prometheus-upgrade-"));
  const createdSpaces = [];
  const cleanup = { base: "not-created", staging: "not-created", workDir: "pending" };

  try {
    for (const space of Object.values(spaces)) {
      check(!spacePresent(space), `refusing to reuse existing Space ${space}`);
    }

    cub([
      "installer", "setup",
      "--pull", current.ref,
      "--base", baseName,
      "--namespace", namespace,
      "--work-dir", workDir,
      "--non-interactive",
      "--clean",
    ], { timeout: 420_000 });
    check(countManifestFiles(workDir) === 7, "the current package did not render seven manifests");

    cub([
      "installer", "upload",
      "--work-dir", workDir,
      "--space", spaces.base,
      "--component", "prometheus-upgrade-proof",
      "--variant", "Base",
      "--layer", "Platform",
      "--owner", "ConfigWorkshop",
    ], { timeout: 600_000 });
    createdSpaces.push(spaces.base);
    cleanup.base = "pending";
    const importedBase = deploymentState(spaces.base);
    assertDeployment(importedBase, { version: current.version, appVersion: current.appVersion, replicas: 1 });

    const userChangeOutput = cub([
      "run", "set-replicas",
      "--space", spaces.base,
      "--unit", deploymentUnit,
      "--replicas", "2",
      "--protect",
      "--change-desc", "Keep two Prometheus replicas through the upstream chart upgrade",
      "--wait",
      "-o", "mutations",
    ], { timeout: 420_000 });
    check(userChangeOutput.includes("spec.replicas"), "the protected change did not report spec.replicas");
    const changedBase = deploymentState(spaces.base);
    assertDeployment(changedBase, { version: current.version, appVersion: current.appVersion, replicas: 2 });

    cub([
      "variant", "create", "staging", spaces.base,
      "--space-pattern", `template:${spaces.staging}`,
      "--environment", "Staging",
      "--wait",
    ], { timeout: 420_000 });
    createdSpaces.push(spaces.staging);
    cleanup.staging = "pending";
    const stagingBeforeUpgrade = deploymentState(spaces.staging);
    assertDeployment(stagingBeforeUpgrade, { version: current.version, appVersion: current.appVersion, replicas: 2 });

    cub([
      "installer", "setup",
      "--pull", candidate.ref,
      "--work-dir", workDir,
      "--reuse",
      "--non-interactive",
      "--clean",
    ], { timeout: 420_000 });
    check(countManifestFiles(workDir) === 7, "the candidate package did not render seven manifests");
    const renderedCandidate = renderedDeployment(workDir);
    assertDeployment(renderedCandidate, { version: candidate.version, appVersion: candidate.appVersion, replicas: 1 });

    const reconcilePlan = cub(["installer", "plan", "--work-dir", workDir], { timeout: 420_000 });
    check(reconcilePlan.includes("prometheus-29.8.0"), "the reconcile plan did not name the current chart version");
    check(reconcilePlan.includes("prometheus-29.9.0"), "the reconcile plan did not name the candidate chart version");
    check(!reconcilePlan.includes("spec.replicas"), "the reconcile plan tried to reset the protected replica field");

    cub(["installer", "upload", "--work-dir", workDir, "--yes"], { timeout: 600_000 });
    const upgradedBase = deploymentState(spaces.base);
    assertDeployment(upgradedBase, { version: candidate.version, appVersion: candidate.appVersion, replicas: 2 });

    const stagingBeforePreview = deploymentState(spaces.staging);
    const previewOutput = cub([
      "variant", "promote", spaces.staging,
      "--dry-run",
      "-o", "mutations",
    ], { timeout: 420_000 });
    check(previewOutput.includes("prometheus-29.9.0"), "the promotion preview did not show the new chart version");
    check(previewOutput.includes("quay.io/prometheus/prometheus:v3.12.0"), "the promotion preview did not show the new image");
    check(!previewOutput.includes("spec.replicas"), "the promotion preview tried to reset the protected replica field");
    const stagingAfterPreview = deploymentState(spaces.staging);
    check(
      stagingAfterPreview.objectSha256 === stagingBeforePreview.objectSha256,
      "the dry-run promotion changed stored staging data",
    );

    cub([
      "variant", "promote", spaces.staging,
      "--change-desc", "Promote tested Prometheus 29.9.0 configuration to staging",
    ], { timeout: 420_000 });
    const stagingAfterPromotion = deploymentState(spaces.staging);
    assertDeployment(stagingAfterPromotion, { version: candidate.version, appVersion: candidate.appVersion, replicas: 2 });

    return {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "PrometheusUpgradePreservationReceipt",
      metadata: { name: "prometheus-server-only-ephemeral-29-8-0-to-29-9-0" },
      spec: {
        recordedAt,
        context: {
          organization: contextInfo.metadata.organizationName,
          server: contextInfo.coordinate?.serverURL,
        },
        tools: {
          cubClient: versions.client,
          configHubServer: versions.server,
          installer: installerVersion,
        },
        source: {
          chart,
          base: baseName,
          namespace,
          current,
          candidate,
        },
        userChange: {
          resource: "apps/v1/Deployment monitoring/prometheus-server",
          field: "spec.replicas",
          chartValue: 1,
          reviewedValue: 2,
          protected: true,
          result: "pass",
        },
        baseUpgrade: {
          before: importedBase,
          afterUserChange: changedBase,
          renderedCandidate,
          afterReconcile: upgradedBase,
          planSha256: sha256(reconcilePlan),
          planShowedSourceChanges: true,
          planTriedToResetReplicas: false,
          result: "pass",
        },
        stagingPromotion: {
          beforeUpgrade: stagingBeforeUpgrade,
          beforePreview: stagingBeforePreview,
          afterPreview: stagingAfterPreview,
          afterPromotion: stagingAfterPromotion,
          previewSha256: sha256(previewOutput),
          previewShowedSourceChanges: true,
          previewTriedToResetReplicas: false,
          dryRunChangedStoredData: false,
          result: "pass",
        },
        cleanup,
        limits: [
          "This run used ConfigHub records only. It did not deliver Prometheus to Kubernetes.",
          "The run used the chart's monitoring namespace for both versions. Custom-namespace upgrade behavior is not part of this receipt.",
          "The selected preset has no Helm hooks or CRDs, so this receipt does not test lifecycle work.",
          "This proves one protected Deployment field across one Prometheus source upgrade and one staging promotion. It does not prove every field or chart.",
        ],
      },
      status: {
        result: "pass",
        claim: "A protected replica change remained at two while Prometheus moved from chart 29.8.0 to 29.9.0, first in the base and then through a previewed staging promotion.",
      },
    };
  } finally {
    if (process.env.HELM_EXPT_KEEP_PROOF_RESOURCES !== "1") {
      for (const space of createdSpaces.reverse()) {
        const key = space === spaces.base ? "base" : "staging";
        try {
          cub(["space", "delete", space, "--recursive-force"], { timeout: 420_000 });
          cleanup[key] = "pass";
        } catch {
          cleanup[key] = "failed";
        }
      }
      rmSync(workDir, { recursive: true, force: true });
      cleanup.workDir = "pass";
    } else {
      cleanup.base = createdSpaces.includes(spaces.base) ? "kept" : cleanup.base;
      cleanup.staging = createdSpaces.includes(spaces.staging) ? "kept" : cleanup.staging;
      cleanup.workDir = "kept";
    }
  }
}

function validateReceipt(receipt) {
  check(receipt.kind === "PrometheusUpgradePreservationReceipt", "receipt kind is wrong");
  check(receipt.status?.result === "pass", "proof did not pass");
  check(receipt.spec?.source?.chart === chart, "receipt chart is wrong");
  check(receipt.spec?.source?.current?.manifestDigest === current.manifestDigest, "current package digest drifted");
  check(receipt.spec?.source?.candidate?.manifestDigest === candidate.manifestDigest, "candidate package digest drifted");
  check(receipt.spec?.userChange?.protected === true, "the object edit was not protected");
  check(receipt.spec?.userChange?.reviewedValue === 2, "the reviewed replica value is wrong");
  check(receipt.spec?.baseUpgrade?.afterReconcile?.replicas === 2, "base upgrade lost the replica change");
  check(receipt.spec?.baseUpgrade?.afterReconcile?.chartVersion === candidate.version, "base did not reach the candidate chart");
  check(receipt.spec?.baseUpgrade?.planTriedToResetReplicas === false, "base plan tried to reset replicas");
  check(receipt.spec?.stagingPromotion?.beforePreview?.chartVersion === current.version, "staging did not begin at the current chart");
  check(receipt.spec?.stagingPromotion?.afterPreview?.objectSha256 === receipt.spec?.stagingPromotion?.beforePreview?.objectSha256, "dry run changed staging");
  check(receipt.spec?.stagingPromotion?.afterPromotion?.replicas === 2, "promotion lost the replica change");
  check(receipt.spec?.stagingPromotion?.afterPromotion?.chartVersion === candidate.version, "staging did not reach the candidate chart");
  check(receipt.spec?.stagingPromotion?.previewTriedToResetReplicas === false, "preview tried to reset replicas");
  check(receipt.spec?.cleanup?.base === "pass", "base Space cleanup did not pass");
  check(receipt.spec?.cleanup?.staging === "pass", "staging Space cleanup did not pass");
  check(receipt.spec?.cleanup?.workDir === "pass", "local cleanup did not pass");
}

function deploymentState(space) {
  const rows = cubJson([
    "resource", "list",
    "--space", space,
    "--where", "ResourceType = 'apps/v1/Deployment'",
    "-o", "json",
  ]);
  check(rows.length === 1, `${space} has ${rows.length} Deployment resources instead of one`);
  return stateFromDeployment(rows[0].Resource.Data);
}

function renderedDeployment(workDir) {
  const path = join(workDir, "out", "manifests", "deployment-monitoring-prometheus-server.yaml");
  check(existsSync(path), "the rendered Prometheus Deployment is missing");
  return stateFromDeployment(readYaml(path));
}

function stateFromDeployment(deployment) {
  const image = deployment.spec?.template?.spec?.containers
    ?.find((container) => container.name === "prometheus-server")?.image;
  const chartVersion = String(deployment.metadata?.labels?.["helm.sh/chart"] ?? "")
    .replace(/^prometheus-/, "");
  const appVersion = String(deployment.metadata?.labels?.["app.kubernetes.io/version"] ?? "");
  return {
    resource: `${deployment.apiVersion}/${deployment.kind} ${deployment.metadata?.namespace}/${deployment.metadata?.name}`,
    chartVersion,
    appVersion,
    replicas: deployment.spec?.replicas,
    image,
    objectSha256: sha256(JSON.stringify(deployment)),
  };
}

function assertDeployment(state, expected) {
  check(state.chartVersion === expected.version, `expected chart ${expected.version}, found ${state.chartVersion}`);
  check(state.appVersion === expected.appVersion, `expected app ${expected.appVersion}, found ${state.appVersion}`);
  check(state.replicas === expected.replicas, `expected ${expected.replicas} replicas, found ${state.replicas}`);
}

function countManifestFiles(workDir) {
  return readdirSync(join(workDir, "out", "manifests"))
    .filter((name) => name.endsWith(".yaml") || name.endsWith(".yml")).length;
}

function spacePresent(space) {
  const result = runCub(["space", "get", space, "-o", "json"], { allowFailure: true });
  return result.status === 0;
}

function cub(args, options = {}) {
  const result = runCub(args, options);
  if (result.status !== 0) {
    throw new Error(`cub ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function cubJson(args, options = {}) {
  return JSON.parse(cub(args, options));
}

function runCub(args, options = {}) {
  return spawnSync("cub", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    maxBuffer: 1024 * 1024 * 100,
    timeout: options.timeout ?? 120_000,
  });
}

function parseCubVersions(output) {
  const client = output.match(/Client Version:[\s\S]*?Version:\s+v?([^\s]+)/)?.[1] ?? "";
  const server = output.match(/Server Version:[\s\S]*?Version:\s+v?([^\s]+)/)?.[1] ?? "";
  check(client && server, "could not parse cub client and server versions");
  return { client, server };
}

function versionAtLeast(actual, minimum) {
  const left = actual.split(".").map(Number);
  const right = minimum.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

function renderSummary(receipt) {
  const source = receipt.spec.source;
  const base = receipt.spec.baseUpgrade;
  const promotion = receipt.spec.stagingPromotion;
  return `# Prometheus upgrade preservation proof

This live ConfigHub run kept one reviewed Kubernetes edit while the upstream Prometheus chart changed.

## Result

- Chart: \`${source.chart}\`
- Preset config: \`${source.base}\`
- Upgrade: \`${source.current.version}\` to \`${source.candidate.version}\`
- Reviewed edit: \`Deployment/monitoring/prometheus-server spec.replicas\`, from \`1\` to \`2\`
- Base after upgrade: chart \`${base.afterReconcile.chartVersion}\`, image \`${base.afterReconcile.image}\`, replicas \`${base.afterReconcile.replicas}\`
- Staging after promotion: chart \`${promotion.afterPromotion.chartVersion}\`, image \`${promotion.afterPromotion.image}\`, replicas \`${promotion.afterPromotion.replicas}\`

The installer rendered the candidate chart with its normal one-replica value. ConfigHub had already recorded the two-replica edit as a protected local change. The upgrade plan changed the chart labels and Prometheus image but did not reset \`spec.replicas\`.

The staging promotion was previewed first. The preview showed the chart and image changes, did not include a replica reset, and did not change stored staging data. The real promotion then moved staging to chart \`${source.candidate.version}\` while keeping two replicas.

## Exact packages

| Version | OCI manifest | Package layer |
| --- | --- | --- |
| \`${source.current.version}\` | \`${source.current.manifestDigest}\` | \`${source.current.layerDigest}\` |
| \`${source.candidate.version}\` | \`${source.candidate.manifestDigest}\` | \`${source.candidate.layerDigest}\` |

## Limits

${receipt.spec.limits.map((limit) => `- ${limit}`).join("\n")}

The machine receipt is [\`runs/prometheus-upgrade-preservation-proof/receipt.yaml\`](../../runs/prometheus-upgrade-preservation-proof/receipt.yaml).
`;
}
