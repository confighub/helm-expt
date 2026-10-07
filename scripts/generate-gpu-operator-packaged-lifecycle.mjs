#!/usr/bin/env node

// Packages the Helm hook objects of the reviewed gpu-operator and
// k8s-nim-operator chart versions as recorded lifecycle actions. --chart selects
// the chart and defaults to gpu-operator.
//
// A base holds the ordinary objects the chart renders. The same
// values also render hook-annotated objects that Helm runs at upgrade and delete
// time. They cannot be flattened into the base: applied as ordinary objects they
// would run at install time. This generator extracts them, per base and per hook
// phase, from the exact locked chart archive, and writes beside them a
// lifecycle-actions.yaml that says when each one applies. Nothing here runs a
// hook, and nothing marks a hook as observed.
//
//   node scripts/generate-gpu-operator-packaged-lifecycle.mjs --generate [--chart <chart>] --version <version>
//   node scripts/generate-gpu-operator-packaged-lifecycle.mjs --verify [--chart <chart>] [--version <version>]
//
// --generate downloads the archive named in scripts/lib/nvidia-gpu-stack-coverage.mjs,
// checks its SHA-256 and renders it with the pinned Helm build. --verify reads
// committed files only: no network, no cluster, no wall clock.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  canonicalObjectMaps,
  check,
  identityFor,
  listFiles,
  normalizeYaml,
  parseDocs,
  readYaml,
  repoRoot,
  sha256,
  sha256File,
  toYaml,
  write,
} from "./lib/proof-common.mjs";
import { gpuOperatorLifecycleProfile } from "./lib/gpu-operator-bases.mjs";
import { nimOperatorLifecycleProfile } from "./lib/k8s-nim-operator-bases.mjs";
import { nvidiaGpuStackAddition } from "./lib/nvidia-gpu-stack-coverage.mjs";

const args = process.argv.slice(2);
const mode = args.find((arg) => ["--generate", "--verify"].includes(arg));
const versionIndex = args.indexOf("--version");
const requestedVersion = versionIndex === -1 ? "" : args[versionIndex + 1];
const chartIndex = args.indexOf("--chart");
const requestedChart = chartIndex === -1 ? "gpu-operator" : args[chartIndex + 1];
const profiles = Object.fromEntries([gpuOperatorLifecycleProfile, nimOperatorLifecycleProfile].map((item) => [item.chartName, item]));
const profile = profiles[requestedChart];
if (!mode || !profile || (versionIndex !== -1 && (!requestedVersion || requestedVersion.startsWith("--")))) {
  console.error(`Usage:
  node scripts/generate-gpu-operator-packaged-lifecycle.mjs --generate [--chart ${Object.keys(profiles).join("|")}] --version <version>
  node scripts/generate-gpu-operator-packaged-lifecycle.mjs --verify [--chart ${Object.keys(profiles).join("|")}] [--version <version>]`);
  process.exit(2);
}
const chartName = profile.chartName;
const chartFlag = chartName === "gpu-operator" ? "" : ` --chart ${chartName}`;
check(mode === "--verify" || requestedVersion, "--generate requires --version");
const versions = requestedVersion ? [requestedVersion] : profile.reviewedVersions;
for (const version of versions) {
  check(profile.reviewedVersions.includes(version), `unsupported ${chartName} lifecycle version ${version}`);
  if (mode === "--generate") generate(version);
  // Straight after --generate the package has not been rebuilt yet, so the
  // package copy is checked only by --verify.
  verify(version, { checkPackage: mode === "--verify" });
}
console.log(
  `${mode === "--generate" ? "generated and verified" : "verified"} packaged ${chartName} lifecycle files for ${versions.join(", ")}`,
);

function extrasRoot(version) {
  return join(repoRoot, profile.extrasRoot, version);
}

function recipeRoot(version) {
  return join(repoRoot, "recipes", "nvidia", chartName, version);
}

function packageRoot(version) {
  return join(repoRoot, "packages", "nvidia", chartName, version);
}

// What each hook phase means for a delivery workflow that applies rendered
// objects instead of running Helm. The chart's profile supplies the wording.
function actionFor(phase, base) {
  return {
    automatic: false,
    evidenceState: "not-run",
    helmHook: phase,
    invokedBy: "delivery-workflow",
    phase,
    ...profile.actionFor(phase, base),
    source: `${profile.lifecycleRoot}/${base.name}/${phase}.yaml`,
  };
}

function lifecycleActions(version) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "PackagedLifecycleActions",
    metadata: { name: `nvidia-${chartName}-${version.replaceAll(".", "-")}` },
    spec: {
      bases: profile.bases(version).map((base) => ({
        actions: [
          {
            automatic: false,
            evidenceState: "not-run",
            invokedBy: "packaged-requirement",
            phase: "pre-apply",
            ...profile.preApply(base),
            source: profile.crdBundlePath(base.name),
          },
          ...Object.keys(base.expected.hooks).map((phase) => actionFor(phase, base)),
        ],
        name: base.name,
      })),
      chart: `nvidia/${chartName}`,
      namespace: profile.chart.namespace,
      version,
    },
  };
}

function readme(version) {
  const bases = profile.bases(version);
  const lines = bases.map((base) => {
    const phases = Object.entries(base.expected.hooks)
      .map(([phase, count]) => `\`${base.name}/${phase}.yaml\` (${count} ${count === 1 ? "object" : "objects"})`)
      .join(", ");
    return `- \`${base.name}\`: ${phases}.`;
  });
  return `# ${profile.title} lifecycle actions

> **Not run on a cluster.** These files were extracted from the locked chart archive. No hook here has been run, and the package has not been published.

${profile.readmeIntro}

${lines.join("\n")}

\`lifecycle-actions.yaml\` records, for each base, when each set applies and what
it does. \`generation-receipt.yaml\` binds every file to the chart archive it was
rendered from, by SHA-256, and lists the object identities in each file.

Every action is marked \`automatic: false\`. ConfigHub does not run them. A
person or a delivery workflow decides whether to run each one, and records the
result. The Job images are the tags the chart renders; they are not pinned by
digest here.

These files come from \`nvidia/${chartName}@${version}\`. Regenerate them with
\`node scripts/generate-gpu-operator-packaged-lifecycle.mjs --generate${chartFlag} --version ${version}\`.
`;
}

function splitDocuments(text) {
  return text
    .split(/^---[ \t]*$/m)
    .map((chunk) => chunk.replace(/^\n+/, ""))
    .filter((chunk) => chunk.split("\n").some((line) => line.trim() && !line.trim().startsWith("#")));
}

function generate(version) {
  const addition = nvidiaGpuStackAddition(chartName, version);
  check(Boolean(addition), `${chartName} ${version} is not in the NVIDIA GPU stack coverage list`);
  const tempRoot = mkdtempSync(join(tmpdir(), `${chartName}-lifecycle-`));
  try {
    const archive = join(tempRoot, `${chartName}-${version}.tgz`);
    execFileSync("curl", ["--fail", "--location", "--retry", "3", "--silent", "--show-error", "--output", archive, addition.url], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "inherit"],
    });
    check(sha256File(archive) === addition.sha256, `chart artifact SHA mismatch for nvidia/${chartName}@${version}`);

    const root = extrasRoot(version);
    rmSync(root, { recursive: true, force: true });
    const receiptBases = [];
    for (const base of profile.bases(version)) {
      const helmArgs = [
        "template",
        profile.chart.releaseName,
        archive,
        "--namespace",
        profile.chart.namespace,
        "--kube-version",
        profile.chart.kubeVersion,
        "--include-crds",
        "--skip-tests",
      ];
      if (base.valuesText) {
        const valuesPath = join(tempRoot, `values-${base.name}.yaml`);
        writeFileSync(valuesPath, base.valuesText);
        helmArgs.push("--values", valuesPath);
      }
      const rendered = execFileSync("helm", helmArgs, { cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 200 });
      const byPhase = new Map();
      const ordinary = [];
      for (const chunk of splitDocuments(rendered)) {
        const [doc] = parseDocs(chunk);
        check(Boolean(doc), `${chartName} ${version} ${base.name} rendered a document that is not an object`);
        const phase = doc.metadata?.annotations?.["helm.sh/hook"];
        if (phase) {
          if (!byPhase.has(phase)) byPhase.set(phase, []);
          byPhase.get(phase).push({ chunk, doc });
        } else {
          ordinary.push(chunk);
        }
      }
      check(
        ordinary.length === base.expected.objects,
        `${chartName} ${version} ${base.name} rendered ${ordinary.length} ordinary objects; reviewed count is ${base.expected.objects}`,
      );
      check(
        JSON.stringify([...byPhase.keys()].sort()) === JSON.stringify(Object.keys(base.expected.hooks).sort()),
        `${chartName} ${version} ${base.name} hook phases changed: ${[...byPhase.keys()].sort().join(", ")}`,
      );
      const files = [];
      const images = new Set();
      for (const phase of Object.keys(base.expected.hooks)) {
        const entries = byPhase.get(phase);
        check(
          entries.length === base.expected.hooks[phase],
          `${chartName} ${version} ${base.name} rendered ${entries.length} ${phase} hook objects; reviewed count is ${base.expected.hooks[phase]}`,
        );
        const path = join(root, base.name, `${phase}.yaml`);
        write(path, normalizeYaml(entries.map((entry) => `---\n${entry.chunk.replace(/\n*$/, "\n")}`).join("")));
        for (const { doc } of entries) {
          for (const container of doc.spec?.template?.spec?.containers ?? []) images.add(container.image);
        }
        files.push({
          phase,
          path: `${base.name}/${phase}.yaml`,
          sha256: sha256File(path),
          objects: entries.map(({ doc }) => identityFor(doc)).sort(),
        });
      }
      receiptBases.push({
        name: base.name,
        valuesSHA256: base.valuesText ? sha256(base.valuesText) : null,
        totalChartObjects: ordinary.length + base.hookObjectCount,
        ordinaryObjects: ordinary.length,
        hookObjects: base.hookObjectCount,
        hookJobs: files.reduce((sum, file) => sum + file.objects.filter((identity) => identity.startsWith("batch/v1|Job|")).length, 0),
        jobImages: [...images].sort(),
        jobImagesPinnedByDigest: false,
        files,
      });
    }
    write(join(root, "lifecycle-actions.yaml"), `${toYaml(lifecycleActions(version))}\n`);
    write(join(root, "README.md"), readme(version));
    write(
      join(root, "generation-receipt.yaml"),
      `${toYaml({
        apiVersion: "helm-expt.confighub.com/v1alpha1",
        kind: "PackagedLifecycleGenerationReceipt",
        metadata: { name: `nvidia-${chartName}-${version.replaceAll(".", "-")}` },
        spec: {
          chart: `nvidia/${chartName}`,
          version,
          sourceLock: `recipes/nvidia/${chartName}/${version}/source-lock.yaml`,
          chartArtifactURL: addition.url,
          chartPackageSha256: addition.sha256,
          renderer: {
            name: "helm",
            version: execFileSync("helm", ["version", "--short"], { encoding: "utf8" }).trim(),
            kubeVersion: profile.chart.kubeVersion,
            flags: ["--include-crds", "--skip-tests"],
          },
          evidenceState: "rendered-not-run",
          bases: receiptBases,
        },
      })}\n`,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verify(version, { checkPackage }) {
  const root = extrasRoot(version);
  const rel = (path) => relative(repoRoot, path);
  check(existsSync(root), `${rel(root)} is missing; run --generate${chartFlag} --version ${version}`);
  const addition = nvidiaGpuStackAddition(chartName, version);
  check(Boolean(addition), `${chartName} ${version} is not in the NVIDIA GPU stack coverage list`);
  const receipt = readYaml(join(root, "generation-receipt.yaml"));
  check(receipt.kind === "PackagedLifecycleGenerationReceipt", `${rel(root)}/generation-receipt.yaml kind mismatch`);
  check(receipt.spec?.chartPackageSha256 === addition.sha256, `${version} lifecycle receipt does not bind the locked chart archive`);
  check(receipt.spec?.evidenceState === "rendered-not-run", `${version} lifecycle receipt must stay rendered-not-run until a live receipt exists`);
  const sourceLockPath = join(repoRoot, receipt.spec.sourceLock);
  if (existsSync(sourceLockPath)) {
    check(
      readYaml(sourceLockPath).spec?.packageSHA256 === addition.sha256,
      `${receipt.spec.sourceLock} does not match the lifecycle receipt archive`,
    );
  }

  const expectedFiles = new Set(["README.md", "generation-receipt.yaml", "lifecycle-actions.yaml"]);
  const bases = profile.bases(version);
  check((receipt.spec.bases ?? []).length === bases.length, `${version} lifecycle receipt base count mismatch`);
  for (const base of bases) {
    const row = receipt.spec.bases.find((item) => item.name === base.name);
    check(Boolean(row), `${version} lifecycle receipt is missing base ${base.name}`);
    check(row.ordinaryObjects === base.expected.objects, `${version} ${base.name} ordinary object count mismatch`);
    check(row.hookObjects === base.hookObjectCount, `${version} ${base.name} hook object count mismatch`);
    check(row.totalChartObjects === base.expected.objects + base.hookObjectCount, `${version} ${base.name} total object count mismatch`);
    check(row.jobImagesPinnedByDigest === false, `${version} ${base.name} must not claim digest-pinned Job images`);
    check(
      (row.valuesSHA256 ?? null) === (base.valuesText ? sha256(base.valuesText) : null),
      `${version} ${base.name} lifecycle files were rendered from different values`,
    );
    check(
      JSON.stringify((row.files ?? []).map((file) => file.phase)) === JSON.stringify(Object.keys(base.expected.hooks)),
      `${version} ${base.name} hook phase list mismatch`,
    );
    const hookIdentities = [];
    let jobs = 0;
    for (const file of row.files) {
      expectedFiles.add(file.path);
      const path = join(root, file.path);
      check(existsSync(path), `${rel(path)} is missing`);
      check(sha256File(path) === file.sha256, `${rel(path)} does not match its generation receipt`);
      const docs = parseDocs(readFileSync(path, "utf8"));
      check(docs.length === base.expected.hooks[file.phase], `${rel(path)} must hold ${base.expected.hooks[file.phase]} object(s)`);
      check(
        docs.every((doc) => doc.metadata?.annotations?.["helm.sh/hook"] === file.phase),
        `${rel(path)} must hold only ${file.phase} hook objects`,
      );
      const identities = docs.map((doc) => identityFor(doc)).sort();
      check(JSON.stringify(identities) === JSON.stringify(file.objects), `${rel(path)} object identities do not match its generation receipt`);
      hookIdentities.push(...identities);
      jobs += docs.filter((doc) => doc.kind === "Job").length;
    }
    check(row.hookJobs === jobs, `${version} ${base.name} hook Job count mismatch`);
    const releasePath = join(recipeRoot(version), "revisions", base.name, "r001", "rendered", "release-objects.yaml");
    if (existsSync(releasePath)) {
      const baseIdentities = new Set(parseDocs(readFileSync(releasePath, "utf8")).map((doc) => identityFor(doc)));
      check(baseIdentities.size === base.expected.objects, `${rel(releasePath)} object count mismatch`);
      check(
        !hookIdentities.some((identity) => baseIdentities.has(identity)),
        `${version} ${base.name} hook objects must not also be in the base`,
      );
    }
  }

  const expectedActions = `${toYaml(lifecycleActions(version))}\n`;
  check(
    readFileSync(join(root, "lifecycle-actions.yaml"), "utf8") === expectedActions,
    `${rel(root)}/lifecycle-actions.yaml is stale; run --generate${chartFlag} --version ${version}`,
  );
  check(readFileSync(join(root, "README.md"), "utf8") === readme(version), `${rel(root)}/README.md is stale; run --generate${chartFlag} --version ${version}`);
  const actualFiles = listFiles(root).map((path) => relative(root, path)).sort();
  check(
    JSON.stringify(actualFiles) === JSON.stringify([...expectedFiles].sort()),
    `${rel(root)} holds unexpected files: ${actualFiles.join(", ")}`,
  );

  // The package carries a byte-for-byte copy, and every action names a file the package holds.
  const packaged = join(packageRoot(version), profile.lifecycleRoot);
  if (checkPackage && existsSync(packageRoot(version))) {
    check(existsSync(packaged), `${rel(packaged)} is missing; regenerate the package`);
    for (const file of actualFiles) {
      check(existsSync(join(packaged, file)), `${rel(packaged)}/${file} is missing`);
      check(sha256File(join(packaged, file)) === sha256File(join(root, file)), `${rel(packaged)}/${file} differs from its source`);
    }
    check(
      JSON.stringify(listFiles(packaged).map((path) => relative(packaged, path)).sort()) === JSON.stringify(actualFiles),
      `${rel(packaged)} holds unexpected files`,
    );
    for (const base of lifecycleActions(version).spec.bases) {
      for (const action of base.actions) {
        check(action.automatic === false, `${version} ${base.name} lifecycle actions must not be automatic`);
        check(existsSync(join(packageRoot(version), action.source)), `${rel(packageRoot(version))}/${action.source} is missing`);
      }
      const crdAction = base.actions.find((action) => action.phase === "pre-apply");
      const bundle = parseDocs(readFileSync(join(packageRoot(version), crdAction.source), "utf8"));
      const declaredBase = bases.find((item) => item.name === base.name);
      // A base may also need CRDs the chart does not ship; the bundle carries a copy of those.
      const externalCRDs = declaredBase.externalCRDs ?? [];
      const expectedCRDs = [...declaredBase.expected.crds, ...externalCRDs].sort();
      check(
        JSON.stringify(bundle.map((doc) => doc.metadata?.name).sort()) === JSON.stringify(expectedCRDs),
        `${version} ${base.name} CRD bundle does not hold exactly the base's CRDs`,
      );
      const releaseText = readFileSync(
        join(recipeRoot(version), "revisions", base.name, "r001", "rendered", "release-objects.yaml"),
        "utf8",
      );
      const maps = canonicalObjectMaps(releaseText, readFileSync(join(packageRoot(version), crdAction.source), "utf8"));
      for (const key of Object.keys(maps.cub)) {
        if (externalCRDs.some((name) => key.endsWith(`|${name}`))) continue;
        check(maps.helm[key] === maps.cub[key], `${version} ${base.name} bundled CRD differs from the base render: ${key}`);
      }
    }
  }
}
