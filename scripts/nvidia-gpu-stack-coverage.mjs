#!/usr/bin/env node

// Renders, packages and checks the NVIDIA GPU stack chart versions listed in
// scripts/lib/nvidia-gpu-stack-coverage.mjs: gpu-operator, nvsentinel,
// cluster-readiness-engine and k8s-nim-operator. Each addition runs its own proof declaration against
// the exact upstream archive, addressed by URL and SHA-256.
//
//   node scripts/nvidia-gpu-stack-coverage.mjs --list
//   node scripts/nvidia-gpu-stack-coverage.mjs --generate  [--only <chart>[@<version>]]
//   node scripts/nvidia-gpu-stack-coverage.mjs --repackage [--only <chart>[@<version>]]
//   node scripts/nvidia-gpu-stack-coverage.mjs --verify    [--only <chart>[@<version>]]
//   node scripts/nvidia-gpu-stack-coverage.mjs --diff <chart> <version>[/<base>] <version>[/<base>]
//   node scripts/nvidia-gpu-stack-coverage.mjs --value-delta <chart> <version>[/<base>] <path>=<value>
//
// Every mode takes --set <name> to run another list of additions through the
// same steps. --set aicr-nested-charts runs the charts the retained AICR EKS
// training entries pin (scripts/lib/aicr-nested-charts-coverage.mjs). Without
// --set the list is the NVIDIA GPU stack.
//
// --generate replaces only the recipe and package directories of the versions it
// names (and, for gpu-operator and k8s-nim-operator, the packaged lifecycle files). It does not publish
// anything: OCI publication, signing and the derived catalog views are separate
// steps that need registry credentials and the maintainer's approval.
//
// --repackage rebuilds only the package directories and their recorded digests
// from the committed recipes. It needs no network and leaves the recipes'
// renders alone. Use it when a digest was recorded with an installer that CI
// cannot reproduce; run it through scripts/run-with-pinned-installer.mjs.
//
// --verify reads committed files and re-packages through the installer. It needs
// no network. --diff compares two committed renders, object by object, and also
// needs no network. Each side is <version>[/<base>], so it compares two versions,
// or two bases of one version: --diff gpu-operator v25.10.1/default
// v25.10.1/driver-580.126.20 answers what a driver change does to the objects. --value-delta downloads the locked archive, renders one base
// twice with and without a single changed value, and prints what moved.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYaml, repoRoot, sha256File } from "./lib/proof-common.mjs";
import { objectDelta } from "./lib/nvidia-gpu-stack-coverage.mjs";
import { coverageSetFromArgs } from "./lib/coverage-sets.mjs";

const { set, rest: args } = coverageSetFromArgs(process.argv.slice(2));
const additions = set.additions;
const mode = args[0] ?? "--verify";

if (mode === "--diff") {
  diff(args[1], args[2], args[3]);
} else if (mode === "--value-delta") {
  valueDelta(args[1], args[2], args[3]);
} else {
  const onlyIndex = args.indexOf("--only");
  const only = onlyIndex === -1 ? null : args[onlyIndex + 1];
  check(onlyIndex === -1 || (only && !only.startsWith("--")), "--only requires a chart name, optionally with @<version>");
  const [onlyChart, onlyVersion] = (only ?? "").split("@");
  const items = additions.filter(
    (item) => !only || (item.chart === onlyChart && (!onlyVersion || item.version === onlyVersion)),
  );
  check(items.length > 0, `no ${set.label} addition named ${only}`);

  if (mode === "--list") {
    for (const item of items) console.log(`${item.canonicalIdentity}@${item.version}\t${item.script}\t${item.url}\t${item.sha256}`);
    // A list may hold chart versions out; they are named so the gap is not silent.
    for (const item of only ? [] : (set.held ?? [])) console.log(`held out: ${item.canonicalIdentity}@${item.version}\t${item.reason}`);
  } else if (mode === "--generate") {
    for (const item of items) {
      console.log(`generating ${item.canonicalIdentity}@${item.version}`);
      run(item, "--generate-proof");
      if (item.lifecycle) lifecycle(item, "--generate");
      run(item, "--generate-package");
      if (item.targetFacts) targetFacts(item, "--generate");
      verifyOne(item);
    }
  } else if (mode === "--repackage") {
    for (const item of items) {
      console.log(`repackaging ${item.canonicalIdentity}@${item.version}`);
      run(item, "--generate-package");
      if (item.targetFacts) targetFacts(item, "--generate");
      verifyOne(item);
    }
  } else if (mode === "--verify") {
    for (const item of items) verifyOne(item);
  } else {
    console.log(`Usage:
  node scripts/nvidia-gpu-stack-coverage.mjs [--set <name>] --list | --generate | --repackage | --verify [--only <chart>[@<version>]]
  node scripts/nvidia-gpu-stack-coverage.mjs [--set <name>] --diff <chart> <version>[/<base>] <version>[/<base>]
  node scripts/nvidia-gpu-stack-coverage.mjs [--set <name>] --value-delta <chart> <version>[/<base>] <path>=<value>`);
    process.exit(2);
  }
}

function env(item) {
  return {
    ...process.env,
    HELM_EXPT_CHART_VERSION: item.version,
    HELM_EXPT_CHART_ARTIFACT_URL: item.url,
    HELM_EXPT_CHART_ARTIFACT_SHA256: item.sha256,
    // The recipe and package READMEs name commands that exist.
    HELM_EXPT_PROOF_COMMANDS: `npm run ${set.npmPrefix}:generate -- --only ${item.chart}@${item.version}\nnpm run ${set.npmPrefix}:verify -- --only ${item.chart}@${item.version}`,
    ...(item.candidate ? { HELM_EXPT_NVIDIA_GPU_STACK_CANDIDATE: item.candidate } : {}),
    ...item.env,
  };
}

function run(item, flag) {
  const result = spawnSync(process.execPath, [join("scripts", item.script), flag], { cwd: repoRoot, env: env(item), stdio: "inherit" });
  check(result.status === 0, `${item.canonicalIdentity}@${item.version}: ${item.script} ${flag} failed`);
}

// The Helm hook objects are packaged beside the bases as recorded lifecycle
// actions. None has been run, and the generated files say so.
function lifecycle(item, flag) {
  const result = spawnSync(process.execPath, [join("scripts", item.lifecycle), flag, ...(item.lifecycleArgs ?? ["--chart", item.chart]), "--version", item.version], {
    cwd: repoRoot,
    env: env(item),
    stdio: "inherit",
  });
  check(result.status === 0, `${item.canonicalIdentity}@${item.version}: lifecycle ${flag} failed`);
}

// A base that needs CRDs established first points each CRD requirement at a CRD
// bundle inside the package. The bundle is cut from the committed render.
function targetFacts(item, flag) {
  const result = spawnSync(process.execPath, ["scripts/sync-installer-target-facts.mjs", flag, "--recipe", item.recipePath], {
    cwd: repoRoot,
    env: env(item),
    stdio: "inherit",
  });
  check(result.status === 0, `${item.canonicalIdentity}@${item.version}: target-facts ${flag} failed`);
}

function verifyOne(item) {
  check(existsSync(join(repoRoot, item.recipePath)), `${item.recipePath} is missing`);
  check(existsSync(join(repoRoot, item.packagePath)), `${item.packagePath} is missing`);
  for (const flag of ["--verify-proof", "--verify-proof-self-test", "--verify-package"]) run(item, flag);
  if (item.targetFacts) targetFacts(item, "--verify");
  if (item.lifecycle) lifecycle(item, "--verify");
  console.log(`checked ${item.canonicalIdentity}@${item.version}`);
}

function parseRef(chart, ref) {
  check(chart && ref, "a chart and a <version>[/<base>] reference are required");
  const [version, base = "default"] = ref.split("/");
  const item = additions.find((candidate) => candidate.chart === chart && candidate.version === version);
  check(Boolean(item), `${chart}@${version} is not in the ${set.label} coverage list`);
  return { item, version, base };
}

function printObjectDiff(fromLabel, toLabel, fromYaml, toYaml) {
  const delta = objectDelta(fromYaml, toYaml);
  console.log(`from ${fromLabel}: ${delta.fromCount} objects`);
  console.log(`to   ${toLabel}: ${delta.toCount} objects`);
  console.log(
    `removed ${delta.removed.length}, added ${delta.added.length}, changed ${delta.changed.length}, unchanged ${delta.fromCount - delta.removed.length - delta.changed.length}`,
  );
  for (const key of delta.removed) console.log(`- ${key}`);
  for (const key of delta.added) console.log(`+ ${key}`);
  const show = (value) => (value === undefined ? "(absent)" : JSON.stringify(value));
  for (const { key, paths, values } of delta.changed) {
    console.log(`~ ${key} (${paths.length} field${paths.length === 1 ? "" : "s"})`);
    for (const path of paths.slice(0, 40)) {
      // A short plain value is shown on both sides, so a driver or image change reads directly.
      const pair = values[path];
      const text = pair ? `${show(pair.from)} -> ${show(pair.to)}` : "";
      console.log(`    ${path}${text && text.length <= 160 ? `: ${text}` : ""}`);
    }
    if (paths.length > 40) console.log(`    ... and ${paths.length - 40} more`);
  }
}

function committedRender(ref) {
  const path = join(repoRoot, ref.item.recipePath, "revisions", ref.base, "r001", "rendered", "release-objects.yaml");
  check(existsSync(path), `${ref.item.recipePath} has no committed render for base ${ref.base}`);
  return readFileSync(path, "utf8");
}

function diff(chart, fromRef, toRef) {
  const from = parseRef(chart, fromRef);
  const to = parseRef(chart, toRef);
  printObjectDiff(
    `${from.item.canonicalIdentity}@${from.version}/${from.base}`,
    `${to.item.canonicalIdentity}@${to.version}/${to.base}`,
    committedRender(from),
    committedRender(to),
  );
}

// Renders one base of the locked archive twice: as committed, and with a single
// value changed. Hook objects are included, so the answer covers everything the
// chart renders, not only the base.
function valueDelta(chart, refText, assignment) {
  const ref = parseRef(chart, refText);
  check(/^[A-Za-z0-9_.-]+=.+$/.test(assignment ?? ""), "--value-delta requires <path>=<value>");
  const variant = readYaml(join(repoRoot, ref.item.recipePath, "variants", ref.base, "variant.yaml"));
  const effective = readYaml(join(repoRoot, ref.item.recipePath, variant.spec.valuesProfile.replace(/^\.\.\/\.\.\//, "")));
  const tempRoot = mkdtempSync(join(tmpdir(), "nvidia-gpu-stack-value-delta-"));
  try {
    const archive = join(tempRoot, `${chart}-${ref.version}.tgz`);
    if (ref.item.url.startsWith("oci://")) {
      const suffix = `:${ref.version}`;
      const artifact = ref.item.url.endsWith(suffix) ? ref.item.url.slice(0, -suffix.length) : ref.item.url;
      execFileSync("helm", ["pull", artifact, "--version", ref.version, "--destination", tempRoot], { stdio: ["ignore", "pipe", "inherit"] });
      const pulled = join(tempRoot, `${chart}-${ref.version}.tgz`);
      check(existsSync(pulled), `helm pull produced no archive for ${ref.item.canonicalIdentity}@${ref.version}`);
    } else {
      execFileSync("curl", ["--fail", "--location", "--retry", "3", "--silent", "--show-error", "--output", archive, ref.item.url], {
        stdio: ["ignore", "pipe", "inherit"],
      });
    }
    check(sha256File(archive) === ref.item.sha256, `chart artifact SHA mismatch for ${ref.item.canonicalIdentity}@${ref.version}`);
    const valuesPath = join(tempRoot, "values.json");
    // JSON is YAML, so the committed effective values can be handed to Helm as they are.
    writeFileSync(valuesPath, JSON.stringify(effective.spec?.values ?? {}));
    const base = [
      "template",
      variant.spec.releaseName,
      archive,
      "--namespace",
      variant.spec.namespace,
      "--kube-version",
      variant.spec.capabilityProfile.kubeVersion,
      "--include-crds",
      "--skip-tests",
      "--values",
      valuesPath,
    ];
    const render = (extra) => execFileSync("helm", [...base, ...extra], { encoding: "utf8", maxBuffer: 1024 * 1024 * 200 });
    printObjectDiff(
      `${ref.item.canonicalIdentity}@${ref.version}/${ref.base} with hook objects`,
      `the same with ${assignment}`,
      render([]),
      render(["--set-string", assignment]),
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
