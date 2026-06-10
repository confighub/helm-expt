import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const readinessPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");
const dispositionPath = join(
  repoRoot,
  "data",
  "latest-top20-refresh",
  "production-disposition",
  "candidate-production-disposition.yaml",
);

if (mode === "--promote") {
  const rows = candidateRows();
  for (const row of rows) promoteRow(row);
  verify();
  console.log(`promoted latest candidate root paths for ${rows.length} candidate(s)`);
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/promote-latest-candidate-root-paths.mjs --promote
  node scripts/promote-latest-candidate-root-paths.mjs --verify`);
}

function promoteRow(row) {
  copyIfMissing(row.candidate_recipe, row.promoted_recipe_path);
  copyIfMissing(row.candidate_package, row.promoted_package_path);
  rewritePublicationReceipt(row);
}

function copyIfMissing(sourceRel, destinationRel) {
  const source = join(repoRoot, sourceRel);
  const destination = join(repoRoot, destinationRel);
  check(existsSync(source), `${sourceRel} is missing`);
  if (existsSync(destination)) return;
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
}

function rewritePublicationReceipt(row) {
  const receiptPath = join(repoRoot, row.promoted_recipe_path, "publication", "installer-package-receipt.yaml");
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing`);
  const from = row.candidate_package;
  const to = row.promoted_package_path;
  const text = readFileSync(receiptPath, "utf8");
  const rewritten = text.replaceAll(from, to);
  if (rewritten !== text) writeFileSync(receiptPath, rewritten);
}

function verify() {
  const rows = candidateRows();
  const disposition = readYaml(dispositionPath);
  const dispositionRows = new Map((disposition.spec?.rows ?? []).map((row) => [`${row.chart}@${row.candidateVersion}`, row]));
  for (const row of rows) {
    const dispositionRow = dispositionRows.get(`${row.chart}@${row.candidate_version}`);
    check(dispositionRow?.proofStatus === "proof-complete", `${row.chart}@${row.candidate_version} missing proof-complete disposition`);
    check(
      dispositionRow?.productionSupportStatus === "not-production-supported",
      `${row.chart}@${row.candidate_version} must not claim production support`,
    );
    check(existsSync(join(repoRoot, row.current_supported_recipe)), `${row.chart}@${row.current_version} current recipe missing`);
    check(existsSync(join(repoRoot, row.current_supported_package)), `${row.chart}@${row.current_version} current package missing`);
    check(existsSync(join(repoRoot, row.promoted_recipe_path)), `${row.promoted_recipe_path} missing`);
    check(existsSync(join(repoRoot, row.promoted_package_path)), `${row.promoted_package_path} missing`);
    const receipt = readYaml(join(repoRoot, row.promoted_recipe_path, "publication", "installer-package-receipt.yaml"));
    check(
      receipt.spec?.package?.path === row.promoted_package_path,
      `${row.promoted_recipe_path} publication receipt still points at ${receipt.spec?.package?.path}`,
    );
    const recipe = readYaml(join(repoRoot, row.promoted_recipe_path, "recipe.yaml"));
    check((recipe.spec?.variants ?? []).length >= 1, `${row.promoted_recipe_path} has no variants`);
    check(existsSync(join(repoRoot, row.promoted_package_path, "installer.yaml")), `${row.promoted_package_path}/installer.yaml missing`);
  }
  console.log(`verified latest candidate root paths for ${rows.length} candidate(s)`);
}

function candidateRows() {
  check(existsSync(readinessPath), `${relativeRepo(readinessPath)} is missing`);
  check(existsSync(dispositionPath), `${relativeRepo(dispositionPath)} is missing`);
  const rows = parseCsv(readFileSync(readinessPath, "utf8"));
  check(rows.length === 6, `expected 6 latest candidate rows; found ${rows.length}`);
  return rows;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}
