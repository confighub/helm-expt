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
import { dirname, join } from "node:path";

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

function verifyReceipt(path) {
  const receipt = readYaml(path);
  const name = receipt?.metadata?.name ?? path;
  verifyStructure(name, receipt);
  const hashes = verifyHashes(name, receipt);
  const citations = verifyVerdictCitation(name, receipt);
  return { hashes, citations };
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
  for (const path of paths) {
    const result = verifyReceipt(path);
    hashes += result.hashes;
    citations += result.citations;
  }
  console.log(
    `strict ingest: ${paths.length} receipt(s) admitted, ${hashes} file hash(es) matched, ${citations} verdict citation(s) confirmed`,
  );
}

function expectRefusal(label, mutate) {
  const base = readYaml(receiptPaths()[0]);
  const copy = JSON.parse(JSON.stringify(base));
  mutate(copy);
  try {
    verifyStructure("self-test", copy);
    verifyHashes("self-test", copy);
    verifyVerdictCitation("self-test", copy);
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
  console.log("strict ingest self-test: 6 refusal(s) fired as required");
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
