#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--check";
const unitsRoot = join(repoRoot, "data", "helm-catalog-readmes", "units");
const changeDesc = "Refresh helm-catalog demo README";
const cubContext = process.env.CUB_CONTEXT ?? "";

if (mode === "--upload") {
  const spaces = sourceSpaces();
  for (const space of spaces) {
    const unitPath = join(unitsRoot, space, "readme.yaml");
    const exists = unitExists(space, "readme");
    const args = exists
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
    console.log(`${exists ? "updated" : "created"} ${space}/readme`);
  }
  verifyLive(spaces);
} else if (mode === "--check") {
  verifyLive(sourceSpaces());
} else {
  console.log(`Usage:
  node scripts/upload-helm-catalog-readmes.mjs --upload
  node scripts/upload-helm-catalog-readmes.mjs --check`);
}

function sourceSpaces() {
  check(existsSync(unitsRoot), `${relativeRepo(unitsRoot)} is missing; run npm run helm-catalog-readmes`);
  return readdirSync(unitsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function verifyLive(spaces) {
  let checked = 0;
  for (const space of spaces) {
    const units = listUnits(space);
    const slugs = units.map((item) => item.Unit?.Slug).filter(Boolean);
    const readmeLike = slugs.filter((slug) => slug.toLowerCase().includes("readme"));
    check(readmeLike.length === 1 && readmeLike[0] === "readme", `${space} has readme-like Units: ${readmeLike.join(", ") || "(none)"}`);
    checked += 1;
  }
  console.log(`verified one README in ${checked} helm-catalog Space(s)`);
}

function unitExists(space, slug) {
  const result = spawnSync("cub", [...contextArgs(), "unit", "get", "--space", space, slug, "-o", "name", "--quiet"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return result.status === 0;
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
