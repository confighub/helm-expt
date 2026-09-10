#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "data/workshop-catalog-guide-proof");
const receiptPath = join(outputDir, "receipt.json");
const summaryPath = join(outputDir, "summary.md");
const fixedInputs = ["scripts/lookup-catalog-record.mjs", "scripts/lib/catalog-record-lookup.mjs", "scripts/lib/proof-common.mjs", "scripts/run-workshop-catalog-guide-proof.mjs", "data/base-variant-records/records.json", "schemas/base-variant-record.schema.json", "examples/workshop-catalog-inspection/README.md"];
const lookup = fixedInputs[0];
const catalog = fixedInputs[4];
const schema = fixedInputs[5];
const name = "bitnami-redis-25-5-3-default";
const digest = "175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e";
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const bytesFor = (relative, rootDir = root) => readFileSync(join(rootDir, relative));
const canonical = (value) => JSON.stringify(sort(value));
function sort(value) { if (Array.isArray(value)) return value.map(sort); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])])); }
function check(condition, message) { if (!condition) throw new Error(message); }
function inputManifest() { for (const path of fixedInputs) check(existsSync(join(root, path)), `missing proof input: ${path}`); return fixedInputs.map((path) => ({ path, sha256: sha256(bytesFor(path)) })); }
function run(argv) {
  const result = spawnSync(process.execPath, argv, { cwd: root, encoding: null, timeout: 10000 });
  const stdout = result.stdout ?? Buffer.alloc(0); const stderr = result.stderr ?? Buffer.alloc(0);
  return { argv, exitCode: result.status, signal: result.signal ?? null, spawnError: result.error?.code ?? null, stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr), stdout };
}
function makeReceipt() {
  const inputs = inputManifest();
  const exact = run([lookup, "--name", name, "--configuration-digest", digest]);
  const mismatch = run([lookup, "--name", name, "--configuration-digest", "f".repeat(64)]);
  return { receipt: { schemaVersion: 1, kind: "WorkshopCatalogGuideProof", nodeVersion: process.versions.node, inputs, outputs: { exact: "data/workshop-catalog-guide-proof/success.json", mismatch: "data/workshop-catalog-guide-proof/refusal.json" }, steps: { exact: { ...exact, stdout: undefined }, mismatch: { ...mismatch, stdout: undefined } } }, outputBytes: { exact: exact.stdout, mismatch: mismatch.stdout } };
}
function validateManifest(receipt, rootDir) {
  check(receipt?.schemaVersion === 1 && receipt.kind === "WorkshopCatalogGuideProof", "invalid proof receipt kind/version");
  check(typeof receipt.nodeVersion === "string" && /^\d+\.\d+\.\d+$/.test(receipt.nodeVersion), "node version binding is invalid");
  check(JSON.stringify(receipt.inputs?.map((x) => x.path)) === JSON.stringify(fixedInputs), "proof input manifest paths changed");
  for (const input of receipt.inputs) check(input.sha256 === sha256(bytesFor(input.path, rootDir)), `stale input: ${input.path}`);
  const readmeLines = bytesFor(fixedInputs[6], rootDir).toString("utf8").split("\n").filter((line) => line.startsWith("node scripts/lookup-catalog-record.mjs"));
  check(JSON.stringify(readmeLines) === JSON.stringify([
    `node scripts/lookup-catalog-record.mjs --name ${name} --configuration-digest ${digest} > catalog-inspection/record.json`,
    `node scripts/lookup-catalog-record.mjs --name ${name} --configuration-digest ${"f".repeat(64)} > catalog-inspection/refusal.json`,
  ]), "README core lookup commands changed");
  check(JSON.stringify(receipt.outputs) === JSON.stringify({ exact: "data/workshop-catalog-guide-proof/success.json", mismatch: "data/workshop-catalog-guide-proof/refusal.json" }), "proof output paths changed");
}
export function validateEvidence(receipt, { rootDir = root, outputBytes = null } = {}) {
  validateManifest(receipt, rootDir);
  const exact = checkStep(receipt.steps?.exact, 0, "exact"); const mismatch = checkStep(receipt.steps?.mismatch, 4, "mismatch");
  check(JSON.stringify(exact.argv) === JSON.stringify([lookup, "--name", name, "--configuration-digest", digest]), "exact argv changed");
  check(JSON.stringify(mismatch.argv) === JSON.stringify([lookup, "--name", name, "--configuration-digest", "f".repeat(64)]), "mismatch argv changed");
  const output = (path, step, key) => { const bytes = outputBytes?.[key] ?? bytesFor(path, rootDir); check(sha256(bytes) === step.stdoutSha256, `${path} output bytes are stale`); return JSON.parse(bytes.toString("utf8")); };
  const exactJson = output(receipt.outputs.exact, exact, "exact"); const mismatchJson = output(receipt.outputs.mismatch, mismatch, "mismatch");
  const document = JSON.parse(bytesFor(catalog, rootDir)); const record = document.records.find((item) => item.metadata?.name === name); check(record, "pinned record disappeared");
  check(exactJson.apiVersion === "catalog.confighub.com/v1alpha1" && exactJson.kind === "CatalogRecordLookup", "exact envelope changed");
  check(exactJson.status === "found" && exactJson.name === name && JSON.stringify(exactJson.record) === JSON.stringify(record), "exact output record differs from committed record");
  check(exactJson.record.spec.configuration.digest === digest && exactJson.configurationDigestRole === "canonical-object-set", "exact digest or role changed");
  check(exactJson.catalog.path === catalog && exactJson.catalog.sha256 === sha256(bytesFor(catalog, rootDir)) && exactJson.recordSchema === schema, "exact catalog/schema binding changed");
  check(exactJson.selectedRecordSha256 === sha256(Buffer.from(canonical(record))), "selected record hash is incorrect");
  check(exactJson.record.spec.inputs.installTimeStatus === "not-yet-declared", "install-time status changed");
  const stages = Object.fromEntries(exactJson.record.spec.assessment.stages.map((stage) => [stage.id, stage])); check(stages.destination?.resultState === "not-run" && stages["post-deployment"]?.resultState === "not-run", "destination/post-deployment boundary changed");
  check(mismatchJson.apiVersion === "catalog.confighub.com/v1alpha1" && mismatchJson.kind === "CatalogRecordLookup" && mismatchJson.status === "digest-mismatch" && mismatchJson.name === name && !Object.hasOwn(mismatchJson, "record"), "mismatch returned a record or wrong envelope");
  check(mismatchJson.catalog?.path === catalog && mismatchJson.catalog.sha256 === sha256(bytesFor(catalog, rootDir)) && mismatchJson.recordSchema === schema, "mismatch catalog/schema binding changed");
  check(mismatchJson.expectedConfigurationDigest === "f".repeat(64) && mismatchJson.observedConfigurationDigest === digest && mismatchJson.configurationDigestRole === "canonical-object-set", "mismatch fields changed");
  return true;
  function checkStep(step, exit, label) { check(step && step.exitCode === exit && step.signal === null && step.spawnError === null, `${label} command did not complete with expected exit`); check(step.stderrSha256 === sha256(Buffer.alloc(0)), `${label} command wrote stderr`); return step; }
}
function renderSummary() { return `# Workshop Catalog Guide proof\n\nThis is an editorial draft, anonymous local inspection exercise with no assigned owner. It runs the committed exact-record lookup for \`${name}\` and a deliberately incorrect digest. It is not a hosted API, cub/plugin result, deployment, or runtime proof.\n\nThe success output preserves the complete record, canonical-object-set digest, catalog SHA, schema, selected-record SHA, and \`installTimeStatus: not-yet-declared\`. Source inspection and materialization statuses are preserved; destination and post-deployment remain \`not-run\`.\n\nThe refusal exits 4 with structured \`digest-mismatch\`, expected/observed digests, and no record. Investigate the discrepancy before retrying; the exercise does not auto-accept a changed pin.\n\nInput files, Node version, and exact readable output bytes are bound in \`receipt.json\`. No timestamps, machine paths, network, authentication, cluster, hosted endpoint, or runtime claim is included.\n`; }
function main() {
  const mode = process.argv[2] ?? "--verify";
  check(mode === "--generate" || mode === "--verify", "usage: --generate|--verify");
  const generated = mode === "--generate" ? makeReceipt() : null;
  const receipt = generated?.receipt ?? JSON.parse(readFileSync(receiptPath, "utf8"));
  validateEvidence(receipt, { outputBytes: generated?.outputBytes });
  if (generated) {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "success.json"), generated.outputBytes.exact);
    writeFileSync(join(outputDir, "refusal.json"), generated.outputBytes.mismatch);
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  }
  if (mode === "--generate") { writeFileSync(summaryPath, renderSummary()); console.log("generated Workshop Catalog Guide exercise evidence"); }
  else { check(readFileSync(summaryPath, "utf8") === renderSummary(), "summary is stale"); console.log("verified workshop catalog Guide proof"); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
