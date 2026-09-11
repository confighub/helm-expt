#!/usr/bin/env node
import { isDeepStrictEqual } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { validateEvidence } from "./run-workshop-catalog-guide-proof.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "data/workshop-guides/admissions/catalog-inspection-v1.json");
const check = (condition, message) => { if (!condition) throw new Error(message); };
const read = (path, base = root) => readFileSync(join(base, path));
const exactPaths = {
  readmePath: "examples/workshop-catalog-inspection/README.md",
  proofReceiptPath: "data/workshop-catalog-guide-proof/receipt.json",
  lookupCliPath: "scripts/lookup-catalog-record.mjs",
  lookupModulePath: "scripts/lib/catalog-record-lookup.mjs",
  successOutputPath: "data/workshop-catalog-guide-proof/success.json",
  refusalOutputPath: "data/workshop-catalog-guide-proof/refusal.json",
};

function exactKeys(value, keys, label) { check(value && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} fields changed`); }
export function validateAdmission(manifest, { rootDir = root } = {}) {
  exactKeys(manifest, ["schemaVersion", "kind", "id", "guideId", "storyId", "title", "goal", "audience", "prerequisites", "editorial", "source", "exercise", "stages", "routes", "outcomes", "nextEdit", "publication"], "admission");
  check(manifest.schemaVersion === 1 && manifest.kind === "WorkshopGuideAdmission", "invalid Guide admission kind/version");
  for (const [key, value] of Object.entries({ id: manifest.id, guideId: manifest.guideId, storyId: manifest.storyId, title: manifest.title, goal: manifest.goal, audience: manifest.audience, nextEdit: manifest.nextEdit })) check(typeof value === "string" && value.trim().length > 0, `admission ${key} must be nonempty`);
  check(manifest.id === "G-E1-catalog-inspection-v1" && manifest.guideId === "G-E1" && manifest.storyId === "S-E1", "admission Guide/story mapping changed");
  check(Array.isArray(manifest.prerequisites) && manifest.prerequisites.length > 0 && manifest.prerequisites.every((item) => typeof item === "string" && item.trim().length > 0), "admission prerequisites must be nonempty strings");
  exactKeys(manifest.editorial, ["status", "ownerRole", "ownerAssigned"], "editorial"); check(manifest.editorial.status === "draft" && manifest.editorial.ownerRole === "proposed-guide-maintainer" && manifest.editorial.ownerAssigned === false, "Guide admission must remain draft with an unassigned owner");
  exactKeys(manifest.source, ["recordName", "configurationDigest", "digestRole", "catalogPath", "schemaPath"], "source");
  check(manifest.source.recordName === "bitnami-redis-25-5-3-default" && manifest.source.configurationDigest === "175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e" && manifest.source.digestRole === "canonical-object-set", "exact source pin changed");
  const expectedSource = { catalogPath: "data/base-variant-records/records.json", schemaPath: "schemas/base-variant-record.schema.json" };
  for (const [key, value] of Object.entries(expectedSource)) check(manifest.source[key] === value, `source ${key} changed`);
  exactKeys(manifest.exercise, Object.keys(exactPaths), "exercise"); for (const [key, value] of Object.entries(exactPaths)) check(manifest.exercise[key] === value, `exercise ${key} changed`);
  for (const path of [...Object.values(expectedSource), ...Object.values(exactPaths)]) check(!path.startsWith("/") && !path.split("/").includes("..") && existsSync(join(rootDir, path)), `missing or unsafe admission path ${path}`);
  const portfolio = JSON.parse(read("data/workshop-guides/portfolio.json", rootDir)); check(portfolio.guides.some((guide) => guide.id === "G-E1") && portfolio.stories.some((story) => story.id === "S-E1" && story.guidePathId === "G-E1"), "portfolio no longer contains G-E1/S-E1 mapping");
  check(isDeepStrictEqual(manifest.stages, [
    { id: "source", state: "record-resolved", evidence: ["source.catalogPath", "exercise.proofReceiptPath"] },
    { id: "materialization", state: "retained-evidence-only", evidence: ["exercise.successOutputPath", "source.configurationDigest"] },
    { id: "confighub-preview", state: "not-created", evidence: [] },
    { id: "delivery", state: "not-run", evidence: [] },
    { id: "authority", state: "not-run", evidence: [] },
  ]), "Guide stage mapping overclaims evidence");
  exactKeys(manifest.routes, ["localRepositoryCli", "cubPlugin", "aiLiveChatApi"], "routes"); check(manifest.routes.localRepositoryCli === "implemented" && manifest.routes.cubPlugin === "not-run" && manifest.routes.aiLiveChatApi === "not-run", "Guide route states changed");
  exactKeys(manifest.outcomes, ["success", "refusal"], "outcomes"); for (const [key, expected] of Object.entries({ success: { proofStep: "exact", status: "found", exitCode: 0, recordReturned: true }, refusal: { proofStep: "mismatch", status: "digest-mismatch", exitCode: 4, recordReturned: false } })) { exactKeys(manifest.outcomes[key], Object.keys(expected), `${key} outcome`); check(isDeepStrictEqual(manifest.outcomes[key], expected), `${key} outcome changed`); }
  exactKeys(manifest.publication, ["status", "approvalReference"], "publication"); check(manifest.publication.status === "blocked-owner-unassigned" && manifest.publication.approvalReference === null, "publication must remain blocked without owner approval");
  const receipt = JSON.parse(read("data/workshop-catalog-guide-proof/receipt.json", rootDir)); validateEvidence(receipt, { rootDir }); for (const [key, step] of Object.entries({ success: "exact", refusal: "mismatch" })) { check(manifest.outcomes[key].proofStep === step && receipt.steps[step].exitCode === manifest.outcomes[key].exitCode, `${key} outcome is not linked to proof step`); check(receipt.outputs[key === "success" ? "exact" : "mismatch"] === manifest.exercise[key === "success" ? "successOutputPath" : "refusalOutputPath"], `${key} output path is not linked to proof receipt`); }
  return true;
}
function main() { validateAdmission(JSON.parse(readFileSync(manifestPath, "utf8"))); console.log("verified draft Guide admission; publication remains refused without owner approval"); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
