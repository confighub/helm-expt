// Re-sync installer package receipts whose recorded installer.yaml SHA has drifted from the actual file.
//
// The curated per-chart proof lanes record sourceFiles SHAs in their receipt. A later enrichment of
// installer.yaml — the F1 set-namespace transformer (#95) — changed the file WITHOUT re-hashing the
// receipts, leaving every curated lane red with "source file SHA mismatch for installer.yaml" (#118).
// The target-facts charts are re-synced by sync-installer-target-facts.mjs; this handles the rest.
//
// It auto-discovers receipts whose installer.yaml SHA no longer matches and re-hashes sourceFiles +
// deterministicBundle to match the CURRENT (canonical, F1-enriched) installer.yaml. It does NOT modify
// installer.yaml, so the F1 transformer and any target-facts collector are preserved. Charts with no
// drift — and charts red for other reasons (e.g. a semantic-equivalence diff) — are left untouched.
//
//   node scripts/resync-package-receipts.mjs            # re-sync drifted receipts
//   node scripts/resync-package-receipts.mjs --check    # report drift only, change nothing
//
// Helpers mirror sync-installer-target-facts.mjs (that module has top-level execution, so it can't be
// imported without side effects).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { check, listFiles, readYaml, relativeRepo, repoRoot, sha256File, writeYaml } from "./lib/proof-common.mjs";

const checkOnly = process.argv.includes("--check");

function cubEnv() {
  const env = { ...process.env, CONFIGHUB_AGENT: "1" };
  try {
    const goBin = join(execFileSync("go", ["env", "GOPATH"], { encoding: "utf8" }).trim(), "bin");
    if (!env.PATH?.split(":").includes(goBin)) env.PATH = `${env.PATH ?? ""}:${goBin}`;
  } catch {
    /* let cub fail clearly if the toolchain is incomplete */
  }
  return env;
}

function runCub(cubArgs) {
  return execFileSync("cub", cubArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    env: cubEnv(),
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 200,
  });
}

function packageSourceFiles(packageRoot) {
  return listFiles(packageRoot).map((path) => ({
    path: relative(packageRoot, path).replaceAll("\\", "/"),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
}

function deterministicBundle(packageRoot, packageRelative) {
  const tempRoot = mkdtempSync(join("/tmp", "helm-expt-resync-"));
  try {
    const first = join(tempRoot, "a.tgz");
    const second = join(tempRoot, "b.tgz");
    runCub(["installer", "package", packageRoot, "-o", first]);
    runCub(["installer", "package", packageRoot, "-o", second]);
    check(sha256File(first) === sha256File(second), `${packageRelative} package SHA changed between runs`);
    return { sha256: sha256File(first) };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const receipts = listFiles(join(repoRoot, "recipes")).filter((f) => f.endsWith("/publication/installer-package-receipt.yaml"));
const drifted = [];
for (const receiptPath of receipts) {
  const receipt = readYaml(receiptPath);
  const pkgRel = receipt.spec?.package?.path;
  if (!pkgRel) continue;
  const packageRoot = join(repoRoot, pkgRel);
  const recorded = (receipt.spec.package.sourceFiles ?? []).find((f) => f.path === "installer.yaml");
  if (!recorded) continue;
  if (sha256File(join(packageRoot, "installer.yaml")) === recorded.sha256) continue; // in sync
  drifted.push({ receiptPath, packageRoot, pkgRel, receipt });
}

if (!drifted.length) {
  console.log("all package receipts in sync with installer.yaml — no drift");
  process.exit(0);
}
console.log(`${drifted.length} receipt(s) with installer.yaml SHA drift:`);
for (const d of drifted) console.log(`  ${relativeRepo(d.packageRoot)}`);
if (checkOnly) process.exit(0);

let ok = 0;
const failed = [];
for (const d of drifted) {
  try {
    d.receipt.spec.package.sourceFiles = packageSourceFiles(d.packageRoot);
    if (d.receipt.spec.deterministicBundle) {
      d.receipt.spec.deterministicBundle.sha256 = deterministicBundle(d.packageRoot, d.pkgRel).sha256;
      d.receipt.spec.deterministicBundle.byteIdenticalAcrossTwoLocalBundles = true;
    }
    writeYaml(d.receiptPath, d.receipt);
    ok += 1;
    console.log(`  re-synced ${relativeRepo(d.receiptPath)}`);
  } catch (e) {
    failed.push({ chart: relativeRepo(d.packageRoot), error: String(e.message || e).split("\n")[0] });
    console.log(`  FAILED ${relativeRepo(d.packageRoot)} — ${String(e.message || e).split("\n")[0]}`);
  }
}
console.log(`\nre-synced ${ok}/${drifted.length} receipt(s)${failed.length ? ` · ${failed.length} failed` : ""}`);
