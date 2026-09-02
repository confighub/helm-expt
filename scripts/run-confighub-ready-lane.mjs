#!/usr/bin/env node
// The ConfigHub-ready lane: every certified image is uploaded into a
// ConfigHub organization as a base variant, its Units are counted, the
// outcome is recorded, and the Space is deleted, one image at a time.
//
//   node scripts/run-confighub-ready-lane.mjs [--workshop <plugin dir>]   # run against the current cub context
//   node scripts/run-confighub-ready-lane.mjs --verify                     # every certified bundle has a recorded outcome
//   node scripts/run-confighub-ready-lane.mjs --only a,b [--workshop …]    # rerun some images and merge them into the receipt
//
// Published bundles upload from their digest, which is the design center's
// path: upload is pointing an organization at an image. Unpublished ones
// upload from the bytes their receipt lists, staged per file. The claim the
// receipt lets the site make is exactly what ran: uploaded as a base variant,
// N Units, on the named server, with any refusal recorded verbatim.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { check, listFiles, readYaml, repoRoot, toYaml } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const verifyOnly = args.includes("--verify");
const workshopDir = args.includes("--workshop") ? args[args.indexOf("--workshop") + 1] : null;
const outDir = join(repoRoot, "data", "confighub-ready");
const receiptPath = join(outDir, "receipt.yaml");
const csvPath = join(repoRoot, "data", "certified-bundles", "receipts.csv");

function readCsv(path) {
  const [head, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const keys = head.split(",");
  return lines.map((line) => Object.fromEntries(keys.map((key, i) => [key, line.split(",")[i] ?? ""])));
}
const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

if (verifyOnly) {
  check(existsSync(receiptPath), "data/confighub-ready/receipt.yaml is missing; run the lane");
  const receipt = readYaml(receiptPath);
  const recorded = new Map(receipt.spec.bundles.map((entry) => [entry.name, entry]));
  const rows = readCsv(csvPath);
  const missing = rows.filter((row) => !recorded.has(row.name)).map((row) => row.name);
  check(missing.length === 0, `certified bundles without a ConfigHub-ready outcome: ${missing.join(", ")} — run the lane`);
  const failed = receipt.spec.bundles.filter((entry) => entry.status === "fail");
  check(failed.length === 0, `ConfigHub-ready lane has refusals: ${failed.map((entry) => entry.name).join(", ")}`);
  console.log(`verified ConfigHub-ready lane: ${receipt.spec.bundles.length} images recorded, ${receipt.spec.summary.pass} uploaded as base variants, ${receipt.spec.summary.notApplicable ?? 0} render-late recorded as not applicable, 0 refused`);
  process.exit(0);
}

const cub = (cubArgs) => execFileSync("cub", cubArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
// Configuration is every YAML or JSON entry that is not a route, a guide, or a
// wrapper-chart file; the receipt's own role names vary by producer.
const EXCLUDED_ROLES = /^(route:|space-guide|guide|readme|wrapper chart file|namespace template|.*template$|source-lock|evidence)/i;
const isConfig = (file) => /\.(ya?ml|json)$/i.test(file.path) && !EXCLUDED_ROLES.test(String(file.role ?? ""));

const trackedFiles = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim().split("\n");
function locate(relPath, receipt, name) {
  const candidates = [join(repoRoot, relPath)];
  const sourcePath = receipt.spec?.source?.canonicalHome?.path ?? receipt.spec?.source?.path;
  const entryDir = join(repoRoot, "examples", "aicr", name.replace(/^aicr-/, ""));
  for (const dir of [sourcePath && join(repoRoot, sourcePath), entryDir].filter(Boolean)) {
    candidates.push(join(dir, relPath), join(dir, "argocd-rendered", "templates", relPath));
  }
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) return found;
  // Last resort: the one tracked file whose path ends with the receipt's path.
  const matches = trackedFiles.filter((tracked) => tracked.endsWith(`/${relPath}`) || tracked === relPath);
  if (matches.length === 1) return join(repoRoot, matches[0]);
  const byBase = trackedFiles.filter((tracked) => tracked.endsWith(`/${basename(relPath)}`) && tracked.includes(name.replace(/^(aicr|kubara|sveltos-example|sveltos)-/, "").split("-")[0]));
  return byBase.length === 1 ? join(repoRoot, byBase[0]) : null;
}

function stageLocal(receipt, name, cacheDir = null) {
  const stage = mkdtempSync(join(tmpdir(), "confighub-ready-"));
  let staged = 0;
  for (const file of receipt.spec.bundle.files.filter(isConfig)) {
    const source = cacheDir ? join(cacheDir, basename(file.path)) : locate(file.path, receipt, name);
    if (!source || !existsSync(source)) continue;
    writeFileSync(join(stage, basename(file.path)), readFileSync(source));
    staged += 1;
  }
  return { stage, staged };
}

function uploadOne({ name, producer, source, spaceSlug, describeSource }) {
  const started = Date.now();
  const entry = { name, producer, source: describeSource, space: spaceSlug, units: 0, status: "pass", message: "" };
  try {
    cub(["variant", "upload", "--component", spaceSlug.replace(/-base$/, ""), "--variant", "base", "--granularity", "per-file", "--owner", "confighub-ready", source]);
    entry.units = cub(["unit", "list", "--space", spaceSlug, "-o", "name"]).trim().split("\n").filter(Boolean).length;
    if (entry.units === 0) { entry.status = "fail"; entry.message = "uploaded but the base Space holds no Units"; }
  } catch (error) {
    entry.status = "fail";
    entry.message = String(error.stderr ?? error.message).trim().split("\n").slice(-2).join(" ").slice(0, 300);
  }
  try { cub(["space", "delete", spaceSlug, "--recursive-force"]); } catch { /* nothing to delete */ }
  entry.seconds = Math.round((Date.now() - started) / 100) / 10;
  return entry;
}

const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const previous = only && existsSync(receiptPath) ? readYaml(receiptPath).spec.bundles : [];
const bundles = [];
for (const row of readCsv(csvPath)) {
  if (only && !only.has(row.name)) continue;
  const receipt = readYaml(join(repoRoot, row.receipt));
  const spaceSlug = `${slugOf(row.name)}-base`;
  const reference = receipt.spec?.bundle?.reference ?? "";
  const digest = receipt.spec?.bundle?.manifestDigest ?? row.bundle_digest ?? "";
  const publishedReachable = row.oci_published === "published" && reference && !/^(oci:\/\/)?(127\.0\.0\.1|localhost)/.test(reference);
  let entry;
  if (publishedReachable) {
    const repo = reference.replace(/^oci:\/\//, "").split(/[:@]/)[0];
    const source = `oci://${repo}@${digest.startsWith("sha256:") ? digest : `sha256:${digest}`}`;
    entry = uploadOne({ name: row.name, producer: row.producer, source, spaceSlug, describeSource: source });
  } else {
    const { stage, staged } = stageLocal(receipt, row.name);
    const renderLate = !["rendered-config", "literal-config"].includes(row.contents_kind);
    entry = staged === 0
      ? { name: row.name, producer: row.producer, source: "local files", space: spaceSlug, units: 0, status: renderLate ? "n/a" : "fail", message: renderLate ? `render-late image (${row.contents_kind}): a wrapper chart, not a rendered object set, so upload does not apply until it is rendered` : "no configuration file the receipt lists could be located", seconds: 0 }
      : uploadOne({ name: row.name, producer: row.producer, source: stage, spaceSlug, describeSource: `local files (${staged} staged from the receipt)` });
    rmSync(stage, { recursive: true, force: true });
  }
  bundles.push(entry);
  console.log(`${entry.status.toUpperCase().padEnd(4)} ${row.name}  ${entry.units} unit(s)  ${entry.message}`);
}

if (workshopDir) {
  const receiptsDir = join(workshopDir, "receipts", "workshop");
  for (const file of readdirSync(receiptsDir).filter((entry) => entry.endsWith(".json")).sort()) {
    const receipt = JSON.parse(readFileSync(join(receiptsDir, file), "utf8"));
    const name = `workshop-${receipt.metadata.name}`;
    if (only && !only.has(name)) continue;
    const digest = receipt.spec.bundle.digest;
    const { stage, staged } = stageLocal(receipt, name, join(workshopDir, "cache", digest.slice(7, 23)));
    const entry = uploadOne({ name, producer: "cub-workshop", source: stage, spaceSlug: `${slugOf(name)}-base`, describeSource: `seeded cache for ${digest.slice(0, 19)} (${staged} file)` });
    rmSync(stage, { recursive: true, force: true });
    bundles.push(entry);
    console.log(`${entry.status.toUpperCase().padEnd(4)} ${name}  ${entry.units} unit(s)  ${entry.message}`);
  }
}

mkdirSync(outDir, { recursive: true });
if (only) {
  const rerun = new Map(bundles.map((entry) => [entry.name, entry]));
  const merged = previous.map((entry) => rerun.get(entry.name) ?? entry);
  for (const entry of bundles) if (!previous.some((prior) => prior.name === entry.name)) merged.push(entry);
  bundles.length = 0; bundles.push(...merged);
}
const pass = bundles.filter((entry) => entry.status === "pass").length;
const notApplicable = bundles.filter((entry) => entry.status === "n/a").length;
const receipt = {
  apiVersion: "evidence.confighub.com/v1alpha1",
  kind: "ConfigHubReadyLane",
  metadata: { recordedAt: new Date().toISOString(), server: cub(["version"]).trim().split("\n")[0].slice(0, 120) },
  spec: {
    claim: "Every certified image uploads into a ConfigHub organization as a base variant with the Units its receipt implies, or its refusal is recorded verbatim.",
    method: "cub variant upload --granularity per-file into a disposable organization, one image at a time, the Units counted, the Space deleted before the next image.",
    summary: { total: bundles.length, pass, notApplicable, fail: bundles.length - pass - notApplicable, units: bundles.reduce((sum, entry) => sum + entry.units, 0) },
    bundles,
  },
};
writeFileSync(receiptPath, `${toYaml(receipt)}\n`);
const lines = [
  "# ConfigHub-ready lane",
  "",
  "Every certified image, uploaded into a ConfigHub organization as a base variant, one at a time. Generated from `receipt.yaml`; rerun with `npm run confighub-ready:run`, check with `npm run confighub-ready:verify`.",
  "",
  `Recorded ${receipt.metadata.recordedAt} on ${receipt.metadata.server}.`,
  "",
  `**${pass} of ${bundles.length} images uploaded as base variants, ${receipt.spec.summary.units} Units in total.** ${notApplicable ? `${notApplicable} render-late image(s) recorded as not applicable. ` : ""}${receipt.spec.summary.fail ? "Refusals are named below." : "No refusals."}`,
  "",
  "| Image | Producer | Source | Units | Result |",
  "| --- | --- | --- | ---: | --- |",
  ...bundles.map((entry) => `| ${entry.name} | ${entry.producer} | ${entry.source.replace(/\|/g, "\\|")} | ${entry.units} | ${entry.status}${entry.message ? `: ${entry.message.replace(/\|/g, "\\|")}` : ""} |`),
  "",
];
writeFileSync(join(outDir, "summary.md"), lines.join("\n"));
console.log(`\n${pass}/${bundles.length} uploaded as base variants; receipt at data/confighub-ready/receipt.yaml`);
process.exit(receipt.spec.summary.fail === 0 ? 0 : 1);
