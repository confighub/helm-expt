#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "eks-inference-promotion-delivery-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "eks-inference-promotion-delivery-proof", "summary.md");
const spaces = {
  source: "inference-workloads-workshop-proof",
  dev: "inference-workloads-workshop-dev",
  staging: "inference-workloads-workshop-staging",
  delivery: "inference-workloads-workshop-delivery",
};
const cluster = "hx-eksinf-proof";
const appName = spaces.delivery;
const expectedUnits = ["00-namespace", "chat", "smoke-cpu", "smoke-gpu", "vllm-qwen"];

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
    `${relativeRepo(summaryPath)} is stale; run npm run eks-inference-promotion-delivery:generate`,
  );
  console.log("verified EKS inference promotion and Argo delivery proof");
} else {
  console.error(`Usage: node ${relativeRepo(import.meta.filename)} --run|--generate|--verify`);
  process.exitCode = 2;
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  const kubeconfig = process.env.HELM_EXPT_EKSINF_KUBECONFIG?.trim() ?? "";
  check(context, "set CUB_CONTEXT to the authenticated ConfigHub context");
  check(kubeconfig, "set HELM_EXPT_EKSINF_KUBECONFIG to the proof cluster kubeconfig");
  const toolChecks = [
    ["cub", ["version"]],
    ["cub-scout", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["kind", ["version"]],
  ];
  for (const [tool, args] of toolChecks) {
    check(commandWorks(tool, args), `${tool} is required for this proof`);
  }

  const contextInfo = cubJson(context, ["context", "get", context, "-o", "json"]);
  check(contextInfo.metadata?.organizationName === "helm-catalog", "proof must use helm-catalog");
  const cubVersions = parseCubVersions(cubText(context, ["version"]));
  const sourceReceipt = readYaml(
    join(
      repoRoot,
      "data",
      "certified-bundles",
      "receipts",
      "eks-inference",
      "inference-workloads",
      "receipt.yaml",
    ),
  );
  const expectedSource = {
    reference: `oci://${sourceReceipt.spec.bundle.reference.replace(/^oci:\/\//, "").replace(/:latest$/, "")}`,
    digest: sourceReceipt.spec.bundle.manifestDigest,
    receipt: "data/certified-bundles/receipts/eks-inference/inference-workloads/receipt.yaml",
  };

  const variants = Object.fromEntries(
    Object.entries(spaces).map(([role, slug]) => [role, inspectSpace(context, slug)]),
  );
  for (const [role, record] of Object.entries(variants)) {
    check(record.source.reference === expectedSource.reference, `${role} has the wrong source reference`);
    check(record.source.digest === expectedSource.digest, `${role} has the wrong source digest`);
    check(JSON.stringify(record.unitSlugs) === JSON.stringify(expectedUnits), `${role} has the wrong Unit set`);
  }
  check(changedUnits(variants.source, variants.dev).join(",") === "chat", "dev must change only chat");
  check(equalUnitHashes(variants.dev, variants.staging), "staging does not match the reviewed dev state");
  check(equalUnitHashes(variants.staging, variants.delivery), "delivery does not match promoted staging");
  check(variants.dev.chat.replicas === 2, "dev chat replicas must be two");
  check(variants.staging.chat.replicas === 2, "staging chat replicas must be two");
  check(variants.delivery.chat.replicas === 2, "delivery chat replicas must be two");
  check(variants.source.chat.replicas === 1, "source chat replicas must remain one");
  check(
    variants.staging.chat.lastChangeDescription === "Promote the reviewed two-client configuration to staging",
    "staging does not carry the recorded promotion description",
  );
  check(
    variants.staging.chat.upstreamRevision === variants.dev.chat.headRevision,
    "staging is behind dev",
  );

  const stagingRelease = release(context, spaces.staging);
  const deliveryRelease = release(context, spaces.delivery);
  const target = inspectTarget(context);
  check(variants.delivery.releaseTargetId === target.targetId, "delivery Space is not bound to the proof target");

  const currentContext = kubeText(kubeconfig, ["config", "current-context"]).trim();
  check(currentContext === `kind-${cluster}`, `unexpected kube context ${currentContext}`);
  const kindClusters = textCommand("kind", ["get", "clusters"]).trim().split("\n").filter(Boolean);
  check(kindClusters.includes(cluster), `${cluster} is not an active kind cluster`);
  const application = kubeJson(kubeconfig, ["get", "application", appName, "-n", "argocd", "-o", "json"]);
  check(application.status?.sync?.status === "Synced", "Argo Application is not Synced");
  check(application.status?.health?.status === "Healthy", "Argo Application is not Healthy");
  check(application.status?.operationState?.phase === "Succeeded", "Argo operation did not succeed");
  check(
    application.status?.sync?.revision === deliveryRelease.ManifestDigest,
    "Argo revision does not match the ConfigHub Release manifest digest",
  );

  const chatDeployment = kubeJson(kubeconfig, ["get", "deployment", "chat", "-n", "inference", "-o", "json"]);
  const inactive = ["smoke-cpu", "smoke-gpu", "vllm-qwen"].map((name) => {
    const deployment = kubeJson(kubeconfig, ["get", "deployment", name, "-n", "inference", "-o", "json"]);
    return {
      name,
      desiredReplicas: deployment.spec?.replicas ?? 0,
      availableReplicas: deployment.status?.availableReplicas ?? 0,
    };
  });
  const pods = kubeJson(kubeconfig, [
    "get",
    "pods",
    "-n",
    "inference",
    "-l",
    "app=chat",
    "-o",
    "json",
  ]).items;
  check(chatDeployment.spec?.replicas === 2, "cluster chat desired replicas must be two");
  check(chatDeployment.status?.availableReplicas === 2, "cluster chat must have two available replicas");
  check(pods.length === 2, "cluster must have two chat pods");
  check(pods.every(podReady), "a chat pod is not Ready");
  check(inactive.every((row) => row.desiredReplicas === 0), "a GPU or smoke workload was activated");

  const gitops = JSON.parse(textCommand("cub-scout", ["gitops", "status", "--json"], { KUBECONFIG: kubeconfig }));
  const scoutApp = gitops.deployers.find((deployer) => deployer.name === appName);
  check(scoutApp?.ready === true, "cub-scout did not report the Application ready");
  check(scoutApp.lastAttemptedRevision === deliveryRelease.ManifestDigest, "cub-scout reported another revision");
  const scan = JSON.parse(
    textCommand("cub-scout", ["scan", "-n", "inference", "--json"], { KUBECONFIG: kubeconfig }),
  );
  check(scan.state?.summary?.total === 0, "cub-scout reported a runtime finding");

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "EksInferencePromotionDeliveryProofReceipt",
    metadata: {
      name: "inference-workloads-chat-two-replicas",
    },
    spec: {
      recordedAt: new Date().toISOString(),
      context: {
        name: context,
        organization: contextInfo.metadata.organizationName,
      },
      tools: {
        cubClient: cubVersions.client,
        confighubServer: cubVersions.server,
        kubernetesContext: currentContext,
        gitopsController: "Argo CD",
      },
      source: expectedSource,
      change: {
        unit: "chat",
        resource: "apps/v1 Deployment inference/chat",
        path: "spec.replicas",
        before: 1,
        after: 2,
        changedUnitCount: 1,
        changedUnits: changedUnits(variants.source, variants.dev),
        devChangeDescription: variants.dev.chat.lastChangeDescription,
      },
      promotion: {
        path: `${spaces.source} -> ${spaces.dev} -> ${spaces.staging}`,
        stagingChangeDescription: variants.staging.chat.lastChangeDescription,
        devUnitHashes: variants.dev.unitHashes,
        stagingUnitHashes: variants.staging.unitHashes,
        stagingMatchesDev: true,
        upstreamRevisionCurrent: true,
      },
      release: {
        staging: releaseRecord(stagingRelease),
        delivery: releaseRecord(deliveryRelease),
        deliveryUnitHashes: variants.delivery.unitHashes,
        deliveryMatchesStaging: true,
      },
      target,
      argo: {
        application: appName,
        repository: application.spec?.source?.repoURL,
        targetRevision: application.spec?.source?.targetRevision,
        observedRevision: application.status.sync.revision,
        sync: application.status.sync.status,
        health: application.status.health.status,
        operation: application.status.operationState.phase,
        releaseManifestDigestMatched: true,
      },
      kubernetes: {
        cluster,
        namespace: "inference",
        chat: {
          desiredReplicas: chatDeployment.spec.replicas,
          availableReplicas: chatDeployment.status.availableReplicas,
          readyPods: pods.filter(podReady).length,
          image: chatDeployment.spec?.template?.spec?.containers?.[0]?.image,
        },
        inactiveWorkloads: inactive,
      },
      observation: {
        cubScoutBackend: gitops.backend,
        cubScoutTransport: gitops.transport,
        applicationReady: scoutApp.ready,
        lastAttemptedRevision: scoutApp.lastAttemptedRevision,
        runtimeFindingCount: scan.state.summary.total,
      },
      limits: [
        "This proof used one local kind cluster and Argo CD. It does not prove Flux delivery or a multi-cluster rollout.",
        "The CPU check, GPU check, and vLLM deployments remained at zero replicas. This proof does not claim AWS provisioning, GPU readiness, model download, or an inference response.",
        "The change was intentionally small: one replica field in one Unit. Larger promotions still need source-aware classification and lifecycle checks.",
      ],
    },
    status: {
      result: "pass",
      oneFieldChange: "pass",
      promotion: "pass",
      exactDeliveryClone: "pass",
      releasePublication: "pass",
      argoOciDelivery: "pass",
      kubernetesConvergence: "pass",
      claim: "A one-field chat replica change was retained in dev, promoted to staging, cloned without data changes for delivery, published as ConfigHub OCI, pulled by Argo CD at the same manifest digest, and observed as two healthy Kubernetes replicas.",
    },
  };

  verifyReceipt(receipt);
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function inspectSpace(context, slug) {
  const space = cubJson(context, ["space", "get", slug, "-o", "json"]).Space;
  const units = cubJson(context, ["unit", "list", "--space", slug, "-o", "json"])
    .map((row) => row.Unit)
    .sort((left, right) => left.Slug.localeCompare(right.Slug));
  const chat = units.find((unit) => unit.Slug === "chat");
  check(chat, `${slug} has no chat Unit`);
  const chatDocs = parseDocs(cubText(context, ["unit", "data", "chat", "--space", slug]));
  const chatDeployment = chatDocs.find(
    (doc) => doc.apiVersion === "apps/v1" && doc.kind === "Deployment" && doc.metadata?.name === "chat",
  );
  check(chatDeployment, `${slug}/chat has no chat Deployment`);
  return {
    space: slug,
    spaceId: space.SpaceID,
    upstreamSpaceId: space.Annotations?.UpstreamSpaceID ?? null,
    releaseTargetId: space.ReleaseTargetID ?? null,
    source: externalSource(space),
    unitSlugs: units.map((unit) => unit.Slug),
    unitHashes: units.map((unit) => ({ slug: unit.Slug, dataHash: unit.DataHash })),
    chat: {
      dataHash: chat.DataHash,
      replicas: chatDeployment.spec.replicas,
      headRevision: chat.HeadRevisionNum,
      upstreamRevision: chat.UpstreamRevisionNum ?? null,
      lastChangeDescription: chat.LastChangeDescription ?? "",
    },
  };
}

function inspectTarget(context) {
  const targetSpace = cubJson(context, ["space", "get", cluster, "-o", "json"]).Space;
  const target = cubJson(context, ["target", "list", "--space", cluster, "-o", "json"])[0]?.Target;
  const triggers = cubJson(context, ["trigger", "list", "--space", cluster, "-o", "json"])
    .map((row) => row.Trigger);
  const placeholder = triggers.find((trigger) => trigger.FunctionName === "vet-placeholders");
  check(targetSpace, "proof target Space is missing");
  check(target?.ProviderType === "OCI", "proof target is not OCI");
  check(target?.ToolchainType === "Any", "proof target is not toolchain-neutral");
  check(placeholder?.Validating === true, "proof target lacks a blocking placeholder gate");
  return {
    space: cluster,
    spaceId: targetSpace.SpaceID,
    targetId: target.TargetID,
    providerType: target.ProviderType,
    toolchainType: target.ToolchainType,
    argoAppsSpace: target.Annotations?.["confighub.com/argo-apps-space"],
    gate: {
      slug: placeholder.Slug,
      function: placeholder.FunctionName,
      validating: placeholder.Validating,
    },
  };
}

function release(context, space) {
  const releases = cubJson(context, ["release", "list", "--space", space, "-o", "json"])
    .map((row) => row.Release)
    .sort((left, right) => right.ReleaseNum - left.ReleaseNum);
  check(releases.length > 0, `${space} has no Release`);
  check(releases[0].Published === true, `${space} latest Release is not published`);
  return releases[0];
}

function releaseRecord(value) {
  return {
    space: value.SpaceSlug,
    number: value.ReleaseNum,
    digest: value.Digest,
    manifestDigest: value.ManifestDigest,
    unitCount: value.UnitCount,
    published: value.Published,
    createdAt: value.CreatedAt,
  };
}

function externalSource(space) {
  const raw = space.Annotations?.["confighub.com/external-source"];
  check(raw, `${space.Slug} has no external source annotation`);
  const values = JSON.parse(raw);
  check(values.length === 1, `${space.Slug} must have one external source`);
  return { reference: values[0].ref, digest: values[0].digest };
}

function changedUnits(left, right) {
  const leftHashes = new Map(left.unitHashes.map((unit) => [unit.slug, unit.dataHash]));
  return right.unitHashes
    .filter((unit) => leftHashes.get(unit.slug) !== unit.dataHash)
    .map((unit) => unit.slug)
    .sort();
}

function equalUnitHashes(left, right) {
  return JSON.stringify(left.unitHashes) === JSON.stringify(right.unitHashes);
}

function podReady(pod) {
  return pod.status?.phase === "Running"
    && pod.status?.conditions?.some((condition) => condition.type === "Ready" && condition.status === "True");
}

function verifyReceipt(receipt) {
  check(receipt.apiVersion === "catalog.confighub.com/v1alpha1", "unexpected receipt apiVersion");
  check(receipt.kind === "EksInferencePromotionDeliveryProofReceipt", "unexpected receipt kind");
  check(receipt.status?.result === "pass", "promotion and delivery proof did not pass");
  check(receipt.spec?.context?.organization === "helm-catalog", "proof did not use helm-catalog");
  const sourceReceipt = readYaml(join(repoRoot, receipt.spec.source.receipt));
  check(receipt.spec.source.digest === sourceReceipt.spec.bundle.manifestDigest, "source digest is stale");
  check(receipt.spec.change.changedUnitCount === 1, "proof must change one Unit");
  check(JSON.stringify(receipt.spec.change.changedUnits) === JSON.stringify(["chat"]), "proof changed another Unit");
  check(receipt.spec.change.before === 1 && receipt.spec.change.after === 2, "unexpected replica change");
  check(receipt.spec.promotion.stagingMatchesDev === true, "staging differs from dev");
  check(receipt.spec.promotion.upstreamRevisionCurrent === true, "staging is behind dev");
  check(receipt.spec.release.deliveryMatchesStaging === true, "delivery differs from staging");
  check(receipt.spec.release.delivery.published === true, "delivery Release is not published");
  check(
    receipt.spec.argo.observedRevision === receipt.spec.release.delivery.manifestDigest,
    "Argo revision differs from the Release manifest digest",
  );
  check(receipt.spec.argo.sync === "Synced", "Argo was not Synced");
  check(receipt.spec.argo.health === "Healthy", "Argo was not Healthy");
  check(receipt.spec.argo.operation === "Succeeded", "Argo operation did not succeed");
  check(receipt.spec.kubernetes.chat.desiredReplicas === 2, "desired chat replicas differ");
  check(receipt.spec.kubernetes.chat.availableReplicas === 2, "available chat replicas differ");
  check(receipt.spec.kubernetes.chat.readyPods === 2, "ready chat pod count differs");
  check(
    receipt.spec.kubernetes.inactiveWorkloads.every((workload) => workload.desiredReplicas === 0),
    "a GPU or smoke workload was active",
  );
  check(receipt.spec.observation.runtimeFindingCount === 0, "cub-scout reported runtime findings");
  check(receipt.spec.target.providerType === "OCI", "target is not OCI");
  check(receipt.spec.target.gate.function === "vet-placeholders", "placeholder gate is missing");
  check(receipt.spec.limits.length >= 3, "proof limits are missing");
  check(!/ch_[a-z0-9]{20,}/i.test(JSON.stringify(receipt)), "receipt contains a credential");
}

function renderSummary(receipt) {
  const lines = [];
  lines.push("# EKS inference promotion and Argo delivery proof");
  lines.push("");
  lines.push(
    "This example changes one field in a checked inference configuration, promotes the reviewed result, publishes it as OCI, and verifies what Argo CD and Kubernetes received.",
  );
  lines.push("");
  lines.push("## Result");
  lines.push("");
  lines.push("| Step | Checked result |");
  lines.push("| --- | --- |");
  lines.push(`| Change | \`${receipt.spec.change.resource}\` changed from ${receipt.spec.change.before} replica to ${receipt.spec.change.after}. No other Unit changed. |`);
  lines.push("| Promote | Staging has the same five Unit hashes as the reviewed dev configuration. |");
  lines.push(`| Publish | ConfigHub published delivery Release #${receipt.spec.release.delivery.number} with manifest \`${receipt.spec.release.delivery.manifestDigest}\`. |`);
  lines.push(`| Deliver | Argo CD reported \`${receipt.spec.argo.sync}\` and \`${receipt.spec.argo.health}\` at that same manifest digest. |`);
  lines.push(`| Run | Kubernetes reported ${receipt.spec.kubernetes.chat.availableReplicas}/${receipt.spec.kubernetes.chat.desiredReplicas} chat replicas available; cub-scout found ${receipt.spec.observation.runtimeFindingCount} runtime issues. |`);
  lines.push("");
  lines.push(
    "The GPU check and vLLM configuration travelled through the same Release but stayed at zero replicas. That makes this a useful promotion and delivery test on a laptop, not a claim that a model ran.",
  );
  lines.push("");
  lines.push("## What this does not prove");
  lines.push("");
  for (const limit of receipt.spec.limits) lines.push(`- ${limit}`);
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
  return textCommand("cub", args, { CUB_CONTEXT: context, CONFIGHUB_AGENT: "1" });
}

function kubeJson(kubeconfig, args) {
  return JSON.parse(kubeText(kubeconfig, args));
}

function kubeText(kubeconfig, args) {
  return textCommand("kubectl", args, { KUBECONFIG: kubeconfig });
}

function textCommand(command, args, extraEnv = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...extraEnv },
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

function parseCubVersions(output) {
  return {
    client: output.match(/Client Version:\s*\n\s*Version:\s*(v[^\s]+)/)?.[1] ?? "unknown",
    server: output.match(/Server Version:[\s\S]*?Version:\s*(v[^\s]+)/)?.[1] ?? "unknown",
  };
}
