#!/usr/bin/env node
// PUBLISHED-SITE gate.
//
// Everything else in this repository checks its own bytes. `site:verify` says
// the committed HTML matches what the generator produces from the current tree,
// which is true and useful and says nothing at all about whether a reader can
// see it. Those two claims came apart for a day and a half: the public site
// failed to deploy thirteen times in a row while thirteen verify chains passed
// green, and nothing in the repository noticed. See issues #1465 and #1466.
//
// This lane closes that by leaving the filesystem. It asks two questions a
// generator cannot answer:
//
//   1. Did the last GitHub Pages deployment of main succeed? The Pages workflow
//      is unusually quiet when it fails the way #1442 broke it: it tars the
//      repository, lists every file, and exits 1 with no message of its own.
//   2. Do the published pages match the committed ones, byte for byte? A deploy
//      can go green and still serve something older, and a stale page is the
//      same lie as a failed one from the reader's side.
//
// The pages checked are the ones the top navigation links, read out of the
// committed homepage rather than listed here, so a new nav entry is covered the
// day it ships without anyone remembering to add it.
//
// This needs the network, so it does not join `npm run verify`. It runs in its
// own workflow after every push to main and once a day, which is the cadence
// that would have caught the outage on the first deploy instead of the
// thirteenth.
//
// Usage:
//   node scripts/verify-published-site.mjs                  # check now
//   node scripts/verify-published-site.mjs --wait-minutes 12
//        Poll until the published pages catch up, for a deploy still in flight.
//   node scripts/verify-published-site.mjs --skip-deploy-check
//        Content only, for when the Actions API is unreachable or rate limited.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const REPO = "confighub/helm-expt";
const PAGES_WORKFLOW = "pages build and deployment";

const args = process.argv.slice(2);
const waitMinutes = Number(args[args.indexOf("--wait-minutes") + 1]) || 0;
const skipDeployCheck = args.includes("--skip-deploy-check");

const failures = [];
const notes = [];

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

// One retry, because a single dropped connection is not a broken website and
// this lane is loud by design.
async function fetchText(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`could not fetch ${url}: ${lastError.message}`);
}

async function githubJson(path) {
  const headers = { accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${path}`);
  return response.json();
}

// The pages the top navigation links, plus the homepage itself. Read from the
// committed homepage so this list cannot drift from the site.
function navTargets() {
  const home = readFileSync(join(repoRoot, "site", "index.html"), "utf8");
  const nav = home.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? "";
  const targets = new Set(["index.html"]);
  for (const match of nav.matchAll(/href="\.\/([^"#?]+\.html)"/g)) targets.add(match[1]);
  return [...targets].sort();
}

async function checkDeploy() {
  const runs = await githubJson(`/repos/${REPO}/actions/runs?branch=main&per_page=30`);
  const pages = (runs.workflow_runs ?? []).filter((run) => run.name === PAGES_WORKFLOW);
  if (!pages.length) {
    failures.push(`no "${PAGES_WORKFLOW}" run found on main in the last 30 runs, so nothing says the site is being published at all`);
    return;
  }
  const latest = pages[0];
  const finished = pages.filter((run) => run.status === "completed");
  const consecutiveFailures = finished.findIndex((run) => run.conclusion === "success");
  if (latest.status !== "completed") {
    notes.push(`the newest Pages deploy (${latest.head_sha.slice(0, 9)}) is still ${latest.status}`);
    return;
  }
  if (latest.conclusion !== "success") {
    const count = consecutiveFailures === -1 ? finished.length : consecutiveFailures;
    failures.push(
      `the last Pages deploy of main failed (${latest.head_sha.slice(0, 9)}, ${latest.created_at}), ` +
        `${count} in a row. Nothing merged since then is published. ` +
        `The log is quiet when this happens: read ${latest.html_url} and look for a tar error rather than a message.`,
    );
    return;
  }
  notes.push(`last Pages deploy of main succeeded: ${latest.head_sha.slice(0, 9)} at ${latest.created_at}`);
}

// Published bytes against committed bytes. Reports every disagreeing page
// rather than the first, because "one page is stale" and "the whole site is a
// day behind" want different responses.
async function comparePages(targets) {
  const stale = [];
  for (const target of targets) {
    const committed = readFileSync(join(repoRoot, "site", target), "utf8");
    const published = await fetchText(`${SITE_BASE_URL}${target}`);
    if (sha256(committed) !== sha256(published)) stale.push(target);
  }
  return stale;
}

function headSha() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim().slice(0, 9) : "unknown";
}

const targets = navTargets();
if (!skipDeployCheck) {
  try {
    await checkDeploy();
  } catch (error) {
    failures.push(`could not read the Pages deploy history: ${error.message}. Re-run with --skip-deploy-check to check content only.`);
  }
}

let stale = await comparePages(targets);
const deadline = Date.now() + waitMinutes * 60_000;
while (stale.length && Date.now() < deadline) {
  console.log(`  ${stale.length} of ${targets.length} pages not published yet, waiting for the deploy to land`);
  await new Promise((resolve) => setTimeout(resolve, 30_000));
  stale = await comparePages(targets);
}
if (stale.length) {
  failures.push(
    `${stale.length} of ${targets.length} published pages differ from the committed ones at ${headSha()}: ${stale.join(", ")}. ` +
      `Either the deploy has not landed, or it landed and served something else. ` +
      `Compare with: curl -s ${SITE_BASE_URL}${stale[0]} | diff - site/${stale[0]}`,
  );
}

console.log(`published site: ${targets.length} navigation pages checked against ${SITE_BASE_URL}`);
for (const note of notes) console.log(`  ${note}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`  every checked page is byte-identical to the committed one at ${headSha()}`);
