#!/usr/bin/env node

// Enumerate every gated artifact the retained configuration names.
//
// The catalog references gated artifacts and never mirrors them, so a reference
// is all it holds. That makes the reference the thing to enumerate: an artifact
// nobody listed is an artifact nobody checked the terms for, and it arrives
// silently the moment an entry retains a document that mentions it.
//
// The lane refuses a gated reference that is not in the register, and refuses a
// register entry that no longer appears anywhere. Both directions matter. The
// first catches an artifact appearing unnoticed; the second catches a record
// describing an entry that has moved on.
//
// Re-reading is tied to the reference rather than to a calendar. Entries are
// keyed by the exact image reference including its tag, so a version bump
// produces a reference nobody enumerated and this lane refuses it until someone
// records what the new artifact's page says. A date-based cadence would go
// stale quietly; this one cannot.
//
// Most entries carry no named terms, and the register says why: the catalog
// pages that hold them are served behind bot detection, and reading them
// automatically would mean working around that. The gap is measured and
// published rather than filled with a guess.
//
// Everything runs offline against committed bytes.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const registerPath = join(repoRoot, "examples", "aicr", "claims", "gated-artifacts.yaml");
const summaryPath = join(repoRoot, "data", "gated-artifacts", "summary.md");

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/verify-gated-artifacts.mjs --generate
  node scripts/verify-gated-artifacts.mjs --verify
  node scripts/verify-gated-artifacts.mjs --self-test`);
  process.exit(2);
}

if (mode === "--generate") {
  const report = audit(loadRegister(), repoRoot);
  write(summaryPath, renderSummary(report));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = audit(loadRegister(), repoRoot);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run gated-artifacts:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(report),
    `${relativeRepo(summaryPath)} is stale; run npm run gated-artifacts:generate`,
  );
  console.log(
    `verified ${report.artifacts.length} gated artifact reference(s) across ${report.filesWithReferences} committed file(s): ${report.withTerms} with per-artifact terms read`,
  );
} else {
  selfTest();
  console.log("verified the gated-artifact checker against fake surfaces");
}

function loadRegister(path = registerPath) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
  const doc = readYaml(path);
  check(doc.kind === "GatedArtifactRegister", `${relativeRepo(path)}: expected kind GatedArtifactRegister`);
  const spec = doc.spec ?? {};
  check(spec.scope?.referencePattern, `${relativeRepo(path)}: no reference pattern is declared`);
  check((spec.scope?.roots ?? []).length > 0, `${relativeRepo(path)}: no roots are declared`);
  check((spec.artifacts ?? []).length > 0, `${relativeRepo(path)}: no artifacts are enumerated`);
  for (const key of ["referenceNeverMirror", "credentialsAreTargetFacts", "noVendorPerformanceClaims", "entitlementIsTheUsersToRead"]) {
    check(spec.policy?.[key], `${relativeRepo(path)}: the policy does not state ${key}`);
  }
  check(spec.reReadCadence?.trigger, `${relativeRepo(path)}: no re-read cadence is declared`);
  check(spec.termsReadingLimit, `${relativeRepo(path)}: the register does not say why terms may be unread`);

  const seen = new Set();
  for (const artifact of spec.artifacts) {
    check(artifact.reference, `${relativeRepo(path)}: an artifact declares no reference`);
    check(!seen.has(artifact.reference), `${relativeRepo(path)}: two entries share the reference ${artifact.reference}`);
    seen.add(artifact.reference);
    check(artifact.catalogPage, `${relativeRepo(path)}: ${artifact.reference} links no catalog page for a person to read`);
    check(artifact.note, `${relativeRepo(path)}: ${artifact.reference} says nothing about what is known`);
    if (artifact.termsReadAt) {
      check(
        /^\d{4}-\d{2}-\d{2}$/.test(artifact.termsReadAt),
        `${relativeRepo(path)}: ${artifact.reference} records a malformed read date`,
      );
      check(
        (artifact.termsNamed ?? []).length > 0,
        `${relativeRepo(path)}: ${artifact.reference} records a read date and names no terms`,
      );
      check(
        artifact.record,
        `${relativeRepo(path)}: ${artifact.reference} records terms but names no record carrying them`,
      );
    } else {
      check(
        !artifact.termsNamed,
        `${relativeRepo(path)}: ${artifact.reference} names terms with no date saying when they were read`,
      );
    }
  }
  return { path, spec, pattern: new RegExp(spec.scope.referencePattern, "g") };
}

// References are found in committed bytes rather than declared, so the register
// is checked against what the entries actually say.
function findReferences(register, root) {
  const found = new Map();
  for (const relative of register.spec.scope.roots) {
    const absolute = join(root, relative);
    if (!existsSync(absolute)) continue;
    const listed = execFileSync("git", ["ls-files", "--", relative], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\n")
      .filter(Boolean);
    for (const file of listed) {
      const path = join(root, file);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, "utf8");
      register.pattern.lastIndex = 0;
      for (const match of text.matchAll(register.pattern)) {
        const reference = match[0];
        if (!found.has(reference)) found.set(reference, new Set());
        found.get(reference).add(file);
      }
    }
  }
  return found;
}

function audit(register, root) {
  const found = findReferences(register, root);
  const enumerated = new Set(register.spec.artifacts.map((row) => row.reference));

  const unenumerated = [...found.keys()].filter((reference) => !enumerated.has(reference)).sort();
  check(
    unenumerated.length === 0,
    `these gated references are in committed bytes and not in ${relativeRepo(register.path)}: ${unenumerated.join(", ")}`,
  );

  const absent = register.spec.artifacts.filter((row) => !found.has(row.reference)).map((row) => row.reference);
  check(
    absent.length === 0,
    `${relativeRepo(register.path)} enumerates references no committed document names: ${absent.join(", ")}`,
  );

  const artifacts = register.spec.artifacts.map((row) => ({
    ...row,
    files: [...(found.get(row.reference) ?? [])].sort(),
  }));
  const filesWithReferences = new Set([...found.values()].flatMap((files) => [...files])).size;

  return {
    register,
    artifacts,
    filesWithReferences,
    withTerms: artifacts.filter((row) => row.termsReadAt).length,
  };
}

function renderSummary(report) {
  const rows = report.artifacts
    .map((row) => {
      const terms = row.termsReadAt ? `read ${row.termsReadAt}` : "not read";
      return `| \`${row.reference}\` | ${row.files.length} | ${terms} |`;
    })
    .join("\n");
  const named = report.artifacts
    .filter((row) => row.termsReadAt)
    .map(
      (row) =>
        `- \`${row.reference}\`, read on ${row.termsReadAt}, naming ${row.termsNamed.map((term) => `**${term}**`).join(", ")}. Carried as data in [${row.record}](../../${row.record}).`,
    )
    .join("\n");
  const policy = report.register.spec.policy;

  return `# The gated artifacts this catalog names

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run gated-artifacts:generate\` and checked by
\`npm run gated-artifacts:verify\`. The register is hand-authored at
\`${relativeRepo(report.register.path)}\`.

The catalog references gated artifacts and never mirrors them, so a reference
is all it holds. That makes the reference the thing to enumerate: an artifact
nobody listed is an artifact nobody checked the terms for, and it arrives the
moment an entry retains a document that mentions it.

## The rules this follows

- **Reference, never mirror.** ${policy.referenceNeverMirror}
- **Credentials are the cluster's.** ${policy.credentialsAreTargetFacts}
- **No vendor performance claims.** ${policy.noVendorPerformanceClaims}
- **Entitlement is the reader's to judge.** ${policy.entitlementIsTheUsersToRead}

## Every reference in the retained configuration

${report.artifacts.length} gated references appear across ${report.filesWithReferences} committed files. The lane
refuses a reference that is not listed here, and refuses a listing that no
committed document names, so this table cannot drift in either direction.

| Reference | Files naming it | Per-artifact terms |
| --- | --- | --- |
${rows}

## What has actually been read

${named}

${report.artifacts.length - report.withTerms} of the ${report.artifacts.length} references have no per-artifact terms recorded, and the
reason is worth stating rather than leaving as an absence. ${report.register.spec.termsReadingLimit}

## Re-reading is tied to the reference, not to a calendar

${report.register.spec.reReadCadence.rule}

That is why this register has no expiry column. A date-based cadence goes stale
quietly, because nothing fails when a date passes. Keying an entry to the exact
tag means a version bump produces a reference nobody enumerated, and the lane
refuses it until someone records what the new artifact's page says.

Everything runs offline against committed bytes. Nothing here pulls a gated
artifact, and no cluster, organization, or GPU workload takes part.
`;
}

function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "gated-artifacts-self-test-"));
  const fixtureRoot = join(repoRoot, "examples", "gated-artifacts-fixture");
  try {
    const base = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "GatedArtifactRegister",
      metadata: { name: "fixture" },
      spec: {
        policy: {
          referenceNeverMirror: "fixture",
          credentialsAreTargetFacts: "fixture",
          noVendorPerformanceClaims: "fixture",
          entitlementIsTheUsersToRead: "fixture",
        },
        reReadCadence: { trigger: "reference-change", rule: "fixture" },
        termsReadingLimit: "fixture",
        scope: { roots: ["examples/gated-artifacts-fixture"], referencePattern: "nvcr\\.io/[a-z0-9./_-]+:[a-zA-Z0-9._-]+" },
        artifacts: [
          {
            reference: "nvcr.io/nim/fixture/alpha:1.0.0",
            catalogPage: "https://example.invalid/alpha",
            termsReadAt: null,
            note: "fixture",
          },
        ],
      },
    };
    const writeRegister = (name, mutate) => {
      const value = JSON.parse(JSON.stringify(base));
      mutate(value);
      const path = join(scratch, `${name}.yaml`);
      writeFileSync(path, `${JSON.stringify(value)}\n`);
      return path;
    };
    const fails = (fn, pattern) => {
      try {
        fn();
        return false;
      } catch (error) {
        return pattern.test(String(error.message));
      }
    };

    write(join(fixtureRoot, "runtime.yaml"), "image: nvcr.io/nim/fixture/alpha:1.0.0\n");
    execFileSync("git", ["add", "-f", "examples/gated-artifacts-fixture/runtime.yaml"], { cwd: repoRoot, stdio: "pipe" });

    const good = loadRegister(writeRegister("good", () => {}));
    const report = audit(good, repoRoot);
    check(report.artifacts.length === 1 && report.artifacts[0].files.length === 1, "self-test did not find the fixture reference");

    write(join(fixtureRoot, "extra.yaml"), "image: nvcr.io/nim/fixture/beta:2.0.0\n");
    execFileSync("git", ["add", "-f", "examples/gated-artifacts-fixture/extra.yaml"], { cwd: repoRoot, stdio: "pipe" });
    check(
      fails(() => audit(good, repoRoot), /in committed bytes and not in .*: nvcr.io\/nim\/fixture\/beta:2.0.0/),
      "self-test accepted a gated reference nobody enumerated",
    );

    // A tag bump is a new reference, which is how the re-read cadence enforces
    // itself without a date.
    write(join(fixtureRoot, "runtime.yaml"), "image: nvcr.io/nim/fixture/alpha:1.1.0\n");
    execFileSync("git", ["add", "-f", "examples/gated-artifacts-fixture/runtime.yaml"], { cwd: repoRoot, stdio: "pipe" });
    rmSync(join(fixtureRoot, "extra.yaml"));
    execFileSync("git", ["rm", "-q", "--cached", "examples/gated-artifacts-fixture/extra.yaml"], { cwd: repoRoot, stdio: "pipe" });
    check(
      fails(() => audit(good, repoRoot), /nvcr.io\/nim\/fixture\/alpha:1.1.0/),
      "self-test accepted a tag bump without a new register entry",
    );

    check(
      fails(() => loadRegister(writeRegister("dated-without-terms", (value) => {
        value.spec.artifacts[0].termsReadAt = "2026-01-01";
      })), /records a read date and names no terms/),
      "self-test accepted a read date with no terms named",
    );
    check(
      fails(() => loadRegister(writeRegister("terms-without-date", (value) => {
        value.spec.artifacts[0].termsNamed = ["Some Agreement"];
      })), /names terms with no date saying when they were read/),
      "self-test accepted named terms with no read date",
    );
    check(
      fails(() => loadRegister(writeRegister("no-policy", (value) => {
        delete value.spec.policy.noVendorPerformanceClaims;
      })), /does not state noVendorPerformanceClaims/),
      "self-test accepted a register that drops a policy rule",
    );
  } finally {
    try {
      execFileSync("git", ["rm", "-q", "-r", "--cached", "--ignore-unmatch", "examples/gated-artifacts-fixture"], {
        cwd: repoRoot,
        stdio: "pipe",
      });
    } catch {
      // The index entry may already be gone, which is fine.
    }
    rmSync(fixtureRoot, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
  }
}
