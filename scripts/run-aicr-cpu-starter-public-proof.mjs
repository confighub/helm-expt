#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AICR_CPU_STARTER_ARTIFACT_TYPE,
  AICR_CPU_STARTER_LOCAL_OCI_DIGEST,
  AICR_CPU_STARTER_SOURCE_DIGEST,
  AICR_CPU_STARTER_SOURCE_OCI_REF,
  AICR_CPU_STARTER_VERSION,
  aicrCpuStarterIntentSha256,
  aicrCpuStarterRecords,
  aicrCpuStarterTryScript,
} from "./lib/aicr-cpu-starter-public.mjs";
import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const scriptPath = join(siteScriptRoot(), "try.sh");
const receiptPath = join(
  repoRoot,
  "runs",
  "aicr-cpu-starter-public-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "aicr-cpu-starter-public-proof",
  "summary.md",
);
const expectedScript = aicrCpuStarterTryScript(
  "https://confighub.github.io/helm-expt/site/",
);

if (mode === "--run") {
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)}: ${receipt.status.result}`);
  if (receipt.status.result !== "pass") process.exitCode = 1;
} else if (mode === "--verify") {
  check(
    existsSync(receiptPath),
    `${relativeRepo(receiptPath)} is missing; run npm run aicr-starter-public:run`,
  );
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    existsSync(summaryPath)
      && readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-starter-public:run`,
  );
  console.log("verified the anonymous AICR CPU-starter walkthrough");
} else {
  console.log(`Usage:
  node scripts/run-aicr-cpu-starter-public-proof.mjs --run
  node scripts/run-aicr-cpu-starter-public-proof.mjs --verify`);
}

function runProof() {
  check(existsSync(scriptPath), "the generated Try AICR script is missing; run npm run site:generate");
  check(readFileSync(scriptPath, "utf8") === expectedScript, "the generated Try AICR script is stale");
  const scratch = mkdtempSync(join(tmpdir(), "helm-expt-aicr-public-"));
  const workDir = join(scratch, "aicr-cpu-starter");
  const home = join(scratch, "anonymous-home");
  const dockerConfig = join(scratch, "empty-docker");
  mkdirSync(home, { recursive: true });
  mkdirSync(dockerConfig, { recursive: true });
  writeFileSync(join(dockerConfig, "config.json"), '{"auths":{}}\n');
  const env = { ...process.env, HOME: home, DOCKER_CONFIG: dockerConfig };
  for (const name of [
    "CONFIGHUB_ACCESS_TOKEN",
    "CONFIGHUB_CONTEXT",
    "CONFIGHUB_TOKEN",
    "CUB_CONTEXT",
  ]) {
    delete env[name];
  }

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AicrCpuStarterPublicProofReceipt",
    metadata: { name: "aicr-cpu-starter-v0-14-0" },
    spec: {
      observedAt: new Date().toISOString(),
      execution: {
        configHubAccountUsed: false,
        configHubServerContacted: false,
        registryLoginUsed: false,
        kubernetesClusterUsed: false,
        isolatedHome: true,
      },
      source: {
        kind: "NVIDIA AICR generated Argo CD configuration",
        version: `v${AICR_CPU_STARTER_VERSION}`,
        reference: AICR_CPU_STARTER_SOURCE_OCI_REF,
        manifestDigest: AICR_CPU_STARTER_SOURCE_DIGEST,
        objectCount: 17,
        publicationReceipt:
          "examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml",
      },
      selection: {
        kind: "Config Workshop CPU-starter derivation",
        record: "examples/aicr/cpu-starter/derivation-receipt.yaml",
        recordSha256: aicrCpuStarterIntentSha256(),
        objectCount: 7,
        objects: [],
      },
      output: {
        role: "literal Kubernetes configuration",
        artifactType: AICR_CPU_STARTER_ARTIFACT_TYPE,
        destination: "temporary local OCI layout",
        manifestDigest: "",
        pullBack: "not-run",
      },
      script: {
        path: relativeRepo(scriptPath),
        sha256: hash(readFileSync(scriptPath)),
      },
      limits: [
        "The source OCI contains 17 Argo CD Application objects generated from NVIDIA AICR v0.14.0. The CPU starter is a recorded Config Workshop selection of seven of those objects; it is not an upstream AICR recipe.",
        "The walkthrough reads configuration and writes a local OCI. It does not contact ConfigHub Server or Kubernetes.",
        "No Argo CD Application was reconciled, no component was installed, and no model workload ran.",
        "The retained kube-prometheus-stack Application still names the gp3 storage class. Change that field before a live run on a cluster without gp3.",
      ],
    },
    status: { result: "blocked", claim: "", error: "" },
  };

  try {
    const output = execFileSync("bash", [scriptPath, workDir], {
      cwd: scratch,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    check(/Nothing was applied to Kubernetes or sent to ConfigHub\./.test(output), "the script did not state its boundary");

    const sourceFiles = yamlFiles(join(workDir, "source", "templates"));
    check(sourceFiles.length === 17, `the anonymous source pull returned ${sourceFiles.length} YAML files, not 17`);
    const selectedRecords = aicrCpuStarterRecords();
    const selectedFiles = yamlFiles(join(workDir, "config", "templates"));
    check(selectedFiles.length === selectedRecords.length, "the selected file count changed");
    for (const expected of selectedRecords) {
      const path = join(workDir, "config", "templates", expected.file);
      check(existsSync(path), `the selected output is missing ${expected.file}`);
      const object = readYaml(path);
      check(object.kind === "Application", `${expected.file} is not an Argo CD Application`);
      check(object.metadata?.name === expected.name, `${expected.file} has the wrong Application name`);
      check(hash(readFileSync(path)) === expected.sha256, `${expected.file} differs from its reviewed bytes`);
      check(
        Number(object.metadata?.annotations?.["argocd.argoproj.io/sync-wave"])
          === expected.syncWave,
        `${expected.file} has the wrong sync wave`,
      );
      receipt.spec.selection.objects.push(expected);
    }

    check(
      hash(readFileSync(join(workDir, "source-and-intent.yaml")))
        === receipt.spec.selection.recordSha256,
      "the downloaded source-and-intent record changed",
    );
    const localDigest = command("oras", [
      "manifest",
      "fetch",
      "--oci-layout",
      "--format",
      "go-template",
      "--template",
      "{{ .digest }}",
      `${join(workDir, "aicr-cpu-starter.oci")}:${AICR_CPU_STARTER_VERSION}`,
    ], env).trim();
    check(localDigest === AICR_CPU_STARTER_LOCAL_OCI_DIGEST, "the local OCI digest changed");
    for (const expected of selectedRecords) {
      const original = join(workDir, "config", "templates", expected.file);
      const pulled = join(workDir, "pulled-back", "templates", expected.file);
      check(existsSync(pulled), `the OCI pull-back is missing ${expected.file}`);
      check(readFileSync(original).equals(readFileSync(pulled)), `${expected.file} changed after OCI pull-back`);
    }
    receipt.spec.output.manifestDigest = localDigest;
    receipt.spec.output.pullBack = "pass";
    receipt.status.result = "pass";
    receipt.status.claim =
      "With no ConfigHub account, registry login, or Kubernetes cluster, the public script anonymously pulled the retained 17-Application AICR configuration, selected and hash-verified the seven CPU-starter Applications, wrote them as a local OCI, pulled that OCI back, and compared every file.";
  } catch (error) {
    receipt.status.error = sanitizeError(error);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return receipt;
}

function verifyReceipt(receipt) {
  check(receipt.kind === "AicrCpuStarterPublicProofReceipt", "unexpected AICR public receipt kind");
  check(receipt.status?.result === "pass", "the anonymous AICR walkthrough is not pass");
  check(receipt.spec?.execution?.configHubAccountUsed === false, "the walkthrough used a ConfigHub account");
  check(receipt.spec?.execution?.configHubServerContacted === false, "the walkthrough contacted ConfigHub Server");
  check(receipt.spec?.execution?.registryLoginUsed === false, "the walkthrough used a registry login");
  check(receipt.spec?.execution?.kubernetesClusterUsed === false, "the walkthrough used Kubernetes");
  check(receipt.spec?.source?.reference === AICR_CPU_STARTER_SOURCE_OCI_REF, "the source OCI changed");
  check(receipt.spec?.source?.manifestDigest === AICR_CPU_STARTER_SOURCE_DIGEST, "the source digest changed");
  check(receipt.spec?.source?.objectCount === 17, "the source object count changed");
  check(receipt.spec?.selection?.recordSha256 === aicrCpuStarterIntentSha256(), "the derivation record digest changed");
  check(receipt.spec?.selection?.objectCount === 7, "the selected object count changed");
  const expected = aicrCpuStarterRecords();
  check(receipt.spec?.selection?.objects?.length === expected.length, "the selected object records changed");
  for (const [index, expectedObject] of expected.entries()) {
    const actualObject = receipt.spec.selection.objects[index];
    for (const field of ["name", "file", "sha256", "syncWave"]) {
      check(
        actualObject?.[field] === expectedObject[field],
        `the selected object record changed at ${expectedObject.name}.${field}`,
      );
    }
  }
  check(receipt.spec?.output?.artifactType === AICR_CPU_STARTER_ARTIFACT_TYPE, "the output artifact type changed");
  check(receipt.spec?.output?.manifestDigest === AICR_CPU_STARTER_LOCAL_OCI_DIGEST, "the output OCI digest changed");
  check(receipt.spec?.output?.pullBack === "pass", "the output OCI pull-back did not pass");
  check(existsSync(scriptPath), "the generated Try AICR script is missing");
  check(readFileSync(scriptPath, "utf8") === expectedScript, "the generated Try AICR script is stale");
  check(receipt.spec?.script?.sha256 === hash(readFileSync(scriptPath)), "the receipted script digest changed");
  check(receipt.spec?.limits?.length === 4, "the walkthrough limits changed");
}

function renderSummary(receipt) {
  const rows = receipt.spec.selection.objects
    .map((object) => `| ${object.name} | ${object.syncWave} | \`${object.sha256}\` |`)
    .join("\n");
  return `# Try AICR: anonymous CPU-starter result

This test ran the same public script linked from the Config Workshop. It used an
empty registry credential store and no ConfigHub account or Kubernetes cluster.

## Result

**${receipt.status.result}.** ${receipt.status.claim}

| Step | Result |
| --- | --- |
| Pull the public NVIDIA AICR configuration at \`${receipt.spec.source.manifestDigest}\` | pass |
| Confirm all ${receipt.spec.source.objectCount} source Applications are present | pass |
| Select the seven Applications named by the CPU-starter derivation record | pass |
| Verify every selected file against its reviewed SHA-256 | pass |
| Write a local configuration OCI at \`${receipt.spec.output.manifestDigest}\` | pass |
| Pull the local OCI back and compare all seven files | pass |
| Contact ConfigHub Server | not run |
| Apply to Kubernetes or run a model | not run |

## Selected Applications

| Application | Argo CD sync wave | File SHA-256 |
| --- | ---: | --- |
${rows}

## What This Means

The public AICR artifact is readable without a registry login. The seven-file
CPU starter can be reproduced from it, checked byte for byte, and kept as a
local OCI. The source-and-intent record explains why those seven Applications
were selected and identifies the retained \`gp3\` storage-class setting.

This is a configuration exercise. It does not install the seven components or
run an inference workload. For the live CPU inference example, see
[the vLLM runtime proof](../vllm-cpu-starter-proof/summary.md).

## Evidence

- Script: [\`${receipt.spec.script.path}\`](../../${receipt.spec.script.path})
- Source publication: [public OCI receipt](../../${receipt.spec.source.publicationReceipt})
- Selection: [CPU-starter derivation receipt](../../${receipt.spec.selection.record})
- Full receipt: [\`runs/aicr-cpu-starter-public-proof/receipt.yaml\`](../../runs/aicr-cpu-starter-public-proof/receipt.yaml)
`;
}

function yamlFiles(dir) {
  return readdirSync(dir).filter((name) => name.endsWith(".yaml")).sort();
}

function command(file, args, env) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sanitizeError(error) {
  return String(error?.stderr || error?.message || error)
    .replaceAll(repoRoot, "<repo>")
    .replace(/\/tmp\/[^\s]+/g, "<temporary-path>")
    .trim();
}

function siteScriptRoot() {
  return join(repoRoot, "site", "sh", "aicr-cpu-starter");
}
