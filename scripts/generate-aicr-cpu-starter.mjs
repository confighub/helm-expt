#!/usr/bin/env node

// Derive the CPU starter entry from the retained H100 training entry.
//
// The starter is the third AICR catalog entry class: a shape anyone can
// exercise without a GPU. Its provenance is a derivation, not new authorship:
// every member is a byte-identical copy of a rendered Application the training
// entry retains from AICR v0.14.0, selected by rules this compiler records in
// the index. Two rules are mechanical (rendered bytes referencing
// nvidia.com/gpu are excluded; Applications bound to the training OCI bundle
// by a path source are excluded) and one is curated with named reasons
// (cloud-specific or GPU-fleet-purpose components). The compiler refuses to
// compile if the curated list goes stale against the source entry.
//
// The derivation is pinned twice: each member records the training entry's
// platform digest and its own source payload hash, and the compiler refuses to
// compile if the training digest index does not pin the exact bytes the
// starter copies.
//
// Boundary: config-plane only. The starter needs no GPU, and no live run is
// claimed anywhere; running it is a later increment.

import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  listFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  toYaml,
  write,
} from "./lib/proof-common.mjs";

const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";
const sourceExampleRoot = join(repoRoot, "examples", "aicr", "eks-h100-training-kubeflow");
const starterExampleRoot = join(repoRoot, "examples", "aicr", "cpu-starter");

// Rule 3: purpose-boundary exclusions the mechanical rules cannot see. Every
// name here must exist in the source entry and must not already be excluded by
// a mechanical rule; otherwise the list is stale and the compile refuses.
const CURATED_EXCLUSIONS = {
  "aws-ebs-csi-driver":
    "AWS-specific storage driver; it needs AWS EBS and cloud credentials a CPU starter cannot assume",
  nvsentinel:
    "GPU fleet health monitoring; its purpose requires accelerated nodes even though its rendered values do not name them",
  "nodewright-operator":
    "GPU node lifecycle operations; the same purpose boundary as nvsentinel",
};

// Cloud residues worth surfacing honestly: retained values that reference
// cloud-specific resources. The starter keeps the bytes faithful and records
// the residue instead of editing it; overriding these is variant work.
const CLOUD_MARKERS = ["gp3"];

const SELECTION_RULES = [
  {
    id: "references-gpu-resources",
    kind: "mechanical",
    description: "rendered bytes reference nvidia.com/gpu",
  },
  {
    id: "bound-to-the-training-bundle",
    kind: "mechanical",
    description: "the Application source is an OCI path into the training bundle instead of a chart",
  },
  {
    id: "cloud-or-gpu-fleet-purpose",
    kind: "curated",
    description: "a named purpose boundary recorded next to each excluded component",
  },
];

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-aicr-cpu-starter.mjs --generate
  node scripts/generate-aicr-cpu-starter.mjs --verify
  node scripts/generate-aicr-cpu-starter.mjs --self-test`);
  process.exit(2);
}

if (mode === "--generate") {
  const compiled = compile(sourceExampleRoot);
  writeOutputs(starterExampleRoot, compiled);
  console.log(
    `compiled ${compiled.index.spec.platformDigest} deriving ${compiled.index.spec.members.length} member(s) into ${relativeRepo(starterExampleRoot)}`,
  );
} else if (mode === "--verify") {
  const compiled = compile(sourceExampleRoot);
  verifyOutputs(starterExampleRoot, compiled);
  console.log(
    `verified ${compiled.index.spec.platformDigest} against ${compiled.index.spec.members.length} committed derived member(s)`,
  );
} else {
  selfTest();
  console.log("verified the AICR CPU starter compiler self-test against fake surfaces");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function stripOciTag(reference) {
  const tagIndex = reference.lastIndexOf(":");
  const pathIndex = reference.lastIndexOf("/");
  check(tagIndex > pathIndex, `${reference}: expected an OCI reference with a tag`);
  return reference.slice(0, tagIndex);
}

function parentOciRepository(reference) {
  const untagged = stripOciTag(reference);
  const pathIndex = untagged.lastIndexOf("/");
  check(pathIndex > "oci://".length, `${reference}: expected a repository under an OCI base`);
  return untagged.slice(0, pathIndex);
}

function readRenderedChecksums(root) {
  const checksumsPath = join(root, "argocd-rendered", "checksums.txt");
  check(existsSync(checksumsPath), "argocd-rendered/checksums.txt is missing from the source entry");
  const rows = new Map();
  for (const line of readFileSync(checksumsPath, "utf8").split("\n").filter(Boolean)) {
    const match = line.match(/^([0-9a-f]{64})  (templates\/[A-Za-z0-9._-]+\.yaml)$/);
    check(match, `source argocd-rendered/checksums.txt: unparseable row: ${line}`);
    check(!rows.has(match[2]), `source argocd-rendered/checksums.txt: duplicate row for ${match[2]}`);
    rows.set(match[2], match[1]);
  }
  check(rows.size > 0, "source argocd-rendered/checksums.txt lists no rendered templates");
  return rows;
}

function compile(sourceRoot) {
  const generationReceipt = readYaml(join(sourceRoot, "generation-receipt.yaml"));
  const source = generationReceipt.spec?.source ?? {};
  check(/^v\d+\.\d+\.\d+$/.test(source.version ?? ""), "source generation receipt pins no exact upstream version");
  check(/^[0-9a-f]{40}$/.test(source.commit ?? ""), "source generation receipt pins no exact upstream commit");

  const ociReceipt = readYaml(join(sourceRoot, "argocd-oci-receipt.yaml"));
  const literal = ociReceipt.spec?.artifacts?.literalConfiguration ?? {};
  const ociBase = parentOciRepository(literal.publicTarget ?? "");

  const sourceIndexPath = join(sourceRoot, "digest-index", "platform-index.json");
  check(existsSync(sourceIndexPath), "the source entry has no digest index; generate it first");
  const sourceIndex = JSON.parse(readFileSync(sourceIndexPath, "utf8"));
  const sourcePlatformDigest = sourceIndex.spec?.platformDigest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(sourcePlatformDigest), "the source digest index records no platform digest");
  const sourceIndexMembers = new Map(
    (sourceIndex.spec?.members ?? []).map((row) => [row.component, row]),
  );

  const checksums = readRenderedChecksums(sourceRoot);
  const renderedRoot = join(sourceRoot, "argocd-rendered");

  const rows = [];
  for (const [templatePath, expectedSha] of [...checksums.entries()].sort()) {
    const bytes = readFileSync(join(renderedRoot, templatePath));
    check(
      sha256(bytes) === expectedSha,
      `source argocd-rendered/${templatePath} differs from its checksums.txt; the source entry drifted`,
    );
    const text = bytes.toString("utf8");
    const docs = parseDocs(text);
    check(docs.length === 1, `source argocd-rendered/${templatePath}: expected exactly one document`);
    const doc = docs[0];
    check(
      doc.apiVersion === "argoproj.io/v1alpha1" && doc.kind === "Application",
      `source argocd-rendered/${templatePath}: expected exactly one Argo CD Application`,
    );
    const name = doc.metadata?.name ?? "";
    check(name, `source argocd-rendered/${templatePath}: Application has no name`);
    rows.push({ templatePath, sha256: expectedSha, bytes, text, doc, name });
  }
  const names = rows.map((row) => row.name);
  check(new Set(names).size === names.length, "two source Applications share one name");

  const excluded = [];
  const selectedRows = [];
  for (const row of rows) {
    if (row.text.includes("nvidia.com/gpu")) {
      excluded.push({ component: row.name, rule: "references-gpu-resources", reason: "rendered bytes reference nvidia.com/gpu" });
      continue;
    }
    if (!row.doc.spec?.source?.chart) {
      excluded.push({
        component: row.name,
        rule: "bound-to-the-training-bundle",
        reason: "the Application source is an OCI path into the training bundle instead of a chart",
      });
      continue;
    }
    if (Object.hasOwn(CURATED_EXCLUSIONS, row.name)) {
      excluded.push({ component: row.name, rule: "cloud-or-gpu-fleet-purpose", reason: CURATED_EXCLUSIONS[row.name] });
      continue;
    }
    selectedRows.push(row);
  }
  for (const name of Object.keys(CURATED_EXCLUSIONS)) {
    const row = excluded.find((entry) => entry.component === name);
    check(row, `curated exclusion ${name} is stale: the source entry has no such component`);
    check(
      row.rule === "cloud-or-gpu-fleet-purpose",
      `curated exclusion ${name} is stale: a mechanical rule already excludes it`,
    );
  }
  check(selectedRows.length > 0, "the selection rules excluded every source Application");
  const waves = selectedRows.map((row) => {
    const wave = Number(row.doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION]);
    check(Number.isInteger(wave), `${row.name}: a selected Application has no integer sync-wave`);
    return wave;
  });
  check(new Set(waves).size === waves.length, "two selected Applications share one sync-wave");

  const cloudResidues = [];
  for (const row of selectedRows) {
    for (const marker of CLOUD_MARKERS) {
      if (row.text.includes(marker)) {
        cloudResidues.push({
          component: row.name,
          marker,
          note: "retained faithfully from the source shape; override it with variant mechanics before a live run on a cluster without this resource",
        });
      }
    }
  }

  const members = selectedRows.map((row) => {
    const indexRow = sourceIndexMembers.get(row.name);
    check(indexRow, `the source digest index does not list the selected component ${row.name}`);
    const payloadPath = join(sourceRoot, "digest-index", indexRow.payloadPath ?? "");
    check(existsSync(payloadPath), `${row.name}: the source digest index names a payload file that does not exist`);
    const sourcePayload = JSON.parse(readFileSync(payloadPath, "utf8"));
    check(
      sourcePayload.spec?.renderedFile?.sha256 === row.sha256,
      `${row.name}: the source digest index does not pin the bytes this starter derives from`,
    );
    const wave = Number(row.doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION]);
    const payload = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AICRCPUStarterComponentPayload",
      metadata: { name: row.name },
      spec: {
        component: row.name,
        role: "component-application",
        syncWave: wave,
        application: {
          apiVersion: row.doc.apiVersion,
          kind: row.doc.kind,
          namespace: row.doc.metadata?.namespace ?? "",
          name: row.name,
        },
        source: {
          type: "helm-chart",
          chart: String(row.doc.spec.source.chart),
          repoURL: String(row.doc.spec.source.repoURL ?? ""),
          targetRevision: String(row.doc.spec.source.targetRevision ?? ""),
        },
        destinationNamespace: row.doc.spec?.destination?.namespace ?? "",
        renderedFile: { path: `argocd-rendered/${row.templatePath}`, sha256: row.sha256, bytes: row.bytes.length },
        derivedFrom: {
          entry: "examples/aicr/eks-h100-training-kubeflow",
          sourceFile: `argocd-rendered/${row.templatePath}`,
          sourcePlatformDigest,
          sourcePayloadSha256: indexRow.payloadSha256,
        },
      },
      status: { result: "compiled-offline", liveRegistryPublicationClaimed: false },
    };
    const payloadText = `${stableJson(payload)}\n`;
    const payloadSha256 = sha256(payloadText);
    return {
      component: row.name,
      role: "component-application",
      syncWave: wave,
      payloadSha256,
      payloadPath: `payloads/${row.name}-${payloadSha256}.json`,
      plannedOCIRef: `${ociBase}/aicr-cpu-starter-components/${row.name}:payload-${payloadSha256}`,
      payloadText,
      templatePath: row.templatePath,
      renderedText: row.bytes,
      renderedSha256: row.sha256,
    };
  });

  const selection = {
    rules: SELECTION_RULES,
    excluded: excluded.sort((left, right) => left.component.localeCompare(right.component)),
    selectedCount: members.length,
  };

  const platformDigest = `sha256:${sha256(
    stableJson({
      source,
      derivedFromPlatformDigest: sourcePlatformDigest,
      selection,
      cloudResidues,
      members: members.map(({ component, syncWave, payloadSha256 }) => ({ component, syncWave, payloadSha256 })),
    }),
  )}`;

  const index = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AICRPlatformDigestIndex",
    metadata: { name: `aicr-cpu-starter-${source.version.replaceAll(".", "-")}-digest-index` },
    spec: {
      platformDigest,
      source,
      derivedFrom: { entry: "examples/aicr/eks-h100-training-kubeflow", platformDigest: sourcePlatformDigest },
      selection,
      cloudResidues,
      members: members.map(({ payloadText, templatePath, renderedText, renderedSha256, ...row }) => row),
      aggregate: {
        plannedOCIRef: `${ociBase}/aicr-cpu-starter-digest-index:platform-${platformDigest.slice("sha256:".length)}`,
        type: "target-neutral-index-published-only-after-member-manifest-digests-are-observed",
      },
      boundary: {
        configPlaneOnly: true,
        gpuRequired: false,
        gpuWorkloadsProven: false,
        liveRunProven: false,
        secretValuesIncluded: false,
        statement:
          "This starter is a derivation of retained configuration. It needs no GPU, and no live run is claimed anywhere in it; running it is a later increment.",
      },
    },
    status: { result: "compiled-offline", liveRegistryPublicationClaimed: false },
  };

  return { index, indexText: `${JSON.stringify(index, null, 2)}\n`, members, source, sourcePlatformDigest };
}

function renderDerivationReceipt(compiled) {
  return `${toYaml({
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "DerivationReceipt",
    metadata: { name: `aicr-cpu-starter-${compiled.source.version.replaceAll(".", "-")}` },
    spec: {
      derivedFrom: {
        entry: "examples/aicr/eks-h100-training-kubeflow",
        platformDigest: compiled.sourcePlatformDigest,
        upstream: compiled.source,
      },
      selection: compiled.index.spec.selection,
      cloudResidues: compiled.index.spec.cloudResidues,
      boundary: compiled.index.spec.boundary,
    },
    status: { result: "compiled-offline", liveRunProven: false },
  })}\n`;
}

function renderStarterReadme(compiled) {
  const { index } = compiled;
  const memberLines = index.spec.members
    .slice()
    .sort((left, right) => left.syncWave - right.syncWave)
    .map((member) => `| ${member.syncWave} | ${member.component} |`)
    .join("\n");
  return `# The CPU starter derives from the training entry

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
\`npm run aicr-cpu-starter:generate\` and checked byte-for-byte by
\`npm run aicr-cpu-starter:verify\`. Do not edit it by hand.

Every file under [argocd-rendered/](./argocd-rendered/) is a byte-identical
copy of a rendered Argo CD Application the
[training entry](../eks-h100-training-kubeflow/) retains from
${index.spec.source.name} ${index.spec.source.version}. The
[derivation receipt](./derivation-receipt.yaml) records the selection rules and
every exclusion with its reason, and the
[digest index](./digest-index/README.md) pins the derivation under:

\`\`\`
${index.spec.platformDigest}
\`\`\`

The selected components, in install order:

| Wave | Component |
| --- | --- |
${memberLines}

The starter needs no GPU. It keeps the source bytes faithful, so the recorded
cloud residues stay visible instead of silently edited; override them with
variant mechanics before a live run. No live run is claimed anywhere in this
directory; running the starter is a later increment.
`;
}

function renderIndexReadme(compiled) {
  const { index } = compiled;
  return `# One digest pins the derived starter

UNOFFICIAL/EXPERIMENTAL. Compiled by \`npm run aicr-cpu-starter:generate\`;
checked byte-for-byte by \`npm run aicr-cpu-starter:verify\`. Do not edit by
hand.

The platform digest is:

\`\`\`
${index.spec.platformDigest}
\`\`\`

That one value pins the upstream source pins, the derivation source
(${index.spec.derivedFrom.platformDigest}), the selection rules with every
exclusion and reason, the recorded cloud residues, and one immutable payload
per derived member. Each payload names the training-entry payload hash it
derives from, so the chain from AICR ${index.spec.source.version} through the
training index to this starter is checkable end to end.

The boundary, stated plainly: config-plane only. The starter needs no GPU,
and no live run is claimed here.
`;
}

function outputRows(compiled) {
  const rows = new Map();
  for (const member of compiled.members) {
    rows.set(`argocd-rendered/${member.templatePath}`, member.renderedText.toString("utf8"));
  }
  const renderedChecksums = compiled.members
    .map((member) => `${member.renderedSha256}  ${member.templatePath}`)
    .sort()
    .join("\n");
  rows.set("argocd-rendered/checksums.txt", `${renderedChecksums}\n`);
  rows.set("derivation-receipt.yaml", renderDerivationReceipt(compiled));
  rows.set("README.md", renderStarterReadme(compiled));
  rows.set("digest-index/platform-index.json", compiled.indexText);
  rows.set("digest-index/README.md", renderIndexReadme(compiled));
  for (const member of compiled.members) rows.set(`digest-index/${member.payloadPath}`, member.payloadText);
  const indexChecksums = [...rows.entries()]
    .filter(([path]) => path.startsWith("digest-index/"))
    .map(([path, text]) => `${sha256(text)}  ${path.slice("digest-index/".length)}`)
    .sort()
    .join("\n");
  rows.set("digest-index/checksums.txt", `${indexChecksums}\n`);
  return rows;
}

function writeOutputs(starterRoot, compiled) {
  if (existsSync(starterRoot)) {
    check(!lstatSync(starterRoot).isSymbolicLink(), "the starter root must not be a symbolic link");
    rmSync(starterRoot, { recursive: true });
  }
  for (const [path, text] of outputRows(compiled)) write(join(starterRoot, path), text);
}

function verifyOutputs(starterRoot, compiled) {
  check(existsSync(starterRoot), "the starter is missing; run npm run aicr-cpu-starter:generate");
  const rows = outputRows(compiled);
  const committed = listFiles(starterRoot).map((path) =>
    relativeRepo(path).slice(`${relativeRepo(starterRoot)}/`.length),
  );
  check(
    stableJson(committed) === stableJson([...rows.keys()].sort()),
    "the starter contains stray or missing files; run npm run aicr-cpu-starter:generate",
  );
  for (const [path, text] of rows) {
    check(
      readFileSync(join(starterRoot, path), "utf8") === text,
      `cpu-starter/${path} is stale; run npm run aicr-cpu-starter:generate`,
    );
  }
}

// The self-test derives from a fake source entry only: fake receipts, fake
// rendered Applications covering every selection rule, and a fake source
// digest index whose payloads pin the fake bytes. It proves selection
// correctness, byte-identical copying, determinism, digest sensitivity, and
// the refusals, without touching the committed entries.
function selfTest() {
  const FIXTURE_BASE = "oci://registry.invalid/fixture";
  const scratch = mkdtempSync(join(tmpdir(), "aicr-cpu-starter-self-test-"));
  try {
    const fixtureTemplates = () => ({
      "alpha.yaml": fixtureChartApplication("alpha", 0),
      "beta.yaml": fixtureChartApplication("beta", 1),
      "gpu-bound.yaml": fixtureChartApplication("gpu-bound", 2).replace(
        "cpu: \"1\"",
        "nvidia.com/gpu: \"1\"",
      ),
      "root.yaml": [
        "apiVersion: argoproj.io/v1alpha1",
        "kind: Application",
        "metadata:",
        "  name: fixture-root",
        "  namespace: argocd",
        "spec:",
        "  destination:",
        "    namespace: argocd",
        "    server: https://kubernetes.default.svc",
        "  source:",
        `    repoURL: ${FIXTURE_BASE}/fixture-argocd`,
        "    targetRevision: '9.9.9'",
        "    path: .",
        "",
      ].join("\n"),
      "aws-ebs-csi-driver.yaml": fixtureChartApplication("aws-ebs-csi-driver", 3),
      "nvsentinel.yaml": fixtureChartApplication("nvsentinel", 4),
      "nodewright-operator.yaml": fixtureChartApplication("nodewright-operator", 5),
    });

    const buildFixture = (name, mutate, options) => {
      const root = join(scratch, name);
      const templates = fixtureTemplates();
      if (mutate) mutate(templates);
      writeFixtureSource(root, templates, FIXTURE_BASE, options);
      return root;
    };

    const baseline = compile(buildFixture("baseline"));
    check(baseline.index.spec.members.length === 2, "self-test did not select exactly the two clean fixture members");
    check(
      stableJson(baseline.index.spec.members.map((m) => m.component)) === '["alpha","beta"]',
      "self-test selected the wrong members",
    );
    const excludedBy = (component) =>
      baseline.index.spec.selection.excluded.find((row) => row.component === component)?.rule;
    check(excludedBy("gpu-bound") === "references-gpu-resources", "self-test did not exclude the GPU-marked member mechanically");
    check(excludedBy("fixture-root") === "bound-to-the-training-bundle", "self-test did not exclude the path-bound root mechanically");
    check(
      ["aws-ebs-csi-driver", "nvsentinel", "nodewright-operator"].every((name) => excludedBy(name) === "cloud-or-gpu-fleet-purpose"),
      "self-test did not apply the curated exclusions",
    );
    check(!baseline.indexText.includes("europe-west1"), "self-test leaked the production OCI origin into a fixture compile");
    check(
      baseline.index.spec.boundary.gpuRequired === false && baseline.index.spec.boundary.liveRunProven === false,
      "self-test index dropped the starter boundary",
    );

    const recompiled = compile(join(scratch, "baseline"));
    check(recompiled.indexText === baseline.indexText, "self-test compile is not deterministic");

    const starterRoot = join(scratch, "baseline-starter");
    writeOutputs(starterRoot, baseline);
    verifyOutputs(starterRoot, baseline);
    check(
      readFileSync(join(starterRoot, "argocd-rendered", "templates", "alpha.yaml"), "utf8")
        === fixtureTemplates()["alpha.yaml"],
      "self-test derived copy is not byte-identical to the source",
    );
    write(join(starterRoot, "stray.txt"), "stray\n");
    check(
      fails(() => verifyOutputs(starterRoot, baseline), /stray or missing/),
      "self-test verify accepted a stray file in the starter",
    );
    rmSync(join(starterRoot, "stray.txt"));
    write(join(starterRoot, "digest-index", "platform-index.json"), "{}\n");
    check(
      fails(() => verifyOutputs(starterRoot, baseline), /platform-index\.json is stale/),
      "self-test verify accepted a tampered platform index",
    );

    const mutated = compile(
      buildFixture("mutated", (templates) => {
        templates["beta.yaml"] = templates["beta.yaml"].replace("namespace: beta", "namespace: beta-mutated");
      }),
    );
    const payloadFor = (compiledSet, component) =>
      compiledSet.index.spec.members.find((member) => member.component === component).payloadSha256;
    check(payloadFor(mutated, "beta") !== payloadFor(baseline, "beta"), "self-test member payload ignored a source change");
    check(payloadFor(mutated, "alpha") === payloadFor(baseline, "alpha"), "self-test source change bled into an untouched member");
    check(
      mutated.index.spec.platformDigest !== baseline.index.spec.platformDigest,
      "self-test platform digest ignored a source change",
    );

    const refusals = [
      ["stale-curated", (templates) => delete templates["nvsentinel.yaml"], /curated exclusion nvsentinel is stale/, "a curated exclusion naming a missing component", undefined],
      ["index-pin-mismatch", null, /does not pin the bytes this starter derives from/, "a source index that does not pin the derived bytes", { wrongPayloadShaFor: "beta" }],
      ["source-drift", (templates) => (templates["alpha.yaml"] += "# drifted\n"), /differs from its checksums\.txt/, "an unchecksummed source drift", { skipChecksum: "alpha.yaml", drift: "# drifted\n" }],
      ["missing-index-member", null, /does not list the selected component/, "a source index missing a selected member", { dropIndexMemberFor: "alpha" }],
    ];
    for (const [name, mutate, pattern, label, options] of refusals) {
      const root = join(scratch, name);
      const templates = fixtureTemplates();
      if (mutate) mutate(templates);
      writeFixtureSource(root, templates, FIXTURE_BASE, options);
      check(fails(() => compile(root), pattern), `self-test accepted ${label}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function fixtureChartApplication(name, wave) {
  return [
    "apiVersion: argoproj.io/v1alpha1",
    "kind: Application",
    "metadata:",
    "  annotations:",
    `    ${SYNC_WAVE_ANNOTATION}: "${wave}"`,
    `  name: ${name}`,
    "  namespace: argocd",
    "spec:",
    "  destination:",
    `    namespace: ${name}`,
    "    server: https://kubernetes.default.svc",
    "  source:",
    `    chart: ${name}`,
    "    repoURL: https://charts.invalid/fixture",
    "    targetRevision: 1.2.3",
    "    helm:",
    "      values: |-",
    "        resources:",
    "          limits:",
    "            cpu: \"1\"",
    "",
  ].join("\n");
}

function writeFixtureSource(root, templates, fixtureBase, options = {}) {
  write(
    join(root, "generation-receipt.yaml"),
    `${stableJson({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "SourceGenerationReceipt",
      metadata: { name: "fixture" },
      spec: {
        source: {
          name: "Fixture AICR",
          version: "v9.9.9",
          commit: "f".repeat(40),
          repository: "https://registry.invalid/fixture/aicr",
        },
        criteria: { service: "fixture" },
      },
    })}\n`,
  );
  write(
    join(root, "argocd-oci-receipt.yaml"),
    `${stableJson({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "SourceGenerationReceipt",
      metadata: { name: "fixture-argocd" },
      spec: {
        artifacts: {
          literalConfiguration: {
            digest: `sha256:${"4".repeat(64)}`,
            objectCount: Object.keys(templates).length,
            publicTarget: `${fixtureBase}/fixture-argocd-config:9.9.9`,
          },
        },
      },
    })}\n`,
  );
  const checksums = Object.entries(templates)
    .map(([file, text]) => {
      const recorded = options.skipChecksum === file ? text.replace(new RegExp(`${options.drift}$`), "") : text;
      return `${sha256(recorded)}  templates/${file}`;
    })
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
  write(join(root, "argocd-rendered", "checksums.txt"), `${checksums}\n`);
  for (const [file, text] of Object.entries(templates)) {
    write(join(root, "argocd-rendered", "templates", file), text);
  }
  const indexMembers = [];
  for (const [file, text] of Object.entries(templates)) {
    const component = file.replace(/\.yaml$/, "") === "root" ? "fixture-root" : file.replace(/\.yaml$/, "");
    if (options.dropIndexMemberFor === component) continue;
    const recordedSha = options.wrongPayloadShaFor === component ? "0".repeat(64) : sha256(text);
    const payloadPath = `payloads/${component}.json`;
    write(
      join(root, "digest-index", payloadPath),
      `${stableJson({ spec: { renderedFile: { sha256: recordedSha } } })}\n`,
    );
    indexMembers.push({ component, payloadPath, payloadSha256: sha256(`${component}-fixture-payload`) });
  }
  write(
    join(root, "digest-index", "platform-index.json"),
    `${JSON.stringify({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AICRPlatformDigestIndex",
      metadata: { name: "fixture-index" },
      spec: { platformDigest: `sha256:${"5".repeat(64)}`, members: indexMembers },
    }, null, 2)}\n`,
  );
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
