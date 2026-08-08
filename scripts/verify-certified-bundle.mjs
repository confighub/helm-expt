#!/usr/bin/env node
// The strict ingest check the certified-bundle spec promises: a bundle without
// a receipt is just a tarball, and a strict consumer may refuse it. This
// verifier is that consumer, run offline over every committed
// CertifiedBundleReceipt. It refuses a receipt whose structure is malformed,
// whose file manifest does not hash-match the committed bytes it names, whose
// certified verdict cites no verdict receipt, or whose lane disagrees with the
// verdict it cites. Spec: docs/reference/certified-bundle-spec.md. Schema:
// schemas/certified-bundle-receipt.schema.json.
//
//   node scripts/verify-certified-bundle.mjs --verify      strict pass over all receipts
//   node scripts/verify-certified-bundle.mjs --self-test   prove each refusal fires

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { check, readYaml, repoRoot, sha256File } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";

const RECEIPTS_DIR = join(repoRoot, "data", "certified-bundles", "receipts");

const LANES = ["safe-to-flatten", "flatten-with-routes", "do-not-flatten", "born-flattened"];
const STATUSES = ["provisional", "certified"];
const FINDINGS = ["absent", "present", "present-gated", "not-evaluated"];
const CONTENTS_KINDS = [
  "rendered-config",
  "literal-config",
  "chart-package",
  "component-definition",
];
const CLASSES = [
  "helm-hooks",
  "resource-policy-keep",
  "lookup",
  "webhook-ca",
  "capabilities-api-versions",
  "generated-secrets",
  "crd-ordering",
  "immutable-fields",
  "namespace-creation",
  "subchart-conditions",
  "test-hooks",
];

function refuse(name, message) {
  throw new Error(`strict ingest refuses ${name}: ${message}`);
}

// Where a receipt's file paths resolve to committed bytes. Witness-backed
// receipts resolve under the witness files directory; repo-relative paths
// resolve directly; component receipts resolve inside their recorded source
// directory. A path that resolves nowhere is a refusal, never a skip.
function resolveFile(receipt, filePath) {
  const spec = receipt.spec;
  if (spec.provenance.witness) {
    const witnessDir = join(repoRoot, dirname(spec.provenance.witness));
    const candidate = join(witnessDir, "files", filePath);
    if (existsSync(candidate)) return candidate;
  }
  const direct = join(repoRoot, filePath);
  if (existsSync(direct)) return direct;
  for (const root of spec.provenance.generatedFrom ?? []) {
    if (root.endsWith(`/${filePath}`)) {
      const exact = join(repoRoot, root);
      if (existsSync(exact)) return exact;
    }
    const candidate = join(repoRoot, root, filePath);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function verifyStructure(name, receipt) {
  if (receipt.apiVersion !== "evidence.confighub.com/v1alpha1")
    refuse(name, `unexpected apiVersion ${receipt.apiVersion}`);
  if (receipt.kind !== "CertifiedBundleReceipt")
    refuse(name, `unexpected kind ${receipt.kind}`);
  if (!receipt.metadata?.name) refuse(name, "metadata.name is missing");
  const spec = receipt.spec;
  for (const section of ["producer", "source", "bundle", "ingest", "dispositions", "verdict", "provenance"]) {
    if (!spec?.[section]) refuse(name, `spec.${section} is missing`);
  }
  if (!CONTENTS_KINDS.includes(spec.bundle.contentsKind))
    refuse(name, `unknown contentsKind ${spec.bundle.contentsKind}`);
  if (!Array.isArray(spec.bundle.files) || spec.bundle.files.length === 0)
    refuse(name, "the bundle names no files");
  if (spec.ingest.granularity !== "per-file")
    refuse(name, `unknown ingest granularity ${spec.ingest.granularity}`);
  if (spec.ingest.externalSourceAnnotation !== "confighub.com/external-source")
    refuse(name, "the external-source annotation contract is missing");
  const classes = spec.dispositions.map((row) => row.class);
  for (const cls of CLASSES) {
    if (!classes.includes(cls)) refuse(name, `no disposition row for quirk class ${cls}`);
  }
  for (const row of spec.dispositions) {
    if (!FINDINGS.includes(row.finding))
      refuse(name, `unknown finding ${row.finding} for ${row.class}`);
    if (!row.disposition) refuse(name, `empty disposition for ${row.class}`);
  }
  if (!LANES.includes(spec.verdict.lane)) refuse(name, `unknown lane ${spec.verdict.lane}`);
  if (!STATUSES.includes(spec.verdict.status))
    refuse(name, `unknown verdict status ${spec.verdict.status}`);
}

function verifyHashes(name, receipt) {
  let checked = 0;
  for (const file of receipt.spec.bundle.files) {
    const resolved = resolveFile(receipt, file.path);
    if (!resolved) refuse(name, `bundle file resolves nowhere: ${file.path}`);
    const actual = sha256File(resolved);
    const expected = String(file.sha256).replace(/^sha256:/, "");
    if (actual !== expected)
      refuse(name, `bundle file hash mismatch for ${file.path}: receipt ${expected}, bytes ${actual}`);
    checked += 1;
  }
  return checked;
}

function verifyVerdictCitation(name, receipt) {
  const verdict = receipt.spec.verdict;
  if (verdict.status !== "certified") return 0;
  if (verdict.lane === "born-flattened") return 0;
  const cited = String(verdict.decidedBy ?? "").match(
    /((?:recipes|data)\/[A-Za-z0-9._/-]+flattening-safety-verdict[A-Za-z0-9._-]*\.yaml)/,
  );
  if (!cited)
    refuse(name, "a certified lane must cite the flattening-safety verdict that decided it");
  const verdictPath = join(repoRoot, cited[1]);
  if (!existsSync(verdictPath)) refuse(name, `cited verdict does not exist: ${cited[1]}`);
  const verdictLane = readFileSync(verdictPath, "utf8").match(/lane:\s*"([a-z-]+)"/)?.[1];
  if (verdictLane !== verdict.lane)
    refuse(
      name,
      `lane disagrees with the cited verdict: receipt says ${verdict.lane}, ${cited[1]} says ${verdictLane}`,
    );
  return 1;
}

// A route is only worth anything if the bundle actually carries it. Two ways
// that can be false, and both are defects rather than gaps: a disposition can
// point at a route file the bundle does not ship, and a bundle can ship a route
// no disposition claims. The third case, a lane that needs routes and ships
// none, is honest unfinished work rather than a broken artifact, so it is
// reported rather than refused.
const ROUTE_KINDS = [
  "apply-ordering",
  "lifecycle-job",
  "prune-protection",
  "external-secret-reference",
  "versioned-replacement",
];

// A route is an artifact a delivery runtime is meant to execute, so a
// malformed one is worse than a missing one: it looks actionable and is not.
function verifyRouteDocument(name, path) {
  const route = readYaml(path);
  const label = `${name} route ${relative(repoRoot, path)}`;
  if (route.apiVersion !== "evidence.confighub.com/v1alpha1")
    refuse(label, `unexpected apiVersion ${route.apiVersion}`);
  if (route.kind !== "BundleRoute") refuse(label, `unexpected kind ${route.kind}`);
  const spec = route.spec ?? {};
  if (!CLASSES.includes(spec.quirkClass)) refuse(label, `unknown quirk class ${spec.quirkClass}`);
  if (!ROUTE_KINDS.includes(spec.routeKind)) refuse(label, `unknown route kind ${spec.routeKind}`);
  if (!spec.discharges) refuse(label, "the route does not say what breaks without it");
  if (!Array.isArray(spec.boundedness) || spec.boundedness.length === 0)
    refuse(label, "boundedness must be a non-empty list, so a route states its own limits");
  const runtimes = spec.executedBy?.runtimes;
  if (!Array.isArray(runtimes) || runtimes.length === 0)
    refuse(
      label,
      "executedBy.runtimes must be a non-empty list. A route no runtime can execute is a refusal, not a route.",
    );
  for (const runtime of runtimes) {
    if (!runtime?.name || !runtime?.mechanism)
      refuse(label, "every runtime must name itself and how it expresses the route");
  }
  if (spec.routeKind === "apply-ordering") {
    const stages = spec.declaration?.stages;
    if (!Array.isArray(stages) || stages.length < 2)
      refuse(label, "an ordering route needs at least two stages, or it orders nothing");
    const orders = stages.map((stage) => stage.order);
    if (orders.some((order, index) => order !== index + 1))
      refuse(label, `stage order must run 1..n without gaps, found ${orders.join(", ")}`);
    // Two producers independently added a field for the same idea under
    // different names, and only an out-of-band schema check noticed. An unknown
    // key on a stage is a vocabulary drifting apart, so it is refused here.
    const STAGE_KEYS = ["order", "name", "selector", "waitFor", "objectCount", "observedSyncWave"];
    for (const stage of stages) {
      const unknown = Object.keys(stage).filter((key) => !STAGE_KEYS.includes(key));
      if (unknown.length > 0)
        refuse(label, `stage "${stage.name}" carries unknown field(s): ${unknown.join(", ")}. Add them to the schema, or use the name the schema already has.`);
    }
  }
}

function verifyRouteIntegrity(name, receipt) {
  const spec = receipt.spec;
  const shipped = spec.bundle.files
    .filter((file) => String(file.role ?? "").startsWith("route:"))
    .map((file) => ({ path: file.path, quirk: String(file.role).slice("route:".length).trim() }));

  const referenced = [];
  for (const row of spec.dispositions) {
    const match = String(row.disposition ?? "").match(/route this bundle ships at ([^\s,;]+)/);
    if (match) referenced.push({ quirk: row.class, path: match[1] });
  }

  for (const reference of referenced) {
    const carried = shipped.find((route) => route.path === reference.path);
    if (!carried)
      refuse(
        name,
        `the ${reference.quirk} disposition points at a route the bundle does not ship: ${reference.path}`,
      );
    if (carried.quirk !== reference.quirk)
      refuse(
        name,
        `route ${reference.path} is carried for ${carried.quirk} but referenced by the ${reference.quirk} disposition`,
      );
  }

  for (const route of shipped) {
    const onDisk = join(repoRoot, route.path);
    if (existsSync(onDisk)) verifyRouteDocument(name, onDisk);
    if (!referenced.some((reference) => reference.path === route.path))
      refuse(
        name,
        `the bundle ships a route no disposition references: ${route.path}. A route nothing claims is either unused or the disposition forgot it.`,
      );
  }

  // Per-class debt. Saying a bundle owes prune protection beats saying it owes
  // something, and the disposition now states the kind rather than implying it
  // in prose. Reading it from the wording was tried and reverted: it called four
  // resolutions debts, and a check that cries wolf teaches readers to skip it.
  const carriedKinds = new Set();
  for (const route of shipped) {
    const onDisk = join(repoRoot, route.path);
    if (!existsSync(onDisk)) continue;
    const kind = readRouteKind(onDisk);
    if (kind) carriedKinds.add(kind);
  }

  const owed = [];
  for (const row of spec.dispositions) {
    const required = row.companionRequired;
    if (!required) continue;
    if (row.finding !== "present")
      refuse(
        name,
        `the ${row.class} disposition requires a ${required} companion but its finding is ${row.finding}. A class that found nothing cannot owe an artifact.`,
      );
    if (!carriedKinds.has(required)) owed.push({ quirk: row.class, required });
  }

  const certified = spec.verdict.status === "certified";
  if (certified && spec.verdict.lane === "flatten-with-routes" && owed.length > 0) {
    const list = owed.map((debt) => `${debt.quirk} owes ${debt.required}`).join(", ");
    refuse(name, `a certified flatten-with-routes bundle is missing companions it names: ${list}`);
  }

  return {
    routes: shipped.length,
    owed: owed.map((debt) => `${name}: ${debt.quirk} owes ${debt.required}`),
  };
}

// A route's kind lives in its own document, not in the receipt, so the debt
// check has to open it. Reading the file rather than trusting the role string
// means a mislabelled route cannot satisfy a debt it does not discharge.
function readRouteKind(onDisk) {
  const doc = readYaml(onDisk);
  return doc?.spec?.routeKind ?? null;
}

// The model promises three artifact classes travel inside a bundle: the
// rendered configuration, the routes, and the words an operator needs beside
// them. The first two are checked above. Without this, the third could quietly
// stop shipping and the bundle would still look complete.
function verifySpaceGuide(name, receipt) {
  const guides = receipt.spec.bundle.files.filter((file) => file.role === "space-guide");
  if (guides.length === 0)
    refuse(
      name,
      "the bundle ships no space guide. A bundle carries the configuration, the routes, and the words an operator needs beside them; nothing explanatory lives out of band.",
    );
  if (guides.length > 1)
    refuse(name, `the bundle ships ${guides.length} space guides, so a reader cannot tell which one governs`);
  return 1;
}

function verifyReceipt(path) {
  const receipt = readYaml(path);
  const name = receipt?.metadata?.name ?? path;
  verifyStructure(name, receipt);
  const hashes = verifyHashes(name, receipt);
  const citations = verifyVerdictCitation(name, receipt);
  const routing = verifyRouteIntegrity(name, receipt);
  const guides = verifySpaceGuide(name, receipt);
  return { hashes, citations, guides, ...routing };
}

function receiptPaths() {
  const paths = [];
  const stack = [RECEIPTS_DIR];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === "receipt.yaml") paths.push(full);
    }
  }
  return paths.sort();
}

function runVerify() {
  const paths = receiptPaths();
  check(paths.length > 0, "no certified-bundle receipts found");
  let hashes = 0;
  let citations = 0;
  let routes = 0;
  let guides = 0;
  const owed = [];
  for (const path of paths) {
    const result = verifyReceipt(path);
    hashes += result.hashes;
    citations += result.citations;
    routes += result.routes;
    guides += result.guides;
    owed.push(...result.owed);
  }
  console.log(
    `strict ingest: ${paths.length} receipt(s) admitted, ${hashes} file hash(es) matched, ${citations} verdict citation(s) confirmed, ${routes} route(s) carried, ${guides} space guide(s)`,
  );
  // Naming these is the point. A provisional bundle that owes a companion is
  // not a broken artifact, it is work the route lane has not reached, and
  // silence would let it read as finished. Certified bundles do not get this
  // grace: the refusal above stops them.
  if (owed.length > 0) {
    console.log(`strict ingest: ${owed.length} outstanding companion artifact(s):`);
    for (const debt of owed) console.log(`  ${debt}`);
  }
}

// Pick a receipt that actually carries what the case needs to break, rather
// than whichever sorts first. The route cases silently stopped testing anything
// the moment a receipt without a route sorted ahead of the one with it.
function receiptCarryingARoute() {
  for (const path of receiptPaths()) {
    const receipt = readYaml(path);
    if (receipt.spec.bundle.files.some((file) => String(file.role ?? "").startsWith("route:")))
      return receipt;
  }
  return null;
}

function expectRefusal(label, mutate, receiptOverride) {
  const base = receiptOverride ?? readYaml(receiptPaths()[0]);
  const copy = JSON.parse(JSON.stringify(base));
  mutate(copy);
  try {
    verifyStructure("self-test", copy);
    verifyHashes("self-test", copy);
    verifyVerdictCitation("self-test", copy);
    verifyRouteIntegrity("self-test", copy);
    verifySpaceGuide("self-test", copy);
  } catch (error) {
    if (String(error.message).startsWith("strict ingest refuses")) return;
    throw error;
  }
  throw new Error(`self-test failed: ${label} was admitted instead of refused`);
}

function runSelfTest() {
  const paths = receiptPaths();
  check(paths.length > 0, "no certified-bundle receipts found");
  expectRefusal("a tampered file hash", (receipt) => {
    receipt.spec.bundle.files[0].sha256 = "0".repeat(64);
  });
  expectRefusal("a file that resolves nowhere", (receipt) => {
    receipt.spec.bundle.files[0].path = "no/such/file.yaml";
  });
  expectRefusal("an unknown lane", (receipt) => {
    receipt.spec.verdict.lane = "probably-fine";
  });
  expectRefusal("a missing quirk class row", (receipt) => {
    receipt.spec.dispositions = receipt.spec.dispositions.slice(1);
  });
  expectRefusal("a certified lane with no verdict citation", (receipt) => {
    receipt.spec.verdict.status = "certified";
    receipt.spec.verdict.lane = "safe-to-flatten";
    receipt.spec.verdict.decidedBy = "someone said so";
  });
  expectRefusal("a dropped ingest contract", (receipt) => {
    receipt.spec.ingest.externalSourceAnnotation = "";
  });
  // Both route refusals need a receipt that ships a route, or they would pass
  // by breaking nothing.
  const routed = receiptCarryingARoute();
  check(routed, "no receipt ships a route, so the route refusals cannot be self-tested");
  expectRefusal("a disposition pointing at a route the bundle does not ship", (receipt) => {
    receipt.spec.bundle.files = receipt.spec.bundle.files.filter(
      (file) => !String(file.role ?? "").startsWith("route:"),
    );
  }, routed);
  // Clear every disposition rather than rewriting the wording that references a
  // route. Producers word it differently, and a mutation tied to one producer's
  // phrasing stops testing anything the moment another producer ships a route.
  expectRefusal("a route no disposition references", (receipt) => {
    for (const row of receipt.spec.dispositions) row.disposition = "none required";
  }, routed);
  expectRefusal("a bundle that ships no space guide", (receipt) => {
    receipt.spec.bundle.files = receipt.spec.bundle.files.filter((file) => file.role !== "space-guide");
  });
  // Name a companion kind nothing carries. Deleting the route instead would fire
  // the dangling-reference case above and prove nothing about per-class debt.
  expectRefusal("a certified bundle naming a companion it does not ship", (receipt) => {
    const row = receipt.spec.dispositions.find((entry) => entry.finding === "present");
    row.companionRequired = "versioned-replacement";
  }, routed);
  expectRefusal("a companion owed by a class that found nothing", (receipt) => {
    const row = receipt.spec.dispositions.find((entry) => entry.finding === "absent");
    row.companionRequired = "prune-protection";
  }, routed);
  console.log("strict ingest self-test: 11 refusal(s) fired as required");
}

if (mode === "--verify") {
  runVerify();
} else if (mode === "--self-test") {
  runSelfTest();
} else {
  console.log(`Usage:
  node scripts/verify-certified-bundle.mjs --verify
  node scripts/verify-certified-bundle.mjs --self-test`);
}
