#!/usr/bin/env node
// Writes the plans and the companion files of the two OCI artifacts each
// mirrored AICR entry needs: the source package its Applications point at, and
// the literal configuration bundle of the rendered Applications.
//
//   node scripts/generate-aicr-mirror-artifacts.mjs             write
//   node scripts/generate-aicr-mirror-artifacts.mjs --verify    rebuild and compare
//   node scripts/generate-aicr-mirror-artifacts.mjs --deep      the same, and re-render
//
// Every output is a pure function of committed files: the retained bundle and
// its checksum list, the rendered Applications, the recipes and the generation
// receipt of each entry. There is no clock, no network, no registry and no
// cluster. Each plan records the manifest digest the committed bytes build, so
// the digest is on record before any push. Nothing here says whether an
// artifact is published. That is decided by a tracked receipt, which
// scripts/publish-aicr-mirror-artifacts.mjs writes.
//
// --verify rebuilds both artifacts of every entry from the retained files and
// compares them with the committed plans, which is why no OCI layout is
// committed. It also compares each recorded placeholder location with the
// rendered bytes, and the mirror's overlay list with the entries on disk.
//
// --deep does everything --verify does, and two slower checks that need Helm
// on the PATH. It renders each source package archive with `helm template`
// and compares the result with the retained Applications, which shows that
// Helm can load the archive this script builds and that it renders the bytes
// the entry holds. It also verifies each entry's digest index.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AICR_MIRROR_ARTIFACT_ROLES,
  AICR_MIRROR_DATA_ROOT,
  LITERAL_CONFIG,
  SOURCE_PACKAGE,
  aicrMirrorOutputs,
  aicrMirrorRequiredInputFindings,
  buildLiteralConfigArtifact,
  buildSourcePackageArtifact,
  loadAicrMirrorEntries,
  readAicrMirrorLayerFiles,
} from "./lib/aicr-mirror-artifacts.mjs";
import { check, listFiles, relativeRepo, repoRoot, sha256, write } from "./lib/proof-common.mjs";

const REGENERATE = "npm run aicr-mirror-artifacts:generate";
const OVERLAY_LIST = "data/aicr-overlay-mirror/overlays.csv";
const mode = process.argv[2] ?? "--generate";
check(["--generate", "--verify", "--deep"].includes(mode), `unknown argument ${mode}. Use --generate, --verify or --deep`);

const entries = loadAicrMirrorEntries();
check(entries.length > 0, "no mirrored AICR entry was discovered under examples/aicr");

// A second build from the same committed bytes must give the same digests. A
// digest that moves without its content moving makes every plan meaningless.
for (const entry of entries) {
  const builders = { [SOURCE_PACKAGE]: buildSourcePackageArtifact, [LITERAL_CONFIG]: buildLiteralConfigArtifact };
  for (const role of AICR_MIRROR_ARTIFACT_ROLES) {
    const again = builders[role](entry);
    check(
      again.manifestDigest === entry.artifacts[role].manifestDigest && again.layerDigest === entry.artifacts[role].layerDigest,
      `${entry.id} built two different ${role} artifacts from the same bytes`,
    );
    const files = readAicrMirrorLayerFiles(entry.artifacts[role]);
    check(
      files.length === entry.artifacts[role].stagedFiles.length
        && files.every((file) => entry.artifacts[role].stagedFiles.some((staged) => staged.path === file.path && staged.sha256 === sha256(file.data))),
      `${entry.id}: the ${role} layer does not hold exactly its staged files`,
    );
  }
}

const outputs = aicrMirrorOutputs(entries);
const owned = new Set(outputs.map((output) => output.rel));
const root = join(repoRoot, AICR_MIRROR_DATA_ROOT);
const leftovers = existsSync(root) ? listFiles(root).map(relativeRepo).filter((rel) => !owned.has(rel)) : [];
const counts = `${entries.length} entries, ${entries.length * 2} artifacts, ${outputs.length} files`;

function verifyOverlayList() {
  check(existsSync(join(repoRoot, OVERLAY_LIST)), `${OVERLAY_LIST} is missing; run scripts/generate-aicr-from-overlay.mjs --all`);
  const lines = readFileSync(join(repoRoot, OVERLAY_LIST), "utf8").split("\n").filter(Boolean);
  const header = lines[0].split(",");
  const column = (name) => header.indexOf(name);
  const listed = lines.slice(1).map((line) => line.split(",")).filter((cells) => cells[column("mirrored")] === "true").map((cells) => cells[column("overlay")]).sort();
  check(
    JSON.stringify(listed) === JSON.stringify(entries.map((entry) => entry.id).sort()),
    `${OVERLAY_LIST} lists ${listed.length} mirrored overlays and examples/aicr holds ${entries.length} mirrored entries`,
  );
}

function verifyRequiredInputs() {
  const findings = entries.flatMap((entry) => aicrMirrorRequiredInputFindings(entry));
  check(findings.length === 0, `a recorded generation input does not match the retained bytes: ${findings.slice(0, 3).join(" | ")}`);
}

function deepChecks() {
  const work = mkdtempSync(join(tmpdir(), "aicr-mirror-deep-"));
  try {
    for (const entry of entries) {
      const artifact = entry.artifacts[SOURCE_PACKAGE];
      const archive = join(work, artifact.layerTitle);
      const rendered = join(work, "rendered");
      rmSync(rendered, { recursive: true, force: true });
      writeFileSync(archive, artifact.layer);
      execFileSync(
        "helm",
        ["template", "aicr-argocd", archive, "--namespace", "argocd", "--set", `repoURL=${entry.generationInputs.repoURL}`, "--output-dir", rendered],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      const templates = join(rendered, "aicr-bundle", "templates");
      const names = readdirSync(templates).filter((name) => name.endsWith(".yaml")).sort();
      check(
        JSON.stringify(names) === JSON.stringify(entry.applications.map((application) => application.file).sort()),
        `${entry.id}: Helm rendered another set of Applications from the source package archive than the entry retains`,
      );
      for (const application of entry.applications) {
        check(
          readFileSync(join(templates, application.file)).equals(readFileSync(join(repoRoot, application.source))),
          `${entry.id}: Helm rendered ${application.file} from the source package archive, and it is not the retained ${application.source}`,
        );
      }
      execFileSync("node", ["scripts/generate-aicr-digest-index.mjs", "--verify", "--example", entry.id], { cwd: repoRoot, stdio: ["ignore", "ignore", "pipe"] });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (mode === "--generate") {
  for (const output of outputs) write(join(repoRoot, output.rel), output.text);
  check(leftovers.length === 0, `${leftovers[0]} is not a file this generator writes; remove it`);
  console.log(`wrote AICR mirror artifact plans: ${counts}`);
} else {
  for (const output of outputs) {
    const path = join(repoRoot, output.rel);
    check(existsSync(path) && readFileSync(path, "utf8") === output.text, `${output.rel} is stale; run ${REGENERATE}`);
  }
  check(leftovers.length === 0, `${leftovers[0]} is not a file this generator writes; remove it or run ${REGENERATE}`);
  verifyOverlayList();
  verifyRequiredInputs();
  if (mode === "--deep") deepChecks();
  console.log(
    `verified AICR mirror artifact plans: ${counts}; every source package and literal bundle rebuilt from retained files to the digest its plan records, and every recorded placeholder location matched the rendered bytes${mode === "--deep" ? "; Helm rendered each source package archive to the retained Applications, and each digest index verified" : ""}`,
  );
}
