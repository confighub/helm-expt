import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validatePortfolio } from "../scripts/generate-workshop-guide-portfolio.mjs";

const base = JSON.parse(readFileSync(new URL("../data/workshop-guides/portfolio.json", import.meta.url), "utf8"));
const invalid = (mutate, pattern) => {
  const copy = structuredClone(base);
  mutate(copy);
  assert.throws(() => validatePortfolio(copy), pattern);
};

test("current portfolio validates", () => assert.equal(validatePortfolio(base), true));
test("principal GPU story cannot disappear", () => invalid((p) => { p.stories = p.stories.filter((s) => s.id !== "S-K3"); }, /required principal story S-K3 is missing/));
test("mapped evidence cannot fake a pass", () => invalid((p) => { p.guides[0].evidence.source = "pass"; }, /Guide validation evidence must remain not-run/));
test("typed prerequisite edges reject a story on a Guide", () => invalid((p) => { p.guides[0].prerequisites = ["S-E1"]; }, /cross-type or dangling prerequisite/));
test("all four evidence fields are mandatory", () => invalid((p) => { delete p.stories[0].evidence.live; }, /missing evidence field live/));
test("guide prerequisite cycles are rejected", () => invalid((p) => { p.guides.find((g) => g.id === "G-E1").prerequisites = ["G-E2"]; }, /cycle/));
test("references must be tracked repository-relative files", () => invalid((p) => { p.stories[0].references = ["../outside.md"]; }, /repository-relative/));

test("deleting the required inventory cannot hide a missing keystone", () => invalid((p) => { p.requiredStoryIds = p.requiredStoryIds.filter((id) => id !== "S-K3"); p.stories = p.stories.filter((s) => s.id !== "S-K3"); }, /required principal story inventory differs/));
test("glob paths are not exact tracked references", () => invalid((p) => { p.guides[0].references = ["docs/planning/*.md"]; }, /not a tracked file/));
test("feature candidates cannot be duplicated", () => invalid((p) => { p.featuredCandidates[1] = p.featuredCandidates[0]; }, /unique small set/));
test("a missing title is refused", () => invalid((p) => { delete p.guides[0].title; }, /title: nonempty/));
test("hardware Match and fleet confidence cannot collapse to one Path", () => invalid((p) => { p.stories.find((s) => s.id === "S-K3").guidePathId = "P-GPU"; }, /distinct Paths/));

test("expert Path entry does not require a beginner Guide completion", () => invalid((p) => { p.guides.find((g) => g.id === "P-COMPOSE").prerequisites = ["G-E1"]; }, /expert Path entry/));
