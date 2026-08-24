import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

import { check, repoRoot } from "./lib/proof-common.mjs";
import { join } from "node:path";

const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(readFileSync(join(repoRoot, "scripts/site/vendor/js-yaml-4.1.0.min.js"), "utf8"), context);
vm.runInContext(readFileSync(join(repoRoot, "scripts/site/config-workshop-yaml.js"), "utf8"), context);

const tools = context.ConfigWorkshopYaml;
check(tools, "browser YAML tools did not load");

const scannerCandidateText = readFileSync(join(repoRoot, "testdata/config-workshop/cub-check-candidate.yaml"), "utf8");
const scannerCandidate = tools.parseObjectSet(scannerCandidateText, "cub-check-candidate.yaml");
const scannerIdentityPayload = tools.scannerObjectSetPayload(scannerCandidate);
const scannerObjectSetSha256 = "sha256:" + createHash("sha256").update(scannerIdentityPayload.payload).digest("hex");
check(scannerIdentityPayload.objectCount === 2, "scanner-compatible object count changed");
check(
  scannerObjectSetSha256 === "sha256:85539e2681fc7cf865b6f50663daf84a19f28202df0ee6c2aa2c78927df448be",
  "browser object-set digest differs from the released scanner",
);
const cubCheckDocument = {
  schema_version: "risk-scan-findings-v1",
  surface: "cub-scan",
  finding_count: 2,
  findings: [{ id: "CCVE-TEST-1" }, { id: "CCVE-TEST-2" }],
  provenance: {
    source: "cub-scan",
    source_version: "v0.7.3",
    scan_time: "2026-08-24T13:00:00Z",
    catalog_version: "risk-catalog-v1.json@7d47e57df947",
  },
  pattern_bundle: {
    schema_version: "bundle-manifest-v1",
    version: "v0.7.3",
    source_repo: "confighubai/confighub-scan",
    manifest_sha256: "a".repeat(64),
    catalog_sha256: "b".repeat(64),
  },
  input: {
    object_count: scannerIdentityPayload.objectCount,
    object_set_sha256: scannerObjectSetSha256,
  },
};
const cubCheckReceipt = tools.validateCubCheckReceipt(cubCheckDocument, {
  objectCount: scannerIdentityPayload.objectCount,
  objectSetSha256: scannerObjectSetSha256,
});
check(cubCheckReceipt.authority === "local-advisory", "local scanner result gained managed authority");
check(cubCheckReceipt.findingIds.join(",") === "CCVE-TEST-1,CCVE-TEST-2", "stable scanner finding IDs were not retained");
const changedScannerCandidate = tools.parseObjectSet(scannerCandidateText.replace("replicas: 2", "replicas: 3"), "cub-check-candidate.yaml");
const changedPayload = tools.scannerObjectSetPayload(changedScannerCandidate);
const changedSha256 = "sha256:" + createHash("sha256").update(changedPayload.payload).digest("hex");
let mismatchRejected = false;
try {
  tools.validateCubCheckReceipt(cubCheckDocument, { objectCount: changedPayload.objectCount, objectSetSha256: changedSha256 });
} catch (error) {
  mismatchRejected = String(error.message).includes("does not describe the candidate objects");
}
check(mismatchRejected, "a cub check result for different objects was accepted");
let missingBundleRejected = false;
try {
  tools.validateCubCheckReceipt({ ...cubCheckDocument, pattern_bundle: undefined }, {
    objectCount: scannerIdentityPayload.objectCount,
    objectSetSha256: scannerObjectSetSha256,
  });
} catch (error) {
  missingBundleRejected = String(error.message).includes("pattern bundle identity");
}
check(missingBundleRejected, "a cub check result without pinned pattern identity was accepted");

const deployment = (replicas, image, secret = "") => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
  namespace: test
spec:
  replicas: ${replicas}
  template:
    spec:
      containers:
        - name: app
          image: ${image}${secret ? `
          env:
            - name: API_KEY
              value: ${secret}` : ""}
`;

const oldSource = tools.parseObjectSet(deployment(3, "app:v1"), "old-source");
const oldAccepted = tools.parseObjectSet(deployment(2, "app:v1"), "old-accepted");
const newSource = tools.parseObjectSet(deployment(3, "app:v2"), "new-source");
const newAccepted = tools.parseObjectSet(deployment(2, "app:v2"), "new-accepted");
const classified = tools.classifySourceAware(oldSource, oldAccepted, newSource, newAccepted);
check(classified.status === "compared", "four-way source classification did not run");
check(classified.rows.some((row) => row.path === "/spec/replicas" && row.class === "overridden" && row.mode === "kept"), "kept post-render replica edit was not classified");
check(
  classified.rows.some((row) => row.path.endsWith("/image") && row.class === "upstream-added" && row.sourceChanged === true),
  "source image change was not classified as a source change",
);
check(classified.counts.overlaps === 0, "independent source and post-render changes were reported as an overlap");

const overlap = tools.classifySourceAware(
  oldSource,
  oldAccepted,
  tools.parseObjectSet(deployment(4, "app:v1"), "new-source"),
  tools.parseObjectSet(deployment(1, "app:v1"), "new-accepted"),
);
check(overlap.rows.some((row) => row.path === "/spec/replicas" && row.needsReview), "source and post-render overlap was not marked for review");

const keptOverlap = tools.classifySourceAware(
  oldSource,
  oldAccepted,
  tools.parseObjectSet(deployment(4, "app:v1"), "new-source"),
  tools.parseObjectSet(deployment(2, "app:v1"), "new-accepted"),
);
check(keptOverlap.rows.some((row) => row.path === "/spec/replicas" && row.mode === "kept" && row.needsReview), "a retained override on a changed source field was not marked for review");

const secretReview = tools.classifySourceAware(
  tools.parseObjectSet(deployment(3, "app:v1", "old-key"), "old-source"),
  tools.parseObjectSet(deployment(3, "app:v1", "old-key"), "old-accepted"),
  tools.parseObjectSet(deployment(3, "app:v1", "new-key"), "new-source"),
  tools.parseObjectSet(deployment(3, "app:v1", "new-key"), "new-accepted"),
);
check(secretReview.rows.some((row) => row.path.endsWith("/value") && row.newAccepted === "<redacted>"), "sensitive field values were not redacted");

const differentlyOrdered = `kind: Deployment
apiVersion: apps/v1
metadata: { namespace: test, name: app }
spec:
  template:
    spec:
      containers: [{ image: app:v1, name: app }]
  replicas: 3
`;
const noOp = tools.compareObjectSets(oldSource, tools.parseObjectSet(differentlyOrdered, "reordered"));
check(noOp.changed.length === 0 && noOp.noOp.length === 1, "representation-only YAML change was not classified as no-op");

const digest = `sha256:${"a".repeat(64)}`;
const partial = tools.parseTargetResults("staging | pass | healthy | " + digest + "\nprod | not-run | waiting |", [], digest);
check(partial.overall === "partial" && partial.counts.pass === 1 && partial.counts["not-run"] === 1, "partial target results were collapsed");
const mismatch = tools.parseTargetResults("staging | pass | healthy | sha256:" + "b".repeat(64), [], digest);
check(mismatch.overall === "blocked" && !mismatch.targets[0].digestMatches, "mismatched target digest was not blocked");

const passingWorkflow = (reconciliation = "argo-cd") => ({
  candidateDigest: digest,
  initiatedBy: "ci",
  responsibilities: {
    changeManagement: "ConfigHub",
    reconciliation,
    runtimeRollout: "Sveltos",
  },
  stages: [
    {
      name: "pilot",
      targets: [{ name: "pilot-a", status: "pass", digest, observedAt: "2026-08-23T10:00:00Z" }],
      gates: [{ type: "policy", status: "pass", candidateDigest: digest }],
    },
    {
      name: "staging",
      targets: [{ name: "staging-a", status: "pass", digest, observedAt: "2026-08-23T10:10:00Z" }],
      gates: [
        { type: "compatibility", status: "pass", candidateDigest: digest },
        { type: "approval", status: "pass", candidateDigest: digest },
        { type: "soak", status: "pass", candidateDigest: digest },
      ],
    },
    {
      name: "production",
      parallel: true,
      targets: [
        { name: "prod-a", status: "pass", digest, observedAt: "2026-08-23T10:20:00Z" },
        { name: "prod-b", status: "pass", digest, observedAt: "2026-08-23T10:20:00Z" },
      ],
      gates: [{ type: "approval", status: "pass", candidateDigest: digest }],
    },
  ],
  events: [{ type: "write", operationId: "publish-production" }],
});

const orderedWorkflow = tools.evaluateChangeWorkflow(passingWorkflow());
check(orderedWorkflow.overall === "pass", "ordered pilot, staging, and production workflow did not pass");
check(orderedWorkflow.initiatedBy === "ci", "CI initiation was not retained");
check(orderedWorkflow.stages[2].parallel && orderedWorkflow.stages[2].counts.pass === 2, "parallel production targets were not retained");
check(orderedWorkflow.responsibilities.separated, "ConfigHub, Argo CD, and runtime rollout responsibilities were not separated");

const staleWorkflow = passingWorkflow();
staleWorkflow.stages[1].gates[0].candidateDigest = `sha256:${"b".repeat(64)}`;
staleWorkflow.stages[1].targets[0].digest = `sha256:${"b".repeat(64)}`;
const staleResult = tools.evaluateChangeWorkflow(staleWorkflow);
check(staleResult.stages[1].decision === "blocked", "stale gate and target evidence did not block the stage");
check(staleResult.stages[2].blockers.includes("The previous stage has not passed."), "a later stage ignored a failed prior stage");

const partialFleetWorkflow = passingWorkflow();
partialFleetWorkflow.stages[2].targets[1].status = "blocked";
const partialFleetResult = tools.evaluateChangeWorkflow(partialFleetWorkflow);
check(partialFleetResult.stages[2].outcome === "partial", "one unhealthy target did not produce a partial fleet result");
check(partialFleetResult.stages[2].decision === "blocked", "a partial fleet was allowed to continue");

const gatedWorkflow = passingWorkflow();
gatedWorkflow.stages[0].targets[0].status = "blocked";
for (const gate of gatedWorkflow.stages[1].gates) gate.status = "blocked";
const gatedResult = tools.evaluateChangeWorkflow(gatedWorkflow);
check(gatedResult.stages[1].blockers.some((value) => value.includes("previous stage")), "prior-stage success was not enforced");
for (const gate of ["compatibility", "approval", "soak"]) {
  check(gatedResult.stages[1].blockers.some((value) => value.startsWith(gate)), `${gate} gate was not enforced`);
}

const exceptionWorkflow = passingWorkflow();
exceptionWorkflow.stages[0].gates[0] = { type: "policy", status: "blocked", candidateDigest: digest, exceptionId: "exception-1" };
exceptionWorkflow.events.unshift({
  type: "exception-open",
  id: "exception-1",
  reason: "Emergency repair",
  approvedBy: "on-call-reviewer",
  expiresAt: "2099-01-01T00:00:00Z",
});
const exceptionActive = tools.evaluateChangeWorkflow(exceptionWorkflow);
check(exceptionActive.stages[0].decision === "pass" && exceptionActive.activeExceptions.includes("exception-1"), "active emergency exception was not recorded or applied");
exceptionWorkflow.events.push({ type: "exception-resolved", id: "exception-1" });
const exceptionResolved = tools.evaluateChangeWorkflow(exceptionWorkflow);
check(exceptionResolved.stages[0].decision === "blocked" && exceptionResolved.resolvedExceptions.includes("exception-1"), "resolved emergency exception still bypassed the gate");

const resumedWorkflow = passingWorkflow();
resumedWorkflow.events.push({ type: "pause", stage: "staging" }, { type: "resume", stage: "staging" });
const resumedResult = tools.evaluateChangeWorkflow(resumedWorkflow);
check(resumedResult.stages[1].decision === "pass" && resumedResult.duplicateWrites.length === 0, "pause and resume changed or duplicated a write");
resumedWorkflow.events.push({ type: "write", operationId: "publish-production" });
check(tools.evaluateChangeWorkflow(resumedWorkflow).duplicateWrites.length === 1, "duplicate write operation was not detected");

const currentHealthWorkflow = passingWorkflow();
currentHealthWorkflow.stages[2].targets.push({
  name: "prod-a",
  status: "blocked",
  digest,
  observedAt: "2026-08-23T10:30:00Z",
});
const currentHealth = tools.evaluateChangeWorkflow(currentHealthWorkflow);
check(currentHealth.stages[2].outcome === "partial", "current unhealthy target did not replace an earlier green result");

const fluxWorkflow = tools.evaluateChangeWorkflow(passingWorkflow("flux"));
check(fluxWorkflow.responsibilities.separated && fluxWorkflow.responsibilities.reconciliation === "flux", "Flux responsibility boundary was not retained");

const recordIndex = JSON.parse(readFileSync(join(repoRoot, "data/base-variant-records/records.json"), "utf8"));
const redisRecord = recordIndex.records.find((record) => record.metadata?.name === "bitnami-redis-25-5-3-reuse-existing-secret");
check(redisRecord, "Redis BaseVariantRecord fixture is missing");
const redisLifecycle = tools.lifecycleFromRecord(redisRecord, oldSource);
check(redisLifecycle.coverage.routes.state === "none-recorded", "an empty lifecycle route list was not kept distinct from target-fact coverage");
check(redisLifecycle.coverage.targetFacts.state === "attached", "Redis target-fact coverage was not retained");
check(redisLifecycle.requirements.some((requirement) => requirement.name === "redis/redis-existing-secret"), "Redis Secret prerequisite was not retained");

console.log("config workshop YAML browser self-test: pass");
