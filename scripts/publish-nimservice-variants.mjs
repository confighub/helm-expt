#!/usr/bin/env node
// Publish the literal configuration OCI artifact of one NIMService variant.
//
// The 38 NIMService variants are Catalog records that nothing has published.
// A variant becomes usable from ConfigHub when its exact objects and its route
// files are a public OCI artifact with a receipt. This script builds that
// artifact from committed bytes, and pushes it only when the maintainer asks.
//
//   node scripts/publish-nimservice-variants.mjs                       dry run, every variant
//   node scripts/publish-nimservice-variants.mjs --dry-run --variant <slug>
//   node scripts/publish-nimservice-variants.mjs --self-test           registry-free
//   HELM_EXPT_ALLOW_NIMSERVICE_OCI_PUBLISH=1 \
//     node scripts/publish-nimservice-variants.mjs --publish --variant <slug>
//
// The dry run is the default and contacts nothing. It prints each variant, the
// files its artifact holds, the digests built locally, the destination, and
// whether a receipt exists.
//
// --publish takes exactly one variant. It refuses when the digest built from
// the working tree differs from the committed plan, pushes with the registry
// credential oras already has, reads the manifest back, pulls it again with
// no credential at all, compares every file, and writes the receipt under
// runs/nimservice-variants/. The receipt has to be added with git add -f,
// because runs/ is ignored, and the records regenerated afterwards.
//
// There is no --sign. The Catalog signs installer packages and their index
// (docs/reference/installer-package-signing.md). It does not sign certified
// configuration bundles, and this script follows that method.
//
// The artifact holds the retained sample file and two route files. It never
// holds an NVIDIA image, a model weight or a Secret value, and the staged list
// in scripts/lib/nimservice-publication.mjs is the only place a file can be
// added.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, repoRoot, serializeYaml, trackedExists, writeYaml } from "./lib/proof-common.mjs";
import { loadNimServiceEntries } from "./lib/nimservice-entries.mjs";
import {
  buildNimServiceArtifact,
  expectedNimServiceLiteralConfigOci,
  loadNimServicePublication,
  NIMSERVICE_BUNDLE_ARTIFACT_TYPE,
  NIMSERVICE_BUNDLE_REGISTRY,
  nimServicePublicationPlanDoc,
  nimServicePublicationProblems,
  nimServicePublicationReceiptDoc,
  nimServiceStagedSources,
  readLayerFiles,
  writeNimServiceOciLayout,
} from "./lib/nimservice-publication.mjs";

const PUBLISH_GATE = "HELM_EXPT_ALLOW_NIMSERVICE_OCI_PUBLISH";
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : "");
const digestOf = (data) => `sha256:${createHash("sha256").update(data).digest("hex")}`;

function fail(message) {
  console.error(`publish-nimservice-variants: ${message}`);
  process.exit(1);
}

function selectEntries(entries, wanted) {
  if (!wanted) return entries;
  const found = entries.filter((entry) => entry.slug === wanted || entry.recordName === wanted);
  if (found.length !== 1) fail(`no NIMService variant is named ${wanted}. Run with no arguments to list them`);
  return found;
}

// The plan committed at HEAD, or an empty string when HEAD has none.
function committedPlanText(planRel) {
  const result = spawnSync("git", ["show", `HEAD:${planRel}`], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout : "";
}

// Why a variant may not be pushed as it stands. An empty list means the bytes
// in the working tree are the bytes the committed plan describes.
function publishProblems(entry, { planText = committedPlanText(entry.artifact.planRel), root = repoRoot } = {}) {
  const artifact = entry.artifact;
  const problems = [];
  const expectedPlan = serializeYaml(nimServicePublicationPlanDoc(entry, artifact));
  if (!planText) problems.push(`${artifact.planRel} is not committed, so there is no committed digest to publish against`);
  else if (planText !== expectedPlan) {
    const committed = /manifestDigest: "?(sha256:[0-9a-f]{64})/.exec(planText)?.[1] ?? "no digest";
    problems.push(`the local artifact is ${artifact.manifestDigest} and the committed plan records ${committed}. Regenerate with npm run aicr-nim-operator-models:generate, commit, and try again`);
  }
  for (const file of artifact.stagedFiles) {
    const path = join(root, file.source);
    if (!existsSync(path) || digestOf(readFileSync(path)) !== `sha256:${file.sha256}`) {
      problems.push(`${file.source} on disk is not the file the artifact was built from. Run npm run aicr-nim-operator-models:generate`);
    }
  }
  const sources = nimServiceStagedSources(entry).map((file) => file.source).sort();
  if (JSON.stringify(sources) !== JSON.stringify([entry.fileRel, entry.operatorRouteRel, entry.secretRouteRel].sort())) {
    problems.push("the staged list is no longer the sample and its two route files");
  }
  return problems;
}

// What must hold before any push is attempted. Kept apart from the push so the
// self-test can exercise every refusal without a registry.
function publishPreconditions({ env, variant, selected }) {
  const problems = [];
  if (env[PUBLISH_GATE] !== "1") problems.push(`set ${PUBLISH_GATE}=1 to publish. Nothing was pushed`);
  if (!variant) problems.push("--publish takes exactly one variant, named with --variant <slug>");
  else if (selected.length !== 1) problems.push(`--variant ${variant} does not name exactly one variant`);
  return problems;
}

function receiptState(entry) {
  const path = join(repoRoot, entry.artifact.receiptRel);
  if (!existsSync(path)) return "no receipt";
  if (!trackedExists(path)) return "receipt on disk and not tracked, so it does not count. Add it with git add -f";
  return entry.publication.published ? "receipt tracked and valid, published" : "receipt tracked";
}

function dryRun(entries) {
  let ready = 0;
  for (const entry of entries) {
    const artifact = entry.artifact;
    const problems = publishProblems(entry);
    if (problems.length === 0) ready += 1;
    console.log(`${entry.recordName}`);
    for (const file of artifact.stagedFiles) console.log(`  holds        ${file.path}  sha256:${file.sha256}  ${file.bytes} bytes  from ${file.source}`);
    console.log(`  layer        ${artifact.layerDigest}  ${artifact.layerBytes} bytes`);
    console.log(`  manifest     ${artifact.manifestDigest}  (local, ${NIMSERVICE_BUNDLE_ARTIFACT_TYPE})`);
    console.log(`  destination  ${artifact.reference}`);
    console.log(`  committed    ${problems.length === 0 ? `the committed plan ${artifact.planRel} records this digest` : problems.join("; ")}`);
    console.log(`  receipt      ${receiptState(entry)} (${artifact.receiptRel})`);
    if (entry.openQuestions.length > 0) console.log("  flagged      this variant is marked watch, so read its open question before publishing it");
  }
  const published = entries.filter((entry) => entry.publication.published).length;
  console.log(`dry run: ${entries.length} variant(s), ${ready} ready to publish against the committed plan, ${published} published with a receipt. Nothing was pushed, and no registry was contacted.`);
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.status !== 0) fail(`${command} ${commandArgs.slice(0, 3).join(" ")} failed: ${(result.stderr || result.stdout || "").trim().slice(0, 600)}`);
  return result.stdout;
}

// Pull a manifest with no credential and compare every file with the staged
// bytes. target is a registry reference, or an OCI layout in the self-test.
function pullAndCompare(artifact, { work, target, layout = false }) {
  const anonymous = join(work, "anonymous");
  const out = join(work, "pulled");
  mkdirSync(anonymous, { recursive: true });
  mkdirSync(out, { recursive: true });
  const config = join(anonymous, "config.json");
  writeFileSync(config, JSON.stringify({ auths: {} }));
  // An empty registry configuration, an empty home and no cloud credential, so
  // the pull cannot borrow the credential the push used.
  const env = { PATH: process.env.PATH, HOME: anonymous, DOCKER_CONFIG: anonymous, CLOUDSDK_CONFIG: anonymous, GOOGLE_APPLICATION_CREDENTIALS: "" };
  const where = layout ? ["--oci-layout", target] : ["--registry-config", config, target];
  const descriptor = JSON.parse(run("oras", ["manifest", "fetch", "--descriptor", ...where], { env }));
  check(descriptor.digest === artifact.manifestDigest, `the pulled manifest is ${descriptor.digest}, and the committed bytes build ${artifact.manifestDigest}`);
  run("oras", ["pull", "--no-tty", "--output", out, ...where], { env });
  const layerPath = join(out, `${artifact.bundleName}.tar.gz`);
  check(existsSync(layerPath), "the pull returned no layer file");
  const layer = readFileSync(layerPath);
  check(digestOf(layer) === artifact.layerDigest, `the pulled layer is ${digestOf(layer)}, and the committed bytes build ${artifact.layerDigest}`);
  const pulled = new Map(readLayerFiles(layer).map((file) => [file.path, digestOf(file.data)]));
  check(pulled.size === artifact.stagedFiles.length, `the pulled layer holds ${pulled.size} file(s), and the artifact has ${artifact.stagedFiles.length}`);
  for (const file of artifact.stagedFiles) {
    check(pulled.get(file.path) === `sha256:${file.sha256}`, `the pulled ${file.path} is not the committed file`);
  }
  return { result: "pass", manifestDigest: descriptor.digest, layerDigest: digestOf(layer), filesMatched: pulled.size };
}

function publish(entry) {
  const artifact = entry.artifact;
  const problems = publishProblems(entry);
  if (problems.length > 0) fail(`${entry.recordName} was not published. ${problems.join("; ")}`);
  const receiptPath = join(repoRoot, artifact.receiptRel);
  if (existsSync(receiptPath)) fail(`${artifact.receiptRel} already exists. Remove it only if that publication is to be replaced`);
  if (spawnSync("oras", ["version"], { encoding: "utf8" }).status !== 0) fail("oras is not on the PATH");
  const work = mkdtempSync(join(tmpdir(), "nimservice-publish-"));
  try {
    const layoutRef = writeNimServiceOciLayout(artifact, join(work, "layout"));
    run("oras", ["cp", "--from-oci-layout", layoutRef, artifact.reference]);
    const pushed = JSON.parse(run("oras", ["manifest", "fetch", "--descriptor", artifact.reference]));
    check(pushed.digest === artifact.manifestDigest, `the registry holds ${pushed.digest} at ${artifact.reference}, and the committed bytes build ${artifact.manifestDigest}`);
    const anonymousPull = {
      ...pullAndCompare(artifact, { work, target: artifact.immutableReference }),
      command: `oras pull --registry-config <empty config> ${artifact.immutableReference}`,
    };
    const receipt = nimServicePublicationReceiptDoc(artifact, {
      observedAt: new Date().toISOString(),
      pushCommand: `oras cp --from-oci-layout <layout>:${artifact.tag} ${artifact.reference}`,
      anonymousPull,
    });
    const receiptProblems = nimServicePublicationProblems(receipt, artifact);
    check(receiptProblems.length === 0, `the receipt this run would write is not valid: ${receiptProblems.join("; ")}`);
    writeYaml(receiptPath, receipt);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`published ${entry.recordName} at ${artifact.immutableReference}`);
  console.log(`wrote ${artifact.receiptRel}. Add it with: git add -f ${artifact.receiptRel}`);
  console.log("then regenerate: npm run aicr-nim-operator-models:generate && npm run config-catalog && npm run catalog:images && npm run workshop-catalog-guide:generate && npm run data:index");
  console.log('and the site: HELM_EXPT_SITE_GENERATED_AT="$(cat site/generated-at.txt)" npm run site:generate');
}

function selfTest() {
  const entries = loadNimServiceEntries();
  check(entries.length > 0, "self-test: no retained NIMService sample was discovered");
  for (const entry of entries) {
    const again = buildNimServiceArtifact(entry, {
      readText: (rel) => entry.artifact.stagedFiles.find((file) => file.source === rel).data.toString("utf8"),
    });
    check(
      again.manifestDigest === entry.artifact.manifestDigest && again.layerDigest === entry.artifact.layerDigest,
      `self-test: ${entry.recordName} built two different artifacts from the same bytes`,
    );
    const files = readLayerFiles(entry.artifact.layer);
    check(
      JSON.stringify(files.map((file) => file.path)) === JSON.stringify(entry.artifact.stagedFiles.map((file) => file.path).sort()),
      `self-test: the layer of ${entry.recordName} does not hold exactly its staged files`,
    );
    check(
      files.every((file) => /\.ya?ml$/.test(file.path))
        && files.length === 3
        && files.filter((file) => file.path.startsWith("routes/")).length === 2,
      `self-test: the layer of ${entry.recordName} holds something other than one sample file and two route files`,
    );
    const sample = files.find((file) => !file.path.startsWith("routes/"));
    check(
      sample.data.equals(readFileSync(join(repoRoot, entry.fileRel))),
      `self-test: the objects in the layer of ${entry.recordName} are not the retained sample bytes`,
    );
    for (const file of files.filter((candidate) => candidate.path.startsWith("routes/"))) {
      const staged = entry.artifact.stagedFiles.find((candidate) => candidate.path === file.path);
      check(file.data.equals(readFileSync(join(repoRoot, staged.source))), `self-test: ${staged.source} on disk is not the route file in the layer; run npm run aicr-nim-operator-models:generate`);
      check(!/\bpublished\b|No OCI artifact exists/i.test(file.data.toString("utf8")), `self-test: ${staged.source} says something about publication, so publishing would make the artifact contradict itself`);
    }
    const manifest = JSON.parse(entry.artifact.manifest.toString("utf8"));
    check(
      manifest.artifactType === NIMSERVICE_BUNDLE_ARTIFACT_TYPE
        && manifest.layers.length === 1
        && manifest.layers[0].digest === entry.artifact.layerDigest
        && manifest.layers[0].size === entry.artifact.layerBytes,
      `self-test: the manifest of ${entry.recordName} does not describe its one layer`,
    );
    check(entry.artifact.reference.startsWith(`${NIMSERVICE_BUNDLE_REGISTRY}/nimservice-`), `self-test: ${entry.recordName} would be pushed outside the bundle repository`);
    check(readFileSync(join(repoRoot, entry.artifact.planRel), "utf8") === serializeYaml(nimServicePublicationPlanDoc(entry, entry.artifact)), `self-test: ${entry.artifact.planRel} is stale`);
  }
  check(new Set(entries.map((entry) => entry.artifact.manifestDigest)).size === entries.length, "self-test: two variants share one manifest digest");

  const entry = entries[0];
  const other = entries[1];
  // A changed byte changes the digest, and the changed artifact is refused
  // against the plan that was generated for the committed bytes.
  const changed = { ...entry };
  changed.artifact = buildNimServiceArtifact(entry, {
    readText: (rel) => `${entry.artifact.stagedFiles.find((file) => file.source === rel).data.toString("utf8")}${rel === entry.operatorRouteRel ? "# one more byte\n" : ""}`,
  });
  check(changed.artifact.manifestDigest !== entry.artifact.manifestDigest, "self-test: a changed route file did not change the manifest digest");
  const committedPlan = serializeYaml(nimServicePublicationPlanDoc(entry, entry.artifact));
  check(publishProblems(entry, { planText: committedPlan }).length === 0, "self-test: the committed bytes were refused against their own plan");
  check(
    publishProblems(changed, { planText: committedPlan }).some((problem) => /the local artifact is sha256:[0-9a-f]{64} and the committed plan records sha256:[0-9a-f]{64}/.test(problem)),
    "self-test: an artifact that differs from the committed plan was not refused",
  );
  check(publishProblems(entry, { planText: "" }).some((problem) => /is not committed/.test(problem)), "self-test: a variant with no committed plan was not refused");
  let refusedSample = false;
  try {
    buildNimServiceArtifact(entry, { readText: (rel) => (rel === entry.fileRel ? "kind: NIMService\n" : entry.artifact.stagedFiles.find((file) => file.source === rel).data.toString("utf8")) });
  } catch (error) {
    refusedSample = /are not the retained sample bytes/.test(error.message);
  }
  check(refusedSample, "self-test: objects that are not the retained sample bytes were staged");

  // The gate and the one-variant rule.
  check(publishPreconditions({ env: {}, variant: entry.slug, selected: [entry] }).some((problem) => problem.includes(PUBLISH_GATE)), "self-test: a publish without the gate was allowed");
  check(publishPreconditions({ env: { [PUBLISH_GATE]: "1" }, variant: "", selected: entries }).some((problem) => /exactly one variant/.test(problem)), "self-test: a publish of every variant at once was allowed");
  check(publishPreconditions({ env: { [PUBLISH_GATE]: "1" }, variant: entry.slug, selected: [entry] }).length === 0, "self-test: a gated publish of one variant was refused");

  // The receipt rule, in both directions.
  const receipt = nimServicePublicationReceiptDoc(entry.artifact, {
    observedAt: "2026-01-01T00:00:00.000Z",
    pushCommand: "self-test fixture, nothing was pushed",
    anonymousPull: { result: "pass", manifestDigest: entry.artifact.manifestDigest, layerDigest: entry.artifact.layerDigest, filesMatched: 3 },
  });
  check(nimServicePublicationProblems(receipt, entry.artifact).length === 0, "self-test: a receipt for these bytes was refused");
  check(nimServicePublicationProblems(receipt, other.artifact).length > 0, "self-test: a receipt for other bytes was accepted");
  check(nimServicePublicationProblems(receipt, changed.artifact).some((problem) => /its manifest digest is/.test(problem)), "self-test: a receipt was accepted for an artifact whose bytes changed after it was written");
  check(expectedNimServiceLiteralConfigOci({ published: false }).status === "not-published", "self-test: a variant with no receipt was given a published state");
  check(
    loadNimServicePublication(entry).published === entry.publication.published,
    "self-test: the publication state changed between two reads",
  );

  // The same tools a publication uses, pointed at local OCI layouts. No
  // registry is contacted. A machine without them still runs everything above.
  const tools = [];
  const work = mkdtempSync(join(tmpdir(), "nimservice-publish-self-test-"));
  try {
    writeFileSync(join(work, "layer.tar.gz"), entry.artifact.layer);
    const listed = spawnSync("tar", ["-tzf", join(work, "layer.tar.gz")], { encoding: "utf8" });
    if (listed.status === 0) {
      tools.push("tar");
      check(
        JSON.stringify(listed.stdout.trim().split("\n").map((line) => line.replace(/^\.\//, "")).sort()) === JSON.stringify(entry.artifact.stagedFiles.map((file) => file.path).sort()),
        "self-test: the system tar does not list the staged files in the layer",
      );
    }
    if (spawnSync("oras", ["version"], { encoding: "utf8" }).status === 0) {
      tools.push("oras");
      const layoutRef = writeNimServiceOciLayout(entry.artifact, join(work, "layout"));
      const copyRef = `${join(work, "copy")}:${entry.artifact.tag}`;
      execFileSync("oras", ["cp", "--from-oci-layout", "--to-oci-layout", layoutRef, copyRef], { encoding: "utf8", stdio: "pipe" });
      const pull = pullAndCompare(entry.artifact, { work, target: copyRef, layout: true });
      check(pull.result === "pass" && pull.filesMatched === 3, "self-test: a copy of the layout did not pull back as the staged files");
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`publish-nimservice-variants self-test passed: ${entries.length} artifact(s) rebuilt to the same digests, each holding one sample file and two route files; plan, gate and receipt refusals fired; local tool checks ran with ${tools.join(" and ") || "no external tool"}. No registry was contacted.`);
}

if (has("--sign")) fail("there is no --sign. The Catalog does not sign certified configuration bundles, and this script follows that method");
const unknown = args.filter((arg, index) => arg.startsWith("--") ? !["--dry-run", "--publish", "--self-test", "--variant"].includes(arg) : args[index - 1] !== "--variant");
if (unknown.length > 0) fail(`unknown argument ${unknown.join(" ")}`);
if (has("--self-test")) {
  selfTest();
} else {
  const variant = valueOf("--variant");
  const selected = selectEntries(loadNimServiceEntries(), variant);
  if (has("--publish")) {
    if (has("--dry-run")) fail("choose --dry-run or --publish, not both");
    const problems = publishPreconditions({ env: process.env, variant, selected });
    if (problems.length > 0) fail(problems.join("; "));
    publish(selected[0]);
  } else {
    dryRun(selected);
  }
}
