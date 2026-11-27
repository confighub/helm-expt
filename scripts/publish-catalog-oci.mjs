#!/usr/bin/env node
// Publishes the Catalog's configuration OCI artifacts that are not installer
// packages (certified bundles, NVIDIA literal bundles, NIMService variants and
// the Timoni Redis configuration) to oci://<REGISTRY>/<name>:<tag>, signed
// keylessly with cosign. REGISTRY defaults to ghcr.io/confighub/configs/catalog.
// scripts/lib/catalog-oci.mjs says what each artifact is, how its bytes are
// built, and why its tag is what it is.
//
// A tag is published once. A tag the registry already serves at the expected
// digest is skipped; one it serves at another digest stops the run, because a
// published tag is never overwritten. So a run after a merge publishes exactly
// what the merge added, and a second run publishes nothing.
//
// Each new artifact is pushed by digest with no tag, signed, and only then
// tagged, so a tag always names a signed manifest. It is then read back with
// no credentials. GHCR creates a new package private, and the run fails with
// the setting to change rather than leave an artifact nobody can pull.
//
// The registry login is the caller's (oras login, or docker's). Signing needs
// cosign on PATH and, in GitHub Actions, id-token: write; the signing identity
// is then the workflow that ran this.
//
// Environment:
//   REGISTRY      where to publish (default ghcr.io/confighub/configs/catalog)
//   SIGN          "false" publishes unsigned, for a trial against a registry of
//                 your own
//   RECEIPTS_DIR  where --publish and --observe write receipts. The default is
//                 runs/catalog-oci for the default registry, and nowhere for
//                 any other, so a trial never writes evidence into the repo.
//   CONCURRENCY   artifacts handled at once (default 6)
//
// Usage:
//   node scripts/publish-catalog-oci.mjs --plan [--offline] [--only <name,...>] [--kind <kind>]
//   node scripts/publish-catalog-oci.mjs --publish [--only <name,...>] [--kind <kind>]
//   node scripts/publish-catalog-oci.mjs --observe [--only <name,...>] [--kind <kind>]
//   node scripts/publish-catalog-oci.mjs --generate | --verify | --self-test

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { check, readYamlText, repoRoot, write } from "./lib/proof-common.mjs";
import {
  CATALOG_OCI_AWAITING,
  CATALOG_OCI_IDENTITY_REGEXP,
  CATALOG_OCI_KINDS,
  CATALOG_OCI_OIDC_ISSUER,
  CATALOG_OCI_PUBLISHED,
  CATALOG_OCI_RECEIPT_ROOT,
  CATALOG_OCI_REGISTRY,
  anonymousEnv,
  catalogOciArtifacts,
  catalogOciDigestOf,
  catalogOciIndexCsv,
  catalogOciOutputs,
  catalogOciReceiptDoc,
  catalogOciReceiptProblems,
  catalogOciReceiptRel,
  catalogOciRegistry,
  catalogOciVerifyCommand,
  catalogOciYaml,
  certifiedBundleTar,
  cleanDir,
  fetchDescriptor,
  fetchRecordedBytes,
  makePublicFix,
  pushUntagged,
  readCatalogOciIndex,
  referenceZlibGzip,
  signDigest,
  tagDigest,
  verifySignature,
} from "./lib/catalog-oci.mjs";

const args = process.argv.slice(2);
const MODES = ["--plan", "--publish", "--observe", "--generate", "--verify", "--self-test"];
const mode = args.find((arg) => MODES.includes(arg)) ?? "--plan";
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] ?? "" : "");
const known = new Set([...MODES, "--offline", "--only", "--kind"]);
const unknown = args.filter((arg, index) => (arg.startsWith("--") ? !known.has(arg) : !["--only", "--kind"].includes(args[index - 1])));
if (unknown.length > 0) {
  console.error(`publish-catalog-oci: unknown argument ${unknown.join(" ")}`);
  process.exit(2);
}

const registry = catalogOciRegistry();
const sign = process.env.SIGN !== "false";
const concurrency = Math.max(1, Number(process.env.CONCURRENCY ?? 6));
const receiptsDir = process.env.RECEIPTS_DIR
  ? process.env.RECEIPTS_DIR
  : registry === CATALOG_OCI_REGISTRY ? join(repoRoot, CATALOG_OCI_RECEIPT_ROOT) : "";

function selectArtifacts() {
  const kind = valueOf("--kind");
  check(!kind || CATALOG_OCI_KINDS.includes(kind), `--kind takes one of ${CATALOG_OCI_KINDS.join(", ")}`);
  const artifacts = catalogOciArtifacts({ registry, kinds: kind ? [kind] : CATALOG_OCI_KINDS });
  const only = valueOf("--only").split(",").filter(Boolean);
  if (only.length === 0) return artifacts;
  const selected = artifacts.filter((artifact) => only.includes(artifact.name));
  const missing = only.filter((name) => !selected.some((artifact) => artifact.name === name));
  check(missing.length === 0, `no catalog OCI artifact is named ${missing.join(", ")}`);
  return selected;
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        results[index] = { status: "failed", message: error.message };
      }
    }
  }));
  return results;
}

// What the registry says about one artifact, read anonymously first, as a
// consumer reads it, then with the caller's credential when that fails.
async function registryState(artifact, anonymous) {
  const open = await fetchDescriptor(artifact.reference, { anonymous });
  if (open.state === "present") {
    return open.digest === artifact.manifestDigest ? { status: "present" } : { status: "conflict", digest: open.digest };
  }
  if (open.state === "error") return { status: "failed", message: `reading ${artifact.reference}: ${open.message}` };
  const authed = await fetchDescriptor(artifact.reference);
  if (authed.state === "present") {
    if (authed.digest !== artifact.manifestDigest) return { status: "conflict", digest: authed.digest };
    return { status: "private" };
  }
  if (authed.state === "missing" || (authed.state === "denied" && open.state !== "error")) return { status: "missing" };
  return { status: "failed", message: `reading ${artifact.reference}: ${authed.message ?? open.message}` };
}

function conflictMessage(artifact, digest) {
  return `${artifact.reference} already names ${digest}, and the committed files build ${artifact.manifestDigest}. A published tag is never overwritten; if the bytes changed, the tag changes with them, so this is a registry the workflow did not write`;
}

function writeReceipt(artifact, { signature, anonymousPull }) {
  if (!receiptsDir) return "";
  const path = join(receiptsDir, `${artifact.name}/${artifact.tag}.yaml`);
  const receipt = catalogOciReceiptDoc(artifact, { observedAt: new Date().toISOString(), signature, anonymousPull });
  write(path, catalogOciYaml(receipt));
  return path.startsWith(`${repoRoot}/`) ? path.slice(repoRoot.length + 1) : path;
}

const signatureRecord = (verification) => ({
  result: verification.result,
  identityRegexp: CATALOG_OCI_IDENTITY_REGEXP,
  issuer: CATALOG_OCI_OIDC_ISSUER,
  command: "cosign verify --certificate-identity-regexp <identity> --certificate-oidc-issuer <issuer> <immutable reference>",
});

async function publishOne(artifact, { work, anonymous }) {
  const state = await registryState(artifact, anonymous);
  if (state.status === "present") return { status: "present" };
  if (state.status === "conflict") return { status: "failed", message: conflictMessage(artifact, state.digest) };
  if (state.status === "private") return { status: "failed", message: `${artifact.reference} is published and cannot be pulled without credentials; ${makePublicFix(artifact)}` };
  if (state.status === "failed") return state;
  const dir = join(work, artifact.name);
  const bytes = artifact.source === "copied"
    ? await fetchRecordedBytes(artifact, join(dir, "earlier"), { anonymous })
    : { manifest: artifact.manifest, blobs: artifact.blobs };
  check(catalogOciDigestOf(bytes.manifest) === artifact.manifestDigest, `${artifact.name}: the bytes to push are not ${artifact.manifestDigest}`);
  await pushUntagged(artifact, bytes, join(dir, "push"));
  if (sign) await signDigest(artifact);
  await tagDigest(artifact);
  const pulled = await fetchDescriptor(artifact.reference, { anonymous });
  if (pulled.state !== "present") {
    return { status: "failed", message: `${artifact.reference} was pushed${sign ? " and signed" : ""} and cannot be pulled without credentials; ${makePublicFix(artifact)}` };
  }
  check(pulled.digest === artifact.manifestDigest, `${artifact.reference} reads back as ${pulled.digest}`);
  let verification = { result: "not-checked" };
  if (sign) {
    verification = await verifySignature(artifact, { anonymous });
    check(verification.result === "verified", `${artifact.immutableReference} was signed and does not verify as the catalog OCI workflow: ${verification.message}`);
  }
  const receipt = writeReceipt(artifact, {
    signature: signatureRecord(verification),
    anonymousPull: { result: "pass", digest: pulled.digest },
  });
  return { status: "published", receipt };
}

async function observeOne(artifact, { anonymous }) {
  const open = await fetchDescriptor(artifact.reference, { anonymous });
  if (open.state === "missing" || open.state === "denied") return { status: "absent" };
  if (open.state !== "present") return { status: "failed", message: open.message };
  if (open.digest !== artifact.manifestDigest) return { status: "failed", message: conflictMessage(artifact, open.digest) };
  const verification = sign ? await verifySignature(artifact, { anonymous }) : { result: "not-checked" };
  if (sign && verification.result !== "verified") return { status: "failed", message: `${artifact.immutableReference} does not verify as the catalog OCI workflow: ${verification.message}` };
  const receipt = writeReceipt(artifact, {
    signature: signatureRecord(verification),
    anonymousPull: { result: "pass", digest: open.digest },
  });
  return { status: "observed", receipt };
}

function report(lines) {
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}

async function registryModes() {
  const artifacts = selectArtifacts();
  const work = mkdtempSync(join(tmpdir(), "catalog-oci-"));
  const anonymous = anonymousEnv(join(work, "anonymous"));
  try {
    if (mode === "--plan") {
      const offline = args.includes("--offline");
      const states = offline ? artifacts.map(() => ({ status: "not-read" })) : await pool(artifacts, (artifact) => registryState(artifact, anonymous));
      const tally = {};
      artifacts.forEach((artifact, index) => {
        const state = states[index];
        tally[state.status] = (tally[state.status] ?? 0) + 1;
        const verb = { "not-read": "would push unless present", missing: "would push", present: "present", conflict: "CONFLICT", private: "PRIVATE", failed: "FAILED" }[state.status];
        console.log(`${verb.padEnd(25)} ${artifact.kind.padEnd(22)} ${artifact.source.padEnd(8)} ${artifact.reference}@${artifact.manifestDigest}`);
        if (state.status === "conflict") console.log(`  ${conflictMessage(artifact, state.digest)}`);
        if (state.status === "private") console.log(`  ${makePublicFix(artifact)}`);
        if (state.status === "failed") console.log(`  ${state.message}`);
      });
      report([
        `plan: ${artifacts.length} artifact(s) for ${registry}: ${Object.entries(tally).map(([key, value]) => `${value} ${key}`).join(", ")}.`,
        `${artifacts.filter((artifact) => artifact.source === "rebuilt").length} rebuilt from committed files, ${artifacts.filter((artifact) => artifact.source === "copied").length} copied at their recorded digest. Nothing was written.`,
      ]);
      if (states.some((state) => ["conflict", "failed"].includes(state.status))) process.exitCode = 1;
      return;
    }
    const worker = mode === "--publish" ? publishOne : observeOne;
    const results = await pool(artifacts, (artifact) => worker(artifact, { work, anonymous }));
    const tally = {};
    const failures = [];
    const lines = [];
    artifacts.forEach((artifact, index) => {
      const result = results[index];
      tally[result.status] = (tally[result.status] ?? 0) + 1;
      if (result.status === "failed") failures.push(`- FAIL ${artifact.reference}: ${result.message}`);
      if (["published", "observed"].includes(result.status)) lines.push(`- ${result.status} ${artifact.reference}@${artifact.manifestDigest}${result.receipt ? ` (receipt ${result.receipt})` : ""}`);
    });
    for (const line of lines) console.log(line);
    report([
      `${mode.slice(2)}: ${artifacts.length} artifact(s) in ${registry}: ${Object.entries(tally).map(([key, value]) => `${value} ${key}`).join(", ")}${sign ? "" : " (SIGN=false: nothing was signed)"}.`,
      ...failures,
    ]);
    // exitCode, not exit(): exit() drops stdout still queued for a pipe, which
    // is how a failed run in Actions lost the lines naming what failed.
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    cleanDir(work);
  }
}

function generateOrVerify() {
  const outputs = catalogOciOutputs();
  if (mode === "--generate") {
    for (const [rel, contents] of outputs) write(join(repoRoot, rel), contents);
    console.log(`wrote ${[...outputs.keys()].join(" and ")}`);
    return;
  }
  for (const [rel, expected] of outputs) {
    const path = join(repoRoot, rel);
    check(existsSync(path), `${rel} is missing; run npm run catalog-oci:generate`);
    check(readFileSync(path, "utf8") === expected, `${rel} is stale; run npm run catalog-oci:generate`);
  }
  const rows = readCatalogOciIndex();
  console.log(`verified ${rows.size} catalog OCI artifact(s): ${[...rows.values()].filter((row) => row.ghcr_state === CATALOG_OCI_PUBLISHED).length} with a GHCR receipt, ${[...rows.values()].filter((row) => row.ghcr_state === CATALOG_OCI_AWAITING).length} awaiting the workflow`);
}

function selfTest() {
  const artifacts = catalogOciArtifacts();
  const count = (predicate) => artifacts.filter(predicate).length;
  // Everything published to the Google registry is either rebuilt to the same
  // digest or copied at it. Nothing reaches GHCR at a digest the Catalog has
  // not recorded, except an artifact that was never published anywhere.
  for (const artifact of artifacts) {
    if (artifact.earlier) {
      check(artifact.manifestDigest === artifact.earlier.manifestDigest, `self-test: ${artifact.name} would publish ${artifact.manifestDigest}, not the recorded ${artifact.earlier.manifestDigest}`);
    } else {
      check(artifact.source === "rebuilt", `self-test: ${artifact.name} was never published and has no bytes of its own`);
    }
    if (artifact.source === "rebuilt") {
      check(catalogOciDigestOf(artifact.manifest) === artifact.manifestDigest, `self-test: ${artifact.name} carries a manifest of another digest`);
      const manifest = JSON.parse(artifact.manifest.toString("utf8"));
      const blobDigests = artifact.blobs.map(catalogOciDigestOf);
      check(
        [manifest.config, ...manifest.layers].every((descriptor) => blobDigests.includes(descriptor.digest)),
        `self-test: ${artifact.name} lacks a blob its manifest names`,
      );
    }
    check(artifact.tag !== "latest", `self-test: ${artifact.name} would be tagged latest`);
    check(artifact.tag.endsWith(artifact.manifestDigest.slice(7, 19)) || artifact.kind === "timoni-config", `self-test: ${artifact.name}'s tag ${artifact.tag} does not carry its digest`);
  }
  check(new Set(artifacts.map((artifact) => artifact.reference)).size === artifacts.length, "self-test: two artifacts share a reference");
  // The certified-bundle layer writer reproduces a known bsdtar archive: one
  // file, then the two end blocks and padding to a 10240-byte record.
  const tar = certifiedBundleTar([{ path: "README.md", data: Buffer.from("hello\n") }]);
  check(tar.length === 10240, "self-test: a one-file archive is not one 10240-byte record");
  check(tar.subarray(0, 11).toString("latin1") === "./README.md" && tar.subarray(257, 263).toString("latin1") === "ustar\0", "self-test: the header is not a ustar header for ./README.md");
  const gzip = referenceZlibGzip(tar);
  check(gzip[9] === 3 && gzip.readUInt32LE(4) === 0 && gunzipSync(gzip).equals(tar), "self-test: the gzip container does not read back, or carries a time or another operating system");
  const listed = spawnSync("tar", ["-tvzf", "-"], { input: gzip, encoding: "utf8" });
  if (listed.status === 0) check(/README\.md/.test(listed.stdout) && /\b0\/0\b|\b0\s+0\b|root/.test(listed.stdout), "self-test: the system tar does not read the archive as ./README.md owned by 0:0");
  // Receipt refusals, in both directions.
  const subject = artifacts.find((artifact) => artifact.source === "rebuilt");
  const verified = { result: "verified", identityRegexp: CATALOG_OCI_IDENTITY_REGEXP, issuer: CATALOG_OCI_OIDC_ISSUER, command: "fixture" };
  const fixture = catalogOciReceiptDoc(subject, { observedAt: "2026-01-01T00:00:00.000Z", signature: verified, anonymousPull: { result: "pass", digest: subject.manifestDigest } });
  check(catalogOciReceiptProblems(readYamlText(catalogOciYaml(fixture)), subject).length === 0, "self-test: a faithful receipt was refused after a YAML round trip");
  for (const [label, change, pattern] of [
    ["another digest", (doc) => { doc.spec.manifestDigest = `sha256:${"0".repeat(64)}`; }, /records sha256:0{64}/],
    ["no signature", (doc) => { doc.spec.signature.result = "not-checked"; }, /no verified signature/],
    ["another identity", (doc) => { doc.spec.signature.identityRegexp = ".*"; }, /workflow identity/],
    ["no anonymous pull", (doc) => { doc.spec.anonymousPull.result = "fail"; }, /no anonymous pull/],
    ["another tag", (doc) => { doc.spec.reference = `${subject.repository}:latest`; }, /records .*:latest/],
  ]) {
    const doc = structuredClone(fixture);
    change(doc);
    check(catalogOciReceiptProblems(doc, subject).some((problem) => pattern.test(problem)), `self-test: a receipt with ${label} was accepted`);
  }
  check(catalogOciReceiptRel(subject.name, subject.tag) === `${CATALOG_OCI_RECEIPT_ROOT}/${subject.name}/${subject.tag}.yaml`, "self-test: the receipt path moved");
  check(catalogOciVerifyCommand(subject.immutableReference).includes(`'${CATALOG_OCI_IDENTITY_REGEXP}'`), "self-test: the verify command does not pin the workflow identity");
  // The index reads back as it was written.
  const rows = [{ kind: "certified-bundle", name: "a", record: "r,1", source: "rebuilt", ghcr_reference: "x", manifest_digest: "d", ghcr_state: CATALOG_OCI_AWAITING, ghcr_receipt: "", earlier_reference: "", same_digest_as_earlier: "", verify_command: "cosign verify --x 'a,b' y" }];
  const dir = mkdtempSync(join(tmpdir(), "catalog-oci-self-test-"));
  try {
    write(join(dir, "data/catalog-oci/artifacts.csv"), catalogOciIndexCsv(rows));
    const read = readCatalogOciIndex({ root: dir }).get("r,1");
    check(read && read.verify_command === rows[0].verify_command, "self-test: the index did not read back");
  } finally {
    cleanDir(dir);
  }
  console.log(`publish-catalog-oci self-test passed: ${artifacts.length} artifact(s), ${count((artifact) => artifact.source === "rebuilt")} rebuilt from committed files (${count((artifact) => artifact.source === "rebuilt" && artifact.earlier)} to the digest already published), ${count((artifact) => artifact.source === "copied")} copied at their recorded digest, ${count((artifact) => !artifact.earlier)} never published before. No registry was contacted.`);
}

if (["--generate", "--verify"].includes(mode)) generateOrVerify();
else if (mode === "--self-test") selfTest();
else await registryModes();
