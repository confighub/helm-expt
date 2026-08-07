#!/usr/bin/env node

// Compile the digest-bound platform index for the AICR H100 training example.
//
// This ports the pattern proven by the Kubara importer
// (github.com/confighub/kubara-confighub, scripts/import-kubara-git-revision.mjs):
// one immutable OCI payload per component plus one digest-bound index that pins
// the whole shape. Everything compiles offline from committed bytes. Nothing
// here contacts a registry, a cluster, or ConfigHub, and the index says so:
// planned OCI references are plans, publication is never claimed.
//
// Boundary, stated once and carried into every output: kind and this compiler
// prove config-plane mechanics only. No GPU workload ran to produce or verify
// this index. Workload-plane claims stay absent rather than implied.

import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  check,
  listFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
} from "./lib/proof-common.mjs";

const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";
const exampleRoot = join(repoRoot, "examples", "aicr", "eks-h100-training-kubeflow");

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-aicr-digest-index.mjs --generate
  node scripts/generate-aicr-digest-index.mjs --verify
  node scripts/generate-aicr-digest-index.mjs --self-test`);
  process.exit(2);
}

if (mode === "--generate") {
  const compiled = compile(exampleRoot);
  writeOutputs(exampleRoot, compiled);
  console.log(
    `compiled ${compiled.index.spec.platformDigest} pinning ${compiled.index.spec.members.length} member(s) into ${relativeRepo(join(exampleRoot, "digest-index"))}`,
  );
} else if (mode === "--verify") {
  const compiled = compile(exampleRoot);
  verifyOutputs(exampleRoot, compiled);
  console.log(
    `verified ${compiled.index.spec.platformDigest} against ${compiled.index.spec.members.length} committed member payload(s)`,
  );
} else {
  selfTest();
  console.log("verified the AICR digest-index compiler self-test against fake surfaces");
}

// stableJson serializes with sorted keys at every depth so byte-identical
// digests come from identical content, not from object insertion order.
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

function manifestTransport(root, id, role, manifestFile, expectations) {
  const manifestPath = join(root, manifestFile);
  check(existsSync(manifestPath), `${manifestFile} is missing from the example`);
  const bytes = readFileSync(manifestPath);
  const digest = `sha256:${sha256(bytes)}`;
  const manifest = JSON.parse(bytes.toString("utf8"));
  check(manifest.schemaVersion === 2, `${manifestFile}: expected an OCI schemaVersion 2 manifest`);
  if (expectations.receiptDigest) {
    check(
      digest === expectations.receiptDigest,
      `${manifestFile}: computed digest ${digest} differs from the receipt digest ${expectations.receiptDigest}`,
    );
  }
  if (expectations.layout) {
    const layoutIndexPath = join(root, "oci-layouts", expectations.layout, "index.json");
    check(existsSync(layoutIndexPath), `oci-layouts/${expectations.layout}/index.json is missing`);
    const layoutIndex = JSON.parse(readFileSync(layoutIndexPath, "utf8"));
    const manifests = layoutIndex.manifests ?? [];
    check(manifests.length === 1, `oci-layouts/${expectations.layout}: expected exactly one manifest in the layout index`);
    check(
      manifests[0].digest === digest,
      `oci-layouts/${expectations.layout}: layout digest ${manifests[0].digest} differs from the committed manifest digest ${digest}`,
    );
    check(
      manifests[0].annotations?.["org.opencontainers.image.ref.name"] === expectations.refName,
      `oci-layouts/${expectations.layout}: layout ref name differs from the pinned bundle version ${expectations.refName}`,
    );
  }
  if (expectations.versionAnnotation) {
    check(
      manifest.annotations?.["org.opencontainers.image.version"] === expectations.versionAnnotation,
      `${manifestFile}: manifest version annotation differs from the pinned bundle version ${expectations.versionAnnotation}`,
    );
  }
  return {
    id,
    role,
    manifestPath: manifestFile,
    manifestDigest: digest,
    ociLayout: expectations.layout ? `oci-layouts/${expectations.layout}` : null,
    publicTarget: expectations.publicTarget ?? null,
  };
}

function readRenderedChecksums(root) {
  const checksumsPath = join(root, "argocd-rendered", "checksums.txt");
  check(existsSync(checksumsPath), "argocd-rendered/checksums.txt is missing");
  const rows = new Map();
  for (const line of readFileSync(checksumsPath, "utf8").split("\n").filter(Boolean)) {
    const match = line.match(/^([0-9a-f]{64})  (templates\/[A-Za-z0-9._-]+\.yaml)$/);
    check(match, `argocd-rendered/checksums.txt: unparseable row: ${line}`);
    check(!rows.has(match[2]), `argocd-rendered/checksums.txt: duplicate row for ${match[2]}`);
    rows.set(match[2], match[1]);
  }
  check(rows.size > 0, "argocd-rendered/checksums.txt lists no rendered templates");
  return rows;
}

function memberSource(doc, path, sourcePackageRepository, bundleVersion) {
  const source = doc.spec?.source ?? {};
  const targetRevision = String(source.targetRevision ?? "");
  check(targetRevision, `${path}: Application has no source targetRevision`);
  if (source.chart) {
    return {
      type: "helm-chart",
      chart: String(source.chart),
      repoURL: String(source.repoURL ?? ""),
      targetRevision,
    };
  }
  check(source.path, `${path}: Application source names neither a chart nor a path`);
  check(
    String(source.repoURL) === sourcePackageRepository,
    `${path}: OCI path source repoURL ${source.repoURL} differs from the receipt source package ${sourcePackageRepository}`,
  );
  check(
    targetRevision === bundleVersion,
    `${path}: OCI path source pins ${targetRevision}, not the receipt bundle version ${bundleVersion}`,
  );
  return {
    type: "oci-path",
    path: String(source.path),
    repoURL: String(source.repoURL),
    targetRevision,
  };
}

function compile(root) {
  const exampleName = basename(root);
  const generationReceipt = readYaml(join(root, "generation-receipt.yaml"));
  const source = generationReceipt.spec?.source ?? {};
  check(/^v\d+\.\d+\.\d+$/.test(source.version ?? ""), "generation receipt pins no exact upstream version");
  check(/^[0-9a-f]{40}$/.test(source.commit ?? ""), "generation receipt pins no exact upstream commit");
  check(/^[0-9a-f]{64}$/.test(source.releaseAsset?.sha256 ?? ""), "generation receipt pins no release asset checksum");
  const bundleVersion = source.version.slice(1);
  const criteria = generationReceipt.spec?.criteria ?? {};
  check(Object.keys(criteria).length > 0, "generation receipt records no recipe criteria");

  const ociReceipt = readYaml(join(root, "argocd-oci-receipt.yaml"));
  const literal = ociReceipt.spec?.artifacts?.literalConfiguration ?? {};
  const sourcePackage = ociReceipt.spec?.artifacts?.sourcePackage ?? {};
  check(/^sha256:[0-9a-f]{64}$/.test(literal.digest ?? ""), "OCI receipt pins no literal-configuration digest");
  check(/^sha256:[0-9a-f]{64}$/.test(sourcePackage.portableDigest ?? ""), "OCI receipt pins no source-package digest");
  check(Number.isInteger(literal.objectCount) && literal.objectCount > 0, "OCI receipt records no literal object count");
  const ociBase = parentOciRepository(literal.publicTarget ?? "");
  const sourcePackageRepository = stripOciTag(sourcePackage.publicTarget ?? "");

  const transports = [
    manifestTransport(root, "argocd-config-oci", "literal-configuration", "local-argocd-config-oci-manifest.json", {
      receiptDigest: literal.digest,
      layout: "argocd-config",
      refName: bundleVersion,
      publicTarget: literal.publicTarget,
    }),
    manifestTransport(root, "argocd-source-oci", "source-package", "local-argocd-source-oci-manifest.json", {
      receiptDigest: sourcePackage.portableDigest,
      layout: "argocd-source",
      refName: bundleVersion,
      publicTarget: sourcePackage.publicTarget,
    }),
    manifestTransport(root, "flux-bundle-oci", "flux-bundle", "local-oci-manifest.json", {
      versionAnnotation: bundleVersion,
    }),
  ];

  const checksums = readRenderedChecksums(root);
  const renderedRoot = join(root, "argocd-rendered");
  const renderedFiles = listFiles(renderedRoot)
    .map((path) => relativeRepo(path).slice(`${relativeRepo(renderedRoot)}/`.length))
    .filter((path) => path !== "checksums.txt");
  check(
    stableJson(renderedFiles) === stableJson([...checksums.keys()].sort()),
    "argocd-rendered file inventory differs from argocd-rendered/checksums.txt",
  );

  const members = [];
  for (const [templatePath, expectedSha] of [...checksums.entries()].sort()) {
    const bytes = readFileSync(join(renderedRoot, templatePath));
    check(
      sha256(bytes) === expectedSha,
      `argocd-rendered/${templatePath} differs from argocd-rendered/checksums.txt; the rendered surface drifted`,
    );
    const docs = parseDocs(bytes.toString("utf8"));
    check(docs.length === 1, `argocd-rendered/${templatePath}: expected exactly one document`);
    const doc = docs[0];
    check(
      doc.apiVersion === "argoproj.io/v1alpha1" && doc.kind === "Application",
      `argocd-rendered/${templatePath}: expected exactly one Argo CD Application`,
    );
    const name = doc.metadata?.name ?? "";
    check(name, `argocd-rendered/${templatePath}: Application has no name`);
    const waveAnnotation = doc.metadata?.annotations?.[SYNC_WAVE_ANNOTATION];
    const syncWave = waveAnnotation === undefined ? null : Number(waveAnnotation);
    check(
      syncWave === null || Number.isInteger(syncWave),
      `argocd-rendered/${templatePath}: sync-wave annotation is not an integer`,
    );
    const memberDescriptor = memberSource(doc, `argocd-rendered/${templatePath}`, sourcePackageRepository, bundleVersion);
    const payload = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AICRComponentOCIPayload",
      metadata: { name },
      spec: {
        component: name,
        role: syncWave === null ? "platform-root" : "component-application",
        syncWave,
        application: {
          apiVersion: doc.apiVersion,
          kind: doc.kind,
          namespace: doc.metadata?.namespace ?? "",
          name,
        },
        source: memberDescriptor,
        destinationNamespace: doc.spec?.destination?.namespace ?? "",
        renderedFile: {
          path: `argocd-rendered/${templatePath}`,
          sha256: expectedSha,
          bytes: bytes.length,
        },
        aicrVersion: source.version,
      },
      status: { result: "compiled-offline", liveRegistryPublicationClaimed: false },
    };
    const payloadText = `${stableJson(payload)}\n`;
    const payloadSha256 = sha256(payloadText);
    members.push({
      component: name,
      role: payload.spec.role,
      syncWave,
      payloadSha256,
      payloadPath: `payloads/${name}-${payloadSha256}.json`,
      plannedOCIRef: `${ociBase}/aicr-${exampleName}-components/${name}:payload-${payloadSha256}`,
      payloadText,
    });
  }

  const names = members.map((member) => member.component);
  check(new Set(names).size === names.length, "two rendered Applications share one name");
  const roots = members.filter((member) => member.role === "platform-root");
  check(roots.length === 1, `expected exactly one root Application without a sync-wave, found ${roots.length}`);
  const waves = members
    .filter((member) => member.role === "component-application")
    .map((member) => member.syncWave)
    .sort((left, right) => left - right);
  check(
    stableJson(waves) === stableJson(waves.map((_, index) => index)),
    `component sync-waves are not the contiguous unique range 0..${waves.length - 1}: ${waves.join(", ")}`,
  );
  check(
    members.length === literal.objectCount,
    `rendered Application count ${members.length} differs from the receipt object count ${literal.objectCount}`,
  );

  const platformDigest = `sha256:${sha256(
    stableJson({
      source,
      criteria,
      transports: transports.map(({ id, role, manifestDigest }) => ({ id, role, manifestDigest })),
      members: members.map(({ component, role, syncWave, payloadSha256 }) => ({ component, role, syncWave, payloadSha256 })),
    }),
  )}`;

  const indexName = `aicr-${exampleName}-${source.version.replaceAll(".", "-")}-digest-index`;
  const index = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AICRPlatformDigestIndex",
    metadata: { name: indexName },
    spec: {
      platformDigest,
      source,
      criteria,
      transports,
      members: members.map(({ payloadText, ...row }) => row),
      aggregate: {
        plannedOCIRef: `${ociBase}/aicr-${exampleName}-digest-index:platform-${platformDigest.slice("sha256:".length)}`,
        type: "target-neutral-index-published-only-after-member-manifest-digests-are-observed",
      },
      boundary: {
        configPlaneOnly: true,
        gpuWorkloadsProven: false,
        secretValuesIncluded: false,
        liveRegistryPublicationClaimed: false,
        statement:
          "This index pins config-plane content by digest. No GPU workload ran to produce or verify it; workload-plane claims stay absent rather than implied.",
      },
    },
    status: { result: "compiled-offline", liveRegistryPublicationClaimed: false },
  };

  return { index, indexText: `${JSON.stringify(index, null, 2)}\n`, members };
}

function renderReadme(compiled) {
  const { index } = compiled;
  const components = index.spec.members.filter((member) => member.role === "component-application");
  const root = index.spec.members.find((member) => member.role === "platform-root");
  return `# One digest pins the whole training shape

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
\`npm run aicr-digest-index:generate\` and checked byte-for-byte by
\`npm run aicr-digest-index:verify\`. Do not edit it by hand.

The platform digest is:

\`\`\`
${index.spec.platformDigest}
\`\`\`

That one value pins the exact upstream source (${index.spec.source.name} ${index.spec.source.version},
commit \`${index.spec.source.commit}\`), the recipe criteria, the three committed OCI
transport manifests, and one immutable payload per rendered Argo CD Application:
${components.length} waved components plus the \`${root.component}\` root. Change any rendered byte
anywhere in the shape and the digest changes.

[platform-index.json](./platform-index.json) holds the full index. Each member row
names its payload file under [payloads/](./payloads/) and the OCI reference the
payload would publish to. Those references are plans. Nothing in this directory
claims a registry push; the committed OCI receipts next to this directory carry
the transport evidence that exists today.

This follows the pattern the Kubara importer proved: per-component immutable
payloads plus one digest-bound index, compiled offline from committed bytes.

The boundary, stated plainly: this index proves config-plane mechanics only.
No GPU workload ran to produce or verify it. Workload-plane claims stay absent
rather than implied.
`;
}

function outputRows(compiled) {
  const rows = new Map();
  rows.set("platform-index.json", compiled.indexText);
  rows.set("README.md", renderReadme(compiled));
  for (const member of compiled.members) rows.set(member.payloadPath, member.payloadText);
  const checksums = [...rows.entries()]
    .map(([path, text]) => `${sha256(text)}  ${path}`)
    .sort()
    .join("\n");
  rows.set("checksums.txt", `${checksums}\n`);
  return rows;
}

function writeOutputs(root, compiled) {
  const outputRoot = join(root, "digest-index");
  if (existsSync(outputRoot)) {
    check(!lstatSync(outputRoot).isSymbolicLink(), "digest-index must not be a symbolic link");
    rmSync(outputRoot, { recursive: true });
  }
  for (const [path, text] of outputRows(compiled)) write(join(outputRoot, path), text);
}

function verifyOutputs(root, compiled) {
  const outputRoot = join(root, "digest-index");
  check(existsSync(outputRoot), "digest-index is missing; run npm run aicr-digest-index:generate");
  const rows = outputRows(compiled);
  const committed = listFiles(outputRoot).map((path) =>
    relativeRepo(path).slice(`${relativeRepo(outputRoot)}/`.length),
  );
  check(
    stableJson(committed) === stableJson([...rows.keys()].sort()),
    "digest-index contains stray or missing files; run npm run aicr-digest-index:generate",
  );
  for (const [path, text] of rows) {
    check(
      readFileSync(join(outputRoot, path), "utf8") === text,
      `digest-index/${path} is stale; run npm run aicr-digest-index:generate`,
    );
  }
}

// The self-test compiles fake surfaces only: a fake generation receipt, fake
// OCI receipts and manifests, and a small fake rendered Application set. It
// proves determinism, digest sensitivity, tamper refusal, and structural
// refusals without touching the committed example, a registry, or a cluster.
function selfTest() {
  const FIXTURE_BASE = "oci://registry.invalid/fixture";
  const scratch = mkdtempSync(join(tmpdir(), "aicr-digest-index-self-test-"));
  try {
    const templates = () => ({
      "fixture-stack.yaml": [
        "apiVersion: argoproj.io/v1alpha1",
        "kind: Application",
        "metadata:",
        "  name: fixture-stack",
        "  namespace: argocd",
        "spec:",
        "  destination:",
        "    namespace: argocd",
        "    server: https://kubernetes.default.svc",
        "  source:",
        `    repoURL: ${FIXTURE_BASE}/aicr-fixture-argocd`,
        "    targetRevision: '9.9.9'",
        "    path: .",
        "",
      ].join("\n"),
      "alpha.yaml": fixtureChartApplication("alpha", 0),
      "beta.yaml": [
        "apiVersion: argoproj.io/v1alpha1",
        "kind: Application",
        "metadata:",
        "  annotations:",
        `    ${SYNC_WAVE_ANNOTATION}: "1"`,
        "  name: beta",
        "  namespace: argocd",
        "spec:",
        "  destination:",
        "    namespace: beta",
        "    server: https://kubernetes.default.svc",
        "  source:",
        `    repoURL: ${FIXTURE_BASE}/aicr-fixture-argocd`,
        "    targetRevision: '9.9.9'",
        "    path: 001-beta",
        "",
      ].join("\n"),
      "gamma.yaml": fixtureChartApplication("gamma", 2),
    });

    const buildFixture = (name, mutate) => {
      const root = join(scratch, name);
      const files = templates();
      if (mutate) mutate(files);
      writeFixture(root, files, FIXTURE_BASE);
      return root;
    };

    const baseline = compile(buildFixture("baseline"));
    check(baseline.index.spec.members.length === 4, "self-test did not compile all four fixture members");
    check(
      baseline.index.spec.members.filter((member) => member.role === "platform-root").length === 1
        && baseline.index.spec.members.find((member) => member.role === "platform-root").component === "fixture-stack",
      "self-test did not classify the unwaved fixture root",
    );
    check(
      stableJson(baseline.index.spec.members.filter((m) => m.role === "component-application").map((m) => m.syncWave).sort()) === "[0,1,2]",
      "self-test did not preserve the fixture sync-waves",
    );
    check(/^sha256:[0-9a-f]{64}$/.test(baseline.index.spec.platformDigest), "self-test produced no platform digest");
    check(!baseline.indexText.includes("europe-west1"), "self-test leaked the production OCI origin into a fixture compile");
    check(
      baseline.index.spec.boundary.configPlaneOnly === true && baseline.index.spec.boundary.gpuWorkloadsProven === false,
      "self-test index dropped the config-plane-only boundary");

    const recompiled = compile(join(scratch, "baseline"));
    check(recompiled.indexText === baseline.indexText, "self-test compile is not deterministic");

    writeOutputs(join(scratch, "baseline"), baseline);
    verifyOutputs(join(scratch, "baseline"), baseline);
    write(join(scratch, "baseline", "digest-index", "stray.txt"), "stray\n");
    check(
      fails(() => verifyOutputs(join(scratch, "baseline"), baseline), /stray or missing/),
      "self-test verify accepted a stray file in digest-index",
    );
    rmSync(join(scratch, "baseline", "digest-index", "stray.txt"));
    write(join(scratch, "baseline", "digest-index", "platform-index.json"), "{}\n");
    check(
      fails(() => verifyOutputs(join(scratch, "baseline"), baseline), /platform-index\.json is stale/),
      "self-test verify accepted a tampered platform index",
    );

    const mutated = compile(
      buildFixture("mutated", (files) => {
        files["beta.yaml"] = files["beta.yaml"].replace("namespace: beta", "namespace: beta-mutated");
      }),
    );
    const payloadFor = (compiledSet, component) =>
      compiledSet.index.spec.members.find((member) => member.component === component).payloadSha256;
    check(payloadFor(mutated, "beta") !== payloadFor(baseline, "beta"), "self-test member payload ignored a rendered change");
    check(payloadFor(mutated, "alpha") === payloadFor(baseline, "alpha"), "self-test rendered change bled into an untouched member");
    check(
      mutated.index.spec.platformDigest !== baseline.index.spec.platformDigest,
      "self-test platform digest ignored a rendered change",
    );

    const refusals = [
      ["tampered", (files) => (files["beta.yaml"] += "# drifted\n"), /differs from argocd-rendered\/checksums\.txt/, "an unchecksummed rendered drift", { skipChecksum: true }],
      ["duplicate-name", (files) => (files["gamma.yaml"] = files["gamma.yaml"].replace("name: gamma", "name: alpha")), /share one name/, "a duplicate Application name"],
      ["duplicate-wave", (files) => (files["gamma.yaml"] = files["gamma.yaml"].replace('sync-wave: "2"', 'sync-wave: "1"')), /contiguous unique range/, "a duplicated sync-wave"],
      ["second-root", (files) => {
        files["gamma.yaml"] = files["gamma.yaml"]
          .split("\n")
          .filter((line) => !line.includes("annotations:") && !line.includes("sync-wave"))
          .join("\n");
      }, /exactly one root Application/, "a second unwaved root"],
      ["wrong-revision", (files) => (files["beta.yaml"] = files["beta.yaml"].replace("targetRevision: '9.9.9'", "targetRevision: '8.8.8'")), /not the receipt bundle version/, "an OCI path member off the pinned bundle version"],
    ];
    for (const [name, mutate, pattern, label, options] of refusals) {
      const root = join(scratch, name);
      const files = templates();
      mutate(files);
      writeFixture(root, files, FIXTURE_BASE, options);
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
    "",
  ].join("\n");
}

function writeFixture(root, templateFiles, fixtureBase, options = {}) {
  const configManifest = `${stableJson({
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    annotations: { "org.opencontainers.image.version": "9.9.9", "org.opencontainers.image.title": "fixture config" },
  })}\n`;
  const sourceManifest = `${stableJson({
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    annotations: { "org.opencontainers.image.version": "9.9.9", "org.opencontainers.image.title": "fixture source" },
  })}\n`;
  const fluxManifest = `${stableJson({
    schemaVersion: 2,
    mediaType: "application/vnd.oci.image.manifest.v1+json",
    annotations: { "org.opencontainers.image.version": "9.9.9", "org.opencontainers.image.title": "fixture flux bundle" },
  })}\n`;
  write(join(root, "local-argocd-config-oci-manifest.json"), configManifest);
  write(join(root, "local-argocd-source-oci-manifest.json"), sourceManifest);
  write(join(root, "local-oci-manifest.json"), fluxManifest);
  for (const [layout, manifestText] of [
    ["argocd-config", configManifest],
    ["argocd-source", sourceManifest],
  ]) {
    write(
      join(root, "oci-layouts", layout, "index.json"),
      `${stableJson({
        schemaVersion: 2,
        mediaType: "application/vnd.oci.image.index.v1+json",
        manifests: [
          {
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            digest: `sha256:${sha256(manifestText)}`,
            size: manifestText.length,
            annotations: { "org.opencontainers.image.ref.name": "9.9.9" },
          },
        ],
      })}\n`,
    );
  }
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
          releaseAsset: { name: "fixture.tar.gz", sha256: "1".repeat(64) },
          binarySha256: "2".repeat(64),
        },
        criteria: { service: "fixture", accelerator: "none", intent: "training" },
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
            digest: `sha256:${sha256(configManifest)}`,
            objectCount: Object.keys(templateFiles).length,
            publicTarget: `${fixtureBase}/aicr-fixture-argocd-config:9.9.9`,
          },
          sourcePackage: {
            portableDigest: `sha256:${sha256(sourceManifest)}`,
            rawAicrDigest: `sha256:${"3".repeat(64)}`,
            publicTarget: `${fixtureBase}/aicr-fixture-argocd:9.9.9`,
          },
        },
      },
    })}\n`,
  );
  const checksums = Object.entries(templateFiles)
    .map(([file, text]) => {
      const recorded = options.skipChecksum && file === "beta.yaml" ? text.replace(/# drifted\n$/, "") : text;
      return `${sha256(recorded)}  templates/${file}`;
    })
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
  write(join(root, "argocd-rendered", "checksums.txt"), `${checksums}\n`);
  for (const [file, text] of Object.entries(templateFiles)) {
    write(join(root, "argocd-rendered", "templates", file), text);
  }
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
