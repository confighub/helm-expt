#!/usr/bin/env node

// Decide whether a pull request only edits content.
//
// A content change modifies files in place under the paths that
// tests/verify-chain-content-gates.yaml lists, and touches nothing else. Such a
// change runs that register's steps instead of the whole verify chain. Anything
// else, including a file added, removed or renamed under those paths, runs the
// whole chain, because the doc index and the freshness snapshot read file names.
//
//   node scripts/classify-content-change.mjs --base <ref>   prints content=true|false
//   node scripts/classify-content-change.mjs --self-test
//
// In GitHub Actions it also writes content=<value> to $GITHUB_OUTPUT.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const registerPath = join(repoRoot, "tests", "verify-chain-content-gates.yaml");

export function contentPaths() {
  const doc = readYaml(registerPath);
  check(doc.kind === "VerifyChainContentGates", `${relativeRepo(registerPath)}: expected kind VerifyChainContentGates`);
  const paths = doc.spec?.paths ?? [];
  check(paths.length > 0, `${relativeRepo(registerPath)}: no paths are declared`);
  return paths;
}

// "**/" matches any number of directories, "*" matches within one name.
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    if (glob.startsWith("**/", i)) { out += "(?:.*/)?"; i += 2; }
    else if (glob.startsWith("**", i)) { out += ".*"; i += 1; }
    else if (glob[i] === "*") out += "[^/]*";
    else out += glob[i].replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

// rows are [status, path] pairs from `git diff --name-status`. The answer is
// content only if every row is an in-place modification under a content path.
export function classify(rows, paths) {
  const patterns = paths.map(globToRegExp);
  const reasons = [];
  if (rows.length === 0) reasons.push("no files changed");
  for (const [status, path] of rows) {
    if (status !== "M") reasons.push(`${path} is ${status === "A" ? "added" : status === "D" ? "removed" : `changed with status ${status}`}`);
    else if (!patterns.some((pattern) => pattern.test(path))) reasons.push(`${path} is outside the content paths`);
  }
  return { content: reasons.length === 0, reasons };
}

const args = process.argv.slice(2);

if (args.includes("--self-test")) {
  const paths = contentPaths();
  const cases = [
    [[["M", "docs/user/workshop-values-guide.md"], ["M", "site/index.html"]], true],
    [[["M", "site/d/docs/user/a.html"], ["M", "scripts/lib/before-after-pages.mjs"], ["M", "scripts/lib/gitops-onboarding-pages.mjs"]], true],
    [[["M", "docs/README.md"], ["M", "scripts/generate-public-site.mjs"]], true],
    [[["A", "docs/user/new-guide.md"]], false],
    [[["D", "site/old.html"]], false],
    [[["R100", "docs/user/a.md"]], false],
    [[["M", "site/index.html"], ["M", "data/catalog/index.json"]], false],
    [[["M", "scripts/lib/proof-common.mjs"]], false],
    [[["M", "docs/planning/roadmap.md"]], false],
    [[["M", "tests/verify-chain-content-gates.yaml"]], false],
    [[["M", ".github/workflows/full-verify.yml"]], false],
    [[], false],
  ];
  for (const [rows, expected] of cases) {
    const { content } = classify(rows, paths);
    check(content === expected, `classify(${JSON.stringify(rows)}) returned ${content}, expected ${expected}`);
  }
  console.log(`self-test passed: ${cases.length} cases, including added, removed and renamed files and files outside the content paths`);
  process.exit(0);
}

const baseIndex = args.indexOf("--base");
check(baseIndex !== -1 && args[baseIndex + 1], "usage: node scripts/classify-content-change.mjs --base <ref> | --self-test");
const base = args[baseIndex + 1];
const diff = execFileSync("git", ["diff", "--name-status", "--no-renames", `${base}...HEAD`], { cwd: repoRoot, encoding: "utf8" });
const rows = diff.split("\n").filter(Boolean).map((line) => line.split("\t"));
const { content, reasons } = classify(rows, contentPaths());
console.log(`content=${content}`);
console.log(content
  ? `${rows.length} file(s) changed, all modified in place under the content paths, so the content gates run instead of the whole chain`
  : `the whole chain runs: ${reasons.slice(0, 5).join("; ")}${reasons.length > 5 ? `; and ${reasons.length - 5} more` : ""}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `content=${content}\n`);
