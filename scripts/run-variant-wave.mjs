// Resumable variant-wave driver. Reads a wave plan (per-chart values / declines) and runs
// generate-variant-proof.mjs for each chart, isolating failures so one bad chart never stops the wave.
//
//   node scripts/run-variant-wave.mjs <wave>     # e.g. ha, ingress-tls, tls
//
// Resumable: a chart whose variant.yaml already exists is skipped (status: already). A failed run has its
// partial writes reverted (git checkout of the chart's package/recipe dirs) so the branch stays clean and
// the chart can be retried after the plan is refined. Honest: declines are recorded with a reason, never
// silently dropped. Results land in data/variant-backlog/wave-results/<wave>.json.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./lib/proof-common.mjs";

const wave = process.argv[2];
if (!wave) {
  console.error("usage: node scripts/run-variant-wave.mjs <wave>   (reads data/variant-backlog/wave-plans/<wave>.json)");
  process.exit(1);
}

const planPath = join(repoRoot, "data/variant-backlog/wave-plans", `${wave}.json`);
if (!existsSync(planPath)) {
  console.error(`no plan at ${planPath}`);
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planPath, "utf8"));

function revert(chart) {
  for (const dir of [`packages/${chart}`, `recipes/${chart}`]) {
    try {
      execFileSync("git", ["checkout", "--", dir], { cwd: repoRoot, stdio: "ignore" });
      execFileSync("git", ["clean", "-fdq", "--", dir], { cwd: repoRoot, stdio: "ignore" });
    } catch {
      /* dir may not exist yet */
    }
  }
}

const results = [];
for (const entry of plan) {
  const { chart, variant = wave, set = [], values, base, noIncludeCrds, decline } = entry;
  const tag = `${chart} :: ${variant}`;

  if (decline) {
    results.push({ chart, variant, status: "declined", reason: decline });
    console.log(`DECLINE  ${tag} — ${decline}`);
    continue;
  }

  const variantYaml = join(repoRoot, "recipes", chart, "variants", variant, "variant.yaml");
  if (existsSync(variantYaml)) {
    results.push({ chart, variant, status: "already" });
    console.log(`ALREADY  ${tag}`);
    continue;
  }

  const args = [join(repoRoot, "scripts/generate-variant-proof.mjs"), chart, variant];
  for (const s of set) args.push("--set", s);
  if (values) args.push("--values", values);
  if (base) args.push("--base", base);
  if (noIncludeCrds) args.push("--no-include-crds");

  try {
    const out = execFileSync("node", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const line = out.trim().split("\n").filter(Boolean).pop() ?? "";

    // No-op guard: a variant whose render is byte-identical to its base added nothing. The values had no
    // effect (wrong key, or already the chart default), so this is not a distinct variant — revert it and
    // record honestly rather than inflate variant-rich with a duplicate of default.
    const baseName = base || "default";
    const variantUpstream = join(repoRoot, "packages", chart, "bases", variant, "upstream.yaml");
    const baseUpstream = join(repoRoot, "packages", chart, "bases", baseName, "upstream.yaml");
    const isNoop =
      existsSync(variantUpstream) &&
      existsSync(baseUpstream) &&
      readFileSync(variantUpstream, "utf8") === readFileSync(baseUpstream, "utf8");

    if (isNoop) {
      revert(chart);
      results.push({ chart, variant, status: "noop", note: `render identical to base "${baseName}" — values had no effect` });
      console.log(`NO-OP    ${tag} — render identical to base "${baseName}"`);
    } else {
      results.push({ chart, variant, status: "promoted", line });
      console.log(`PROMOTED ${tag} — ${line}`);
    }
  } catch (e) {
    const lines = String(e.stderr || e.message || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const err = lines.find((s) => s.startsWith("Error:")) ?? lines.pop() ?? "unknown error";
    revert(chart);
    results.push({ chart, variant, status: "failed", error: err });
    console.log(`FAILED   ${tag} — ${err}`);
  }
}

const outDir = join(repoRoot, "data/variant-backlog/wave-results");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${wave}.json`), JSON.stringify(results, null, 2) + "\n");

const count = (s) => results.filter((r) => r.status === s).length;
console.log(
  `\nwave ${wave}: ${count("promoted")} promoted · ${count("already")} already · ${count("noop")} no-op · ${count("declined")} declined · ${count("failed")} failed (of ${results.length})`,
);
