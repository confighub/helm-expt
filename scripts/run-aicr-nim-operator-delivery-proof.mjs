#!/usr/bin/env node

// Config-plane delivery proof for the NIM operator surface.
//
// The AICR-native inference entry installs the NIM operator as one of its
// components. The operator's custom resource definitions are the surface an
// operator team writes against, so proving the entry is usable means proving a
// real API server accepts the shapes a team would write.
//
// This installs the retained definitions on a throwaway kind cluster and
// applies the catalog's own authored NIMService. The operator itself is not
// installed, and that is the whole reason both boundaries hold: with no
// controller, nothing reconciles the resource, so no pod is scheduled, no NIM
// image is pulled from the gated registry, and no NGC surface is contacted.
//
// The proof also checks something a delivery proof usually cannot: that the
// definitions retained here agree with the operator version the entry's own
// rendered Application pins. Definitions that drift from the component they
// describe would accept shapes the deployed operator rejects.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const exampleRoot = join(repoRoot, "examples", "aicr", "eks-h100-inference-nim");
const receiptPath = join(repoRoot, "runs", "aicr-nim-operator-delivery", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-nim-operator-delivery", "summary.md");
const serviceNamespace = "nim-service";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-nim-operator-delivery-proof.mjs --run
  node scripts/run-aicr-nim-operator-delivery-proof.mjs --generate
  node scripts/run-aicr-nim-operator-delivery-proof.mjs --verify
  node scripts/run-aicr-nim-operator-delivery-proof.mjs --self-test`);
  process.exit(2);
}

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-nim-operator-delivery:generate`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-nim-operator-delivery:generate`,
  );
  console.log("verified the NIM operator config-plane delivery proof");
} else {
  selfTest();
  console.log("verified the NIM operator delivery receipt checks against fake surfaces");
}

function loadExpectations(rootOverride) {
  const root = rootOverride ?? exampleRoot;
  const retention = readYaml(join(root, "operator-crds-retention-receipt.yaml"));
  const retainedTag = String(retention.spec?.source?.ref ?? "");
  check(retainedTag, "the operator retention receipt names no upstream tag");

  // The definitions must agree with the component the entry actually installs.
  const applicationRel = String(retention.spec?.versionAgreement?.renderedApplication ?? "");
  const applicationPath = join(root, applicationRel);
  check(existsSync(applicationPath), `${applicationRel} is missing`);
  const application = parseDocs(readFileSync(applicationPath, "utf8"))[0];
  const pinnedVersion = String(application?.spec?.source?.targetRevision ?? "");
  check(pinnedVersion, "the rendered operator Application pins no chart version");
  check(
    retainedTag === `v${pinnedVersion}`,
    `the retained definitions are ${retainedTag} but the entry installs operator chart ${pinnedVersion}`,
  );

  const crdRoot = join(root, "operator-crds");
  const checksums = new Map();
  for (const line of readFileSync(join(root, "operator-crds-checksums.txt"), "utf8").split("\n").filter(Boolean)) {
    const match = line.match(/^([0-9a-f]{64})\s+(\S+)$/);
    check(match, `operator-crds-checksums.txt: unparseable row: ${line}`);
    checksums.set(match[2], match[1]);
  }
  const crds = listFiles(crdRoot)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .map((path) => {
      const file = path.split("/").pop();
      const bytes = readFileSync(path);
      check(
        sha256(bytes) === checksums.get(file),
        `operator-crds/${file} differs from its recorded checksum`,
      );
      const doc = parseDocs(bytes.toString("utf8"))[0];
      check(doc?.kind === "CustomResourceDefinition", `operator-crds/${file} is not a CustomResourceDefinition`);
      return { file, name: doc.metadata?.name ?? "", kind: doc.spec?.names?.kind ?? "" };
    });
  check(crds.length > 0, "no operator definitions are retained");

  const authoredRoot = join(root, "authored");
  const authored = listFiles(authoredRoot)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .map((path) => {
      const text = readFileSync(path, "utf8");
      const doc = parseDocs(text)[0];
      return {
        file: `authored/${path.split("/").pop()}`,
        text,
        doc,
        kind: doc.kind,
        name: doc.metadata?.name ?? "",
        namespace: doc.metadata?.namespace ?? "",
      };
    });
  check(authored.length > 0, "the entry authors no example resources");
  // Authored config may reference a gated image, and may never embed a secret.
  for (const row of authored) {
    const text = JSON.stringify(row.doc);
    check(
      !/(NGC_API_KEY|HF_TOKEN)\s*[:=]\s*["']?[A-Za-z0-9]/.test(row.text),
      `${row.file}: authored config must not embed a credential value`,
    );
    check(
      !text.includes("password") && !text.includes("apiKey"),
      `${row.file}: authored config must not carry a secret field`,
    );
  }
  const gatedReferences = [...new Set(
    authored
      .map((row) => row.doc?.spec?.image)
      .filter(Boolean)
      .map((image) => `${image.repository}:${image.tag}`)
      .filter((reference) => reference.startsWith("nvcr.io/")),
  )].sort();

  return {
    retainedTag,
    pinnedVersion,
    crds,
    authored,
    gatedReferences,
    crdCount: crds.length,
    authoredCount: authored.length,
    canonicalAuthoredSha256: sha256(authored.map((row) => row.text).join("\n---\n")),
  };
}

function run() {
  check(
    process.env.HELM_EXPT_ALLOW_KIND_CLUSTER === "1",
    "set HELM_EXPT_ALLOW_KIND_CLUSTER=1 to confirm this throwaway kind cluster run",
  );
  for (const [tool, args] of [["docker", ["version"]], ["kind", ["version"]], ["kubectl", ["version", "--client"]]]) {
    check(tryCommand(tool, args).ok, `${tool} is required for the NIM operator delivery proof`);
  }

  const expectations = loadExpectations();
  const observedAt = new Date().toISOString();
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || observedAt);
  const clusterName = `hx-aicr-nimop-${runId}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-nim-operator-"));
  const kubeconfigPath = join(workRoot, "kubeconfig");
  let clusterStarted = false;
  let receipt;
  const cleanup = { cluster: "not-created", localFiles: "pending" };

  try {
    command("kind", ["create", "cluster", "--name", clusterName, "--kubeconfig", kubeconfigPath, "--wait", "180s"], {
      timeout: 420_000,
    });
    clusterStarted = true;
    cleanup.cluster = "pending";
    const kubectl = (args, options = {}) =>
      command("kubectl", ["--kubeconfig", kubeconfigPath, ...args], { timeout: 360_000, ...options });

    // Definitions only. The operator is never installed, so nothing reconciles
    // the resources this proof applies.
    kubectl(["apply", "--server-side", "-f", join(exampleRoot, "operator-crds")]);
    for (const crd of expectations.crds) {
      kubectl(["wait", "--for=condition=Established", `crd/${crd.name}`, "--timeout=120s"]);
    }
    kubectl(["create", "namespace", serviceNamespace]);

    const accepted = [];
    for (const row of expectations.authored) {
      kubectl(["apply", "-f", join(exampleRoot, row.file)]);
      const live = JSON.parse(
        kubectl(["get", row.kind.toLowerCase(), row.name, "-n", row.namespace, "-o", "json"]),
      );
      check(live.metadata?.name === row.name, `${row.name}: the cluster returned a different object`);
      // The API server prunes fields a definition does not know, so a surviving
      // image reference proves the definition understood the shape.
      const image = live.spec?.image ?? {};
      check(
        `${image.repository}:${image.tag}` === `${row.doc.spec.image.repository}:${row.doc.spec.image.tag}`,
        `${row.name}: the stored resource lost its image reference`,
      );
      accepted.push({ kind: row.kind, name: row.name, namespace: row.namespace });
    }

    const pods = JSON.parse(kubectl(["get", "pods", "--all-namespaces", "-o", "json"]));
    const workloadPods = (pods.items ?? []).filter(
      (pod) => !["kube-system", "local-path-storage"].includes(pod.metadata?.namespace ?? ""),
    );
    check(workloadPods.length === 0, `expected no workload pods, found ${workloadPods.length}`);
    const events = JSON.parse(kubectl(["get", "events", "--all-namespaces", "-o", "json"]));
    const pullEvents = (events.items ?? []).filter((event) => String(event.message ?? "").includes("nvcr.io"));
    check(pullEvents.length === 0, "the cluster recorded an image-pull event naming the gated registry");

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrNimOperatorDeliveryProofReceipt",
      metadata: { name: "aicr-eks-h100-inference-nim-operator-delivery" },
      spec: {
        observedAt,
        input: {
          committedEntry: relativeRepo(exampleRoot),
          retainedDefinitionTag: expectations.retainedTag,
          operatorChartVersionInEntry: expectations.pinnedVersion,
          definitionsAgreeWithComponent: true,
          definitionCount: expectations.crdCount,
          definitions: expectations.crds,
          authoredCount: expectations.authoredCount,
          canonicalAuthoredSha256: expectations.canonicalAuthoredSha256,
        },
        cluster: {
          shape: "throwaway kind cluster with an isolated kubeconfig",
          operatorInstalled: false,
          reason:
            "with no operator nothing reconciles a NIMService, so no pod is scheduled and no gated image is pulled",
        },
        delivery: {
          definitionsEstablished: expectations.crdCount,
          resourcesAccepted: accepted.length,
          accepted,
          imageReferencePreserved: true,
          workloadPods: 0,
          gatedImagePullEvents: 0,
          servingProven: false,
        },
        licenseBoundary: {
          ngcContacted: false,
          imagesPulled: false,
          modelsFetched: false,
          credentialValuesInAuthoredConfig: false,
          gatedImageReferences: expectations.gatedReferences,
        },
        provenance: {
          definitions: "retained from NVIDIA/k8s-nim-operator, Apache-2.0",
          exampleResource:
            "authored by this catalog, because upstream ships no ready-made NIMService for this entry",
        },
        cleanup,
        limits: [
          "This proof shows a real API server accepting the shapes a NIM deployment writes, against the operator's own definitions. It does not prove serving, model loading, or any workload behavior.",
          "The NIM operator was deliberately not installed. With it, a NIMService would attempt to pull a gated image, which the licensing boundary forbids this project from doing.",
          "The example resource is authored, not retained. It exercises the definition; it is not a recommended deployment.",
          "Two of the operator's nine definitions are retained, the two a NIM deployment writes.",
        ],
      },
      status: {
        result: "pass",
        definitionsAgree: "pass",
        crdInstall: "pass",
        resourcesAccepted: "pass",
        boundaryProven: "pass",
        claim:
          "The NIM operator definitions retained for this entry match the operator chart version the entry installs, a real API server established them and accepted the catalog's authored NIMService with its gated image reference intact, and no operator, pod, or image pull existed anywhere in the run.",
      },
    };
  } finally {
    if (clusterStarted) {
      const deleted = tryCommand("kind", ["delete", "cluster", "--name", clusterName]);
      const gone = !command("kind", ["get", "clusters"]).split("\n").includes(clusterName);
      cleanup.cluster = deleted.ok && gone ? "pass" : "fail";
    }
    try {
      rmSync(workRoot, { recursive: true, force: true });
      cleanup.localFiles = existsSync(workRoot) ? "fail" : "pass";
    } catch {
      cleanup.localFiles = "fail";
    }
  }

  check(receipt, "the NIM operator delivery proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `the NIM operator delivery proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(readYaml(receiptPath), loadExpectations());
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function verifyReceipt(receipt, expectations) {
  check(receipt.kind === "AicrNimOperatorDeliveryProofReceipt", "NIM operator delivery receipt kind changed");
  check(receipt.status?.result === "pass", "NIM operator delivery proof is not pass");
  for (const lane of ["definitionsAgree", "crdInstall", "resourcesAccepted", "boundaryProven"]) {
    check(receipt.status?.[lane] === "pass", `NIM operator delivery receipt lane ${lane} did not pass`);
  }
  check(
    receipt.spec?.input?.retainedDefinitionTag === expectations.retainedTag
      && receipt.spec?.input?.operatorChartVersionInEntry === expectations.pinnedVersion
      && receipt.spec?.input?.definitionsAgreeWithComponent === true,
    "NIM operator delivery receipt no longer records definitions agreeing with the installed component",
  );
  check(
    receipt.spec?.input?.definitionCount === expectations.crdCount,
    "NIM operator delivery receipt definition count changed",
  );
  check(
    receipt.spec?.input?.canonicalAuthoredSha256 === expectations.canonicalAuthoredSha256,
    "NIM operator delivery receipt authored config differs from the committed bytes",
  );
  check(
    receipt.spec?.delivery?.resourcesAccepted === expectations.authoredCount
      && receipt.spec?.delivery?.imageReferencePreserved === true,
    "NIM operator delivery receipt acceptance evidence is incomplete",
  );
  check(
    receipt.spec?.cluster?.operatorInstalled === false
      && receipt.spec?.delivery?.workloadPods === 0
      && receipt.spec?.delivery?.gatedImagePullEvents === 0
      && receipt.spec?.delivery?.servingProven === false,
    "NIM operator delivery receipt does not prove the no-workload boundary",
  );
  check(
    receipt.spec?.licenseBoundary?.ngcContacted === false
      && receipt.spec?.licenseBoundary?.imagesPulled === false
      && receipt.spec?.licenseBoundary?.credentialValuesInAuthoredConfig === false,
    "NIM operator delivery receipt does not hold the license boundary",
  );
  check(
    String(receipt.spec?.provenance?.exampleResource ?? "").includes("authored"),
    "the receipt must say the example resource is authored rather than retained",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "the NIM operator delivery proof cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("does not prove serving")),
    "the receipt must say that serving was not proven",
  );
}

function renderSummary(receipt) {
  const input = receipt.spec.input;
  const delivery = receipt.spec.delivery;
  return `# NIM operator config-plane delivery proof

**UNOFFICIAL/EXPERIMENTAL.** Generated from the committed receipt. Rerun with
\`npm run aicr-nim-operator-delivery:run\`; check the committed result without
a cluster using \`npm run aicr-nim-operator-delivery:verify\`.

The AICR-native inference entry installs the NIM operator, and this proof
covers the surface an operator team writes against. The
${input.definitionCount} retained definitions were established on a throwaway
kind cluster, and the catalog's authored NIMService was accepted with its
gated image reference intact.

One check here is unusual and worth naming. The definitions are retained at
\`${input.retainedDefinitionTag}\`, and the entry's own rendered Application
installs operator chart \`${input.operatorChartVersionInEntry}\`. The proof
refuses to run unless those agree, because definitions that drift from the
component they describe would accept shapes the deployed operator rejects.

The operator itself was never installed. With nothing reconciling a
NIMService, the run scheduled ${delivery.workloadPods} pods and recorded
${delivery.gatedImagePullEvents} image-pull events naming the gated registry,
which is how the config-plane boundary and the licensing boundary hold at the
same time.

## Limits

${receipt.spec.limits.map((limit) => `- ${limit}`).join("\n")}
`;
}

function selfTest() {
  const expectations = loadExpectations();
  const receipt = () => JSON.parse(JSON.stringify({
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AicrNimOperatorDeliveryProofReceipt",
    metadata: { name: "fixture" },
    spec: {
      observedAt: "1970-01-01T00:00:00.000Z",
      input: {
        retainedDefinitionTag: expectations.retainedTag,
        operatorChartVersionInEntry: expectations.pinnedVersion,
        definitionsAgreeWithComponent: true,
        definitionCount: expectations.crdCount,
        canonicalAuthoredSha256: expectations.canonicalAuthoredSha256,
      },
      cluster: { operatorInstalled: false },
      delivery: {
        resourcesAccepted: expectations.authoredCount,
        imageReferencePreserved: true,
        workloadPods: 0,
        gatedImagePullEvents: 0,
        servingProven: false,
      },
      licenseBoundary: {
        ngcContacted: false,
        imagesPulled: false,
        modelsFetched: false,
        credentialValuesInAuthoredConfig: false,
      },
      provenance: { exampleResource: "authored by this catalog" },
      cleanup: { cluster: "pass", localFiles: "pass" },
      limits: ["This proof does not prove serving, model loading, or any workload behavior."],
    },
    status: {
      result: "pass",
      definitionsAgree: "pass",
      crdInstall: "pass",
      resourcesAccepted: "pass",
      boundaryProven: "pass",
    },
  }));

  verifyReceipt(receipt(), expectations);
  const refusals = [
    [(r) => (r.spec.input.retainedDefinitionTag = "v9.9.9"), /definitions agreeing with the installed component/],
    [(r) => (r.spec.input.definitionsAgreeWithComponent = false), /definitions agreeing with the installed component/],
    [(r) => (r.spec.input.canonicalAuthoredSha256 = "wrong"), /authored config differs/],
    [(r) => (r.spec.delivery.imageReferencePreserved = false), /acceptance evidence is incomplete/],
    [(r) => (r.spec.cluster.operatorInstalled = true), /no-workload boundary/],
    [(r) => (r.spec.delivery.gatedImagePullEvents = 2), /no-workload boundary/],
    [(r) => (r.spec.licenseBoundary.credentialValuesInAuthoredConfig = true), /hold the license boundary/],
    [(r) => (r.spec.provenance.exampleResource = "retained from upstream"), /authored rather than retained/],
    [(r) => (r.spec.cleanup.cluster = "fail"), /cleanup did not pass/],
  ];
  for (const [mutate, pattern] of refusals) {
    const mutated = receipt();
    mutate(mutated);
    check(fails(() => verifyReceipt(mutated, expectations), pattern), `self-test accepted a receipt violating ${pattern}`);
  }
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function command(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });
}

function tryCommand(file, args, options = {}) {
  const result = spawnSync(file, args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 100, ...options });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, out: out || String(result.error ?? "") };
}

function safeRunId(value) {
  const compact = String(value).replace(/\D/g, "").slice(0, 14);
  check(compact.length >= 8, "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits");
  return compact;
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
