import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const defaultPilotRoot = "/Users/alexis/code/confighub-ai-demo";

function argValue(name, fallback = "") {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";
}

function findPackageRoots(root) {
  const found = [];
  function walk(dir, depth = 0) {
    if (depth > 6) return;
    if (existsSync(join(dir, "installer.yaml"))) {
      found.push(dir);
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), depth + 1);
    }
  }
  walk(join(root, "packages"));
  return found.sort();
}

function run(command, args, options = {}) {
  const proc = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  return {
    command: [command, ...args].join(" "),
    status: proc.status ?? 1,
    stdout: proc.stdout || "",
    stderr: proc.stderr || "",
  };
}

function parseJson(output) {
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function proofCounts(proofChain = []) {
  const counts = {};
  for (const row of proofChain) {
    const status = String(row.status || "unknown");
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

const pilotRoot = resolve(argValue("--pilot-root", process.env.PILOT_ROOT || defaultPilotRoot));
const pilot = join(pilotRoot, "scripts", "pilot");
const runId = argValue("--run-id", timestamp());
const outDir = resolve(argValue("--out-dir", join(repoRoot, "runs", "pilot", runId)));
const includeRepoVerify = hasArg("--include-repo-verify");

if (!existsSync(pilot)) {
  throw new Error(`Pilot front door not found: ${pilot}`);
}

mkdirSync(outDir, { recursive: true });

const commands = [];
const repoVerify = includeRepoVerify ? run("npm", ["run", "verify"], { cwd: repoRoot }) : null;
if (repoVerify) {
  commands.push({
    id: "repo-verify",
    command: repoVerify.command,
    status: repoVerify.status,
    stdout_bytes: Buffer.byteLength(repoVerify.stdout),
    stderr_bytes: Buffer.byteLength(repoVerify.stderr),
  });
  writeFileSync(join(outDir, "npm-run-verify.stdout.log"), repoVerify.stdout);
  writeFileSync(join(outDir, "npm-run-verify.stderr.log"), repoVerify.stderr);
}

const packages = findPackageRoots(repoRoot);
const rows = [];

for (const packageRoot of packages) {
  const chartId = slug(relative(join(repoRoot, "packages"), packageRoot));
  const chartOut = join(outDir, chartId);
  mkdirSync(chartOut, { recursive: true });

  const previewOut = join(chartOut, "render-preview");
  const preview = run(pilot, [
    "installer-render-preview",
    "--source",
    packageRoot,
    "--out-dir",
    previewOut,
    "--json",
  ], { cwd: pilotRoot });
  commands.push({
    id: `${chartId}:render-preview`,
    command: preview.command,
    status: preview.status,
    stdout_bytes: Buffer.byteLength(preview.stdout),
    stderr_bytes: Buffer.byteLength(preview.stderr),
  });
  writeFileSync(join(chartOut, "render-preview.stdout.json"), preview.stdout);
  writeFileSync(join(chartOut, "render-preview.stderr.log"), preview.stderr);

  const previewJson = parseJson(preview.stdout);

  const gateOut = join(chartOut, "e2e-gate");
  const gate = run(pilot, [
    "installer-e2e-gate",
    "--source",
    packageRoot,
    "--out-dir",
    gateOut,
    "--json",
  ], { cwd: pilotRoot });
  commands.push({
    id: `${chartId}:e2e-gate`,
    command: gate.command,
    status: gate.status,
    stdout_bytes: Buffer.byteLength(gate.stdout),
    stderr_bytes: Buffer.byteLength(gate.stderr),
  });
  writeFileSync(join(chartOut, "e2e-gate.stdout.json"), gate.stdout);
  writeFileSync(join(chartOut, "e2e-gate.stderr.log"), gate.stderr);

  const gateJson = parseJson(gate.stdout);
  const renderPreview = previewJson?.render_preview || {};
  rows.push({
    chart_id: chartId,
    package: relative(repoRoot, packageRoot),
    preview_status: previewJson?.status || "NO_JSON",
    preview_decision: previewJson?.decision || "UNKNOWN",
    preview_mode: renderPreview.mode || "",
    base_count: Array.isArray(renderPreview.bases) ? renderPreview.bases.length : 0,
    resource_count: renderPreview.resource_count ?? 0,
    e2e_status: gateJson?.status || "NO_JSON",
    e2e_decision: gateJson?.decision || "UNKNOWN",
    route_stop: gateJson?.route_stop || "",
    proof_counts: proofCounts(gateJson?.proof_chain || []),
  });
}

const failures = rows.filter((row) => row.preview_status !== "INSTALLER_RENDER_PREVIEW_READY");
const blocks = rows.filter((row) => row.e2e_decision === "BLOCK");
const watches = rows.filter((row) => row.e2e_decision === "WATCH");

const summary = {
  schema: "helm-expt.pilot-adversarial-run.v1",
  run_id: runId,
  created_at: new Date().toISOString(),
  pilot_root: pilotRoot,
  pilot: pilot,
  include_repo_verify: includeRepoVerify,
  repo_verify_status: repoVerify ? repoVerify.status : null,
  package_count: packages.length,
  render_preview_ready: packages.length - failures.length,
  e2e_watch: watches.length,
  e2e_block: blocks.length,
  rows,
  commands,
};

const lines = [
  "# Pilot Adversarial Run",
  "",
  `Run: ${runId}`,
  `Pilot: ${pilot}`,
  `Packages: ${packages.length}`,
  `Render previews ready: ${summary.render_preview_ready}/${packages.length}`,
  `E2E gates watching for live proof: ${watches.length}/${packages.length}`,
  `E2E gates blocked: ${blocks.length}/${packages.length}`,
  `Repo verify: ${repoVerify ? (repoVerify.status === 0 ? "pass" : `fail (${repoVerify.status})`) : "not run"}`,
  "",
  "## Chart Results",
  "",
  "| Chart | Bases | Resources | Preview | E2E gate | Stop |",
  "| --- | ---: | ---: | --- | --- | --- |",
  ...rows.map(
    (row) =>
      `| ${row.chart_id} | ${row.base_count} | ${row.resource_count} | ${row.preview_status} | ${row.e2e_status} / ${row.e2e_decision} | ${row.route_stop || "-"} |`,
  ),
  "",
  "## Interpretation",
  "",
  "This run is read-only. It proves local Pilot can inspect the current cub installer package shape, build render previews, and compose e2e gates. WATCH is expected until live ConfigHub, OCI/GitOps, GUI, target-access, and Kubernetes runtime receipts are attached.",
  "",
];

writeFileSync(join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(join(outDir, "summary.md"), `${lines.join("\n")}\n`);

console.log(`wrote Pilot adversarial run to ${relative(repoRoot, outDir)}`);
console.log(`render previews ready: ${summary.render_preview_ready}/${packages.length}`);
console.log(`e2e gates watching for live proof: ${watches.length}/${packages.length}`);
if (failures.length || blocks.length || (repoVerify && repoVerify.status !== 0)) {
  process.exitCode = 1;
}
