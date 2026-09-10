#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = join(repoRoot, "data/workshop-guides");
const sourcePath = join(directory, "portfolio.json");
const summaryPath = join(directory, "summary.md");
const coveragePath = join(directory, "coverage.csv");
// Principal story inventory from #1869; changing this requires an explicit scope review.
const requiredStoryIds = ["S-E1", "S-E2", "S-E3", "S-E4", "S-M1", "S-M2", "S-M3", "S-M4", "S-M5", "S-K1", "S-K2", "S-K3", "S-K4", "S-K5"];

export function validatePortfolio(value, { root = repoRoot } = {}) {
  check(value?.schemaVersion === 1 && value.kind === "WorkshopGuidePortfolio", "portfolio kind/version is invalid");
  check(value.entryPolicy === "direct-with-equivalent-prerequisites", "expert direct entry policy is required");
  check(value.status === "planning", "portfolio must remain planning");
  check(JSON.stringify(value.sequence) === JSON.stringify(["compose", "adapt", "match"]), "Compose -> Adapt -> Match sequence is required");
  check(Array.isArray(value.guides) && value.guides.length > 0, "guides are required");
  check(Array.isArray(value.stories) && value.stories.length > 0, "stories are required");
  const guideIds = ids(value.guides, "guide/path");
  const storyIds = ids(value.stories, "story");
  check([...guideIds].every((id) => !storyIds.has(id)), "Guide/Path and story ID namespaces must be disjoint");
  check(JSON.stringify(value.requiredStoryIds) === JSON.stringify(requiredStoryIds), "required principal story inventory differs");
  for (const id of requiredStoryIds) check(storyIds.has(id), `required principal story ${id} is missing`);
  check(Array.isArray(value.validationRoutes) && value.validationRoutes.map((route) => route.id).join(",") === "directCubPlugin,aiLiveChatApi", "direct cub/plugin and AI live-chat routes are required");
  for (const route of value.validationRoutes) check(route.status === "not-run" && route.evidence === "not-run", `${route.id}: route validation must remain not-run`);
  check(Array.isArray(value.featuredCandidates) && value.featuredCandidates.length > 0, "featuredCandidates are required");
  for (const id of value.featuredCandidates) check(guideIds.has(id), `featured candidate ${id} is dangling`);
  check(new Set(value.featuredCandidates).size === value.featuredCandidates.length && value.featuredCandidates.length <= 3, "feature candidates must be a unique small set (at most three)");
  const trackedFiles = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).split("\0"));
  const bands = new Set(["entry", "midpoint", "keystone"]);
  for (const guide of value.guides) {
    check(bands.has(guide.band), `${guide.id}: invalid band`);
    check(["Guide", "Path"].includes(guide.kind), `${guide.id}: invalid kind`);
    check(["draft", "retired"].includes(guide.status), `${guide.id}: invalid editorial status`);
    check(["planned", "blocked"].includes(guide.capabilityStatus), `${guide.id}: capability status must remain planned or blocked`);
    if (guide.kind === "Path") {
      check(guide.prerequisites?.length === 0, `${guide.id}: expert Path entry must not require prior Guide completion`);
      check(Array.isArray(guide.prerequisiteFacts) && guide.prerequisiteFacts.length > 0, `${guide.id}: direct-entry facts are required`);
      for (const fact of guide.prerequisiteFacts) requiredText(fact, `${guide.id}: prerequisite fact`);
    }
    requiredText(guide.title, `${guide.id}: title`);
    validateCommon(guide, guideIds, `guide/path ${guide.id}`);
    check(guide.ownerAssigned === false && guide.ownerRole === "proposed-guide-maintainer", `${guide.id}: owner must remain proposed and unassigned`);
    check(Object.keys(guide.evidence ?? {}).length === 4, `${guide.id}: all four evidence fields are required`);
    check(guide.evidence.live === "not-run" && Object.values(guide.evidence).every((state) => state === "not-run"), `${guide.id}: Guide validation evidence must remain not-run`);
    if (guide.capabilityStatus === "blocked") check(typeof guide.blocker === "string" && guide.blocker.length > 0, `${guide.id}: blocked reason is required`);
  }
  for (const story of value.stories) {
    check(bands.has(story.band), `${story.id}: invalid band`);
    check(guideIds.has(story.guidePathId), `${story.id}: dangling Guide/Path reference`);
    check(["draft", "retired"].includes(story.status), `${story.id}: invalid editorial status`);
    check(["planned", "blocked"].includes(story.capabilityStatus), `${story.id}: capability status must remain planned or blocked`);
    requiredText(story.userGoal, `${story.id}: user goal`);
    validateCommon(story, storyIds, `story ${story.id}`);
    check(story.ownerAssigned === false && story.ownerRole === "proposed-guide-maintainer", `${story.id}: owner must remain proposed and unassigned`);
    check(Object.keys(story.evidence ?? {}).length === 4, `${story.id}: all four evidence fields are required`);
    check(Object.values(story.evidence).every((state) => state === "not-run"), `${story.id}: story evidence must remain not-run`);
    check(Array.isArray(story.precedingGuides) && Array.isArray(story.nextGuides), `${story.id}: preceding/next Guide links are required`);
    check([...story.precedingGuides, ...story.nextGuides].every((id) => guideIds.has(id)), `${story.id}: Guide link is dangling`);
    if (story.capabilityStatus === "blocked") check(typeof story.blocker === "string" && story.blocker.length > 0, `${story.id}: blocked reason is required`);
    if (story.id === "S-K3") check(JSON.stringify(story.confidenceQuestions) === JSON.stringify(["safe to deploy", "deploys without disruption", "rollback preserves data", "rollback succeeds"]), "S-K3: four fleet confidence questions are required");
  }
  check([...bands].every((band) => value.guides.some((item) => item.band === band)), "guides omit a required band");
  check([...bands].every((band) => value.stories.some((item) => item.band === band)), "stories omit a required band");
  const platform = value.stories.find((s) => s.id === "S-K1");
  const hardware = value.stories.find((s) => s.id === "S-K2");
  const fleet = value.stories.find((s) => s.id === "S-K3");
  check(new Set([platform.guidePathId, hardware.guidePathId, fleet.guidePathId]).size === 3, "platform, hardware and GPU fleet outcomes require distinct Paths");
  for (const story of [platform, hardware, fleet]) check(value.guides.find((g) => g.id === story.guidePathId)?.kind === "Path", `${story.id}: keystone requires a Path`);
  checkNoCycles(value.guides, guideIds, "guide/path prerequisites");
  checkNoCycles(value.stories, storyIds, "story prerequisites");
  return true;

  function validateCommon(item, ownIds, label) {
    for (const key of ["id", "ownerRole", "ownerAssigned", "references", "prerequisites", "next", "evidence"]) check(item[key] !== undefined, `${label}: missing ${key}`);
    requiredText(item.id, `${label}: id`);
    requiredText(item.ownerRole, `${label}: owner role`);
    check(item.evidence && typeof item.evidence === "object" && !Array.isArray(item.evidence), `${label}: evidence must be an object`);
    check(Array.isArray(item.references) && item.references.length > 0 && Array.isArray(item.prerequisites) && Array.isArray(item.next), `${label}: required arrays are missing`);
    for (const reference of item.references) {
      check(typeof reference === "string" && reference.length > 0 && !reference.includes("\\") && reference.split("/").every((part) => part && part !== "." && part !== ".."), `${label}: reference must be repository-relative`);
      check(trackedFiles.has(reference) && statSync(join(root, reference), { throwIfNoEntry: false })?.isFile(), `${label}: reference is not a tracked file: ${reference}`);
    }
    for (const id of item.prerequisites) check(ownIds.has(id), `${label}: cross-type or dangling prerequisite ${id}`);
    for (const id of item.next) check(ownIds.has(id), `${label}: cross-type or dangling next link ${id}`);
    for (const state of ["source", "materialization", "destination", "live"]) check(Object.hasOwn(item.evidence, state), `${label}: missing evidence field ${state}`);
  }
}

function ids(items, label) {
  const result = new Set();
  for (const item of items) { check(typeof item?.id === "string" && item.id.length > 0, `${label}: missing id`); check(!result.has(item.id), `${label}: duplicate id ${item.id}`); result.add(item.id); }
  return result;
}
function requiredText(value, label) {
  check(typeof value === "string" && value.trim().length > 0 && !/[\r\n|]/.test(value), `${label}: nonempty single-line text is required`);
}
function checkNoCycles(items, ownIds, label) {
  const graph = new Map(items.map((item) => [item.id, item.prerequisites])); const visiting = new Set(); const visited = new Set();
  function visit(id) { check(ownIds.has(id), `${label}: dangling node ${id}`); if (visiting.has(id)) throw new Error(`${label} contains a cycle at ${id}`); if (visited.has(id)) return; visiting.add(id); for (const parent of graph.get(id)) visit(parent); visiting.delete(id); visited.add(id); }
  for (const id of graph.keys()) visit(id);
}
function check(condition, message) { if (!condition) throw new Error(message); }
function csv(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function renderSummary(value) {
  const guides = value.guides.map((x) => `| ${x.id} | ${x.kind} | ${x.band} | ${x.status} | ${x.capabilityStatus} | ${x.title} |`).join("\n");
  const stories = value.stories.map((x) => `| ${x.id} | ${x.band} | ${x.guidePathId} | ${x.status} | ${x.capabilityStatus} | ${x.userGoal} |`).join("\n");
  return `# Workshop Guide portfolio mapping\n\n**Planning/admission groundwork.** This is a proposed mapping of entry, midpoint and keystone stories to Guides and Paths. All Guide validation evidence is explicitly **not-run**. A mapped candidate is not a published Guide, proven capability, live result or user demonstration.\n\nThe journey order is **Compose → Adapt → Match**. Experts can enter a Path directly with its declared input and authority facts. Guide prerequisite links are suggested learning dependencies, satisfiable by equivalent knowledge; next links are optional continuations. No account or beginner walkthrough is imposed by this map. The small featured set contains candidates only: ${value.featuredCandidates.join(", ")}. The platform-plus-app and GPU-fleet Paths are separate; the GPU Path keeps four confidence questions distinct. Direct cub/plugin and AI live-chat API routes are both explicitly not-run and carry no inherited proof.\n\n## Guide and Path records\n\n| ID | Kind | Band | Editorial status | Capability status | Title |\n| --- | --- | --- | --- | --- | --- |\n${guides}\n\n## Story coverage\n\n| Story | Band | Guide/Path | Status | Capability status | User goal |\n| --- | --- | --- | --- | --- | --- |\n${stories}\n\n## Boundary\n\nReferences are exact tracked repository files. They establish mapping inputs only; they do not justify source or materialization passes. Destination and live evidence are not-run for this portfolio. Runnable commands, WorkshopResult, plugin behavior, live-chat API equivalence, Argo handover and fleet/runtime acceptance remain separate work under #1861, #1869 and #1870.\n\nGenerated by scripts/generate-workshop-guide-portfolio.mjs; verify with --verify.\n`;
}
function renderCoverage(value) {
  const header = ["story_id","band","guide_path_id","story_status","capability_status","owner_role","owner_assigned","user_goal","references","prerequisites","next_stories","preceding_guides","next_guides","evidence_source","evidence_materialization","evidence_destination","evidence_live"].join(",");
  const rows = value.stories.map((x) => [x.id,x.band,x.guidePathId,x.status,x.capabilityStatus,x.ownerRole,x.ownerAssigned,x.userGoal,x.references.join(";"),x.prerequisites.join(";"),x.next.join(";"),x.precedingGuides.join(";"),x.nextGuides.join(";"),x.evidence.source,x.evidence.materialization,x.evidence.destination,x.evidence.live].map(csv).join(","));
  return `${header}\n${rows.join("\n")}\n`;
}

function main() {
  const mode = process.argv[2] ?? "--verify";
  if (!["--generate", "--verify"].includes(mode)) throw new Error("usage: node scripts/generate-workshop-guide-portfolio.mjs --generate|--verify");
  const portfolio = JSON.parse(readFileSync(sourcePath, "utf8"));
  validatePortfolio(portfolio);
  const outputs = { summary: renderSummary(portfolio), coverage: renderCoverage(portfolio) };
  if (mode === "--generate") { writeFileSync(summaryPath, outputs.summary); writeFileSync(coveragePath, outputs.coverage); console.log("generated Workshop Guide summary and coverage"); }
  else { check(readFileSync(summaryPath, "utf8") === outputs.summary, "summary.md is stale"); check(readFileSync(coveragePath, "utf8") === outputs.coverage, "coverage.csv is stale"); console.log(`verified ${portfolio.stories.length} stories across ${portfolio.guides.length} guides/paths`); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
