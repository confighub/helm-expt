#!/usr/bin/env node

// Records the one v1.21.0 lifecycle observation that the flattened default
// cert-manager base needs. It is intentionally separate from the older v1.20.2
// rig: a lifecycle receipt belongs to the exact chart, values, and hook bytes
// it exercised. --self-test is read-only; only --run creates a kind cluster.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { check, parseDocs, readYaml, repoRoot, sha256, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--self-test";
const recipe = "recipes/jetstack/cert-manager/v1.21.0";
const contractRel = `${recipe}/publication/default-lifecycle-contract.yaml`;
const defaultOutputRoot = "runs/lifecycle-observations/cert-manager-v121-default";
const outputOption = option("--output");
if (outputOption)
  check(
    outputOption.startsWith(`${defaultOutputRoot}/attempts/`) && !outputOption.includes("..") && !outputOption.startsWith("/"),
    `--output must be a new repository-relative attempt under ${defaultOutputRoot}/attempts/`,
  );
const outputRoot = outputOption || defaultOutputRoot;
const receiptRel = `${outputRoot}/receipt.yaml`;
const receiptPath = join(repoRoot, receiptRel);
const contract = readYaml(join(repoRoot, contractRel));
const spec = contract?.spec ?? {};

if (mode === "--run") run();
else if (mode === "--verify") verifyReceipt();
else if (mode === "--self-test") verifyContract();
else throw new Error("Usage: node scripts/run-cert-manager-v121-default-lifecycle.mjs --self-test|--run|--verify [--output runs/lifecycle-observations/cert-manager-v121-default/attempts/<new-attempt>]");

function verifyContract() {
  check(contract?.kind === "LifecycleCompanionContract", `${contractRel}: kind mismatch`);
  check(spec.chart === "jetstack/cert-manager" && spec.version === "v1.21.0" && spec.base === "default", `${contractRel}: exact source identity mismatch`);
  check(spec.status === "declared-not-observed", `${contractRel}: only a fresh receipt may change lifecycle status`);
  if (!outputOption) check(spec.observationReceipt === receiptRel, `${contractRel}: observation receipt path mismatch`);
  check(spec.renderedObjectSet?.path === `${recipe}/revisions/default/r001/rendered/release-objects.yaml`, `${contractRel}: default render path mismatch`);
  check(sha256(readFileSync(join(repoRoot, spec.renderedObjectSet.path), "utf8")) === spec.renderedObjectSet.sha256, `${contractRel}: default render digest mismatch`);
  check(spec.externalCRDs?.ownership === "external-to-default-base", `${contractRel}: CRD ownership must remain external`);
  check(spec.externalCRDs?.source?.path === `${recipe}/revisions/crds-enabled/r001/rendered/release-objects.yaml`, `${contractRel}: CRD source must be same-version crds-enabled`);
  check(sha256(readFileSync(join(repoRoot, spec.externalCRDs.source.path), "utf8")) === spec.externalCRDs.source.sha256, `${contractRel}: CRD source digest mismatch`);
  check(spec.externalCRDs?.apply?.mode === "server-side", `${contractRel}: external CRDs must use server-side apply`);
  check(spec.externalCRDs?.apply?.waitFor === "every named definition reports the Established condition", `${contractRel}: external CRDs must wait for Established`);
  const crds = crdDocs(spec.externalCRDs.source.path).map((doc) => doc.metadata.name).sort();
  check(JSON.stringify(crds) === JSON.stringify([...(spec.externalCRDs.names ?? [])].sort()), `${contractRel}: external CRD identities mismatch`);
  const payload = spec.startupApiCheck?.source?.payload;
  check(payload && existsSync(join(repoRoot, payload)), `${contractRel}: startup payload missing`);
  check(sha256(readFileSync(join(repoRoot, payload), "utf8")) === spec.startupApiCheck.source.payloadSHA256, `${contractRel}: startup payload digest mismatch`);
  check(spec.startupApiCheck.source.extractionCommand === "node scripts/extract-cert-manager-startupapicheck.mjs --chart <verified-cert-manager-v1.21.0.tgz> --output recipes/jetstack/cert-manager/v1.21.0/lifecycle/startupapicheck.yaml", `${contractRel}: extraction command mismatch`);
  const sourceLock = readYaml(join(repoRoot, `${recipe}/source-lock.yaml`));
  check(sourceLock.spec?.packageSHA256 === spec.startupApiCheck.source.artifactSHA256, `${contractRel}: startup payload artifact must match source lock`);
  const docs = parseDocs(readFileSync(join(repoRoot, payload), "utf8"));
  check(docs.length === 4, `${contractRel}: expected the four startup hook objects`);
  const job = docs.find((doc) => doc.kind === "Job");
  check(job?.metadata?.name === "cert-manager-startupapicheck", `${contractRel}: startup Job missing`);
  check(JSON.stringify(job?.spec?.template?.spec?.containers?.[0]?.args) === JSON.stringify(["check", "api", "--wait=1m", "-v"]), `${contractRel}: startup Job arguments mismatch`);
  check(spec.startupApiCheck?.execution?.mode === "manual-until-runtime-observed", `${contractRel}: do not claim an unobserved lifecycle run`);
}

function run() {
  verifyContract();
  check(!existsSync(receiptPath), `${receiptRel} already exists; refuse to overwrite retained lifecycle evidence`);
  const runRoot = join(repoRoot, outputRoot);
  mkdirSync(runRoot, { recursive: true });
  const work = join(runRoot, "execution");
  mkdirSync(work, { recursive: true });
  const cluster = `hx-cert-manager-v121-${Date.now().toString(36)}`;
  const kubeconfig = join(work, "kubeconfig");
  const context = `kind-${cluster}`;
  const receipt = baseReceipt(cluster);
  let created = false;

  try {
    stage(receipt, runRoot, "kind-create", () => {
      runCommand("kind", ["create", "cluster", "--name", cluster, "--image", "kindest/node:v1.30.0", "--kubeconfig", kubeconfig, "--wait", "300s"], { timeout: 720 });
      created = true;
      return { detail: "created fresh kind cluster with kindest/node:v1.30.0", text: `cluster=${cluster}\nnodeImage=kindest/node:v1.30.0\n` };
    });

    if (!created) throw new Error("kind cluster creation failed");
    stage(receipt, runRoot, "cluster-version", () => {
      const version = kubectl(kubeconfig, context, ["version", "-o", "json"], 120);
      const parsed = JSON.parse(version);
      const serverVersion = parsed.serverVersion?.gitVersion ?? "";
      check(serverVersion.startsWith("v1.30."), `kindest/node:v1.30.0 produced unexpected Kubernetes version ${serverVersion}`);
      receipt.spec.run.serverVersion = serverVersion;
      return { detail: `server reports ${serverVersion}`, text: `${version}\n` };
    });
    const crdPath = join(work, "external-crds.yaml");
    writeYaml(crdPath, { apiVersion: "v1", kind: "List", items: crdDocs(spec.externalCRDs.source.path) });
    stage(receipt, runRoot, "external-crds-established", () => {
      const output = kubectl(kubeconfig, context, ["apply", "--server-side", "-f", crdPath], 300);
      const names = spec.externalCRDs.names;
      const wait = kubectl(kubeconfig, context, ["wait", "--for=condition=Established", "--timeout=300s", ...names.map((name) => `crd/${name}`)], 330);
      return { detail: `server-side applied and established ${names.length} external CRDs`, text: `${output}\n${wait}\n`, source: join(repoRoot, spec.externalCRDs.source.path) };
    });

    const namespacePath = join(work, "namespace.yaml");
    stage(receipt, runRoot, "namespace-created", () => {
      writeFileSync(namespacePath, kubectl(kubeconfig, context, ["create", "namespace", "cert-manager", "--dry-run=client", "-o", "yaml"], 120));
      return {
        detail: "server-side created the cert-manager namespace required by the default render",
        text: kubectl(kubeconfig, context, ["apply", "--server-side", "-f", namespacePath], 120),
        source: namespacePath,
      };
    });

    const defaultRender = join(repoRoot, spec.renderedObjectSet.path);
    stage(receipt, runRoot, "default-base-applied", () => ({
      detail: "server-side applied the unchanged 40-object default render",
      text: kubectl(kubeconfig, context, ["apply", "--server-side", "-f", defaultRender], 300),
      source: defaultRender,
    }));

    for (const deployment of ["cert-manager", "cert-manager-cainjector", "cert-manager-webhook"]) {
      stage(receipt, runRoot, `deployment-ready:${deployment}`, () => ({
        detail: "rollout complete",
        text: kubectl(kubeconfig, context, ["-n", "cert-manager", "rollout", "status", `deployment/${deployment}`, "--timeout=300s"], 330),
      }));
    }

    for (const kind of ["mutatingwebhookconfiguration", "validatingwebhookconfiguration"]) {
      stage(receipt, runRoot, `webhook-ca-bundle:${kind}`, () => {
        const json = kubectl(kubeconfig, context, ["get", kind, "cert-manager-webhook", "-o", "json"], 120);
        const parsed = JSON.parse(json);
        const bundles = (parsed.webhooks ?? []).map((hook) => hook.clientConfig?.caBundle).filter(Boolean);
        check(bundles.length === (parsed.webhooks ?? []).length && bundles.length > 0, `${kind}/cert-manager-webhook has an empty caBundle`);
        return { detail: "all webhook clientConfig.caBundle fields are non-empty", text: `${json}\n` };
      });
    }

    const payload = join(repoRoot, spec.startupApiCheck.source.payload);
    stage(receipt, runRoot, "startupapicheck-complete", () => {
      const applied = kubectl(kubeconfig, context, ["apply", "--server-side", "-f", payload], 180);
      const waited = kubectl(kubeconfig, context, ["-n", "cert-manager", "wait", "--for=condition=complete", "--timeout=180s", "job/cert-manager-startupapicheck"], 210);
      const job = kubectl(kubeconfig, context, ["-n", "cert-manager", "get", "job/cert-manager-startupapicheck", "-o", "yaml"], 120);
      return { detail: "exact v1.21.0 startup API check Job completed", text: `${applied}\n${waited}\n${job}\n`, source: payload };
    });
  } finally {
    const allStagesPassed = receipt.spec.checks.every((item) => item.result === "pass");
    if (created && allStagesPassed) {
      const cleanup = runCommand("kind", ["delete", "cluster", "--name", cluster, "--kubeconfig", kubeconfig], { timeout: 300, allowFailure: true });
      receipt.spec.run.cleanup = { result: cleanup.status === 0 ? "pass" : "blocked", detail: `${cleanup.stdout}\n${cleanup.stderr}`.trim() };
    }
    if (!allStagesPassed) {
      receipt.spec.run.diagnostics = {
        retained: true,
        kubeconfig: "execution/kubeconfig",
        cluster,
        detail: "The cluster and kubeconfig remain for diagnosis; delete the named kind cluster after inspection.",
      };
    } else if (receipt.spec.run.cleanup?.result === "pass") {
      rmSync(work, { recursive: true, force: true });
    }
    receipt.spec.result = receipt.spec.checks.every((item) => item.result === "pass") && receipt.spec.run.cleanup?.result === "pass" ? "pass" : "blocked";
    writeYaml(receiptPath, receipt);
    console.log(`wrote ${receiptRel} result=${receipt.spec.result}`);
  }
}

function baseReceipt(cluster) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "LifecycleObservationReceipt",
    metadata: { name: "jetstack-cert-manager-v1.21.0-default-lifecycle" },
    spec: {
      chart: spec.chart,
      version: spec.version,
      base: spec.base,
      result: "blocked",
      observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      lifecycleContract: contractRel,
      renderedObjectSet: spec.renderedObjectSet,
      externalCRDs: spec.externalCRDs,
      startupApiCheck: spec.startupApiCheck,
      lifecycleModel: {
        claim: "The exact v1.21.0 startup API check hook completed after externally owned CRDs were server-side applied and Established, the unchanged default payload was applied, and the controller and webhook deployments became ready.",
        crdPolicy: "external-crds-required",
        hookPolicy: "startupapicheck-executed-as-explicit-post-apply-job",
        controllerOwnedFields: ["admission webhook caBundle"],
      },
      contract: { path: contractRel, sha256: sha256(readFileSync(join(repoRoot, contractRel), "utf8")) },
      sourceHashes: {
        sourceLock: sha256(readFileSync(join(repoRoot, `${recipe}/source-lock.yaml`), "utf8")),
        defaultRenderedObjectSet: sha256(readFileSync(join(repoRoot, spec.renderedObjectSet.path), "utf8")),
        externalCrdRenderedObjectSet: sha256(readFileSync(join(repoRoot, spec.externalCRDs.source.path), "utf8")),
        startupApiCheckPayload: sha256(readFileSync(join(repoRoot, spec.startupApiCheck.source.payload), "utf8")),
      },
      run: { mode: "single-kind-cluster-explicit-startupapicheck", cluster, nodeImage: "kindest/node:v1.30.0", namespace: "cert-manager", cleanup: { result: "not-run" } },
      checks: [],
    },
  };
}

function stage(receipt, runRoot, name, action) {
  try {
    const result = action();
    const artifact = join(runRoot, `${name}.txt`);
    writeFileSync(artifact, `${result.text ?? ""}`);
    const rel = relative(runRoot, artifact);
    receipt.spec.checks.push({ name, result: "pass", detail: result.detail, evidencePath: rel, evidenceSHA256: fileSha(artifact), ...(result.source ? { sourceSHA256: fileSha(result.source) } : {}) });
  } catch (error) {
    receipt.spec.checks.push({ name, result: "blocked", detail: errorText(error) });
    throw error;
  }
}

function verifyReceipt() {
  verifyContract();
  check(existsSync(receiptPath), `${receiptRel} is missing; run --run on an available Docker host`);
  const receipt = readYaml(receiptPath);
  check(receipt.kind === "LifecycleObservationReceipt", `${receiptRel}: kind mismatch`);
  check(receipt.spec?.result === "pass", `${receiptRel}: pass receipt required`);
  check(receipt.spec?.version === "v1.21.0" && receipt.spec?.base === "default", `${receiptRel}: exact version/base mismatch`);
  check(receipt.spec?.contract?.path === contractRel && receipt.spec.contract.sha256 === sha256(readFileSync(join(repoRoot, contractRel), "utf8")), `${receiptRel}: contract hash mismatch`);
  const expectedSources = {
    sourceLock: `${recipe}/source-lock.yaml`,
    defaultRenderedObjectSet: spec.renderedObjectSet.path,
    externalCrdRenderedObjectSet: spec.externalCRDs.source.path,
    startupApiCheckPayload: spec.startupApiCheck.source.payload,
  };
  for (const [name, path] of Object.entries(expectedSources))
    check(receipt.spec?.sourceHashes?.[name] === sha256(readFileSync(join(repoRoot, path), "utf8")), `${receiptRel}: ${name} hash mismatch`);
  check(receipt.spec?.run?.nodeImage === "kindest/node:v1.30.0", `${receiptRel}: kind node image mismatch`);
  check(String(receipt.spec?.run?.serverVersion ?? "").startsWith("v1.30."), `${receiptRel}: recorded server version mismatch`);
  const expectedStageSources = {
    "external-crds-established": spec.externalCRDs.source.path,
    "default-base-applied": spec.renderedObjectSet.path,
    "startupapicheck-complete": spec.startupApiCheck.source.payload,
  };
  for (const name of [
    "kind-create",
    "cluster-version",
    "external-crds-established",
    "namespace-created",
    "default-base-applied",
    "deployment-ready:cert-manager",
    "deployment-ready:cert-manager-cainjector",
    "deployment-ready:cert-manager-webhook",
    "webhook-ca-bundle:mutatingwebhookconfiguration",
    "webhook-ca-bundle:validatingwebhookconfiguration",
    "startupapicheck-complete",
  ]) {
    const row = receipt.spec?.checks?.find((item) => item.name === name);
    check(row?.result === "pass" && row.evidencePath && row.evidenceSHA256, `${receiptRel}: ${name} needs byte-addressed passing evidence`);
    const artifact = join(receiptPath.replace(/\/receipt\.yaml$/, ""), row.evidencePath);
    check(existsSync(artifact) && fileSha(artifact) === row.evidenceSHA256, `${receiptRel}: ${name} evidence mismatch`);
    if (expectedStageSources[name])
      check(row.sourceSHA256 === fileSha(join(repoRoot, expectedStageSources[name])), `${receiptRel}: ${name} source hash mismatch`);
  }
  console.log("verified cert-manager v1.21.0 default lifecycle observation");
}

function crdDocs(relPath) {
  return parseDocs(readFileSync(join(repoRoot, relPath), "utf8")).filter((doc) => doc.kind === "CustomResourceDefinition");
}

function kubectl(kubeconfig, context, args, timeout) {
  return runCommand("kubectl", ["--kubeconfig", kubeconfig, "--context", context, ...args], { timeout }).stdout;
}

function runCommand(command, args, { timeout, allowFailure = false } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: timeout ? timeout * 1000 : undefined, stdio: ["ignore", "pipe", "pipe"] });
  const output = { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  if (result.error && !allowFailure) throw result.error;
  if (output.status !== 0 && !allowFailure) throw new Error(`${command} ${args.join(" ")} failed (${output.status})\n${output.stdout}\n${output.stderr}`);
  return output;
}

function fileSha(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function errorText(error) {
  return [error?.message, error?.stdout, error?.stderr]
    .filter(Boolean)
    .join("\n")
    .replaceAll(repoRoot, "<workspace>")
    .slice(0, 4000);
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? "" : "";
}
