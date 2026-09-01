// The CI-rendered catalog journey: a team whose CI already renders its charts
// into plain YAML in git has accepted the premise, render before commit, and
// implemented the weak half of it: text in a repo. This journey lands those
// exact renders in ConfigHub as governed data and then shows, step by step,
// what data adds over text: queries across the catalog, changes with named
// history, environment variants with protected values, and releases by digest
// that the reconciler pulls unchanged.
//
// Phases, one per invocation, against a disposable ConfigHub organization:
//
//   --fixture    assemble "your repo": three CI-rendered files, taken verbatim
//                from the catalog's committed renders so the fixture is real
//                rendered YAML, not invented content
//   --land       cub check each file (the free look), then variant upload each
//                one per-resource into a base Space
//   --advantage  what text cannot do: a fleet query, a governed change with a
//                change description, a staging variant with one protected
//                value, and a release published by digest
//   --capture    read-only: verify the identity claims and write the receipt
//                to data/ci-rendered-catalog/
//   --down       delete everything the journey created
//
// The identity claim is the pitch: the objects in ConfigHub are canonically
// equal to the files CI rendered, receipted, so holding them as data loses
// nothing and adds the governed surface.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalObjectMaps, check, repoRoot, write } from "./lib/proof-common.mjs";

const cub = (...args) => execFileSync("cub", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const mode = process.argv[2];
const FIXTURE_DIR = join(tmpdir(), "ci-rendered-catalog-repo");
const COMPONENTS = [
  { name: "redis", render: "packages/bitnami/redis/25.5.3/bases/reuse-existing-secret/upstream.yaml" },
  { name: "metrics-server", render: "packages/metrics-server/metrics-server/3.13.1/bases/default/upstream.yaml" },
  { name: "traefik", render: "packages/traefik/traefik/41.0.2/bases/default/upstream.yaml" },
];

const dumpSpace = (space) => cub("unit", "list", "--space", space, "-o", "name").trim().split("\n")
  .map((line) => line.split("/")[1]).sort()
  .map((unit) => cub("unit", "data", unit, "--space", space)).join("\n---\n");

if (mode === "--fixture") {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  for (const component of COMPONENTS) {
    writeFileSync(join(FIXTURE_DIR, `${component.name}.yaml`), readFileSync(join(repoRoot, component.render)));
    console.log(`  ${component.name}.yaml <- ${component.render}`);
  }
  console.log(`fixture repo assembled at ${FIXTURE_DIR}`);
  process.exit(0);
}

if (mode === "--land") {
  for (const component of COMPONENTS) {
    const scan = cub("check", join(FIXTURE_DIR, `${component.name}.yaml`));
    const findings = (scan.match(/^Findings: (\d+)/m) ?? [])[1] ?? "0";
    cub("variant", "upload", "--component", component.name, "--variant", "base",
      "--granularity", "per-resource", "--owner", "CI Rendered Catalog", join(FIXTURE_DIR, `${component.name}.yaml`));
    console.log(`  ${component.name}: checked (${findings} advisory finding(s)), landed per-resource in ${component.name}-base`);
  }
  process.exit(0);
}

if (mode === "--advantage") {
  // 1. Query the whole catalog like a database, which grep on a repo is not.
  const deployments = cub("k8s", "get", "deploy", "--space", "*").trim().split("\n").length - 1;
  console.log(`  query: ${deployments} Deployment(s) across the landed catalog via cub k8s get`);

  // 2. A change with a named reason, kept in history.
  cub("function", "do", "--space", "traefik-base", "--where", "Slug LIKE '%deployment%'",
    "set-annotation", "example.com/reviewed-by", "platform-review", "--change-desc", "Journey: record the review that approved this render");
  console.log("  history: a governed change with its change description recorded");

  // 3. A staging variant whose one local choice is protected from upstream.
  cub("space", "create", "ci-cluster", "--label", "Owner=CI Rendered Catalog");
  cub("worker", "create", "worker", "--space", "ci-cluster", "--is-server-worker");
  cub("target", "create", "target", "{}", "worker", "--space", "ci-cluster", "-p", "OCI", "-t", "Any");
  cub("variant", "create", "staging", "redis-base", "--target", "ci-cluster/target");
  cub("function", "do", "--space", "redis-staging", "--unit", "redis-statefulset-redis-master",
    "--protect", "set-replicas", "3", "--change-desc", "Journey: staging runs three replicas, a protected local choice");
  console.log("  variant: redis-staging created; its replica choice protected against upstream merges");

  // 4. A release the reconciler pulls by digest.
  cub("release", "publish", "redis-staging");
  console.log("  release: redis-staging published; the digest is what a reconciler pulls");
  process.exit(0);
}

if (mode === "--capture") {
  const who = cub("auth", "status");
  const organization = (who.match(/Organization Name\s+(\S.*?)\s*$/m) ?? [])[1] ?? "unknown";
  const identity = COMPONENTS.map((component) => {
    const file = readFileSync(join(FIXTURE_DIR, `${component.name}.yaml`), "utf8");
    const maps = canonicalObjectMaps(file, dumpSpace(`${component.name}-base`));
    const keys = Object.keys(maps.helm).sort();
    const sameSet = JSON.stringify(keys) === JSON.stringify(Object.keys(maps.cub).sort());
    const differing = keys.filter((key) => maps.cub[key] && maps.helm[key] !== maps.cub[key]);
    return { name: component.name, objects: keys.length, sameSet, differing, maps, canonical: createHash("sha256").update(keys.map((key) => maps.helm[key]).join("\n")).digest("hex") };
  });
  // redis and metrics-server were never touched after landing: they must equal
  // the CI files canonically. traefik took the governed change, so it must
  // differ from its frozen file in exactly one object, only at the annotation
  // the change description names. The divergence IS the demonstration: text
  // stays frozen, data moves with its reason recorded.
  for (const row of identity) {
    check(row.sameSet, `acceptance: ${row.name} must hold the same object set as the CI file`);
    if (row.name === "traefik") {
      check(row.differing.length === 1 && row.differing[0].endsWith("|Deployment|traefik|traefik"), "acceptance: traefik must diverge in exactly the Deployment the governed change touched");
      const before = JSON.parse(row.maps.helm[row.differing[0]]);
      const after = JSON.parse(row.maps.cub[row.differing[0]]);
      check(after.metadata.annotations?.["example.com/reviewed-by"] === "platform-review" && !before.metadata.annotations,
        "acceptance: the divergence must be exactly the reviewed-by annotation the history explains");
    } else {
      check(row.differing.length === 0, `acceptance: ${row.name} in ConfigHub must equal the CI-rendered file canonically`);
    }
  }
  const deploymentUnit = cub("unit", "list", "--space", "traefik-base", "--where", "Slug LIKE '%deployment%'", "-o", "name").trim().split("\n")[0].split("/")[1];
  const historyLine = cub("revision", "list", deploymentUnit, "--space", "traefik-base").split("\n").find((line) => line.includes("record the review"));
  check(Boolean(historyLine), "acceptance: the change description must be visible in revision history");
  const mutations = cub("unit", "get", "redis-statefulset-redis-master", "--space", "redis-staging", "-o", "mutations");
  check(/Locally overridden[\s\S]*replicas/i.test(mutations), "acceptance: the protected replica choice must show as a local override");
  const releases = cub("release", "list", "--space", "redis-staging").trim().split("\n").slice(1).map((line) => line.split(/\s+/));
  check(releases.length >= 1, "acceptance: the staging release must exist");
  const digest = releases[releases.length - 1][2];

  write(join(repoRoot, "data", "ci-rendered-catalog", "receipt.yaml"), [
    "apiVersion: evidence.confighub.com/v1alpha1",
    "kind: CiRenderedCatalogReceipt",
    "metadata:",
    "  name: ci-rendered-catalog-journey",
    "spec:",
    `  organization: "${organization}"`,
    '  fixture: "three CI-rendered files taken verbatim from the catalog\'s committed renders"',
    "  identity:",
    ...identity.flatMap((row) => [
      `    - component: "${row.name}"`,
      `      objects: ${row.objects}`,
      `      equalToFile: ${row.differing.length === 0}`,
      ...(row.differing.length ? [`      divergence: "one object, one annotation, explained by the recorded change description; the CI file stays frozen while the data moves with its reason"`] : []),
      `      fileCanonicalSha256: "${row.canonical}"`,
    ]),
    '  history: "the change description is visible in cub revision list, quoted in the walkthrough"',
    '  protectedChoice: "redis-staging keeps replicas as a local override; cub unit get -o mutations lists it under Locally overridden"',
    `  releaseDigest: "${digest}"`,
    "  boundaries:",
    '    - "The organization is a disposable self-hosted server; the journey creates and removes everything it uses."',
    '    - "Delivery to a reconciler is not re-proven here: the Flux and operator-ladder receipts carry the exact-digest handoffs this release would ride."',
    '    - "A private catalog at CI scale, with private sources and team access, is the commercial tier, and the site says so."',
  ].join("\n") + "\n");
  console.log(`receipt: two components equal their CI files, one diverged exactly as its history says, one protected choice, release ${digest.slice(0, 19)}`);
  process.exit(0);
}

if (mode === "--down") {
  for (const space of ["redis-staging", "ci-cluster", ...COMPONENTS.map((component) => `${component.name}-base`)]) {
    try { cub("space", "delete", space, "--recursive"); console.log(`  deleted ${space}`); } catch { console.log(`  ${space}: already absent`); }
  }
  console.log("journey teardown complete");
  process.exit(0);
}

check(false, "usage: run-ci-rendered-catalog-journey.mjs --fixture | --land | --advantage | --capture | --down");
