#!/usr/bin/env node

// Compile the digest-bound platform index for the KServe NIM inference entry.
//
// The entry retains the Apache-2.0 KServe reference tree from NVIDIA/nim-deploy
// at one exact commit and describes one model profile as data. This compiler
// pins the whole shape the same way the H100 training entry is pinned: one
// immutable payload per component plus one digest-bound index, compiled offline
// from committed bytes. Nothing here contacts a registry, NGC, or a cluster.
//
// License boundary, enforced in code (docs/planning/nim-ngc-license-read.md):
// gated images appear as references only, secret surfaces carry names or
// environment substitutions only, and the compiler refuses to compile if a
// credential value appears in the retained tree.
//
// Proof boundary, stated in every output: config-plane only. No NIM container
// ran, no model was fetched, and no GPU workload claim exists here.

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
  write,
} from "./lib/proof-common.mjs";

const exampleRoot = join(repoRoot, "examples", "aicr", "kserve-nim-inference");

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-aicr-kserve-nim-index.mjs --generate
  node scripts/generate-aicr-kserve-nim-index.mjs --verify
  node scripts/generate-aicr-kserve-nim-index.mjs --self-test`);
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
  console.log("verified the KServe NIM digest-index compiler self-test against fake surfaces");
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

function readUpstreamChecksums(root) {
  const checksumsPath = join(root, "upstream-checksums.txt");
  check(existsSync(checksumsPath), "upstream-checksums.txt is missing");
  const rows = new Map();
  for (const line of readFileSync(checksumsPath, "utf8").split("\n").filter(Boolean)) {
    const match = line.match(/^([0-9a-f]{64})  (\S+)$/);
    check(match, `upstream-checksums.txt: unparseable row: ${line}`);
    check(!rows.has(match[2]), `upstream-checksums.txt: duplicate row for ${match[2]}`);
    rows.set(match[2], match[1]);
  }
  check(rows.size > 0, "upstream-checksums.txt lists no retained files");
  return rows;
}

// refuseEmbeddedCredentials rejects any retained line that assigns a literal
// value to a known credential variable. Empty values and shell or template
// substitutions (values starting with "$") are the upstream-intended shape.
function refuseEmbeddedCredentials(path, text) {
  for (const line of text.split("\n")) {
    const match = line.match(/(NGC_API_KEY|HF_TOKEN)\s*[:=]\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    check(
      value === "" || value.startsWith("$"),
      `${path}: a literal credential value is assigned to ${match[1]}; secret surfaces must carry names or substitutions only`,
    );
  }
}

function parseSingleDoc(root, relativePath, expectedKind) {
  const bytes = readFileSync(join(root, relativePath));
  const docs = parseDocs(bytes.toString("utf8"));
  check(docs.length === 1, `${relativePath}: expected exactly one document`);
  const doc = docs[0];
  check(doc.kind === expectedKind, `${relativePath}: expected kind ${expectedKind}, found ${doc.kind}`);
  const name = doc.metadata?.name ?? "";
  check(name, `${relativePath}: ${expectedKind} has no name`);
  return { doc, name, bytes };
}

function compile(root) {
  const receipt = readYaml(join(root, "retention-receipt.yaml"));
  const source = receipt.spec?.source ?? {};
  check(/^[0-9a-f]{40}$/.test(source.commit ?? ""), "retention receipt pins no exact upstream commit");
  check(source.license === "Apache-2.0", "retention receipt does not record the Apache-2.0 upstream license");
  check(source.subtree === "kserve", "retention receipt does not name the retained kserve subtree");
  const plannedOCIBase = String(receipt.spec?.destination?.plannedOCIBase ?? "");
  check(plannedOCIBase.startsWith("oci://"), "retention receipt names no planned OCI base");
  const boundary = receipt.spec?.boundary ?? {};
  for (const [key, expected] of [
    ["configPlaneOnly", true],
    ["gpuWorkloadsProven", false],
    ["nimContainersRan", false],
    ["modelsFetched", false],
    ["ngcContacted", false],
    ["secretValuesIncluded", false],
  ]) {
    check(boundary[key] === expected, `retention receipt boundary.${key} must be ${expected}`);
  }

  const checksums = readUpstreamChecksums(root);
  const upstreamRoot = join(root, "upstream");
  const retainedFiles = listFiles(upstreamRoot).map((path) =>
    relativeRepo(path).slice(`${relativeRepo(upstreamRoot)}/`.length),
  );
  check(
    stableJson(retainedFiles) === stableJson([...checksums.keys()].sort()),
    "upstream file inventory differs from upstream-checksums.txt",
  );
  for (const [path, expectedSha] of checksums) {
    const bytes = readFileSync(join(upstreamRoot, path));
    check(
      sha256(bytes) === expectedSha,
      `upstream/${path} differs from upstream-checksums.txt; the retained tree drifted`,
    );
    refuseEmbeddedCredentials(`upstream/${path}`, bytes.toString("utf8"));
  }
  check(
    readFileSync(join(upstreamRoot, "LICENSE"), "utf8").includes("Apache License"),
    "upstream/LICENSE does not carry the Apache License text",
  );

  const runtimeFiles = [...checksums.keys()]
    .filter((path) => path.startsWith("kserve/runtimes/") && path.endsWith(".yaml"))
    .sort();
  const shapeFiles = [...checksums.keys()]
    .filter((path) => path.startsWith("kserve/nim-models/") && path.endsWith(".yaml"))
    .sort();
  check(runtimeFiles.length > 0, "no ClusterServingRuntime files are retained");
  check(shapeFiles.length > 0, "no InferenceService files are retained");

  const members = [];
  const runtimesByName = new Map();
  for (const path of runtimeFiles) {
    const { doc, name, bytes } = parseSingleDoc(upstreamRoot, path, "ClusterServingRuntime");
    const images = (doc.spec?.containers ?? []).map((container) => String(container.image ?? "")).filter(Boolean);
    check(images.length > 0, `upstream/${path}: ClusterServingRuntime names no container image`);
    check(!runtimesByName.has(name), `two retained ClusterServingRuntimes share the name ${name}`);
    runtimesByName.set(name, { images });
    members.push({
      component: name,
      role: "serving-runtime",
      sourceFile: `upstream/${path}`,
      sha256: checksums.get(path),
      bytes: bytes.length,
      detail: { images },
    });
  }
  const shapesByName = new Map();
  for (const path of shapeFiles) {
    const { doc, name, bytes } = parseSingleDoc(upstreamRoot, path, "InferenceService");
    const runtimeRef = String(doc.spec?.predictor?.model?.runtime ?? "");
    check(runtimeRef, `upstream/${path}: InferenceService names no serving runtime`);
    check(
      runtimesByName.has(runtimeRef),
      `upstream/${path}: InferenceService references the runtime ${runtimeRef}, which is not retained`,
    );
    const gpuLimit = doc.spec?.predictor?.model?.resources?.limits?.["nvidia.com/gpu"];
    check(!shapesByName.has(name), `two retained InferenceServices share the name ${name}`);
    shapesByName.set(name, { runtimeRef, sourceFile: `upstream/${path}` });
    members.push({
      component: name,
      role: "model-shape",
      sourceFile: `upstream/${path}`,
      sha256: checksums.get(path),
      bytes: bytes.length,
      detail: {
        servingRuntime: runtimeRef,
        gpuCount: gpuLimit === undefined ? null : Number(gpuLimit),
        storageUri: String(doc.spec?.predictor?.model?.storageUri ?? ""),
      },
    });
  }

  const profilePath = join(root, "profile", "model-profile.yaml");
  const profile = readYaml(profilePath);
  const profileBytes = readFileSync(profilePath);
  const profileSpec = profile.spec ?? {};
  const profileName = profile.metadata?.name ?? "";
  check(profileName, "model profile has no name");
  const shape = shapesByName.get(profileSpec.modelShape);
  check(shape, `model profile names the shape ${profileSpec.modelShape}, which is not retained`);
  check(
    profileSpec.modelShapeFile === shape.sourceFile,
    "model profile names a shape file that differs from the retained shape",
  );
  check(
    profileSpec.servingRuntime === shape.runtimeRef,
    `model profile names the runtime ${profileSpec.servingRuntime}, but the shape uses ${shape.runtimeRef}`,
  );
  const runtime = runtimesByName.get(shape.runtimeRef);
  check(
    runtime.images.includes(profileSpec.image),
    `model profile records the image ${profileSpec.image}, which the runtime does not name`,
  );
  check(profile.status?.imagePulled === false && profile.status?.modelFetched === false,
    "model profile must record that no image was pulled and no model was fetched");
  members.push({
    component: profileName,
    role: "model-profile",
    sourceFile: "profile/model-profile.yaml",
    sha256: sha256(profileBytes),
    bytes: profileBytes.length,
    detail: {
      modelShape: profileSpec.modelShape,
      servingRuntime: profileSpec.servingRuntime,
      image: profileSpec.image,
    },
  });

  const memberFiles = new Set(members.map((member) => member.sourceFile.replace(/^upstream\//, "")));
  const supportFiles = [...checksums.keys()]
    .filter((path) => !memberFiles.has(path))
    .sort()
    .map((path) => ({ path: `upstream/${path}`, sha256: checksums.get(path) }));

  const compiledMembers = members
    .sort((left, right) => `${left.role}:${left.component}`.localeCompare(`${right.role}:${right.component}`))
    .map((member) => {
      const payload = {
        apiVersion: "catalog.confighub.com/v1alpha1",
        kind: "KServeNIMComponentPayload",
        metadata: { name: member.component },
        spec: {
          component: member.component,
          role: member.role,
          sourceFile: { path: member.sourceFile, sha256: member.sha256, bytes: member.bytes },
          upstream: { repository: source.repository, commit: source.commit },
          ...member.detail,
        },
        status: { result: "compiled-offline", liveRegistryPublicationClaimed: false },
      };
      const payloadText = `${stableJson(payload)}\n`;
      const payloadSha256 = sha256(payloadText);
      return {
        component: member.component,
        role: member.role,
        sourceFile: member.sourceFile,
        payloadSha256,
        payloadPath: `payloads/${member.component}-${payloadSha256}.json`,
        plannedOCIRef: `${plannedOCIBase}/aicr-kserve-nim-inference-components/${member.component}:payload-${payloadSha256}`,
        payloadText,
      };
    });

  const gatedImageReferences = [...runtimesByName.entries()]
    .flatMap(([name, row]) => row.images.map((image) => ({ servingRuntime: name, image, registry: image.split("/")[0] })))
    .sort((left, right) => `${left.servingRuntime}|${left.image}`.localeCompare(`${right.servingRuntime}|${right.image}`));

  const platformDigest = `sha256:${sha256(
    stableJson({
      source,
      members: compiledMembers.map(({ component, role, payloadSha256 }) => ({ component, role, payloadSha256 })),
      supportFiles,
    }),
  )}`;

  const index = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AICRPlatformDigestIndex",
    metadata: { name: `aicr-kserve-nim-inference-${source.commit.slice(0, 8)}-digest-index` },
    spec: {
      platformDigest,
      source,
      members: compiledMembers.map(({ payloadText, ...row }) => row),
      supportFiles,
      gatedImageReferences,
      aggregate: {
        plannedOCIRef: `${plannedOCIBase}/aicr-kserve-nim-inference-digest-index:platform-${platformDigest.slice("sha256:".length)}`,
        type: "target-neutral-index-published-only-after-member-manifest-digests-are-observed",
      },
      boundary: {
        ...boundary,
        statement:
          "This index pins retained configuration by digest. Gated images appear as references only; no NIM container ran, no model was fetched, and no NGC surface was contacted to produce or verify it.",
      },
    },
    status: { result: "compiled-offline", liveRegistryPublicationClaimed: false },
  };

  return { index, indexText: `${JSON.stringify(index, null, 2)}\n`, members: compiledMembers };
}

function renderReadme(compiled) {
  const { index } = compiled;
  const count = (role) => index.spec.members.filter((member) => member.role === role).length;
  return `# One digest pins the retained inference shape

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
\`npm run aicr-kserve-nim:generate\` and checked byte-for-byte by
\`npm run aicr-kserve-nim:verify\`. Do not edit it by hand.

The platform digest is:

\`\`\`
${index.spec.platformDigest}
\`\`\`

That one value pins the retained upstream tree (NVIDIA nim-deploy, commit
\`${index.spec.source.commit}\`, Apache-2.0), meaning ${count("serving-runtime")} serving
runtimes, ${count("model-shape")} model shapes, and ${count("model-profile")} described model profile,
plus every support file by checksum. Change any retained byte and the digest
changes.

[platform-index.json](./platform-index.json) holds the full index. The gated
image references it lists are configuration data: the images live behind NGC
and are pulled only by a user's cluster with the user's own key and
entitlement. Nothing in this directory claims a registry push.

The boundary, stated plainly: this index proves config-plane retention only.
No NIM container ran, no model was fetched, no NGC surface was contacted, and
no GPU workload claim exists here.
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
  check(existsSync(outputRoot), "digest-index is missing; run npm run aicr-kserve-nim:generate");
  const rows = outputRows(compiled);
  const committed = listFiles(outputRoot).map((path) =>
    relativeRepo(path).slice(`${relativeRepo(outputRoot)}/`.length),
  );
  check(
    stableJson(committed) === stableJson([...rows.keys()].sort()),
    "digest-index contains stray or missing files; run npm run aicr-kserve-nim:generate",
  );
  for (const [path, text] of rows) {
    check(
      readFileSync(join(outputRoot, path), "utf8") === text,
      `digest-index/${path} is stale; run npm run aicr-kserve-nim:generate`,
    );
  }
}

// The self-test compiles fake surfaces only: a fake retained tree, a fake
// retention receipt, and a fake model profile. It proves determinism, digest
// sensitivity, tamper refusal, the runtime cross-reference refusal, the
// embedded-credential refusal, and profile-consistency refusals, without
// touching the committed entry, a registry, or NGC.
function selfTest() {
  const FIXTURE_BASE = "oci://registry.invalid/fixture";
  const scratch = mkdtempSync(join(tmpdir(), "aicr-kserve-nim-self-test-"));
  try {
    const files = () => ({
      "kserve/runtimes/alpha.yaml": fixtureRuntime("fixture-runtime-alpha", "nvcr.io/nim/fixture/alpha:1.0.0"),
      "kserve/runtimes/beta.yaml": fixtureRuntime("fixture-runtime-beta", "nvcr.io/nim/fixture/beta:1.0.0"),
      "kserve/nim-models/alpha-1xgpu.yaml": fixtureShape("fixture-alpha-1xgpu", "fixture-runtime-alpha", 1),
      "kserve/nim-models/beta-2xgpu.yaml": fixtureShape("fixture-beta-2xgpu", "fixture-runtime-beta", 2),
      "kserve/scripts/secrets.env": "export NGC_API_KEY=${NGC_API_KEY:-}\nexport HF_TOKEN=${HF_TOKEN:-}\n",
      "kserve/README.md": "# Fixture tree\n",
    });

    const buildFixture = (name, mutateFiles, mutateProfile) => {
      const root = join(scratch, name);
      const tree = files();
      if (mutateFiles) mutateFiles(tree);
      writeFixture(root, tree, FIXTURE_BASE, mutateProfile);
      return root;
    };

    const baseline = compile(buildFixture("baseline"));
    check(baseline.index.spec.members.length === 5, "self-test did not compile all five fixture members");
    check(
      baseline.index.spec.members.filter((m) => m.role === "serving-runtime").length === 2
        && baseline.index.spec.members.filter((m) => m.role === "model-shape").length === 2
        && baseline.index.spec.members.filter((m) => m.role === "model-profile").length === 1,
      "self-test did not classify the fixture roles",
    );
    check(
      baseline.index.spec.gatedImageReferences.every((row) => row.registry === "nvcr.io"),
      "self-test did not classify the gated image registries",
    );
    check(/^sha256:[0-9a-f]{64}$/.test(baseline.index.spec.platformDigest), "self-test produced no platform digest");
    check(!baseline.indexText.includes("europe-west1"), "self-test leaked the production OCI origin into a fixture compile");

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
      buildFixture("mutated", (tree) => {
        tree["kserve/nim-models/beta-2xgpu.yaml"] = tree["kserve/nim-models/beta-2xgpu.yaml"].replace(
          "minReplicas: 1",
          "minReplicas: 2",
        );
      }),
    );
    const payloadFor = (compiledSet, component) =>
      compiledSet.index.spec.members.find((member) => member.component === component).payloadSha256;
    check(
      payloadFor(mutated, "fixture-beta-2xgpu") !== payloadFor(baseline, "fixture-beta-2xgpu"),
      "self-test member payload ignored a retained change",
    );
    check(
      payloadFor(mutated, "fixture-alpha-1xgpu") === payloadFor(baseline, "fixture-alpha-1xgpu"),
      "self-test retained change bled into an untouched member",
    );
    check(
      mutated.index.spec.platformDigest !== baseline.index.spec.platformDigest,
      "self-test platform digest ignored a retained change",
    );

    const refusals = [
      ["tampered", (tree) => (tree["kserve/README.md"] += "drifted\n"), null, /differs from upstream-checksums\.txt/, "an unchecksummed retained drift", { skipChecksum: "kserve/README.md", drift: "drifted\n" }],
      ["missing-runtime", (tree) => {
        tree["kserve/nim-models/beta-2xgpu.yaml"] = tree["kserve/nim-models/beta-2xgpu.yaml"].replace(
          "runtime: fixture-runtime-beta",
          "runtime: fixture-runtime-gone",
        );
      }, null, /which is not retained/, "a model shape referencing a missing runtime"],
      ["duplicate-name", (tree) => {
        tree["kserve/runtimes/beta.yaml"] = tree["kserve/runtimes/beta.yaml"].replace(
          "name: fixture-runtime-beta",
          "name: fixture-runtime-alpha",
        );
      }, null, /share the name/, "two runtimes sharing one name"],
      ["embedded-credential", (tree) => {
        tree["kserve/scripts/secrets.env"] = "export NGC_API_KEY=abcd1234efgh\n";
      }, null, /literal credential value/, "an embedded credential value"],
      ["profile-image-mismatch", null, (profile) => profile.replace(
        "nvcr.io/nim/fixture/alpha:1.0.0",
        "nvcr.io/nim/fixture/other:9.9.9",
      ), /which the runtime does not name/, "a profile whose image the runtime does not name"],
      ["profile-wrong-runtime", null, (profile) => profile.replace(
        '"servingRuntime":"fixture-runtime-alpha"',
        '"servingRuntime":"fixture-runtime-beta"',
      ), /but the shape uses/, "a profile naming the wrong runtime"],
    ];
    for (const [name, mutateFiles, mutateProfile, pattern, label, options] of refusals) {
      const root = join(scratch, name);
      const tree = files();
      if (mutateFiles) mutateFiles(tree);
      writeFixture(root, tree, FIXTURE_BASE, mutateProfile, options);
      check(fails(() => compile(root), pattern), `self-test accepted ${label}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function fixtureRuntime(name, image) {
  return [
    "apiVersion: serving.kserve.io/v1alpha1",
    "kind: ClusterServingRuntime",
    "metadata:",
    `  name: ${name}`,
    "spec:",
    "  containers:",
    "  - env:",
    "    - name: NGC_API_KEY",
    "      valueFrom:",
    "        secretKeyRef:",
    "          name: nvidia-nim-secrets",
    "          key: NGC_API_KEY",
    `    image: ${image}`,
    "    name: kserve-container",
    "",
  ].join("\n");
}

function fixtureShape(name, runtime, gpuCount) {
  return [
    "apiVersion: serving.kserve.io/v1beta1",
    "kind: InferenceService",
    "metadata:",
    `  name: ${name}`,
    "spec:",
    "  predictor:",
    "    minReplicas: 1",
    "    model:",
    "      modelFormat:",
    `        name: fixture-${name}`,
    "      resources:",
    "        limits:",
    `          nvidia.com/gpu: "${gpuCount}"`,
    `      runtime: ${runtime}`,
    "      storageUri: pvc://fixture-pvc/",
    "",
  ].join("\n");
}

function writeFixture(root, tree, fixtureBase, mutateProfile, options = {}) {
  const license = "Apache License\nVersion 2.0, January 2004\nFixture copy for the self-test.\n";
  write(join(root, "upstream", "LICENSE"), license);
  for (const [path, text] of Object.entries(tree)) {
    write(join(root, "upstream", path), text);
  }
  const allFiles = { LICENSE: license, ...Object.fromEntries(Object.entries(tree).map(([path, text]) => [path, text])) };
  const checksums = Object.entries(allFiles)
    .map(([path, text]) => {
      const recorded = options.skipChecksum === path ? text.replace(new RegExp(`${options.drift}$`), "") : text;
      return `${sha256(recorded)}  ${path}`;
    })
    .sort((left, right) => left.localeCompare(right))
    .join("\n");
  write(join(root, "upstream-checksums.txt"), `${checksums}\n`);
  write(
    join(root, "retention-receipt.yaml"),
    `${stableJson({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "SourceRetentionReceipt",
      metadata: { name: "fixture-retention" },
      spec: {
        source: {
          name: "Fixture nim-deploy KServe path",
          repository: "https://registry.invalid/fixture/nim-deploy",
          commit: "f".repeat(40),
          subtree: "kserve",
          license: "Apache-2.0",
          retrievedAt: "1970-01-01",
        },
        destination: { plannedOCIBase: fixtureBase },
        boundary: {
          configPlaneOnly: true,
          gpuWorkloadsProven: false,
          nimContainersRan: false,
          modelsFetched: false,
          ngcContacted: false,
          secretValuesIncluded: false,
        },
      },
      status: { result: "retained-offline", liveRegistryPublicationClaimed: false },
    })}\n`,
  );
  let profile = `${stableJson({
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "NIMModelProfileRecord",
    metadata: { name: "fixture-alpha-profile" },
    spec: {
      modelShape: "fixture-alpha-1xgpu",
      modelShapeFile: "upstream/kserve/nim-models/alpha-1xgpu.yaml",
      servingRuntime: "fixture-runtime-alpha",
      servingRuntimeFile: "upstream/kserve/runtimes/alpha.yaml",
      image: "nvcr.io/nim/fixture/alpha:1.0.0",
      gpuCount: 1,
      storageUri: "pvc://fixture-pvc/",
    },
    status: { result: "described-offline", imagePulled: false, modelFetched: false },
  })}\n`;
  if (mutateProfile) profile = mutateProfile(profile);
  write(join(root, "profile", "model-profile.yaml"), profile);
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
