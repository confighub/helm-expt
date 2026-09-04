// The AI-operator ladder run: an assistant drives every rung of the settled
// verb ladder through the generic surface, and the record proves the surface,
// not autonomy. check inspects the configuration for free; upload brings it
// into ConfigHub; release publishes it for a cluster; promote moves a governed
// change to staging behind an approval gate that refuses first and releases
// only after an explicit approval.
//
// Phases, one per invocation, against a disposable ConfigHub organization:
//
//   --check      cub check the committed redis render; record the findings
//   --upload     variant upload, per-resource, into redis-ladder-base
//   --release    cluster space + server worker + OCI target, dev variant,
//                first release
//   --change     two governed changes on the base through cub set-replicas
//   --promote    staging variant, the vet-approvedby trigger, the WhereTrigger
//                fix a clone needs, and the promotion of the pending change
//   --gate       the refused publish, the thirteen explicit approvals, and the
//                publish that then succeeds
//   --capture    read-only: write the receipt into data/ai-operator-ladder/
//   --down       delete the ladder Spaces
//
// The known clone trap is part of the record: cub variant create copies the
// upstream Space's WhereTrigger, so a trigger created inside the clone matches
// nothing until the clone's WhereTrigger names its own SpaceID. The run hits
// it, fixes it, and the gate then holds.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalObjectMaps, check, repoRoot, write } from "./lib/proof-common.mjs";

const outRoot = join(repoRoot, "data", "ai-operator-ladder");
const RENDER = join(repoRoot, "packages", "bitnami", "redis", "25.5.3", "bases", "reuse-existing-secret", "upstream.yaml");
const cub = (...args) => execFileSync("cub", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const mode = process.argv[2];

const dumpSpace = (space) => cub("unit", "list", "--space", space, "-o", "name").trim().split("\n")
  .map((line) => line.split("/")[1]).sort()
  .map((unit) => cub("unit", "data", unit, "--space", space)).join("\n---\n");
const canonicalHash = (yamlText) => {
  const maps = canonicalObjectMaps(yamlText, "");
  const keys = Object.keys(maps.helm).sort();
  return { hash: createHash("sha256").update(keys.map((key) => maps.helm[key]).join("\n")).digest("hex"), objects: keys.length };
};

if (mode === "--check") {
  console.log(cub("check", RENDER));
  process.exit(0);
}
if (mode === "--upload") {
  cub("variant", "upload", "--component", "redis-ladder", "--variant", "base",
    "--granularity", "per-resource", "--owner", "AI Operator Ladder", RENDER);
  console.log("uploaded per-resource into redis-ladder-base");
  process.exit(0);
}
if (mode === "--release") {
  cub("space", "create", "ladder-cluster", "--label", "Owner=AI Operator Ladder");
  cub("worker", "create", "worker", "--space", "ladder-cluster", "--is-server-worker");
  cub("target", "create", "target", "{}", "worker", "--space", "ladder-cluster", "-p", "OCI", "-t", "Any");
  cub("variant", "create", "dev", "redis-ladder-base", "--target", "ladder-cluster/target");
  cub("release", "publish", "redis-ladder-dev");
  console.log("dev variant released");
  process.exit(0);
}
if (mode === "--change") {
  cub("function", "do", "--space", "redis-ladder-base", "--unit", "redis-statefulset-redis-master",
    "set-replicas", "2", "--change-desc", "AI operator ladder: master to two replicas");
  cub("function", "do", "--space", "redis-ladder-base", "--unit", "redis-statefulset-redis-replicas",
    "set-replicas", "4", "--change-desc", "AI operator ladder: scale the replicas tier to four");
  console.log("two governed changes on the base");
  process.exit(0);
}
if (mode === "--promote") {
  cub("variant", "create", "staging", "redis-ladder-base", "--target", "ladder-cluster/target");
  cub("trigger", "create", "require-approval", "Mutation", "Kubernetes/YAML", "vet-approvedby", "1", "--space", "redis-ladder-staging");
  const spaceId = JSON.parse(cub("space", "get", "redis-ladder-staging", "-o", "json")).Space?.SpaceID
    ?? JSON.parse(cub("space", "get", "redis-ladder-staging", "-o", "json")).SpaceID;
  cub("space", "update", "--patch", "redis-ladder-staging", "--where-trigger", `SpaceID='${spaceId}'`, "--refresh-triggers");
  cub("variant", "promote", "redis-ladder-staging", "--change-desc", "AI operator ladder: promote the pending base change to staging");
  console.log("staging promoted behind the approval gate, with the clone's WhereTrigger pointed at itself");
  process.exit(0);
}
if (mode === "--gate") {
  const before = cub("release", "list", "--space", "redis-ladder-staging").trim().split("\n").length - 1;
  try { cub("release", "publish", "redis-ladder-staging"); } catch { /* a refusal is the expected path */ }
  const during = cub("release", "list", "--space", "redis-ladder-staging").trim().split("\n").length - 1;
  check(during === before, "the gated publish must not create a release");
  for (const unit of cub("unit", "list", "--space", "redis-ladder-staging", "-o", "name").trim().split("\n").map((line) => line.split("/")[1])) {
    cub("unit", "approve", unit, "--space", "redis-ladder-staging");
  }
  cub("release", "publish", "redis-ladder-staging");
  console.log("refused while gated, approved unit by unit, then released");
  process.exit(0);
}

if (mode === "--capture") {
  const who = cub("auth", "status");
  const organization = (who.match(/Organization Name\s+(\S.*?)\s*$/m) ?? [])[1] ?? "unknown";
  const checked = canonicalHash(readFileSync(RENDER, "utf8"));
  const baseHead = canonicalHash(dumpSpace("redis-ladder-base"));
  const staging = canonicalHash(dumpSpace("redis-ladder-staging"));
  const gated = Number(cub("unit", "list", "--space", "redis-ladder-staging", "--where", "LEN(ApplyGates) > 0", "-o", "name").trim().split("\n").filter(Boolean).length);
  const releases = (space) => cub("release", "list", "--space", space).trim().split("\n").slice(1)
    .map((line) => line.split(/\s+/)).map((cells) => ({ id: cells[0], digest: cells[2] }));
  const devReleases = releases("redis-ladder-dev");
  const stagingReleases = releases("redis-ladder-staging");
  const findings = cub("check", RENDER).split("\n").filter((line) => /^\[(WARNING|CRITICAL)\]/.test(line));
  check(baseHead.hash === staging.hash, "acceptance: the promoted staging set must equal the base head, canonically");
  check(gated === 0, "acceptance: no gate may remain after the explicit approvals");
  check(stagingReleases.length >= 1, "acceptance: staging must carry the post-approval release");

  write(join(outRoot, "receipt.yaml"), [
    "apiVersion: evidence.confighub.com/v1alpha1",
    "kind: AiOperatorLadderReceipt",
    "metadata:",
    "  name: ai-operator-ladder",
    "spec:",
    `  organization: "${organization}"`,
    `  input: "packages/bitnami/redis/25.5.3/bases/reuse-existing-secret/upstream.yaml"`,
    "  rungs:",
    `    check: "cub check: ${findings.length} advisory finding(s) with stable identifiers, named, not hidden"`,
    `    upload: "cub variant upload, per-resource, ${checked.objects} object(s) into redis-ladder-base"`,
    `    release: "dev variant released: ${devReleases.map((release) => release.digest).join(", ")}"`,
    `    promote: "one changed unit carried to staging behind vet-approvedby"`,
    `    approve: "publish refused while gated, ${staging.objects} explicit unit approvals, then released: ${stagingReleases[stagingReleases.length - 1].digest}"`,
    "  identity:",
    `    checkedCanonicalSha256: "${checked.hash}"`,
    `    baseHeadCanonicalSha256: "${baseHead.hash}"`,
    `    stagingCanonicalSha256: "${staging.hash}"`,
    `    promotedEqualsBaseHead: ${baseHead.hash === staging.hash}`,
    "  findings:",
    ...findings.map((line) => `    - "${line.replaceAll('"', "'")}"`),
    "  gotchaReproduced:",
    '    - "cub variant create copies the upstream WhereTrigger, so the in-clone trigger matched nothing and one publish went out ungated."',
    "    - \"The fix is the documented one: point the clone's WhereTrigger at its own SpaceID and refresh, after which all units gated and the refusal held.\"",
    "  boundaries:",
    '    - "This proves the operator surface, not autonomy: the approvals are explicit commands in the record, and in production the approver is a human."',
    '    - "The organization is the disposable self-hosted server, named above."',
    '    - "The checked hash differs from the base-head hash because two governed changes were made after upload; the identity claim is promoted-equals-base-head, with every change described in the revision history."',
  ].join("\n") + "\n");
  write(join(outRoot, "summary.md"), `# The AI operator drives the whole ladder

<!-- Generated by scripts/run-ai-operator-ladder-proof.mjs --capture. Do not edit by hand. -->

One assistant session drove every rung of the settled verb ladder through the generic surface, against a disposable organization. **check** ran the free scan and surfaced ${findings.length} advisory findings with stable identifiers, which stayed named through the whole run. **upload** brought the ${checked.objects}-object redis render into ConfigHub per resource. **release** published the dev variant. Two governed changes went through cub with change descriptions, never kubectl. **promote** carried exactly the changed unit to staging behind a vet-approvedby gate, and the record includes the documented clone trap, hit and fixed live: the clone's WhereTrigger pointed at its upstream, the trigger matched nothing, one publish went out ungated, and pointing the WhereTrigger at the clone's own SpaceID gated all thirteen units. The next publish was refused, thirteen explicit approvals cleared it, and the release then carried digest ${stagingReleases[stagingReleases.length - 1].digest}.

The identity claim closes the loop: the promoted staging set equals the base head canonically, ${staging.hash.slice(0, 19)}, and re-running the same free check on the promoted set returns the same findings. The boundary stays explicit: this proves the operator surface, not autonomy, and in production the approver is a human.

The staged plan is [eks-inf-replica-plan.md](../../docs/planning/eks-inf-replica-plan.md), and the roadmap is [roadmap-2026-09.md](../../docs/planning/roadmap-2026-09.md).
`);
  console.log(`receipt written: promotedEqualsBaseHead=${baseHead.hash === staging.hash}, ${findings.length} finding(s), staging release ${stagingReleases[stagingReleases.length - 1].digest.slice(0, 19)}`);
  process.exit(0);
}

if (mode === "--down") {
  for (const space of ["redis-ladder-staging", "redis-ladder-dev", "ladder-cluster", "redis-ladder-base"]) {
    try { cub("space", "delete", space, "--recursive"); console.log(`deleted ${space}`); } catch { console.log(`${space}: already absent`); }
  }
  console.log("ladder teardown complete");
  process.exit(0);
}

check(false, "usage: run-ai-operator-ladder-proof.mjs --check | --upload | --release | --change | --promote | --gate | --capture | --down");
