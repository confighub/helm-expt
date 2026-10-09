#!/usr/bin/env node
// Publish one of the two OCI artifacts of one mirrored AICR entry.
//
// A mirrored entry is a set of rendered Argo CD Applications, and some of them
// take their source from the entry's own AICR bundle. The entry can be
// delivered only when two artifacts are public: the source package those
// Applications name, and the literal configuration bundle of the Applications
// with their route and requirement files. This script builds both from
// committed bytes, and pushes one only when the maintainer asks.
//
//   node scripts/publish-aicr-mirror-artifacts.mjs                     dry run, every entry
//   node scripts/publish-aicr-mirror-artifacts.mjs --dry-run --entry <id>
//   node scripts/publish-aicr-mirror-artifacts.mjs --self-test         registry-free
//   HELM_EXPT_ALLOW_AICR_MIRROR_PUBLISH=1 \
//     node scripts/publish-aicr-mirror-artifacts.mjs --publish --entry <id> --artifact source-package
//   HELM_EXPT_ALLOW_AICR_MIRROR_PUBLISH=1 \
//     node scripts/publish-aicr-mirror-artifacts.mjs --publish --entry <id> --artifact literal-config
//
// The dry run is the default and contacts nothing. It prints each entry, the
// digests built locally, the destinations, and whether a receipt exists.
//
// --publish takes exactly one entry and one artifact. It refuses when the
// digest built from the working tree differs from the committed plan, and when
// a recorded generation input is not accounted for. It pushes with the
// registry credential oras already has, reads the manifest back, pulls it
// again with no credential at all, compares every file, and writes the receipt
// under runs/aicr-mirror-artifacts/. The receipt has to be added with
// git add -f, because runs/ is ignored, and the records regenerated afterwards.
//
// The source package goes first. The literal configuration bundle is refused
// until the entry's source package receipt exists and matches the committed
// bytes, because Applications that point at a missing package cannot be
// delivered.
//
// There is no --sign. The Catalog signs installer packages and their index.
// It does not sign these artifacts, and this script follows that method.
// Nothing here talks to ConfigHub or to a cluster.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AICR_MIRROR_ARTIFACT_ROLES,
  AICR_MIRROR_BUNDLE_REGISTRY,
  AICR_MIRROR_PUBLISHED_STATUS,
  AICR_MIRROR_REGISTRY,
  AICR_MIRROR_STATES,
  AICR_MIRROR_UNPUBLISHED_STATUS,
  LITERAL_ARTIFACT_TYPE,
  LITERAL_CONFIG,
  SOURCE_PACKAGE,
  aicrMirrorDelivery,
  aicrMirrorDeliveryProblem,
  aicrMirrorLiteralStagedSources,
  aicrMirrorPlanDoc,
  aicrMirrorPublicationProblems,
  aicrMirrorReceiptDoc,
  aicrMirrorRequiredInputFindings,
  buildLiteralConfigArtifact,
  buildSourcePackageArtifact,
  loadAicrMirrorEntries,
  readAicrMirrorLayerFiles,
  writeAicrMirrorOciLayout,
} from "./lib/aicr-mirror-artifacts.mjs";
import { check, readYamlText, repoRoot, serializeYaml, trackedExists, writeYaml } from "./lib/proof-common.mjs";

const PUBLISH_GATE = "HELM_EXPT_ALLOW_AICR_MIRROR_PUBLISH";
const REGENERATE = "npm run aicr-mirror-artifacts:generate";
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : "");
const digestOf = (data) => `sha256:${createHash("sha256").update(data).digest("hex")}`;

function fail(message) {
  console.error(`publish-aicr-mirror-artifacts: ${message}`);
  process.exit(1);
}

function selectEntries(entries, wanted) {
  if (!wanted) return entries;
  const found = entries.filter((entry) => entry.id === wanted || entry.recordName === wanted);
  if (found.length !== 1) fail(`no mirrored AICR entry is recorded as ${wanted}. Run with no arguments to list them`);
  return found;
}

// The plan committed at HEAD, or an empty string when HEAD has none.
function committedPlanText(planRel) {
  const result = spawnSync("git", ["show", `HEAD:${planRel}`], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout : "";
}

// Why one artifact may not be pushed as it stands. An empty list means the
// bytes in the working tree are the bytes the committed plan describes.
function publishProblems(entry, role, { planText, root = repoRoot, inputFindings } = {}) {
  const artifact = entry.artifacts[role];
  const problems = [];
  const committed = planText ?? committedPlanText(artifact.planRel);
  const expectedPlan = serializeYaml(aicrMirrorPlanDoc(entry, artifact));
  if (!committed) problems.push(`${artifact.planRel} is not committed, so there is no committed digest to publish against`);
  else if (committed !== expectedPlan) {
    const recorded = /manifestDigest: "?(sha256:[0-9a-f]{64})/.exec(committed)?.[1] ?? "no digest";
    problems.push(`the local artifact is ${artifact.manifestDigest} and the committed plan records ${recorded}. Regenerate with ${REGENERATE}, commit, and try again`);
  }
  for (const file of artifact.stagedFiles) {
    const path = join(root, file.source);
    if (!existsSync(path) || digestOf(readFileSync(path)) !== `sha256:${file.sha256}`) {
      problems.push(`${file.source} on disk is not the file the artifact was built from. Run ${REGENERATE}`);
    }
  }
  if (role === LITERAL_CONFIG) {
    const staged = aicrMirrorLiteralStagedSources(entry);
    if (staged.some((file) => !(file.source.startsWith(`${entry.templatesRel}/`) || file.source.startsWith(`${entry.dataDir}/`)))) {
      problems.push("the staged list is no longer the retained Applications and this entry's generated companion files");
    }
  }
  for (const finding of inputFindings ?? aicrMirrorRequiredInputFindings(entry, { root, published: true })) problems.push(finding);
  return problems;
}

// The source package of an entry has to be there before its literal bundle is
// pushed. The receipt is read from disk whether or not Git tracks it yet,
// because the maintainer publishes both before committing either receipt.
function sourcePackageFirstProblems(entry, { receiptText } = {}) {
  const artifact = entry.artifacts[SOURCE_PACKAGE];
  const path = join(repoRoot, artifact.receiptRel);
  const text = receiptText ?? (existsSync(path) ? readFileSync(path, "utf8") : "");
  if (!text) return [`the source package of ${entry.id} has no receipt at ${artifact.receiptRel}. Publish it first with --artifact ${SOURCE_PACKAGE}`];
  const problems = aicrMirrorPublicationProblems(readYamlText(text), entry, artifact);
  return problems.length === 0 ? [] : [`${artifact.receiptRel} is not a receipt for the source package these files build: ${problems.join("; ")}`];
}

// What must hold before any push is attempted. Kept apart from the push so the
// self-test can exercise every refusal without a registry.
function publishPreconditions({ env, entryId, role, selected }) {
  const problems = [];
  if (env[PUBLISH_GATE] !== "1") problems.push(`set ${PUBLISH_GATE}=1 to publish. Nothing was pushed`);
  if (!entryId) problems.push("--publish takes exactly one entry, named with --entry <id>");
  else if (selected.length !== 1) problems.push(`--entry ${entryId} does not name exactly one entry`);
  if (!AICR_MIRROR_ARTIFACT_ROLES.includes(role)) problems.push(`--publish takes exactly one artifact, named with --artifact ${AICR_MIRROR_ARTIFACT_ROLES.join(" or --artifact ")}`);
  return problems;
}

function receiptState(entry, role) {
  const artifact = entry.artifacts[role];
  const path = join(repoRoot, artifact.receiptRel);
  if (!existsSync(path)) return "no receipt";
  if (!trackedExists(path)) return "receipt on disk and not tracked, so it does not count. Add it with git add -f";
  return entry.publications[role].published ? "receipt tracked and valid, published" : "receipt tracked";
}

function dryRun(entries, { verbose }) {
  const ready = { [SOURCE_PACKAGE]: 0, [LITERAL_CONFIG]: 0 };
  for (const entry of entries) {
    const inputFindings = aicrMirrorRequiredInputFindings(entry, { published: true });
    console.log(`${entry.id}  ${entry.recordName}  ${aicrMirrorDelivery(entry).retention}`);
    for (const role of AICR_MIRROR_ARTIFACT_ROLES) {
      const artifact = entry.artifacts[role];
      const problems = publishProblems(entry, role, { inputFindings });
      if (problems.length === 0) ready[role] += 1;
      console.log(`  ${role}`);
      if (verbose) {
        for (const file of artifact.stagedFiles) console.log(`    holds        ${file.path}  sha256:${file.sha256}  ${file.bytes} bytes  from ${file.source}`);
        console.log(`    layer        ${artifact.layerDigest}  ${artifact.layerBytes} bytes`);
      } else {
        console.log(`    holds        ${artifact.stagedFiles.length} files`);
      }
      console.log(`    manifest     ${artifact.manifestDigest}  (local, ${artifact.artifactType})`);
      console.log(`    destination  ${artifact.reference}`);
      console.log(`    committed    ${problems.length === 0 ? `the committed plan ${artifact.planRel} records this digest` : problems.join("; ")}`);
      console.log(`    receipt      ${receiptState(entry, role)} (${artifact.receiptRel})`);
    }
  }
  const published = (role) => entries.filter((entry) => entry.publications[role].published).length;
  console.log(
    `dry run: ${entries.length} entr${entries.length === 1 ? "y" : "ies"}. ${ready[SOURCE_PACKAGE]} source package(s) and ${ready[LITERAL_CONFIG]} literal bundle(s) are ready to publish against the committed plans. ${published(SOURCE_PACKAGE)} source package(s) and ${published(LITERAL_CONFIG)} literal bundle(s) are published with a receipt. Nothing was pushed, and no registry was contacted.`,
  );
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.status !== 0) fail(`${command} ${commandArgs.slice(0, 3).join(" ")} failed: ${(result.stderr || result.stdout || "").trim().slice(0, 600)}`);
  return result.stdout;
}

// Pull a manifest with no credential and compare every file with the staged
// bytes. target is a registry reference, or an OCI layout in the self-test.
function pullAndCompare(artifact, { work, target, layout = false }) {
  const anonymous = join(work, `anonymous-${artifact.role}`);
  const out = join(work, `pulled-${artifact.role}`);
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
  const layerPath = join(out, artifact.layerTitle);
  check(existsSync(layerPath), "the pull returned no layer file");
  const layer = readFileSync(layerPath);
  check(digestOf(layer) === artifact.layerDigest, `the pulled layer is ${digestOf(layer)}, and the committed bytes build ${artifact.layerDigest}`);
  const pulled = new Map(readAicrMirrorLayerFiles(artifact, layer).map((file) => [file.path, digestOf(file.data)]));
  check(pulled.size === artifact.stagedFiles.length, `the pulled layer holds ${pulled.size} file(s), and the artifact has ${artifact.stagedFiles.length}`);
  for (const file of artifact.stagedFiles) {
    check(pulled.get(file.path) === `sha256:${file.sha256}`, `the pulled ${file.path} is not the committed file`);
  }
  return { result: "pass", manifestDigest: descriptor.digest, layerDigest: digestOf(layer), filesMatched: pulled.size };
}

function publish(entry, role) {
  const artifact = entry.artifacts[role];
  const problems = [
    ...publishProblems(entry, role),
    ...(role === LITERAL_CONFIG ? sourcePackageFirstProblems(entry) : []),
  ];
  if (problems.length > 0) fail(`the ${role} of ${entry.id} was not published. ${problems.join("; ")}`);
  const receiptPath = join(repoRoot, artifact.receiptRel);
  if (existsSync(receiptPath)) fail(`${artifact.receiptRel} already exists. Remove it only if that publication is to be replaced`);
  if (spawnSync("oras", ["version"], { encoding: "utf8" }).status !== 0) fail("oras is not on the PATH");
  const work = mkdtempSync(join(tmpdir(), "aicr-mirror-publish-"));
  try {
    const layoutRef = writeAicrMirrorOciLayout(artifact, join(work, "layout"));
    run("oras", ["cp", "--from-oci-layout", layoutRef, artifact.reference]);
    const pushed = JSON.parse(run("oras", ["manifest", "fetch", "--descriptor", artifact.reference]));
    check(pushed.digest === artifact.manifestDigest, `the registry holds ${pushed.digest} at ${artifact.reference}, and the committed bytes build ${artifact.manifestDigest}`);
    const anonymousPull = {
      ...pullAndCompare(artifact, { work, target: artifact.immutableReference }),
      command: `oras pull --registry-config <empty config> ${artifact.immutableReference}`,
    };
    const receipt = aicrMirrorReceiptDoc(entry, artifact, {
      observedAt: new Date().toISOString(),
      pushCommand: `oras cp --from-oci-layout <layout>:${artifact.tag} ${artifact.reference}`,
      anonymousPull,
    });
    const receiptProblems = aicrMirrorPublicationProblems(receipt, entry, artifact);
    check(receiptProblems.length === 0, `the receipt this run would write is not valid: ${receiptProblems.join("; ")}`);
    writeYaml(receiptPath, receipt);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(`published the ${role} of ${entry.id} at ${artifact.immutableReference}`);
  console.log(`wrote ${artifact.receiptRel}. Add it with: git add -f ${artifact.receiptRel}`);
  if (role === SOURCE_PACKAGE) console.log(`next: ${PUBLISH_GATE}=1 node scripts/publish-aicr-mirror-artifacts.mjs --publish --entry ${entry.id} --artifact ${LITERAL_CONFIG}`);
  console.log("after the receipts are added, regenerate: npm run config-catalog && npm run catalog:listings && npm run aicr-platform-evidence:generate && npm run workshop-catalog-guide:generate && npm run receipt-aging:generate");
  console.log('and the site: HELM_EXPT_SITE_GENERATED_AT="$(cat site/generated-at.txt)" npm run site:generate');
}

function selfTest() {
  // The fixtures start not published whatever receipts are tracked, and the
  // published cases below build their own receipts in memory.
  const entries = loadAicrMirrorEntries({ receipts: "none" });
  check(entries.length > 0, "self-test: no mirrored AICR entry was discovered");
  const builders = { [SOURCE_PACKAGE]: buildSourcePackageArtifact, [LITERAL_CONFIG]: buildLiteralConfigArtifact };
  for (const entry of entries) {
    for (const role of AICR_MIRROR_ARTIFACT_ROLES) {
      const artifact = entry.artifacts[role];
      const again = builders[role](entry);
      check(
        again.manifestDigest === artifact.manifestDigest && again.layerDigest === artifact.layerDigest,
        `self-test: ${entry.id} built two different ${role} artifacts from the same bytes`,
      );
      const files = readAicrMirrorLayerFiles(artifact);
      check(
        JSON.stringify(files.map((file) => file.path).sort()) === JSON.stringify(artifact.stagedFiles.map((file) => file.path).sort()),
        `self-test: the ${role} layer of ${entry.id} does not hold exactly its staged files`,
      );
      for (const file of files) {
        const staged = artifact.stagedFiles.find((candidate) => candidate.path === file.path);
        check(file.data.equals(readFileSync(join(repoRoot, staged.source))), `self-test: ${staged.source} on disk is not the file in the ${role} layer; run ${REGENERATE}`);
      }
      const manifest = JSON.parse(artifact.manifest.toString("utf8"));
      check(
        manifest.layers.length === 1 && manifest.layers[0].digest === artifact.layerDigest && manifest.layers[0].size === artifact.layerBytes,
        `self-test: the ${role} manifest of ${entry.id} does not describe its one layer`,
      );
      check(
        readFileSync(join(repoRoot, artifact.planRel), "utf8") === serializeYaml(aicrMirrorPlanDoc(entry, artifact)),
        `self-test: ${artifact.planRel} is stale; run ${REGENERATE}`,
      );
    }
    const source = entry.artifacts[SOURCE_PACKAGE];
    const literal = entry.artifacts[LITERAL_CONFIG];
    check(
      source.reference === `${AICR_MIRROR_REGISTRY}/aicr-${entry.id}/aicr-bundle:${entry.sourcePackageTag}` && `oci://${source.reference}` === entry.sourcePackageRef,
      `self-test: the source package of ${entry.id} would be pushed somewhere other than the reference its Applications name`,
    );
    check(literal.reference.startsWith(`${AICR_MIRROR_BUNDLE_REGISTRY}/catalog-aicr-`), `self-test: the literal bundle of ${entry.id} would be pushed outside the bundle repository`);
    check(JSON.parse(literal.manifest.toString("utf8")).artifactType === LITERAL_ARTIFACT_TYPE, `self-test: the literal bundle of ${entry.id} has another artifact type`);
    const literalFiles = readAicrMirrorLayerFiles(literal);
    const applications = literalFiles.filter((file) => !file.path.includes("/") && file.path.endsWith(".yaml"));
    check(
      applications.length === entry.applications.length
        && literalFiles.every((file) => /^([A-Za-z0-9._-]+\.yaml|README\.md|routes\/[a-z-]+\.yaml|requirements\/target-requirements\.yaml)$/.test(file.path))
        && literalFiles.filter((file) => file.path === "routes/sync-wave-ordering.yaml").length === 1
        && literalFiles.filter((file) => file.path === "requirements/target-requirements.yaml").length === 1
        && literalFiles.filter((file) => file.path === "README.md").length === 1,
      `self-test: the literal bundle of ${entry.id} holds something other than its Applications, its routes, one requirements file and one guide`,
    );
    check(
      literalFiles.some((file) => file.path === "routes/system-node-selector-placeholder.yaml") === (entry.placeholders.length > 0),
      `self-test: the literal bundle of ${entry.id} does not carry a placeholder route exactly when the entry carries a placeholder`,
    );
    for (const file of entry.generated) {
      check(!/\bpublished\b|\bpublication\b/i.test(file.text), `self-test: ${file.source} says something about publication, so publishing would make the bundle contradict itself`);
      check(!/^kind: "?(Job|Secret)"?$/m.test(file.text), `self-test: ${file.source} holds a Job or a Secret, and a companion file only names things`);
    }
    for (const application of literalFiles.filter((file) => !file.path.includes("/") && file.path.endsWith(".yaml"))) {
      check(/^kind: Application$/m.test(application.data.toString("utf8")), `self-test: ${entry.id}/${application.path} in the literal bundle is not an Argo CD Application`);
    }
  }
  for (const role of AICR_MIRROR_ARTIFACT_ROLES) {
    check(new Set(entries.map((entry) => entry.artifacts[role].reference)).size === entries.length, `self-test: two entries share one ${role} destination`);
  }

  const entry = entries.find((candidate) => candidate.placeholders.length > 0 && candidate.leftOutOfBundle.length > 0);
  const other = entries.find((candidate) => candidate.id !== entry?.id);
  check(entry && other, "self-test: the mirror no longer holds an entry with a placeholder and a left-out component, so these fixtures need a new subject");
  const source = entry.artifacts[SOURCE_PACKAGE];
  const literal = entry.artifacts[LITERAL_CONFIG];
  const plans = Object.fromEntries(AICR_MIRROR_ARTIFACT_ROLES.map((role) => [role, serializeYaml(aicrMirrorPlanDoc(entry, entry.artifacts[role]))]));
  const noFindings = { inputFindings: [] };

  // A changed byte in the retained bundle is refused before anything is built.
  const bundleFile = source.stagedFiles.find((file) => file.path === "values.yaml");
  let refusedBundle = false;
  try {
    buildSourcePackageArtifact(entry, { readFile: (rel) => (rel === bundleFile.source ? Buffer.concat([bundleFile.data, Buffer.from("# one more byte\n")]) : readFileSync(join(repoRoot, rel))) });
  } catch (error) {
    refusedBundle = /so the retained bundle changed after it was generated/.test(error.message);
  }
  check(refusedBundle, "self-test: a retained bundle file that differs from the checksum list was packaged");

  // A changed companion file changes the digest, and the changed artifact is
  // refused against the plan generated for the committed bytes.
  const stagedText = (rel) => literal.stagedFiles.find((file) => file.source === rel).data.toString("utf8");
  const routeRel = entry.generated.find((file) => file.role === "route: sync-wave-ordering").source;
  const changed = { ...entry, artifacts: { ...entry.artifacts } };
  changed.artifacts[LITERAL_CONFIG] = buildLiteralConfigArtifact(entry, { readText: (rel) => `${stagedText(rel)}${rel === routeRel ? "# one more byte\n" : ""}` });
  check(changed.artifacts[LITERAL_CONFIG].manifestDigest !== literal.manifestDigest, "self-test: a changed route file did not change the manifest digest");
  for (const role of AICR_MIRROR_ARTIFACT_ROLES) {
    check(publishProblems(entry, role, { planText: plans[role], ...noFindings }).length === 0, `self-test: the committed ${role} bytes were refused against their own plan`);
    check(publishProblems(entry, role, { planText: "", ...noFindings }).some((problem) => /is not committed/.test(problem)), `self-test: a ${role} with no committed plan was not refused`);
  }
  check(
    publishProblems(changed, LITERAL_CONFIG, { planText: plans[LITERAL_CONFIG], ...noFindings }).some((problem) => /the local artifact is sha256:[0-9a-f]{64} and the committed plan records sha256:[0-9a-f]{64}/.test(problem)),
    "self-test: an artifact that differs from the committed plan was not refused",
  );
  let refusedRender = false;
  const applicationRel = entry.applications[0].source;
  try {
    buildLiteralConfigArtifact(entry, { readText: (rel) => (rel === applicationRel ? "kind: ConfigMap\n" : stagedText(rel)) });
  } catch (error) {
    refusedRender = /is not the retained render/.test(error.message);
  }
  check(refusedRender, "self-test: an Application that is not the retained render was staged");

  // A generation input that is not accounted for blocks publication.
  check(aicrMirrorRequiredInputFindings(entry, { published: true }).length === 0, "self-test: a fully recorded placeholder blocked publication");
  const unaccounted = { ...entry, requiredInputs: entry.requiredInputs.map((input) => ({ ...input, valueStatus: "awaiting-maintainer-confirmation" })) };
  check(
    publishProblems(unaccounted, SOURCE_PACKAGE, { planText: plans[SOURCE_PACKAGE] }).some((problem) => /neither confirmed nor a recorded placeholder/.test(problem)),
    "self-test: an entry with an unconfirmed generation input was allowed to publish",
  );
  const moved = { ...entry, requiredInputs: entry.requiredInputs.map((input) => ({ ...input, placeholder: { ...input.placeholder, appearsIn: input.placeholder.appearsIn.slice(1) } })) };
  check(
    aicrMirrorRequiredInputFindings(moved, { published: true }).some((finding) => /recorded placeholder locations differ from the rendered Applications/.test(finding)),
    "self-test: a placeholder whose recorded locations differ from the bytes was accepted",
  );

  // The gate, the one-entry rule and the one-artifact rule.
  const gate = { [PUBLISH_GATE]: "1" };
  check(publishPreconditions({ env: {}, entryId: entry.id, role: SOURCE_PACKAGE, selected: [entry] }).some((problem) => problem.includes(PUBLISH_GATE)), "self-test: a publish without the gate was allowed");
  check(publishPreconditions({ env: gate, entryId: "", role: SOURCE_PACKAGE, selected: entries }).some((problem) => /exactly one entry/.test(problem)), "self-test: a publish of every entry at once was allowed");
  check(publishPreconditions({ env: gate, entryId: entry.id, role: "", selected: [entry] }).some((problem) => /exactly one artifact/.test(problem)), "self-test: a publish with no artifact named was allowed");
  check(publishPreconditions({ env: gate, entryId: entry.id, role: SOURCE_PACKAGE, selected: [entry] }).length === 0, "self-test: a gated publish of one artifact of one entry was refused");

  // The receipt rule, in both directions.
  const fixture = (subject, artifact) => aicrMirrorReceiptDoc(subject, artifact, {
    observedAt: "2026-01-01T00:00:00.000Z",
    pushCommand: "self-test fixture, nothing was pushed",
    anonymousPull: { result: "pass", manifestDigest: artifact.manifestDigest, layerDigest: artifact.layerDigest, filesMatched: artifact.stagedFiles.length },
  });
  const receipts = { [SOURCE_PACKAGE]: fixture(entry, source), [LITERAL_CONFIG]: fixture(entry, literal) };
  for (const role of AICR_MIRROR_ARTIFACT_ROLES) {
    const artifact = entry.artifacts[role];
    const receipt = receipts[role];
    check(aicrMirrorPublicationProblems(receipt, entry, artifact).length === 0, `self-test: a receipt for the ${role} bytes was refused`);
    // A receipt is read back from YAML with its keys in another order, and it
    // must still be the receipt of these bytes.
    check(aicrMirrorPublicationProblems(readYamlText(serializeYaml(receipt)), entry, artifact).length === 0, `self-test: a ${role} receipt written as YAML and read back was refused`);
    check(aicrMirrorPublicationProblems(receipt, other, other.artifacts[role]).length > 0, `self-test: a ${role} receipt for another entry was accepted`);
    const otherRole = role === SOURCE_PACKAGE ? LITERAL_CONFIG : SOURCE_PACKAGE;
    check(aicrMirrorPublicationProblems(receipt, entry, entry.artifacts[otherRole]).length > 0, `self-test: a ${role} receipt was accepted for the ${otherRole}`);
    for (const [label, change, pattern] of [
      ["no anonymous pull", (doc) => { doc.spec.anonymousPull.result = "not-run"; }, /records no anonymous pull of this manifest/],
      ["another digest", (doc) => { doc.spec.artifact.manifestDigest = `sha256:${"b".repeat(64)}`; }, /its manifest digest is/],
      ["a claimed ConfigHub upload", (doc) => { doc.spec.configHubUpload = "pass"; }, /does not say that no ConfigHub upload was run/],
      ["a claimed delivery", (doc) => { doc.spec.delivery = "pass"; }, /does not say that no delivery was run/],
    ]) {
      const doc = structuredClone(receipt);
      change(doc);
      check(aicrMirrorPublicationProblems(doc, entry, artifact).some((problem) => pattern.test(problem)), `self-test: a ${role} receipt with ${label} was accepted`);
    }
  }
  check(
    aicrMirrorPublicationProblems(receipts[LITERAL_CONFIG], entry, changed.artifacts[LITERAL_CONFIG]).some((problem) => /its manifest digest is/.test(problem)),
    "self-test: a receipt was accepted for an artifact whose bytes changed after it was written",
  );

  // The source package goes first.
  check(sourcePackageFirstProblems(entry, { receiptText: "" }).some((problem) => /Publish it first/.test(problem)), "self-test: a literal bundle was allowed before its source package had a receipt");
  check(sourcePackageFirstProblems(entry, { receiptText: serializeYaml(receipts[SOURCE_PACKAGE]) }).length === 0, "self-test: a literal bundle was refused beside a valid source package receipt");
  check(
    sourcePackageFirstProblems(entry, { receiptText: serializeYaml(fixture(other, other.artifacts[SOURCE_PACKAGE])) }).some((problem) => /is not a receipt for the source package these files build/.test(problem)),
    "self-test: a literal bundle was allowed beside another entry's source package receipt",
  );

  // The record rule, in all four states and in both directions.
  const publicationOf = (role) => ({
    published: true,
    artifact: entry.artifacts[role],
    receipt: receipts[role],
    receiptRel: entry.artifacts[role].receiptRel,
    receiptSha256: digestOf(serializeYaml(receipts[role])),
    observedReference: `oci://${entry.artifacts[role].reference}@${entry.artifacts[role].manifestDigest}`,
  });
  const inState = (sourcePublished, literalPublished) => ({
    ...entry,
    publications: {
      [SOURCE_PACKAGE]: sourcePublished ? publicationOf(SOURCE_PACKAGE) : entry.publications[SOURCE_PACKAGE],
      [LITERAL_CONFIG]: literalPublished ? publicationOf(LITERAL_CONFIG) : entry.publications[LITERAL_CONFIG],
    },
  });
  const recordFor = (subject) => {
    const delivery = aicrMirrorDelivery(subject);
    return {
      spec: {
        source: { packageOciRef: delivery.packageOciRef },
        delivery: { sourcePackageOci: delivery.sourcePackageOci, literalConfigOci: delivery.literalConfigOci },
        evidence: { retention: delivery.retention },
      },
      status: { claim: `fixture. ${delivery.claim}` },
    };
  };
  const states = {
    neither: inState(false, false),
    sourceOnly: inState(true, false),
    literalOnly: inState(false, true),
    both: inState(true, true),
  };
  for (const [state, subject] of Object.entries(states)) {
    const delivery = aicrMirrorDelivery(subject);
    check(delivery.state === state && delivery.retention === AICR_MIRROR_STATES[state], `self-test: the ${state} state reads as ${delivery.retention}`);
    check(delivery.deliverable === (state === "both"), `self-test: the ${state} state reads as ${delivery.deliverable ? "deliverable" : "not deliverable"}`);
    check(aicrMirrorDeliveryProblem(entry.recordName, recordFor(subject), subject) === "", `self-test: a record written for the ${state} state was refused in that state`);
    for (const [otherState, otherSubject] of Object.entries(states)) {
      if (otherState === state) continue;
      check(
        aicrMirrorDeliveryProblem(entry.recordName, recordFor(otherSubject), subject) !== "",
        `self-test: a record written for the ${otherState} state was accepted in the ${state} state`,
      );
    }
  }
  const unpublished = aicrMirrorDelivery(states.neither);
  check(
    unpublished.sourcePackageOci.status === AICR_MIRROR_UNPUBLISHED_STATUS && unpublished.literalConfigOci.status === AICR_MIRROR_UNPUBLISHED_STATUS && unpublished.packageOciRef === "",
    "self-test: an entry with no receipt reads as published",
  );
  const literalOnly = aicrMirrorDelivery(states.literalOnly);
  check(
    literalOnly.literalConfigOci.status === AICR_MIRROR_PUBLISHED_STATUS
      && literalOnly.literalConfigOci.sourcePackage === "missing"
      && /cannot be delivered/.test(literalOnly.literalConfigOci.note)
      && /cannot be delivered/.test(literalOnly.claim),
    "self-test: a literal bundle with no source package does not say it cannot be delivered",
  );
  check(
    /says published-with-receipt with sha256:[0-9a-f]{64}, and no tracked publication receipt/.test(aicrMirrorDeliveryProblem(entry.recordName, recordFor(states.both), states.neither)),
    "self-test: a published record was accepted with no publication receipt",
  );
  check(
    /does not carry exactly that reference/.test(aicrMirrorDeliveryProblem(entry.recordName, recordFor(states.neither), states.both)),
    "self-test: a record that says not published was accepted beside valid receipts",
  );

  // The same tools a publication uses, pointed at local OCI layouts. No
  // registry is contacted. A machine without them still runs everything above.
  const tools = [];
  const work = mkdtempSync(join(tmpdir(), "aicr-mirror-self-test-"));
  try {
    for (const role of AICR_MIRROR_ARTIFACT_ROLES) {
      const artifact = entry.artifacts[role];
      const archive = join(work, artifact.layerTitle);
      writeFileSync(archive, artifact.layer);
      const listed = spawnSync("tar", ["-tzf", archive], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      if (listed.status === 0) {
        if (!tools.includes("tar")) tools.push("tar");
        const prefix = role === SOURCE_PACKAGE ? "aicr-bundle/" : "./";
        check(
          JSON.stringify(listed.stdout.trim().split("\n").map((line) => line.slice(prefix.length)).sort()) === JSON.stringify(artifact.stagedFiles.map((file) => file.path).sort()),
          `self-test: the system tar does not list the staged files in the ${role} layer`,
        );
      }
      if (spawnSync("oras", ["version"], { encoding: "utf8" }).status === 0) {
        if (!tools.includes("oras")) tools.push("oras");
        const layoutRef = writeAicrMirrorOciLayout(artifact, join(work, `layout-${role}`));
        const copyRef = `${join(work, `copy-${role}`)}:${artifact.tag}`;
        execFileSync("oras", ["cp", "--from-oci-layout", "--to-oci-layout", layoutRef, copyRef], { encoding: "utf8", stdio: "pipe" });
        const pull = pullAndCompare(artifact, { work, target: copyRef, layout: true });
        check(pull.result === "pass" && pull.filesMatched === artifact.stagedFiles.length, `self-test: a copy of the ${role} layout did not pull back as the staged files`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  console.log(
    `publish-aicr-mirror-artifacts self-test passed: ${entries.length * 2} artifact(s) of ${entries.length} entries rebuilt to the same digests; plan, checksum, generation-input, gate, order, receipt and record refusals fired in every publication state; local tool checks ran with ${tools.join(" and ") || "no external tool"}. No registry was contacted.`,
  );
}

if (has("--sign")) fail("there is no --sign. The Catalog does not sign these artifacts, and this script follows that method");
const valued = ["--entry", "--artifact"];
const unknown = args.filter((arg, index) => (arg.startsWith("--") ? !["--dry-run", "--publish", "--self-test", "--verbose", ...valued].includes(arg) : !valued.includes(args[index - 1])));
if (unknown.length > 0) fail(`unknown argument ${unknown.join(" ")}`);
if (has("--self-test")) {
  selfTest();
} else {
  const entryId = valueOf("--entry");
  const role = valueOf("--artifact");
  const selected = selectEntries(loadAicrMirrorEntries(), entryId);
  if (has("--publish")) {
    if (has("--dry-run")) fail("choose --dry-run or --publish, not both");
    const problems = publishPreconditions({ env: process.env, entryId, role, selected });
    if (problems.length > 0) fail(problems.join("; "));
    publish(selected[0], role);
  } else {
    dryRun(selected, { verbose: has("--verbose") });
  }
}
