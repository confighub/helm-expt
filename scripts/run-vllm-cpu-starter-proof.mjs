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
const receiptPath = join(repoRoot, "runs", "vllm-cpu-starter-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "vllm-cpu-starter-proof", "summary.md");
const exampleDir = join(repoRoot, "examples", "inference", "vllm-cpu-starter");
const sourceReceiptPath = join(
  repoRoot,
  "data",
  "certified-bundles",
  "receipts",
  "eks-inference",
  "inference-workloads",
  "receipt.yaml",
);
const sourceSpace = "inference-workloads-workshop-proof";
const variantSpace = "vllm-cpu-proof";
const cluster = "hx-vllm-proof";
const expectedUnits = ["00-namespace", "chat", "smoke-cpu", "smoke-gpu", "vllm-qwen"];
const expectedChangedUnits = ["chat", "vllm-qwen"];
const model = "Qwen/Qwen2.5-0.5B-Instruct";
const modelRevision = "7ae557604adf67be50417f59c2c2f167def9a775";
const imageDigest = "sha256:e6745d7ba6610f637c6f22fc06cd730342e50245b6c46767235600483adfbbde";

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
    `${relativeRepo(summaryPath)} is stale; run npm run vllm-cpu-starter:generate`,
  );
  console.log("verified vLLM CPU starter proof");
} else {
  console.error(`Usage: node ${relativeRepo(import.meta.filename)} --run|--generate|--verify`);
  process.exitCode = 2;
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  const kubeconfig = process.env.HELM_EXPT_VLLM_KUBECONFIG?.trim() ?? "";
  check(context, "set CUB_CONTEXT to the authenticated ConfigHub context");
  check(kubeconfig, "set HELM_EXPT_VLLM_KUBECONFIG to the proof cluster kubeconfig");
  for (const [tool, args] of [
    ["cub", ["version"]],
    ["cub-scout", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["kind", ["version"]],
  ]) {
    check(commandWorks(tool, args), `${tool} is required for this proof`);
  }

  const contextInfo = cubJson(context, ["context", "get", context, "-o", "json"]);
  check(contextInfo.metadata?.organizationName === "helm-catalog", "proof must use helm-catalog");
  const sourceReceipt = readYaml(sourceReceiptPath);
  const expectedSource = {
    reference: `oci://${sourceReceipt.spec.bundle.reference.replace(/^oci:\/\//, "").replace(/:latest$/, "")}`,
    digest: sourceReceipt.spec.bundle.manifestDigest,
    receipt: relativeRepo(sourceReceiptPath),
  };

  const source = inspectSpace(context, sourceSpace);
  const variant = inspectSpace(context, variantSpace);
  for (const record of [source, variant]) {
    check(record.source.reference === expectedSource.reference, `${record.space} has the wrong source reference`);
    check(record.source.digest === expectedSource.digest, `${record.space} has the wrong source digest`);
    check(JSON.stringify(record.unitSlugs) === JSON.stringify(expectedUnits), `${record.space} has the wrong Unit set`);
  }
  check(variant.upstreamSpaceId === source.spaceId, `${variantSpace} does not point at ${sourceSpace}`);
  const changed = changedUnits(source, variant);
  check(JSON.stringify(changed) === JSON.stringify(expectedChangedUnits), "the CPU variant changed an unexpected Unit");

  const localChat = parseDocs(readFileSync(join(exampleDir, "chat.yaml"), "utf8"));
  const localVllm = parseDocs(readFileSync(join(exampleDir, "vllm-qwen.yaml"), "utf8"));
  check(sameDocuments(variant.documents.chat, localChat), "the ConfigHub chat Unit differs from the checked example");
  check(sameDocuments(variant.documents["vllm-qwen"], localVllm), "the ConfigHub vllm-qwen Unit differs from the checked example");

  const intent = readYaml(join(exampleDir, "source-and-intent.yaml"));
  check(intent.kind === "SourceAndIntentRecord", "the example source-and-intent record has the wrong kind");
  check(intent.spec.source.digest === expectedSource.digest, "the example source-and-intent digest is stale");
  check(intent.spec.runtime.image.digest === imageDigest, "the example image digest is stale");
  check(intent.spec.runtime.model.identity === model, "the example model identity is stale");
  check(intent.spec.runtime.model.revision === modelRevision, "the example model revision is stale");

  const release = latestRelease(context, variantSpace);
  const target = inspectTarget(context);
  check(variant.releaseTargetId === target.targetId, `${variantSpace} is not bound to the proof target`);

  const currentContext = kubeText(kubeconfig, ["config", "current-context"]).trim();
  check(currentContext === `kind-${cluster}`, `unexpected kube context ${currentContext}`);
  const kindClusters = textCommand("kind", ["get", "clusters"]).trim().split("\n").filter(Boolean);
  check(kindClusters.includes(cluster), `${cluster} is not an active kind cluster`);

  const nodes = kubeJson(kubeconfig, ["get", "nodes", "-o", "json"]).items;
  check(nodes.length > 0, "proof cluster has no node");
  check(nodes.every((node) => node.status?.nodeInfo?.architecture === "arm64"), "proof target is not ARM64");
  check(nodes.every(nodeReady), "a proof node is not Ready");

  const application = kubeJson(kubeconfig, ["get", "application", variantSpace, "-n", "argocd", "-o", "json"]);
  check(application.status?.sync?.status === "Synced", "Argo Application is not Synced");
  check(application.status?.health?.status === "Healthy", "Argo Application is not Healthy");
  check(application.status?.operationState?.phase === "Succeeded", "Argo operation did not succeed");
  check(
    application.status?.sync?.revision === release.ManifestDigest,
    "Argo revision does not match the ConfigHub Release manifest digest",
  );

  const vllmDeployment = kubeJson(kubeconfig, ["get", "deployment", "vllm-qwen", "-n", "inference", "-o", "json"]);
  const chatDeployment = kubeJson(kubeconfig, ["get", "deployment", "chat", "-n", "inference", "-o", "json"]);
  const vllmPods = kubeJson(kubeconfig, ["get", "pods", "-n", "inference", "-l", "app=vllm-qwen", "-o", "json"]).items;
  const chatPods = kubeJson(kubeconfig, ["get", "pods", "-n", "inference", "-l", "app=chat", "-o", "json"]).items;
  check(vllmDeployment.spec?.replicas === 1, "vLLM desired replicas must be one");
  check(vllmDeployment.status?.availableReplicas === 1, "vLLM must have one available replica");
  check(chatDeployment.status?.availableReplicas === 1, "chat client must have one available replica");
  check(vllmPods.length === 1 && vllmPods.every(podReady), "vLLM pod is not Ready");
  check(chatPods.length === 1 && chatPods.every(podReady), "chat client pod is not Ready");
  const image = vllmDeployment.spec?.template?.spec?.containers?.find((container) => container.name === "vllm")?.image ?? "";
  const imageId = vllmPods[0].status?.containerStatuses?.find((container) => container.name === "vllm")?.imageID ?? "";
  check(image.endsWith(`@${imageDigest}`), "vLLM Deployment does not pin the expected image digest");
  check(imageId.endsWith(`@${imageDigest}`), "running vLLM image ID differs from the expected digest");

  const response = JSON.parse(kubeText(kubeconfig, [
    "exec",
    "-n",
    "inference",
    "deployment/chat",
    "--",
    "request-model",
  ]));
  const answer = response.choices?.[0]?.message?.content?.trim() ?? "";
  check(response.model === model, "the response names another model");
  check(response.choices?.[0]?.finish_reason === "stop", "the model request did not finish normally");
  check(answer.length > 0, "the model returned an empty answer");
  check((response.usage?.total_tokens ?? 0) > 0, "the model response has no token count");

  const gitops = JSON.parse(textCommand("cub-scout", ["gitops", "status", "--json"], { KUBECONFIG: kubeconfig }));
  const scoutApp = gitops.deployers.find((deployer) => deployer.name === variantSpace);
  check(scoutApp?.ready === true, "cub-scout did not report the Application ready");
  check(scoutApp.lastAttemptedRevision === release.ManifestDigest, "cub-scout reported another revision");
  const scan = JSON.parse(textCommand("cub-scout", ["scan", "-n", "inference", "--json"], { KUBECONFIG: kubeconfig }));
  check(scan.state?.summary?.total === 0, "cub-scout reported a runtime finding");

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "VllmCpuStarterProofReceipt",
    metadata: {
      name: "eks-inference-vllm-cpu-starter",
    },
    spec: {
      recordedAt: new Date().toISOString(),
      context: {
        name: context,
        organization: contextInfo.metadata.organizationName,
      },
      tools: {
        ...parseCubVersions(cubText(context, ["version"])),
        kubernetesContext: currentContext,
        gitopsController: "Argo CD",
      },
      source: expectedSource,
      configuration: {
        sourceSpace,
        variantSpace,
        sourceSpaceId: source.spaceId,
        variantSpaceId: variant.spaceId,
        upstreamSpaceId: variant.upstreamSpaceId,
        unitCount: variant.unitSlugs.length,
        changedUnits: changed,
        sourceUnitHashes: source.unitHashes,
        variantUnitHashes: variant.unitHashes,
        checkedFiles: [
          "examples/inference/vllm-cpu-starter/chat.yaml",
          "examples/inference/vllm-cpu-starter/vllm-qwen.yaml",
          "examples/inference/vllm-cpu-starter/source-and-intent.yaml",
        ],
        checkedFilesMatchConfigHub: true,
      },
      runtime: {
        image,
        imageDigest,
        observedImageId: imageId,
        architecture: nodes[0].status.nodeInfo.architecture,
        model,
        modelRevision,
        device: "cpu",
      },
      release: releaseRecord(release),
      target,
      argo: {
        application: variantSpace,
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
        nodeCount: nodes.length,
        readyNodeCount: nodes.filter(nodeReady).length,
        vllm: {
          desiredReplicas: vllmDeployment.spec.replicas,
          availableReplicas: vllmDeployment.status.availableReplicas,
          readyPods: vllmPods.filter(podReady).length,
        },
        client: {
          desiredReplicas: chatDeployment.spec.replicas,
          availableReplicas: chatDeployment.status.availableReplicas,
          readyPods: chatPods.filter(podReady).length,
        },
      },
      inference: {
        api: "OpenAI-compatible chat completions",
        prompt: "What is two plus two? Reply with only the number.",
        model: response.model,
        answer,
        finishReason: response.choices[0].finish_reason,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
      observation: {
        cubScoutBackend: gitops.backend,
        cubScoutTransport: gitops.transport,
        applicationReady: scoutApp.ready,
        lastAttemptedRevision: scoutApp.lastAttemptedRevision,
        runtimeFindingCount: scan.state.summary.total,
      },
      limits: [
        "This proof used one local ARM64 kind cluster and Argo CD. It does not prove EKS, Flux, or a multi-cluster rollout.",
        "This is a functional CPU test of one small public model. It does not prove NVIDIA GPU readiness, the 7B AWQ model, production capacity, latency, response quality, or model accuracy.",
        "The model and image were public and needed no credentials. This proof does not exercise private model access, Secret delivery, or credential rotation.",
      ],
    },
    status: {
      result: "pass",
      configurationRetained: "pass",
      releasePublished: "pass",
      argoOciDelivery: "pass",
      clusterReady: "pass",
      workloadReady: "pass",
      modelRequest: "pass",
      claim: "ConfigHub retained a two-Unit CPU runtime change to the checked EKS inference source, published it as OCI, Argo CD pulled the same manifest digest, Kubernetes made the pinned vLLM image ready, and one request returned a non-empty response from the pinned model revision.",
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
  return {
    space: slug,
    spaceId: space.SpaceID,
    upstreamSpaceId: space.Annotations?.UpstreamSpaceID ?? null,
    releaseTargetId: space.ReleaseTargetID ?? null,
    source: externalSource(space),
    unitSlugs: units.map((unit) => unit.Slug),
    unitHashes: units.map((unit) => ({ slug: unit.Slug, dataHash: unit.DataHash })),
    documents: Object.fromEntries(
      expectedChangedUnits.map((unit) => [unit, parseDocs(cubText(context, ["unit", "data", unit, "--space", slug]))]),
    ),
  };
}

function inspectTarget(context) {
  const target = cubJson(context, ["target", "list", "--space", cluster, "-o", "json"])[0]?.Target;
  const triggers = cubJson(context, ["trigger", "list", "--space", cluster, "-o", "json"])
    .map((row) => row.Trigger);
  const placeholder = triggers.find((trigger) => trigger.FunctionName === "vet-placeholders");
  check(target?.ProviderType === "OCI", "proof target is not OCI");
  check(target?.ToolchainType === "Any", "proof target is not toolchain-neutral");
  check(placeholder?.Validating === true, "proof target lacks a blocking placeholder gate");
  return {
    space: cluster,
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

function latestRelease(context, space) {
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

function sameDocuments(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function nodeReady(node) {
  return node.status?.conditions?.some((condition) => condition.type === "Ready" && condition.status === "True");
}

function podReady(pod) {
  return pod.status?.phase === "Running"
    && pod.status?.conditions?.some((condition) => condition.type === "Ready" && condition.status === "True");
}

function verifyReceipt(receipt) {
  check(receipt.apiVersion === "catalog.confighub.com/v1alpha1", "unexpected receipt apiVersion");
  check(receipt.kind === "VllmCpuStarterProofReceipt", "unexpected receipt kind");
  check(receipt.status?.result === "pass", "vLLM CPU starter proof did not pass");
  check(receipt.spec?.context?.organization === "helm-catalog", "proof did not use helm-catalog");
  const sourceReceipt = readYaml(sourceReceiptPath);
  check(receipt.spec.source.digest === sourceReceipt.spec.bundle.manifestDigest, "source digest is stale");
  check(
    JSON.stringify(receipt.spec.configuration.changedUnits) === JSON.stringify(expectedChangedUnits),
    "receipt changed an unexpected Unit",
  );
  check(receipt.spec.configuration.checkedFilesMatchConfigHub === true, "checked files differ from ConfigHub");
  check(receipt.spec.runtime.imageDigest === imageDigest, "runtime image digest is stale");
  check(receipt.spec.runtime.observedImageId.endsWith(`@${imageDigest}`), "observed image digest differs");
  check(receipt.spec.runtime.model === model, "runtime model differs");
  check(receipt.spec.runtime.modelRevision === modelRevision, "runtime model revision differs");
  check(receipt.spec.runtime.architecture === "arm64", "runtime architecture differs");
  check(receipt.spec.release.published === true, "ConfigHub Release was not published");
  check(receipt.spec.release.unitCount === expectedUnits.length, "ConfigHub Release has the wrong Unit count");
  check(receipt.spec.target.providerType === "OCI", "target is not OCI");
  check(receipt.spec.target.gate.function === "vet-placeholders", "placeholder gate is missing");
  check(
    receipt.spec.argo.observedRevision === receipt.spec.release.manifestDigest,
    "Argo revision differs from the Release manifest digest",
  );
  check(receipt.spec.argo.sync === "Synced", "Argo was not Synced");
  check(receipt.spec.argo.health === "Healthy", "Argo was not Healthy");
  check(receipt.spec.argo.operation === "Succeeded", "Argo operation did not succeed");
  check(receipt.spec.kubernetes.readyNodeCount === receipt.spec.kubernetes.nodeCount, "a target node was not Ready");
  check(receipt.spec.kubernetes.vllm.readyPods === 1, "vLLM pod was not Ready");
  check(receipt.spec.kubernetes.client.readyPods === 1, "client pod was not Ready");
  check(receipt.spec.inference.model === model, "model response identity differs");
  check(receipt.spec.inference.finishReason === "stop", "model response did not finish normally");
  check(receipt.spec.inference.answer.length > 0, "model response was empty");
  check(receipt.spec.inference.totalTokens > 0, "model response has no tokens");
  check(receipt.spec.observation.runtimeFindingCount === 0, "cub-scout reported a runtime finding");
  check(receipt.spec.limits.length >= 3, "proof limits are missing");
  const serialized = JSON.stringify(receipt);
  check(!/ch_[a-z0-9]{20,}/i.test(serialized), "receipt contains a credential");
  check(!serialized.includes("/Users/"), "receipt contains a local path");
}

function renderSummary(receipt) {
  const lines = [];
  lines.push("# vLLM CPU starter proof");
  lines.push("");
  lines.push(
    "This example starts with the checked EKS inference workload package, replaces its GPU model server with a small CPU profile, and runs one real request.",
  );
  lines.push("");
  lines.push("## Result");
  lines.push("");
  lines.push("| Step | Checked result |");
  lines.push("| --- | --- |");
  lines.push(
    `| Keep the source | ConfigHub retained the exact source OCI digest and changed only \`${receipt.spec.configuration.changedUnits.join("\` and \`")}\`. |`,
  );
  lines.push(`| Publish | ConfigHub published Release #${receipt.spec.release.number} with manifest \`${receipt.spec.release.manifestDigest}\`. |`);
  lines.push(`| Deliver | Argo CD reported \`${receipt.spec.argo.sync}\` and \`${receipt.spec.argo.health}\` at that same manifest digest. |`);
  lines.push(`| Start the runtime | Kubernetes ran one ready vLLM pod on ${receipt.spec.runtime.architecture} with image digest \`${receipt.spec.runtime.imageDigest}\`. |`);
  lines.push(`| Ask the model | \`${receipt.spec.inference.model}\` returned \`${receipt.spec.inference.answer}\` and used ${receipt.spec.inference.totalTokens} tokens. |`);
  lines.push(`| Check the target | cub-scout found ${receipt.spec.observation.runtimeFindingCount} runtime issues. |`);
  lines.push("");
  lines.push(
    "The Kubernetes files in the example match the two changed ConfigHub Units. The source-and-intent record names the original package, image, model revision, request, lifecycle order, and limits.",
  );
  lines.push("");
  lines.push("## Run the accessible example");
  lines.push("");
  lines.push(
    "Read [the starter README](../../examples/inference/vllm-cpu-starter/README.md) for the direct Kubernetes path. It needs an ARM64 cluster with enough CPU and memory, but no GPU, cloud account, ConfigHub account, or model credential.",
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
    cubClient: output.match(/Client Version:\s*\n\s*Version:\s*(v[^\s]+)/)?.[1] ?? "unknown",
    confighubServer: output.match(/Server Version:[\s\S]*?Version:\s*(v[^\s]+)/)?.[1] ?? "unknown",
  };
}
