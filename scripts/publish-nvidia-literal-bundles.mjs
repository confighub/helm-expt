#!/usr/bin/env node
// Publish the literal configuration OCI bundle of one base of an NVIDIA chart.
//
// The Catalog holds 41 bases of cluster-readiness-engine, gpu-operator,
// k8s-nim-operator and nvsentinel. Each chart version is published as one
// signed installer package. A single base can be composed into a Stack only
// when its exact objects and its route files are a public OCI bundle of their
// own, with a receipt. This script builds that bundle from committed bytes,
// and pushes it only when the maintainer asks.
//
//   node scripts/publish-nvidia-literal-bundles.mjs                    dry run, every base
//   node scripts/publish-nvidia-literal-bundles.mjs --dry-run --base <record>
//   node scripts/publish-nvidia-literal-bundles.mjs --self-test        registry-free
//   HELM_EXPT_ALLOW_NVIDIA_LITERAL_BUNDLE_PUBLISH=1 \
//     node scripts/publish-nvidia-literal-bundles.mjs --publish --base <record>
//
// The dry run is the default and contacts nothing. It prints each base, the
// files its bundle holds, the digests built locally, the destination, and
// whether a receipt exists.
//
// --publish takes exactly one base, named by its Catalog record. It refuses
// when the digest built from the working tree differs from the committed plan,
// pushes with the registry credential oras already has, reads the manifest
// back, pulls it again with no credential at all, compares every file, and
// writes the receipt under runs/catalog-literal-bundles/. The receipt has to
// be added with git add -f, because runs/ is ignored, and the records
// regenerated afterwards.
//
// There is no --sign. The Catalog signs installer packages and their index
// (docs/reference/installer-package-signing.md). It does not sign literal
// configuration bundles, and this script follows that method. Nothing here
// talks to ConfigHub, and a published bundle is not a row in the
// certified-bundle table.
//
// The staged list in scripts/lib/nvidia-literal-bundles.mjs is the only place
// a file can be added to a bundle. A bundle never holds a container image, a
// Helm hook object or a Secret.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYamlText, repoRoot, serializeYaml, trackedExists, writeYaml } from "./lib/proof-common.mjs";
import {
  buildLiteralBundleArtifact,
  LITERAL_BUNDLE_ARTIFACT_TYPE,
  LITERAL_BUNDLE_REGISTRY,
  LITERAL_BUNDLE_UNPUBLISHED_STATUS,
  literalBundlePlanDoc,
  literalBundlePublicationProblems,
  literalBundleReceiptDoc,
  literalBundleStagedSources,
  literalConfigOciProblem,
  loadNvidiaLiteralBundleEntries,
  publishedLiteralConfigOci,
  readLiteralBundleLayerFiles,
  writeLiteralBundleOciLayout,
} from "./lib/nvidia-literal-bundles.mjs";

const PUBLISH_GATE = "HELM_EXPT_ALLOW_NVIDIA_LITERAL_BUNDLE_PUBLISH";
const REGENERATE = "npm run nvidia-literal-bundles:generate";
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : "");
const digestOf = (data) => `sha256:${createHash("sha256").update(data).digest("hex")}`;

function fail(message) {
  console.error(`publish-nvidia-literal-bundles: ${message}`);
  process.exit(1);
}

function selectEntries(entries, wanted) {
  if (!wanted) return entries;
  const found = entries.filter((entry) => entry.recordName === wanted);
  if (found.length !== 1) fail(`no NVIDIA base is recorded as ${wanted}. Run with no arguments to list them`);
  return found;
}

// The plan committed at HEAD, or an empty string when HEAD has none.
function committedPlanText(planRel) {
  const result = spawnSync("git", ["show", `HEAD:${planRel}`], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout : "";
}

// Why a base may not be pushed as it stands. An empty list means the bytes in
// the working tree are the bytes the committed plan describes.
function publishProblems(entry, { planText = committedPlanText(entry.artifact.planRel), root = repoRoot } = {}) {
  const artifact = entry.artifact;
  const problems = [];
  const expectedPlan = serializeYaml(literalBundlePlanDoc(entry, artifact));
  if (!planText) problems.push(`${artifact.planRel} is not committed, so there is no committed digest to publish against`);
  else if (planText !== expectedPlan) {
    const committed = /manifestDigest: "?(sha256:[0-9a-f]{64})/.exec(planText)?.[1] ?? "no digest";
    problems.push(`the local artifact is ${artifact.manifestDigest} and the committed plan records ${committed}. Regenerate with ${REGENERATE}, commit, and try again`);
  }
  for (const file of artifact.stagedFiles) {
    const path = join(root, file.source);
    if (!existsSync(path) || digestOf(readFileSync(path)) !== `sha256:${file.sha256}`) {
      problems.push(`${file.source} on disk is not the file the artifact was built from. Run ${REGENERATE}`);
    }
  }
  const staged = literalBundleStagedSources(entry);
  if (staged[0]?.source !== entry.upstreamRel || staged.slice(1).some((file) => !file.source.startsWith(`${entry.dataDir}/`))) {
    problems.push("the staged list is no longer the retained render and this base's generated companion files");
  }
  return problems;
}

// What must hold before any push is attempted. Kept apart from the push so the
// self-test can exercise every refusal without a registry.
function publishPreconditions({ env, base, selected }) {
  const problems = [];
  if (env[PUBLISH_GATE] !== "1") problems.push(`set ${PUBLISH_GATE}=1 to publish. Nothing was pushed`);
  if (!base) problems.push("--publish takes exactly one base, named with --base <record>");
  else if (selected.length !== 1) problems.push(`--base ${base} does not name exactly one base`);
  return problems;
}

function receiptState(entry) {
  const path = join(repoRoot, entry.artifact.receiptRel);
  if (!existsSync(path)) return "no receipt";
  if (!trackedExists(path)) return "receipt on disk and not tracked, so it does not count. Add it with git add -f";
  return entry.publication.published ? "receipt tracked and valid, published" : "receipt tracked";
}

function dryRun(entries, { verbose }) {
  let ready = 0;
  for (const entry of entries) {
    const artifact = entry.artifact;
    const problems = publishProblems(entry);
    if (problems.length === 0) ready += 1;
    console.log(`${entry.recordName}  ${entry.lane}`);
    if (verbose) {
      for (const file of artifact.stagedFiles) console.log(`  holds        ${file.path}  sha256:${file.sha256}  ${file.bytes} bytes  from ${file.source}`);
      console.log(`  layer        ${artifact.layerDigest}  ${artifact.layerBytes} bytes`);
    } else {
      console.log(`  holds        ${artifact.stagedFiles.map((file) => file.path).join(", ")}`);
    }
    console.log(`  manifest     ${artifact.manifestDigest}  (local, ${LITERAL_BUNDLE_ARTIFACT_TYPE})`);
    console.log(`  destination  ${artifact.reference}`);
    console.log(`  committed    ${problems.length === 0 ? `the committed plan ${artifact.planRel} records this digest` : problems.join("; ")}`);
    console.log(`  receipt      ${receiptState(entry)} (${artifact.receiptRel})`);
  }
  const published = entries.filter((entry) => entry.publication.published).length;
  console.log(`dry run: ${entries.length} base(s), ${ready} ready to publish against the committed plan, ${published} published with a receipt. Nothing was pushed, and no registry was contacted.`);
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
  const pulled = new Map(readLiteralBundleLayerFiles(layer).map((file) => [file.path, digestOf(file.data)]));
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
  const work = mkdtempSync(join(tmpdir(), "nvidia-literal-bundle-publish-"));
  try {
    const layoutRef = writeLiteralBundleOciLayout(artifact, join(work, "layout"));
    run("oras", ["cp", "--from-oci-layout", layoutRef, artifact.reference]);
    const pushed = JSON.parse(run("oras", ["manifest", "fetch", "--descriptor", artifact.reference]));
    check(pushed.digest === artifact.manifestDigest, `the registry holds ${pushed.digest} at ${artifact.reference}, and the committed bytes build ${artifact.manifestDigest}`);
    const anonymousPull = {
      ...pullAndCompare(artifact, { work, target: artifact.immutableReference }),
      command: `oras pull --registry-config <empty config> ${artifact.immutableReference}`,
    };
    const receipt = literalBundleReceiptDoc(entry, artifact, {
      observedAt: new Date().toISOString(),
      pushCommand: `oras cp --from-oci-layout <layout>:${artifact.tag} ${artifact.reference}`,
      anonymousPull,
    });
    const receiptProblems = literalBundlePublicationProblems(receipt, entry, artifact);
    check(receiptProblems.length === 0, `the receipt this run would write is not valid: ${receiptProblems.join("; ")}`);
    writeYaml(receiptPath, receipt);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`published ${entry.recordName} at ${artifact.immutableReference}`);
  console.log(`wrote ${artifact.receiptRel}. Add it with: git add -f ${artifact.receiptRel}`);
  console.log("then regenerate: npm run config-catalog && npm run workshop-catalog-guide:generate && npm run receipt-aging:generate");
  console.log('and the site: HELM_EXPT_SITE_GENERATED_AT="$(cat site/generated-at.txt)" npm run site:generate');
}

function selfTest() {
  // The fixtures start not published whatever receipts are tracked, and the
  // published cases below build their own receipt in memory.
  const entries = loadNvidiaLiteralBundleEntries({ receipts: "none" });
  check(entries.length > 0, "self-test: no NVIDIA base was discovered");
  for (const entry of entries) {
    const stagedText = (rel) => entry.artifact.stagedFiles.find((file) => file.source === rel).data.toString("utf8");
    const again = buildLiteralBundleArtifact(entry, { readText: stagedText });
    check(
      again.manifestDigest === entry.artifact.manifestDigest && again.layerDigest === entry.artifact.layerDigest,
      `self-test: ${entry.recordName} built two different artifacts from the same bytes`,
    );
    const files = readLiteralBundleLayerFiles(entry.artifact.layer);
    check(
      JSON.stringify(files.map((file) => file.path)) === JSON.stringify(entry.artifact.stagedFiles.map((file) => file.path).sort()),
      `self-test: the layer of ${entry.recordName} does not hold exactly its staged files`,
    );
    const routes = files.filter((file) => file.path.startsWith("routes/"));
    check(
      files.every((file) => /^(upstream\.yaml|README\.md|routes\/[a-z-]+\.yaml|requirements\/target-requirements\.yaml)$/.test(file.path))
        && files.filter((file) => file.path === "upstream.yaml").length === 1
        && files.filter((file) => file.path === "requirements/target-requirements.yaml").length === 1,
      `self-test: the layer of ${entry.recordName} holds something other than one render, its routes, one requirements file and one guide`,
    );
    check(
      entry.lane === "flatten-with-routes" ? routes.length > 0 : routes.length === 0,
      `self-test: ${entry.recordName} is ${entry.lane} and its layer holds ${routes.length} route file(s)`,
    );
    const objects = files.find((file) => file.path === "upstream.yaml");
    check(
      objects.data.equals(readFileSync(join(repoRoot, entry.objectsRel))) && objects.data.equals(readFileSync(join(repoRoot, entry.upstreamRel))),
      `self-test: the objects in the layer of ${entry.recordName} are not the retained render bytes`,
    );
    for (const file of files.filter((candidate) => candidate.path !== "upstream.yaml")) {
      const staged = entry.artifact.stagedFiles.find((candidate) => candidate.path === file.path);
      check(file.data.equals(readFileSync(join(repoRoot, staged.source))), `self-test: ${staged.source} on disk is not the file in the layer; run ${REGENERATE}`);
      const text = file.data.toString("utf8");
      check(!/\bpublished\b/i.test(text), `self-test: ${staged.source} says something about publication, so publishing would make the bundle contradict itself`);
      check(!/helm\.sh\/hook|^kind: "?(Job|Secret)"?$/m.test(text), `self-test: ${staged.source} holds a hook object or a Secret, and a companion file only names them`);
    }
    const manifest = JSON.parse(entry.artifact.manifest.toString("utf8"));
    check(
      manifest.artifactType === LITERAL_BUNDLE_ARTIFACT_TYPE
        && manifest.layers.length === 1
        && manifest.layers[0].digest === entry.artifact.layerDigest
        && manifest.layers[0].size === entry.artifact.layerBytes,
      `self-test: the manifest of ${entry.recordName} does not describe its one layer`,
    );
    check(entry.artifact.reference.startsWith(`${LITERAL_BUNDLE_REGISTRY}/catalog-nvidia-`), `self-test: ${entry.recordName} would be pushed outside the bundle repository`);
    check(readFileSync(join(repoRoot, entry.artifact.planRel), "utf8") === serializeYaml(literalBundlePlanDoc(entry, entry.artifact)), `self-test: ${entry.artifact.planRel} is stale; run ${REGENERATE}`);
  }
  check(new Set(entries.map((entry) => entry.artifact.manifestDigest)).size === entries.length, "self-test: two bases share one manifest digest");
  check(new Set(entries.map((entry) => entry.artifact.reference)).size === entries.length, "self-test: two bases share one destination");

  const entry = entries.find((candidate) => candidate.lifecycleActions.length > 0);
  const other = entries.find((candidate) => candidate.lane === "safe-to-flatten");
  check(entry && other, "self-test: the corpus no longer holds both a base with lifecycle actions and a safe-to-flatten base, so these fixtures need new subjects");
  const routeRel = entry.generated.find((file) => file.role === "route: lifecycle-actions").source;
  const stagedText = (rel) => entry.artifact.stagedFiles.find((file) => file.source === rel).data.toString("utf8");
  // A changed byte changes the digest, and the changed artifact is refused
  // against the plan that was generated for the committed bytes.
  const changed = { ...entry };
  changed.artifact = buildLiteralBundleArtifact(entry, { readText: (rel) => `${stagedText(rel)}${rel === routeRel ? "# one more byte\n" : ""}` });
  check(changed.artifact.manifestDigest !== entry.artifact.manifestDigest, "self-test: a changed route file did not change the manifest digest");
  const committedPlan = serializeYaml(literalBundlePlanDoc(entry, entry.artifact));
  check(publishProblems(entry, { planText: committedPlan }).length === 0, "self-test: the committed bytes were refused against their own plan");
  check(
    publishProblems(changed, { planText: committedPlan }).some((problem) => /the local artifact is sha256:[0-9a-f]{64} and the committed plan records sha256:[0-9a-f]{64}/.test(problem)),
    "self-test: an artifact that differs from the committed plan was not refused",
  );
  check(publishProblems(entry, { planText: "" }).some((problem) => /is not committed/.test(problem)), "self-test: a base with no committed plan was not refused");
  let refusedRender = false;
  try {
    buildLiteralBundleArtifact(entry, { readText: (rel) => (rel === entry.upstreamRel ? "kind: ConfigMap\n" : stagedText(rel)) });
  } catch (error) {
    refusedRender = /are not the retained render bytes/.test(error.message);
  }
  check(refusedRender, "self-test: objects that are not the retained render bytes were staged");

  // The gate and the one-base rule.
  check(publishPreconditions({ env: {}, base: entry.recordName, selected: [entry] }).some((problem) => problem.includes(PUBLISH_GATE)), "self-test: a publish without the gate was allowed");
  check(publishPreconditions({ env: { [PUBLISH_GATE]: "1" }, base: "", selected: entries }).some((problem) => /exactly one base/.test(problem)), "self-test: a publish of every base at once was allowed");
  check(publishPreconditions({ env: { [PUBLISH_GATE]: "1" }, base: entry.recordName, selected: [entry] }).length === 0, "self-test: a gated publish of one base was refused");

  // The receipt rule, in both directions.
  const fixture = (subject, artifact = subject.artifact) => literalBundleReceiptDoc(subject, artifact, {
    observedAt: "2026-01-01T00:00:00.000Z",
    pushCommand: "self-test fixture, nothing was pushed",
    anonymousPull: { result: "pass", manifestDigest: artifact.manifestDigest, layerDigest: artifact.layerDigest, filesMatched: artifact.stagedFiles.length },
  });
  const receipt = fixture(entry);
  check(literalBundlePublicationProblems(receipt, entry, entry.artifact).length === 0, "self-test: a receipt for these bytes was refused");
  // A receipt is read back from YAML with its keys in another order, and it
  // must still be the receipt of these bytes.
  check(
    literalBundlePublicationProblems(readYamlText(serializeYaml(receipt)), entry, entry.artifact).length === 0,
    "self-test: a receipt written as YAML and read back was refused",
  );
  check(literalBundlePublicationProblems(receipt, other, other.artifact).length > 0, "self-test: a receipt for another base was accepted");
  check(
    literalBundlePublicationProblems(receipt, entry, changed.artifact).some((problem) => /its manifest digest is/.test(problem)),
    "self-test: a receipt was accepted for an artifact whose bytes changed after it was written",
  );
  for (const [label, change, pattern] of [
    ["no anonymous pull", (doc) => { doc.spec.anonymousPull.result = "not-run"; }, /records no anonymous pull of this manifest/],
    ["an extra file", (doc) => { doc.spec.bundle.files.push({ path: "hook.yaml", stagedAs: "hook.yaml", role: "hook object", sha256: "a".repeat(64), bytes: 1 }); }, /its files are not the render and the companion files/],
    ["a claimed ConfigHub upload", (doc) => { doc.spec.configHubUpload = "pass"; }, /does not say that no ConfigHub upload was run/],
    ["another verdict lane", (doc) => { doc.spec.verdict.lane = "safe-to-flatten"; }, /its verdict is not the flatten-with-routes verdict/],
  ]) {
    const doc = structuredClone(receipt);
    change(doc);
    check(literalBundlePublicationProblems(doc, entry, entry.artifact).some((problem) => pattern.test(problem)), `self-test: a receipt with ${label} was accepted`);
  }

  // The record rule, in both directions. Without a publication the record
  // keeps the unpublished state. With one it carries exactly that publication.
  const unpublished = { status: LITERAL_BUNDLE_UNPUBLISHED_STATUS, note: "fixture" };
  const publication = {
    published: true,
    artifact: entry.artifact,
    receipt,
    receiptRel: entry.artifact.receiptRel,
    receiptSha256: digestOf(serializeYaml(receipt)),
    observedReference: `oci://${entry.artifact.reference}@${entry.artifact.manifestDigest}`,
  };
  const publishedState = publishedLiteralConfigOci(publication);
  check(literalConfigOciProblem(entry.recordName, unpublished, entry.publication) === "", "self-test: an unpublished record was refused with no receipt");
  check(literalConfigOciProblem(entry.recordName, publishedState, publication) === "", "self-test: a published record was refused beside its own receipt");
  check(
    /says published-with-receipt with sha256:[0-9a-f]{64}, and no tracked publication receipt/.test(literalConfigOciProblem(entry.recordName, publishedState, entry.publication)),
    "self-test: a published record was accepted with no publication receipt",
  );
  check(
    /does not carry exactly that reference/.test(literalConfigOciProblem(entry.recordName, unpublished, publication)),
    "self-test: a record that says not published was accepted beside a valid receipt",
  );
  check(
    /does not carry exactly that reference/.test(literalConfigOciProblem(entry.recordName, { ...publishedState, manifestDigest: `sha256:${"b".repeat(64)}` }, publication)),
    "self-test: a published record carrying another digest was accepted",
  );

  // The same tools a publication uses, pointed at local OCI layouts. No
  // registry is contacted. A machine without them still runs everything above.
  const tools = [];
  const work = mkdtempSync(join(tmpdir(), "nvidia-literal-bundle-self-test-"));
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
      const layoutRef = writeLiteralBundleOciLayout(entry.artifact, join(work, "layout"));
      const copyRef = `${join(work, "copy")}:${entry.artifact.tag}`;
      execFileSync("oras", ["cp", "--from-oci-layout", "--to-oci-layout", layoutRef, copyRef], { encoding: "utf8", stdio: "pipe" });
      const pull = pullAndCompare(entry.artifact, { work, target: copyRef, layout: true });
      check(pull.result === "pass" && pull.filesMatched === entry.artifact.stagedFiles.length, "self-test: a copy of the layout did not pull back as the staged files");
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`publish-nvidia-literal-bundles self-test passed: ${entries.length} artifact(s) rebuilt to the same digests, each holding one render, its route files, one requirements file and one guide; plan, gate, receipt and record refusals fired; local tool checks ran with ${tools.join(" and ") || "no external tool"}. No registry was contacted.`);
}

if (has("--sign")) fail("there is no --sign. The Catalog does not sign literal configuration bundles, and this script follows that method");
const unknown = args.filter((arg, index) => arg.startsWith("--") ? !["--dry-run", "--publish", "--self-test", "--base", "--verbose"].includes(arg) : args[index - 1] !== "--base");
if (unknown.length > 0) fail(`unknown argument ${unknown.join(" ")}`);
if (has("--self-test")) {
  selfTest();
} else {
  const base = valueOf("--base");
  const selected = selectEntries(loadNvidiaLiteralBundleEntries(), base);
  if (has("--publish")) {
    if (has("--dry-run")) fail("choose --dry-run or --publish, not both");
    const problems = publishPreconditions({ env: process.env, base, selected });
    if (problems.length > 0) fail(problems.join("; "));
    publish(selected[0]);
  } else {
    dryRun(selected, { verbose: has("--verbose") || selected.length === 1 });
  }
}
