#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

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

const mode = process.argv[2] ?? "--help";
const exampleRoot = join(repoRoot, "examples", "promotion", "nginx-candidate-test");
const currentPath = join(exampleRoot, "current.yaml");
const intentPath = join(exampleRoot, "test-plan.yaml");
const candidatePaths = [1, 2, 3].map((replicas) =>
  join(exampleRoot, "candidates", `replicas-${replicas}.yaml`));
const receiptPath = join(repoRoot, "runs", "measured-promotion-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "measured-promotion-proof", "summary.md");
const namespace = "nginx-promotion";
const image = "docker.io/nginx:1.31.3-alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752";
const requestCount = 60;
const maximumP95Milliseconds = 1000;
const requiredReadyReplicas = 2;

if (mode === "--generate") {
  generateFixtures();
  if (existsSync(receiptPath)) {
    const receipt = readYaml(receiptPath);
    verifyReceipt(receipt);
    write(summaryPath, renderSummary(receipt));
  }
  console.log("generated measured promotion fixture and summary");
} else if (mode === "--run") {
  generateFixtures();
  await runProof();
} else if (mode === "--verify") {
  verifyFixtures();
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; generate the summary`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run measured-promotion:generate`,
  );
  console.log("verified measured promotion proof");
} else if (mode === "--self-test") {
  verifyFixtures();
  selfTest();
  console.log("verified measured promotion proof self-test");
} else {
  console.error(`Usage: node ${relativeRepo(import.meta.filename)} --generate|--run|--verify|--self-test`);
  process.exitCode = 2;
}

function generateFixtures() {
  write(currentPath, candidateYaml(1));
  for (const replicas of [1, 2, 3]) write(candidatePaths[replicas - 1], candidateYaml(replicas));
  writeYaml(intentPath, testPlan());
  write(join(exampleRoot, "README.md"), exampleReadme());
}

function verifyFixtures() {
  check(readFileSync(currentPath, "utf8") === candidateYaml(1), "current NGINX fixture is stale");
  for (const replicas of [1, 2, 3]) {
    const path = candidatePaths[replicas - 1];
    check(readFileSync(path, "utf8") === candidateYaml(replicas), `${relativeRepo(path)} is stale`);
    const deployment = parseDocs(readFileSync(path, "utf8"))
      .find((doc) => doc.kind === "Deployment" && doc.metadata?.name === "nginx-candidate");
    check(deployment?.spec?.replicas === replicas, `${relativeRepo(path)} has the wrong replica count`);
    check(deployment?.spec?.template?.spec?.containers?.[0]?.image === image, `${relativeRepo(path)} has the wrong image`);
  }
  check(readFileSync(join(exampleRoot, "README.md"), "utf8") === exampleReadme(), "example README is stale");
  const plan = readYaml(intentPath);
  check(plan.kind === "PromotionTestPlan", "promotion test plan has the wrong kind");
  check(plan.spec?.selection?.requiredReadyReplicas === requiredReadyReplicas, "promotion target requirement drifted");
}

async function runProof() {
  const context = process.env.CUB_CONTEXT?.trim();
  check(context, "set CUB_CONTEXT to the authenticated helm-catalog context");
  for (const [tool, args] of [
    ["cub", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
  ]) check(tryCommand(tool, args).ok, `${tool} is required for the measured promotion proof`);

  const contextInfo = cubJson(context, ["context", "get", context, "-o", "json"]);
  check(contextInfo.metadata?.organizationName === "helm-catalog", "proof must use the helm-catalog organization");
  const recordedAt = new Date().toISOString();
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || recordedAt);
  const prefix = `hx-measured-promotion-${runId}`;
  const spaces = {
    base: `${prefix}-base`,
    staging: `${prefix}-staging`,
    production: `${prefix}-prod`,
  };
  const cluster = `${prefix}-cluster`;
  let clusterStarted = false;
  let receipt;

  try {
    for (const space of Object.values(spaces)) check(!spacePresent(context, space), `refusing to reuse ${space}`);
    check(!clusterPresent(cluster), `refusing to reuse kind cluster ${cluster}`);
    clusterUp(context, cluster);
    clusterStarted = true;

    const target = cubJson(context, ["target", "get", "target", "--space", cluster, "-o", "json"]).Target;
    check(target?.ProviderType === "OCI", `${cluster}/target is not an OCI target`);
    const targetRef = `${cluster}/target`;
    const node = kubectlJson(cluster, ["get", "nodes", "-o", "json"]).items[0];
    const targetFacts = {
      kubernetesVersion: node?.status?.nodeInfo?.kubeletVersion ?? "",
      architecture: node?.status?.nodeInfo?.architecture ?? "",
      operatingSystem: node?.status?.nodeInfo?.operatingSystem ?? "",
      requiredReadyReplicas,
    };

    const candidateResults = [];
    for (const [index, path] of candidatePaths.entries()) {
      candidateResults.push(await testCandidate(cluster, path, index + 1));
    }
    const passing = candidateResults.filter((candidate) => candidate.result === "pass")
      .sort((left, right) => left.replicas - right.replicas || left.id.localeCompare(right.id));
    check(passing.length > 0, "no candidate passed the fixed test and destination requirement");
    const selected = passing[0];
    check(selected.id === "replicas-2", `expected replicas-2 to be the smallest passing candidate, got ${selected.id}`);

    kubectl(cluster, ["delete", "namespace", namespace, "--wait=true", "--timeout=180s"]);

    cub(context, [
      "variant", "upload",
      "--component", "nginx-candidate",
      "--variant", "base",
      "--space", spaces.base,
      "--granularity", "per-resource",
      "--owner", "ConfigHub",
      "--layer", "App",
      "--label", "Example=measured-promotion",
      "--change-desc", "Record the current one-replica configuration",
      currentPath,
    ], { timeout: 420_000 });
    const baseline = inspectSpace(context, spaces.base);
    check(baseline.objectSetSha256 === objectSetSha256(currentPath), "ConfigHub base differs from current.yaml");

    variantCreate(context, "staging", spaces.base, spaces.staging, null);
    variantCreate(context, "production", spaces.staging, spaces.production, targetRef);
    const stagingBefore = inspectSpace(context, spaces.staging);
    const productionBefore = inspectSpace(context, spaces.production);
    check(stagingBefore.objectSetSha256 === baseline.objectSetSha256, "staging did not begin at the current configuration");
    check(productionBefore.objectSetSha256 === baseline.objectSetSha256, "production did not begin at the current configuration");

    cub(context, [
      "variant", "upload",
      "--component", "nginx-candidate",
      "--variant", "base",
      "--space", spaces.base,
      "--granularity", "per-resource",
      "--owner", "ConfigHub",
      "--layer", "App",
      "--label", "Example=measured-promotion",
      "--change-desc", `Accept ${selected.id} after the fixed target test`,
      selected.path,
    ], { timeout: 420_000 });
    const acceptedBase = inspectSpace(context, spaces.base);
    check(acceptedBase.objectSetSha256 === selected.objectSetSha256, "accepted base differs from the selected candidate");
    check(
      sameStrings(changedObjects(baseline.documents, acceptedBase.documents), ["apps/v1|Deployment|nginx-promotion|nginx-candidate"]),
      "accepting the candidate changed more than the Deployment",
    );

    const stagingPreview = promotionPreview(context, spaces.staging);
    check(stagingPreview.changed, "staging preview reported no change");
    cub(context, ["variant", "promote", spaces.staging, "--change-desc", `Promote measured winner ${selected.id} to staging`], { timeout: 420_000 });
    const stagingAfter = inspectSpace(context, spaces.staging);
    check(stagingAfter.objectSetSha256 === selected.objectSetSha256, "staging differs from the selected candidate");

    const productionPreview = promotionPreview(context, spaces.production);
    check(productionPreview.changed, "production preview reported no change");
    cub(context, ["variant", "promote", spaces.production, "--change-desc", `Promote measured winner ${selected.id} to production`], { timeout: 420_000 });
    const productionAfter = inspectSpace(context, spaces.production);
    check(productionAfter.objectSetSha256 === selected.objectSetSha256, "production differs from the selected candidate");

    const releaseResponse = cubJson(context, ["release", "publish", spaces.production, "-o", "json"], { timeout: 420_000 });
    const release = releaseResponse.Release ?? releaseResponse;
    const releaseDigest = normalizeDigest(release.ManifestDigest);
    check(releaseDigest, "ConfigHub release returned no manifest digest");
    const argo = waitForArgo(cluster, spaces.production, releaseDigest);
    const kubernetes = await inspectDeliveredCandidate(cluster, selected);
    const versions = parseCubVersions(cub(context, ["version"]));

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "MeasuredPromotionProofReceipt",
      metadata: { name: "nginx-fixed-candidate-test" },
      spec: {
        recordedAt,
        context: { name: context, organization: contextInfo.metadata.organizationName },
        tools: {
          cubClient: versions.client,
          configHubServer: versions.server,
          gitopsController: "Argo CD",
          kubernetesContext: `kind-${cluster}`,
        },
        input: {
          current: candidateIdentity(currentPath, 1),
          candidates: candidatePaths.map((path, index) => candidateIdentity(path, index + 1)),
          image,
        },
        policy: {
          requestCount,
          requiredSuccessRate: 1,
          maximumP95Milliseconds,
          requiredReadyReplicas,
          selection: "Choose the fewest replicas among candidates that pass every fixed check and destination requirement; use candidate id as the stable tie-breaker.",
        },
        targetFacts,
        tests: candidateResults,
        decision: {
          selected: selected.id,
          replicas: selected.replicas,
          objectSetSha256: selected.objectSetSha256,
          reason: "One replica failed the destination capacity requirement. Two and three replicas passed, so the smallest passing configuration was two replicas.",
        },
        configHub: {
          spaces,
          path: `${spaces.base} -> ${spaces.staging} -> ${spaces.production}`,
          baselineObjectSetSha256: baseline.objectSetSha256,
          acceptedObjectSetSha256: acceptedBase.objectSetSha256,
          stagingObjectSetSha256: stagingAfter.objectSetSha256,
          productionObjectSetSha256: productionAfter.objectSetSha256,
          changedObject: "apps/v1|Deployment|nginx-promotion|nginx-candidate",
          stagingPreview,
          productionPreview,
        },
        release: {
          manifestDigest: releaseDigest,
          bundleDigest: normalizeDigest(release.Digest),
          target: targetRef,
        },
        argo,
        kubernetes,
        cleanup: {
          scratchSpaces: "deleted after receipt capture",
          cluster: "deleted after receipt capture",
        },
        limits: [
          "This is one fixed HTTP and capacity test on one local kind target. It is not a performance benchmark or production capacity recommendation.",
          "The example has no hooks, CRDs, Secrets, migrations, storage, or cloud prerequisites. Charts with those requirements need additional tests and explicit lifecycle work.",
          "The target requirement was two ready replicas. A different destination or service-level objective can produce a different accepted configuration.",
          "The test selected among three known candidates. It did not search every possible Kubernetes or Helm setting.",
        ],
      },
      status: {
        result: "pass",
        candidateTest: "pass",
        deterministicSelection: "pass",
        exactConfigPromotion: "pass",
        releaseOci: "pass",
        argoDelivery: "pass",
        kubernetesCheck: "pass",
        claim: "A fixed local test rejected a one-replica NGINX candidate, selected the smallest passing candidate, promoted that exact object set through ConfigHub, and delivered its ConfigHub release digest through Argo CD to Kubernetes.",
      },
    };
    verifyReceipt(receipt);
  } finally {
    if (clusterStarted || clusterPresent(cluster)) clusterDown(context, cluster);
    for (const space of Object.values(spaces).reverse()) deleteSpace(context, space);
  }

  check(receipt, "measured promotion proof did not complete");
  check(!clusterPresent(cluster), "measured promotion cluster remains");
  check(Object.values(spaces).every((space) => !spacePresent(context, space)), "a measured promotion Space remains");
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

async function testCandidate(cluster, path, replicas) {
  kubectl(cluster, ["apply", "-f", path]);
  kubectl(cluster, ["rollout", "status", "deployment/nginx-candidate", "-n", namespace, "--timeout=180s"]);
  const deployment = kubectlJson(cluster, ["get", "deployment", "nginx-candidate", "-n", namespace, "-o", "json"]);
  const readyReplicas = deployment.status?.readyReplicas ?? 0;
  const http = await runHttpTest(cluster);
  const checks = {
    allRequestsSucceeded: http.successfulRequests === requestCount,
    p95WithinLimit: http.p95Milliseconds <= maximumP95Milliseconds,
    destinationCapacity: readyReplicas >= requiredReadyReplicas,
  };
  return {
    id: `replicas-${replicas}`,
    path: relativeRepo(path),
    replicas,
    objectSetSha256: objectSetSha256(path),
    readyReplicas,
    requests: requestCount,
    successfulRequests: http.successfulRequests,
    successRate: http.successfulRequests / requestCount,
    p95Milliseconds: http.p95Milliseconds,
    checks,
    result: Object.values(checks).every(Boolean) ? "pass" : "blocked",
  };
}

async function runHttpTest(cluster) {
  const port = await freePort();
  const args = kubeArgs(cluster, ["port-forward", "service/nginx-candidate", `${port}:80`, "-n", namespace, "--address=127.0.0.1"]);
  const child = spawn("kubectl", args, { cwd: repoRoot, env: { ...process.env, CONFIGHUB_AGENT: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    await waitForPortForward(child);
    const latencies = [];
    let successfulRequests = 0;
    for (let index = 0; index < requestCount; index += 1) {
      const started = process.hrtime.bigint();
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000) });
      const body = await response.text();
      const elapsed = Number(process.hrtime.bigint() - started) / 1_000_000;
      latencies.push(elapsed);
      if (response.status === 200 && body.includes("promotion candidate test passed")) successfulRequests += 1;
    }
    latencies.sort((left, right) => left - right);
    return {
      successfulRequests,
      p95Milliseconds: Number(latencies[Math.ceil(latencies.length * 0.95) - 1].toFixed(3)),
    };
  } finally {
    child.kill("SIGTERM");
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleepAsync(2000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

function waitForPortForward(child) {
  return new Promise((resolve, reject) => {
    let text = "";
    const timeout = setTimeout(() => reject(new Error(`port-forward did not start: ${text}`)), 15_000);
    const read = (chunk) => {
      text += chunk.toString();
      if (/Forwarding from 127\.0\.0\.1:/.test(text)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`port-forward exited ${code}: ${text}`));
    });
  });
}

async function inspectDeliveredCandidate(cluster, selected) {
  const deployment = kubectlJson(cluster, ["get", "deployment", "nginx-candidate", "-n", namespace, "-o", "json"]);
  check(deployment.spec?.replicas === selected.replicas, "delivered replica count differs from selected candidate");
  check(deployment.status?.readyReplicas === selected.replicas, "delivered replicas are not ready");
  check(deployment.spec?.template?.spec?.containers?.[0]?.image === image, "delivered image differs from selected candidate");
  const http = await runHttpTest(cluster);
  check(http.successfulRequests === requestCount, "delivered candidate failed the fixed HTTP check");
  return {
    result: "pass",
    namespace,
    replicas: deployment.spec.replicas,
    readyReplicas: deployment.status.readyReplicas,
    image,
    successfulRequests: http.successfulRequests,
    requests: requestCount,
    p95Milliseconds: http.p95Milliseconds,
  };
}

function candidateYaml(replicas) {
  return `apiVersion: v1
kind: Namespace
metadata:
  name: ${namespace}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-page
  namespace: ${namespace}
data:
  index.html: |
    promotion candidate test passed
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-candidate
  namespace: ${namespace}
  labels:
    app.kubernetes.io/name: nginx-candidate
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app.kubernetes.io/name: nginx-candidate
  template:
    metadata:
      labels:
        app.kubernetes.io/name: nginx-candidate
    spec:
      containers:
        - name: nginx
          image: ${image}
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 1
            periodSeconds: 2
          livenessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 3
            periodSeconds: 5
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              cpu: 250m
              memory: 64Mi
          volumeMounts:
            - name: page
              mountPath: /usr/share/nginx/html/index.html
              subPath: index.html
      volumes:
        - name: page
          configMap:
            name: nginx-page
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-candidate
  namespace: ${namespace}
spec:
  selector:
    app.kubernetes.io/name: nginx-candidate
  ports:
    - name: http
      port: 80
      targetPort: http
`;
}

function testPlan() {
  return {
    apiVersion: "workshop.confighub.com/v1alpha1",
    kind: "PromotionTestPlan",
    metadata: { name: "nginx-fixed-candidate-test" },
    spec: {
      question: "Which exact NGINX configuration is the smallest one that passes our fixed test and destination requirement?",
      source: { type: "KubernetesYAML", current: "current.yaml", candidates: candidatePaths.map((path) => relativeRepo(path)) },
      workload: { image, requestPath: "/", expectedText: "promotion candidate test passed" },
      checks: { requests: requestCount, requiredSuccessRate: 1, maximumP95Milliseconds },
      selection: {
        requiredReadyReplicas,
        rule: "Choose the fewest replicas among candidates that pass every check. Use candidate id as the stable tie-breaker.",
      },
      lifecycle: { hooks: [], crds: [], secrets: [], migrations: [], setupJobs: [] },
      next: "Upload current.yaml as a ConfigHub base, replace it with the selected exact candidate, preview staging and production, then publish the production release OCI.",
    },
  };
}

function exampleReadme() {
  return `# Test candidates, then promote the one that passed

This example answers one practical question: which NGINX configuration should
move to the next environment?

It tests three exact Kubernetes configurations on the same throwaway cluster.
They differ only in the Deployment replica count: one, two, or three. Every
candidate must answer 60 HTTP requests, stay below a deliberately generous
local latency limit, and satisfy the destination requirement of two ready
replicas.

The one-replica candidate can serve traffic, but it does not meet the stated
destination requirement. The two- and three-replica candidates pass. The rule
selects the smallest passing candidate, so two replicas wins.

The live proof then uploads the current one-replica YAML to ConfigHub, replaces
it with the selected two-replica YAML, previews and runs staging and production
promotions, publishes the production release as OCI, and checks that Argo CD and
Kubernetes use that release.

Run the checked fixture locally:

\`\`\`bash
npm run measured-promotion:verify
\`\`\`

Run the live proof in an authenticated scratch context for the \`helm-catalog\`
organization:

\`\`\`bash
CUB_CONTEXT=<context> npm run measured-promotion:run
\`\`\`

This is not a performance benchmark. It proves one small decision process. A
chart with hooks, CRDs, Secrets, migrations, storage, or cloud prerequisites
needs tests for those parts before promotion.
`;
}

function verifyReceipt(receipt) {
  check(receipt.kind === "MeasuredPromotionProofReceipt", "measured promotion receipt has the wrong kind");
  check(receipt.status?.result === "pass", "measured promotion proof did not pass");
  for (const key of ["candidateTest", "deterministicSelection", "exactConfigPromotion", "releaseOci", "argoDelivery", "kubernetesCheck"]) {
    check(receipt.status[key] === "pass", `${key} did not pass`);
  }
  check(receipt.spec?.tests?.length === 3, "receipt must contain three candidate results");
  const tests = Object.fromEntries(receipt.spec.tests.map((item) => [item.id, item]));
  check(tests["replicas-1"]?.result === "blocked", "one-replica candidate was not blocked");
  check(tests["replicas-1"]?.checks?.destinationCapacity === false, "one-replica candidate did not fail the target fact");
  check(tests["replicas-2"]?.result === "pass", "two-replica candidate did not pass");
  check(tests["replicas-3"]?.result === "pass", "three-replica candidate did not pass");
  check(receipt.spec.decision?.selected === "replicas-2", "receipt selected the wrong candidate");
  const selectedHash = receipt.spec.decision?.objectSetSha256;
  check(/^sha256:[a-f0-9]{64}$/.test(selectedHash ?? ""), "selected object hash is invalid");
  for (const key of ["acceptedObjectSetSha256", "stagingObjectSetSha256", "productionObjectSetSha256"]) {
    check(receipt.spec.configHub?.[key] === selectedHash, `${key} differs from selected candidate`);
  }
  check(/^sha256:[a-f0-9]{64}$/.test(receipt.spec.release?.manifestDigest ?? ""), "release digest is invalid");
  check(receipt.spec.argo?.revision === receipt.spec.release?.manifestDigest, "Argo used another release digest");
  check(receipt.spec.kubernetes?.readyReplicas === 2, "delivered candidate did not have two ready replicas");
  check(receipt.spec.kubernetes?.successfulRequests === requestCount, "delivered candidate did not pass all HTTP requests");
  check(
    (receipt.spec.limits ?? []).some((line) => line.includes("not a performance benchmark")),
    "receipt does not state the performance boundary",
  );
}

function selfTest() {
  check(existsSync(receiptPath), "run the measured promotion proof before its self-test");
  const original = readYaml(receiptPath);
  for (const mutate of [
    (value) => { value.spec.decision.selected = "replicas-1"; },
    (value) => { value.spec.configHub.productionObjectSetSha256 = `sha256:${"0".repeat(64)}`; },
    (value) => { value.spec.argo.revision = `sha256:${"0".repeat(64)}`; },
  ]) {
    const changed = structuredClone(original);
    mutate(changed);
    let rejected = false;
    try { verifyReceipt(changed); } catch { rejected = true; }
    check(rejected, "a false measured promotion claim was accepted");
  }
}

function renderSummary(receipt) {
  const tests = receipt.spec.tests;
  return `# Test candidates, then promote the selected configuration

This live test compared three exact NGINX configurations on one throwaway kind
cluster. Every candidate served the same page. The destination also required at
least two ready replicas.

| Candidate | Ready replicas | HTTP results | p95 | Destination requirement | Decision |
| --- | ---: | ---: | ---: | --- | --- |
${tests.map((item) => `| ${item.id} | ${item.readyReplicas} | ${item.successfulRequests}/${item.requests} | ${item.p95Milliseconds} ms | ${item.checks.destinationCapacity ? "pass" : "blocked"} | ${item.result} |`).join("\n")}

The test selected **${receipt.spec.decision.selected}** because it was the
smallest candidate that passed every fixed check and the destination
requirement. Its object-set hash is
\`${receipt.spec.decision.objectSetSha256}\`.

That exact object set became the ConfigHub base, staging variant, and production
variant. ConfigHub published release OCI
\`${receipt.spec.release.manifestDigest}\`. Argo CD reported
${receipt.spec.argo.sync}/${receipt.spec.argo.health} at the same digest, and the
delivered Deployment had ${receipt.spec.kubernetes.readyReplicas} ready replicas.

## What this proves

- A test result can select one exact configuration rather than a vague set of values.
- The stated destination requirement can reject a configuration that still serves traffic.
- ConfigHub can keep and promote the selected object set without changing it.
- Argo CD can pull the resulting ConfigHub release OCI and reconcile it on Kubernetes.

## Limits

${receipt.spec.limits.map((line) => `- ${line}`).join("\n")}

The fixture is in \`examples/promotion/nginx-candidate-test/\`. The complete
machine receipt is \`runs/measured-promotion-proof/receipt.yaml\`.
`;
}

function candidateIdentity(path, replicas) {
  return { id: `replicas-${replicas}`, path: relativeRepo(path), replicas, objectSetSha256: objectSetSha256(path) };
}

function objectSetSha256(path) {
  return hashDocuments(parseDocs(readFileSync(path, "utf8")));
}

function inspectSpace(context, space) {
  const units = cubJson(context, ["unit", "list", "--space", space, "-o", "json"])
    .map((row) => row.Unit)
    .sort((left, right) => left.Slug.localeCompare(right.Slug));
  const documents = units.flatMap((unit) => parseDocs(cub(context, ["unit", "data", unit.Slug, "--space", space])));
  return { unitSlugs: units.map((unit) => unit.Slug), documents, objectSetSha256: hashDocuments(documents) };
}

function changedObjects(leftDocs, rightDocs) {
  const left = new Map(leftDocs.map((doc) => [objectIdentity(doc), stableValue(doc)]));
  const right = new Map(rightDocs.map((doc) => [objectIdentity(doc), stableValue(doc)]));
  return [...new Set([...left.keys(), ...right.keys()])]
    .filter((key) => JSON.stringify(left.get(key)) !== JSON.stringify(right.get(key)))
    .sort();
}

function variantCreate(context, variant, upstream, space, target) {
  const args = ["variant", "create", variant, upstream, "--space-pattern", `template:${space}`, "--environment", title(variant)];
  if (target) args.push("--target", target, "--namespace", namespace);
  else args.push("--no-argo-app");
  cub(context, args, { timeout: 420_000 });
}

function promotionPreview(context, space) {
  const result = tryCommand("cub", ["variant", "promote", space, "--dry-run", "-o", "mutations", "--context", context], { timeout: 240_000 });
  check(result.ok, `promotion preview failed for ${space}: ${result.error}`);
  const output = result.output.trim();
  return { changed: Boolean(output) && !/no (?:units|changes)/i.test(output), outputSha256: `sha256:${sha256(output)}`, outputLines: output ? output.split(/\r?\n/).length : 0 };
}

function waitForArgo(cluster, application, digest) {
  let last = {};
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const result = kubectlTry(cluster, ["get", "application", application, "-n", "argocd", "-o", "json"]);
    if (result.ok) {
      const app = JSON.parse(result.output);
      last = {
        application,
        sync: app.status?.sync?.status ?? "",
        health: app.status?.health?.status ?? "",
        operation: app.status?.operationState?.phase ?? "",
        revision: normalizeDigest(app.status?.sync?.revision),
      };
      if (last.sync === "Synced" && last.health === "Healthy" && last.revision === digest) return last;
    }
    sleep(4000);
  }
  throw new Error(`Argo did not converge: ${JSON.stringify(last)}`);
}

function clusterUp(context, name) {
  const result = tryCommand("cub", ["cluster", "up", "--name", name, "--no-ports", "--context", context], { timeout: 900_000 });
  check(result.ok, `cub cluster up failed: ${result.error}`);
  check(clusterPresent(name), `kind cluster ${name} is missing`);
  check(spacePresent(context, name), `cluster Space ${name} is missing`);
  check(spacePresent(context, `${name}-argo-apps`), `Argo apps Space ${name}-argo-apps is missing`);
}

function clusterDown(context, name) {
  const result = tryCommand("cub", ["cluster", "down", "--name", name, "--delete-config", "--force", "--context", context], { timeout: 600_000 });
  if (!result.ok && clusterPresent(name)) tryCommand("kind", ["delete", "cluster", "--name", name], { timeout: 180_000 });
  for (const space of [`${name}-argo-apps`, `argobot-${name}`, `${name}-cluster`, name]) deleteSpace(context, space);
}

function deleteSpace(context, space) {
  if (!spacePresent(context, space)) return;
  tryCommand("cub", ["space", "delete", space, "--recursive-force", "--quiet", "--context", context], { timeout: 300_000 });
}

function cub(context, args, options = {}) {
  const result = tryCommand("cub", [...args, "--context", context], options);
  check(result.ok, `cub ${args.slice(0, 3).join(" ")} failed: ${result.error}`);
  return result.output;
}

function cubJson(context, args, options = {}) {
  return JSON.parse(cub(context, args, options));
}

function kubectl(cluster, args, options = {}) {
  return command("kubectl", kubeArgs(cluster, args), options).output;
}

function kubectlJson(cluster, args) {
  const result = kubectlTry(cluster, args);
  check(result.ok, `kubectl ${args.slice(0, 4).join(" ")} failed: ${result.error}`);
  return JSON.parse(result.output);
}

function kubectlTry(cluster, args) {
  return tryCommand("kubectl", kubeArgs(cluster, args), { timeout: 180_000 });
}

function kubeArgs(cluster, args) {
  return ["--kubeconfig", join(homedir(), ".confighub", "clusters", `${cluster}.kubeconfig`), "--context", `kind-${cluster}`, ...args];
}

function command(file, args, options = {}) {
  const result = tryCommand(file, args, options);
  check(result.ok, `${file} ${args.slice(0, 4).join(" ")} failed: ${result.error}`);
  return result;
}

function tryCommand(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: repoRoot,
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    encoding: "utf8",
    input: options.input,
    timeout: options.timeout ?? 180_000,
    maxBuffer: 1024 * 1024 * 100,
  });
  return { ok: result.status === 0, output: result.stdout ?? "", error: [result.stderr, result.error?.message].filter(Boolean).join("\n").trim() };
}

function spacePresent(context, space) {
  return tryCommand("cub", ["space", "get", space, "--quiet", "--context", context], { timeout: 60_000 }).ok;
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function normalizeDigest(value) {
  return String(value ?? "").match(/sha256:[a-f0-9]{64}/)?.[0] ?? "";
}

function hashDocuments(documents) {
  const ordered = [...documents].sort((left, right) => objectIdentity(left).localeCompare(objectIdentity(right))).map(stableValue);
  return `sha256:${sha256(JSON.stringify(ordered))}`;
}

function objectIdentity(doc) {
  return [doc.apiVersion, doc.kind, doc.metadata?.namespace ?? "", doc.metadata?.name ?? ""].join("|");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

function sameStrings(left, right) {
  return [...left].sort().join("\n") === [...right].sort().join("\n");
}

function parseCubVersions(text) {
  return {
    client: text.match(/Client Version:[\s\S]*?Version:\s+(v[^\s]+)/)?.[1] ?? "",
    server: text.match(/Server Version:[\s\S]*?Version:\s+(v[^\s]+)/)?.[1] ?? "",
  };
}

function safeRunId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12);
}

function title(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function sleepAsync(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
