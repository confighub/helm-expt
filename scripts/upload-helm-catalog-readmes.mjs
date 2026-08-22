#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYamlText, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--check";
const spaceArgIndex = process.argv.indexOf("--space");
const requestedSpace = spaceArgIndex === -1 ? "" : process.argv[spaceArgIndex + 1];
check(spaceArgIndex === -1 || requestedSpace, "--space requires a generated Space slug");
const unitsRoot = join(repoRoot, "data", "helm-catalog-readmes", "units");
const changeDesc = "Refresh helm-catalog demo README";
const cubContext = process.env.CUB_CONTEXT ?? "";

if (mode === "--upload") {
  const spaces = sourceSpaces();
  for (const space of spaces) {
    const state = readmeState(space);
    if (state.current) {
      console.log(`current ${space}/readme`);
      continue;
    }
    const unitPath = join(unitsRoot, space, "readme.yaml");
    const args = state.exists
      ? [
          "unit",
          "update",
          "--space",
          space,
          "readme",
          unitPath,
          "--change-desc",
          changeDesc,
          "--label",
          "helm-expt.confighub.com/readme=true",
          "--label",
          `helm-expt.confighub.com/source-space=${space}`,
        ]
      : [
          "unit",
          "create",
          "--space",
          space,
          "readme",
          unitPath,
          "--change-desc",
          changeDesc,
          "--label",
          "helm-expt.confighub.com/readme=true",
          "--label",
          `helm-expt.confighub.com/source-space=${space}`,
        ];
    runCub(args);
    console.log(`${state.exists ? "updated" : "created"} ${space}/readme`);
  }
  verifyLive(spaces);
} else if (mode === "--check") {
  verifyLive(sourceSpaces());
} else {
  console.log(`Usage:
  node scripts/upload-helm-catalog-readmes.mjs --upload [--space <slug>]
  node scripts/upload-helm-catalog-readmes.mjs --check [--space <slug>]`);
}

function sourceSpaces() {
  check(existsSync(unitsRoot), `${relativeRepo(unitsRoot)} is missing; run npm run helm-catalog-readmes`);
  const spaces = readdirSync(unitsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (!requestedSpace) return spaces;
  check(spaces.includes(requestedSpace), `${requestedSpace} has no generated README source`);
  return [requestedSpace];
}

function verifyLive(spaces) {
  let checked = 0;
  const failures = [];
  for (const space of spaces) {
    try {
      const state = readmeState(space);
      if (!state.current) failures.push(`${space}/readme differs from its generated source`);
      else checked += 1;
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (failures.length) {
    console.error(`README check found ${failures.length} problem(s) across ${spaces.length} helm-catalog Space(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`verified one current README in ${checked} helm-catalog Space(s)`);
}

function readmeState(space) {
  const units = listUnits(space);
  const slugs = units.map((item) => item.Unit?.Slug).filter(Boolean);
  const readmeLike = slugs.filter((slug) => slug.toLowerCase().includes("readme"));
  check(readmeLike.length <= 1, `${space} has readme-like Units: ${readmeLike.join(", ")}`);
  if (readmeLike.length === 0) return { current: false, exists: false };
  check(readmeLike[0] === "readme", `${space} has readme-like Unit ${readmeLike[0]} instead of readme`);
  const liveReadme = units.find((item) => item.Unit?.Slug === "readme")?.Unit;
  check(liveReadme?.Data, `${space}/readme has no data`);
  const expected = readFileSync(join(unitsRoot, space, "readme.yaml"), "utf8");
  const actual = Buffer.from(liveReadme.Data, "base64").toString("utf8");
  return {
    current: JSON.stringify(readYamlText(actual)) === JSON.stringify(readYamlText(expected)),
    exists: true,
  };
}

function listUnits(space) {
  const result = spawnSync("cub", [...contextArgs(), "unit", "list", "--space", space, "--quiet", "-o", "json"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  check(result.status === 0, `cub unit list failed for ${space}: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout || "[]");
}

function runCub(args) {
  const result = spawnSync("cub", [...contextArgs(), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"],
  });
  check(result.status === 0, `cub ${args.join(" ")} failed`);
}

function contextArgs() {
  return cubContext ? ["--context", cubContext] : [];
}
