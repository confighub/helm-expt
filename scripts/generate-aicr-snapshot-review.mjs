#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  serializeYaml,
  sha256,
  sha256File,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const modes = new Set(["--generate", "--verify", "--self-test", "--review"]);
check(modes.has(mode), "use --generate, --verify, --self-test, or --review");

const profileCatalogPath = join(repoRoot, "config-catalog", "aicr-snapshot-profiles.yaml");
const baselineFixturePath = join(
  repoRoot,
  "tests",
  "fixtures",
  "config-assessment",
  "aicr-snapshot-baseline.yaml",
);
const targetFixturePath = join(
  repoRoot,
  "tests",
  "fixtures",
  "config-assessment",
  "aicr-snapshot-target.yaml",
);
const absentFixturePath = join(
  repoRoot,
  "tests",
  "fixtures",
  "config-assessment",
  "aicr-expected-resources-components-absent.yaml",
);
const outputRoot = join(repoRoot, "data", "aicr-snapshot-review");
const reviewPath = join(outputRoot, "review.yaml");
const summaryPath = join(outputRoot, "summary.md");

if (mode === "--review") {
  const baselinePath = requiredFlag("--baseline");
  const targetPath = requiredFlag("--target");
  const profilesPath = resolve(flagValue("--profiles") || profileCatalogPath);
  const outputPath = resolve(flagValue("--output") || "aicr-snapshot-review.yaml");
  const baselineProfile = flagValue("--baseline-profile") || "";
  const targetProfile = flagValue("--target-profile") || "";
  const report = buildReview({
    baselinePath: resolve(baselinePath),
    targetPath: resolve(targetPath),
    profilesPath,
    baselineProfile,
    targetProfile,
    reviewOutputPath: outputPath,
    maintained: false,
  });
  writeYaml(outputPath, report);
  const ociRef = flagValue("--output-oci");
  if (ociRef) {
    const digest = writeLocalOci({
      baselinePath: resolve(baselinePath),
      targetPath: resolve(targetPath),
      profilesPath,
      reviewPath: outputPath,
      ociRef,
    });
    console.log(`wrote local review OCI ${ociRef}@${digest}`);
  }
  console.log(`wrote ${outputPath}`);
  process.exit(0);
}

const report = buildReview({
  baselinePath: baselineFixturePath,
  targetPath: targetFixturePath,
  profilesPath: profileCatalogPath,
  baselineProfile: "l40-mellanox-rdma",
  targetProfile: "l40-standard-networking",
  reviewOutputPath: reviewPath,
  maintained: true,
});
const reviewText = serializeYaml(report);
const summaryText = renderSummary(report);

if (mode === "--generate") {
  write(reviewPath, reviewText);
  write(summaryPath, summaryText);
  console.log(`wrote ${relativeRepo(outputRoot)}`);
} else if (mode === "--verify") {
  check(existsSync(reviewPath), `${relativeRepo(reviewPath)} is missing; run --generate`);
  check(readFileSync(reviewPath, "utf8") === reviewText, `${relativeRepo(reviewPath)} is stale; run --generate`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run --generate`);
  check(readFileSync(summaryPath, "utf8") === summaryText, `${relativeRepo(summaryPath)} is stale; run --generate`);
  console.log("verified the variant-aware AICR snapshot review");
} else {
  runSelfTest();
  console.log("verified the variant-aware AICR snapshot review self-test");
}

function buildReview({
  baselinePath,
  targetPath,
  profilesPath,
  baselineProfile,
  targetProfile,
  reviewOutputPath,
  maintained,
  catalogOverride,
  targetOverride,
  absentOverride,
}) {
  for (const path of [baselinePath, targetPath, profilesPath, absentFixturePath]) {
    check(existsSync(path), `missing AICR review input ${path}`);
  }
  const catalog = catalogOverride ?? readYaml(profilesPath);
  validateProfileCatalog(catalog);
  const baseline = readYaml(baselinePath);
  const target = targetOverride ?? readYaml(targetPath);
  const absent = absentOverride ?? readYaml(absentFixturePath);
  validateSnapshot(baseline, "baseline");
  validateSnapshot(target, "target");
  validateMissingDeployment(absent);

  const baselineReadings = readings(baseline);
  const targetReadings = readings(target);
  const differences = diffReadings(baselineReadings, targetReadings);
  const baselineBinding = bindProfile(catalog, baselineProfile, baselineReadings);
  const targetBinding = bindProfile(catalog, targetProfile, targetReadings);
  const counterfactualProfile = baselineProfile;
  const targetAsBaselineProfile = bindProfile(
    catalog,
    counterfactualProfile,
    targetReadings,
  );

  if (maintained) {
    check(differences.length === 2, `expected two observed differences, found ${differences.length}`);
    check(baselineBinding.result === "pass", "the RDMA baseline no longer satisfies its selected profile");
    check(targetBinding.result === "pass", "the standard-network target no longer satisfies its selected profile");
    check(
      targetBinding.requirements.filter((item) => item.result === "not-applicable").length === 2,
      "the standard-network target no longer marks two RDMA settings not applicable",
    );
    check(
      targetAsBaselineProfile.requirements.filter((item) => item.result === "finding").length === 2,
      "the target bound to the RDMA profile no longer produces two findings",
    );
  }

  const sourceCatalogRecord = resolve(repoRoot, catalog.spec.basedOn.sourceCatalogRecord);
  check(existsSync(sourceCatalogRecord), "the profile catalog's AICR source record is missing");
  const sourceRecord = readYaml(sourceCatalogRecord);
  check(sourceRecord.spec?.source?.version === catalog.spec.basedOn.version, "the profile catalog AICR version differs from its source record");
  const catalogPathForRecord = portablePath(profilesPath);
  const baselinePathForRecord = portablePath(baselinePath);
  const targetPathForRecord = portablePath(targetPath);
  const sourceRecordPathForRecord = portablePath(sourceCatalogRecord);
  const reviewPathForRecord = portablePath(reviewOutputPath);
  const context = {
    profileCatalog: {
      path: catalogPathForRecord,
      sha256: sha256File(profilesPath),
      provider: catalog.spec.provider,
      version: catalog.metadata.version,
      use: catalog.status.use,
    },
    upstream: {
      project: catalog.spec.basedOn.project,
      version: catalog.spec.basedOn.version,
      sourceCatalogRecord: sourceRecordPathForRecord,
      sourceCatalogRecordSha256: sha256File(sourceCatalogRecord),
      retainedCatalogInventorySha256:
        sourceRecord.spec?.inventories?.embeddedCatalogEntries?.recordSha256 ?? "",
    },
    bindings: {
      baseline: baselineBinding.profile
        ? { profile: baselineBinding.profile, dimensions: baselineBinding.dimensions }
        : null,
      target: targetBinding.profile
        ? { profile: targetBinding.profile, dimensions: targetBinding.dimensions }
        : null,
    },
  };

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "ConfigReviewRecord",
    metadata: {
      name: "aicr-l40-node-snapshot-review",
    },
    spec: {
      question: "What differs between these GPU nodes, and does the difference matter for each node's intended role?",
      source: {
        format: "aicr-snapshot",
        inspectionCommands: [
          "aicr snapshot --output baseline.yaml",
          "aicr snapshot --output current.yaml",
          "aicr diff --baseline baseline.yaml --target current.yaml",
        ],
        note: "Snapshot and diff inspect observed node state. They do not require a recipe or deploy a bundle.",
      },
      snapshots: {
        baseline: snapshotRecord(baselinePathForRecord, baselinePath, baselineReadings),
        target: snapshotRecord(targetPathForRecord, targetPath, targetReadings),
      },
      observedDifferences: differences,
      unboundInterpretation: {
        result: differences.length ? "finding" : "pass",
        decision: differences.length
          ? "The snapshots differ. Select the intended profile for each node before deciding whether either node should change."
          : "The recorded measurements are equal. This does not prove that either node matches its intended profile.",
      },
      selectedIntent: context,
      variantAssessment: {
        baseline: baselineBinding,
        target: targetBinding,
        targetUsingBaselineProfile: {
          purpose: "Shows why the same observed state can be correct for one variant and wrong for another.",
          ...targetAsBaselineProfile,
        },
      },
      assessmentClasses: {
        nodeInspection: {
          evidenceState: "completed",
          resultState: "available",
          note: "Two exact snapshot files were parsed, hashed, and compared.",
        },
        configurationValidation: {
          evidenceState: "not-applicable",
          resultState: "not-applicable",
          note: "A node snapshot is observed state, not a deployable configuration candidate.",
        },
        postDeploymentValidation: {
          evidenceState: absent.spec.expectedClassification.evidenceState,
          resultState: absent.spec.expectedClassification.resultState,
          executionOutcome: "missing-deployment-timeout",
          note: absent.spec.expectedClassification.reason,
        },
        hardwareRuntimeProof: {
          evidenceState: "not-run",
          resultState: "not-run",
          note: "No RDMA transfer, GPU workload, model request, or performance test ran for these sanitized fixtures.",
        },
      },
      retention: {
        acceptedContextSha256: sha256(stableJson(context)),
        localFiles: [baselinePathForRecord, targetPathForRecord, reviewPathForRecord],
        optionalOci: {
          artifactType: "application/vnd.confighub.config-review.v1",
          contents: ["baseline.yaml", "target.yaml", "profiles.yaml", "review.yaml"],
          note: "The optional local OCI keeps the observations and interpretation together. It is a review artifact, not deployable Kubernetes configuration.",
        },
        configHub: {
          status: "not-run",
          purpose: "Keep the two observations and their accepted interpretation as non-deployable Units for later comparison.",
          commands: [
            "cub space create aicr-node-review --component aicr-node-state --variant reviewed --stage Review",
            `cub unit create --space aicr-node-review --provider None baseline-snapshot ${baselinePathForRecord}`,
            `cub unit create --space aicr-node-review --provider None target-snapshot ${targetPathForRecord}`,
            `cub unit create --space aicr-node-review --provider None snapshot-review ${reviewPathForRecord}`,
          ],
        },
      },
    },
    status: {
      result: "reviewed",
      decision: reviewDecision({
        differences,
        baselineBinding,
        targetBinding,
        targetAsBaselineProfile,
      }),
      limits: [
        "The snapshots are sanitized fixtures, not fresh measurements from a live GPU cluster.",
        "The deployment profiles demonstrate provider-owned intent and are not NVIDIA AICR leaves or production hardware advice.",
        "No configuration was generated, deployed, validated after deployment, or exercised on GPU hardware.",
      ],
    },
  };
}

function validateProfileCatalog(catalog) {
  check(catalog.apiVersion === "catalog.confighub.com/v1alpha1", "invalid AICR profile catalog apiVersion");
  check(catalog.kind === "AICRNodeProfileCatalog", "invalid AICR profile catalog kind");
  check(catalog.spec?.provider?.name && catalog.spec?.provider?.role, "AICR profile provider is missing");
  check(catalog.spec?.basedOn?.version && catalog.spec?.basedOn?.sourceCatalogRecord, "AICR profile source is missing");
  check(catalog.status?.use === "demonstration-only", "AICR profile catalog must remain demonstration-only");
  check(catalog.status?.runtimeProven === false, "AICR profile catalog must not claim runtime proof");
  const profiles = catalog.spec?.profiles ?? [];
  check(profiles.length >= 2, "AICR profile catalog needs at least two profiles");
  check(new Set(profiles.map((item) => item.name)).size === profiles.length, "AICR profile names are not unique");
  for (const profile of profiles) {
    check(profile.name && profile.displayName, "AICR profile identity is incomplete");
    check(Array.isArray(profile.targetAssumptions) && profile.targetAssumptions.length > 0, `${profile.name}: target assumptions are missing`);
    check(Array.isArray(profile.requirements) && profile.requirements.length > 0, `${profile.name}: requirements are missing`);
    for (const requirement of profile.requirements) {
      check(requirement.path && ["equals", "contains"].includes(requirement.operator), `${profile.name}: invalid requirement`);
      check(typeof requirement.required === "boolean", `${profile.name}: requirement required flag is missing`);
      check(requirement.explanation, `${profile.name}: requirement explanation is missing`);
    }
  }
  const rdma = profiles.find((item) => item.name === "l40-mellanox-rdma");
  const standard = profiles.find((item) => item.name === "l40-standard-networking");
  check(rdma?.dimensions?.rdma === true && standard?.dimensions?.rdma === false, "the two network roles are not explicit");
  check(
    rdma.requirements.filter((item) => item.required && item.path.startsWith("OS/")).length === 2,
    "the RDMA profile must require both operating-system settings",
  );
  check(
    standard.requirements.filter((item) => !item.required && item.path.startsWith("OS/")).length === 2,
    "the standard profile must mark both RDMA settings not required",
  );
}

function validateSnapshot(snapshot, label) {
  check(Array.isArray(snapshot.measurements) && snapshot.measurements.length > 0, `${label} snapshot has no measurements`);
  check(readings(snapshot).size > 0, `${label} snapshot has no readable fields`);
}

function validateMissingDeployment(absent) {
  check(absent.spec?.selectedConfigurationDeployed === false, "expected-resources fixture no longer records a missing deployment");
  check(
    absent.spec?.expectedClassification?.evidenceState === "blocked"
      && absent.spec?.expectedClassification?.resultState === "not-run",
    "missing components must remain blocked and not run",
  );
}

function readings(snapshot) {
  const result = new Map();
  for (const measurement of snapshot.measurements ?? []) {
    for (const subtype of measurement.subtypes ?? []) {
      for (const [key, value] of Object.entries(subtype.data ?? {})) {
        result.set(`${measurement.type}/${subtype.subtype}/${key}`, value);
      }
    }
  }
  return new Map([...result.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function diffReadings(baseline, target) {
  const paths = [...new Set([...baseline.keys(), ...target.keys()])].sort();
  return paths
    .filter((path) => stableJson(baseline.get(path)) !== stableJson(target.get(path)))
    .map((path) => ({
      path,
      baseline: baseline.has(path) ? baseline.get(path) : null,
      target: target.has(path) ? target.get(path) : null,
      classification: "observed-difference",
    }));
}

function bindProfile(catalog, profileName, snapshotReadings) {
  if (!profileName) {
    return {
      profile: null,
      result: "needs-intent",
      requirements: [],
      decision: "No intended profile was selected, so the snapshot can be compared but not judged as correct or incorrect.",
    };
  }
  const profile = catalog.spec.profiles.find((item) => item.name === profileName);
  check(profile, `unknown AICR node profile ${profileName}`);
  const requirements = profile.requirements.map((requirement) => {
    const observed = snapshotReadings.has(requirement.path)
      ? snapshotReadings.get(requirement.path)
      : null;
    if (!requirement.required) {
      return {
        path: requirement.path,
        required: false,
        observed,
        result: "not-applicable",
        explanation: requirement.explanation,
      };
    }
    const matches = requirement.operator === "equals"
      ? stableJson(observed) === stableJson(requirement.value)
      : String(observed ?? "").includes(String(requirement.value));
    return {
      path: requirement.path,
      required: true,
      expected: { operator: requirement.operator, value: requirement.value },
      observed,
      result: matches ? "pass" : "finding",
      explanation: requirement.explanation,
    };
  });
  const findings = requirements.filter((item) => item.result === "finding").length;
  return {
    profile: profile.name,
    provider: catalog.spec.provider,
    dimensions: profile.dimensions,
    targetAssumptions: profile.targetAssumptions,
    result: findings ? "finding" : "pass",
    requirements,
    decision: findings
      ? `${findings} required setting${findings === 1 ? " does" : "s do"} not match this profile.`
      : "The recorded fields satisfy this profile; checks outside the snapshot remain separate.",
  };
}

function snapshotRecord(pathForRecord, absolutePath, snapshotReadings) {
  return {
    path: pathForRecord,
    sha256: sha256File(absolutePath),
    measurementCount: snapshotReadings.size,
  };
}

function renderSummary(report) {
  const differences = report.spec.observedDifferences
    .map((item) => `| \`${item.path}\` | \`${item.baseline}\` | \`${item.target}\` |`)
    .join("\n");
  const bindings = [
    ["Baseline", report.spec.variantAssessment.baseline],
    ["Target", report.spec.variantAssessment.target],
    ["Target under baseline profile", report.spec.variantAssessment.targetUsingBaselineProfile],
  ]
    .map(([name, binding]) => {
      const findings = binding.requirements.filter((item) => item.result === "finding").length;
      const notApplicable = binding.requirements.filter((item) => item.result === "not-applicable").length;
      return `| ${name} | \`${binding.profile ?? "none"}\` | \`${binding.result}\` | ${findings} | ${notApplicable} |`;
    })
    .join("\n");
  return `# Compare two AICR GPU-node snapshots

This maintained example answers one question: **what differs between two GPU
nodes, and does the difference matter for each node's intended role?**

The snapshot diff finds two differences. It does not call either one a fault.
The baseline is assessed as an L40 node with Mellanox RDMA. The target is
assessed as an L40 node with standard networking. Both pass their selected
demonstration profiles. The same target produces two findings when it is
assessed against the RDMA profile.

## Observed differences

| Field | Baseline | Target |
| --- | --- | --- |
${differences}

## Variant-aware result

| Observation | Selected profile | Result | Findings | Not applicable |
| --- | --- | --- | ---: | ---: |
${bindings}

The two profiles are maintained in
[\`${report.spec.selectedIntent.profileCatalog.path}\`](../../${report.spec.selectedIntent.profileCatalog.path}).
They demonstrate provider-owned target intent; they are not NVIDIA AICR leaves
or production hardware advice. The review keeps the profile catalog SHA-256,
the retained AICR source record SHA-256, both snapshot SHA-256 values, and every
field decision in [\`review.yaml\`](./review.yaml).

## What did not run

- No recipe or bundle was selected for the snapshot comparison.
- No configuration was generated or deployed.
- The recipe-dependent \`expected-resources\` check is blocked and not run when
  its declared components are absent. That is not failed GPU conformance.
- No GPU workload, RDMA transfer, model request, or performance test ran.

## Keep the result

The review can remain as files, be packed into a local OCI review artifact, or
be stored as three non-deployable ConfigHub Units. The commands are recorded in
[\`review.yaml\`](./review.yaml). Keeping the result preserves the two snapshot
digests and the intent used to interpret them.
`;
}

function runSelfTest() {
  const catalog = readYaml(profileCatalogPath);
  const brokenCatalog = structuredClone(catalog);
  brokenCatalog.spec.profiles
    .find((item) => item.name === "l40-mellanox-rdma")
    .requirements.find((item) => item.path === "OS/kernel-modules/nvidia_peermem")
    .required = false;
  expectFailure(
    () => buildReview({
      baselinePath: baselineFixturePath,
      targetPath: targetFixturePath,
      profilesPath: profileCatalogPath,
      baselineProfile: "l40-mellanox-rdma",
      targetProfile: "l40-standard-networking",
      reviewOutputPath: reviewPath,
      maintained: true,
      catalogOverride: brokenCatalog,
    }),
    "a weakened RDMA profile was accepted",
  );

  const target = readYaml(targetFixturePath);
  target.measurements
    .find((item) => item.type === "OS")
    .subtypes.find((item) => item.subtype === "kernel-cmdline")
    .data.cmdline = "quiet splash iommu=pt";
  target.measurements
    .find((item) => item.type === "OS")
    .subtypes.find((item) => item.subtype === "kernel-modules")
    .data.nvidia_peermem = "loaded";
  expectFailure(
    () => buildReview({
      baselinePath: baselineFixturePath,
      targetPath: targetFixturePath,
      profilesPath: profileCatalogPath,
      baselineProfile: "l40-mellanox-rdma",
      targetProfile: "l40-standard-networking",
      reviewOutputPath: reviewPath,
      maintained: true,
      targetOverride: target,
    }),
    "a fixture with no RDMA differences was accepted",
  );

  const absent = readYaml(absentFixturePath);
  absent.spec.expectedClassification.resultState = "fail";
  expectFailure(
    () => buildReview({
      baselinePath: baselineFixturePath,
      targetPath: targetFixturePath,
      profilesPath: profileCatalogPath,
      baselineProfile: "l40-mellanox-rdma",
      targetProfile: "l40-standard-networking",
      reviewOutputPath: reviewPath,
      maintained: true,
      absentOverride: absent,
    }),
    "a missing deployment was accepted as failed conformance",
  );
}

function writeLocalOci({ baselinePath, targetPath, profilesPath, reviewPath, ociRef }) {
  const { layoutPath, tag } = parseOciRef(ociRef);
  const staging = mkdtempSync(join(tmpdir(), "aicr-snapshot-review-"));
  try {
    const files = [
      [baselinePath, "baseline.yaml", "application/yaml"],
      [targetPath, "target.yaml", "application/yaml"],
      [profilesPath, "profiles.yaml", "application/yaml"],
      [reviewPath, "review.yaml", "application/vnd.confighub.config-review.v1+yaml"],
    ];
    for (const [source, name] of files) copyFileSync(source, join(staging, name));
    mkdirSync(dirname(layoutPath), { recursive: true });
    const ref = `${layoutPath}:${tag}`;
    execFileSync(
      "oras",
      [
        "push",
        "--oci-layout",
        ref,
        "--artifact-type",
        "application/vnd.confighub.config-review.v1",
        ...files.map(([, name, mediaType]) => `${name}:${mediaType}`),
      ],
      { cwd: staging, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" },
    );
    return execFileSync(
      "oras",
      ["manifest", "fetch", "--oci-layout", "--format", "go-template", "--template", "{{ .digest }}", ref],
      { cwd: staging, encoding: "utf8" },
    ).trim();
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function reviewDecision({
  differences,
  baselineBinding,
  targetBinding,
  targetAsBaselineProfile,
}) {
  if (!baselineBinding.profile || !targetBinding.profile) {
    return differences.length
      ? "The snapshots differ, but intended profiles were not selected. Keep the observations and add intent before deciding what should change."
      : "The recorded measurements are equal, but intended profiles were not selected. Equality does not prove that either node is correctly configured.";
  }
  const selectedFindings = [baselineBinding, targetBinding]
    .flatMap((binding) => binding.requirements)
    .filter((requirement) => requirement.result === "finding").length;
  if (selectedFindings) {
    return `${selectedFindings} required setting${selectedFindings === 1 ? " does" : "s do"} not match the selected node profiles.`;
  }
  const counterfactualFindings = targetAsBaselineProfile.requirements
    .filter((requirement) => requirement.result === "finding").length;
  return counterfactualFindings
    ? `The observed differences are compatible with the selected profiles. The target would have ${counterfactualFindings} finding${counterfactualFindings === 1 ? "" : "s"} if it were assigned the baseline profile.`
    : "The observed differences are compatible with the selected profiles.";
}

function parseOciRef(value) {
  const index = value.lastIndexOf(":");
  check(index > 0 && index < value.length - 1, "--output-oci must be PATH:TAG");
  return {
    layoutPath: resolve(value.slice(0, index)),
    tag: value.slice(index + 1),
  };
}

function portablePath(path) {
  const absolute = resolve(path);
  return absolute.startsWith(`${repoRoot}/`)
    ? relativeRepo(absolute)
    : basename(absolute);
}

function flagValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function requiredFlag(name) {
  const value = flagValue(name);
  check(value, `${name} is required with --review`);
  return value;
}

function expectFailure(fn, message) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  check(failed, message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
