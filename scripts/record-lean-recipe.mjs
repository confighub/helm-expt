#!/usr/bin/env node
// Records a lean catalog entry from a pinned chart tarball: source lock,
// audited-base variant, effective values, and one rendered revision with its
// object inventory and digests. This is the entry shape the certified-bundle
// model needs before the deeper catalog lanes (installer package, value model,
// control points, proofs) are built for a chart. Like the witness scanner, it
// needs the chart tarball and a helm binary, so it runs once per entry and its
// output is committed; nothing in the verify chain re-runs it.
//
// Usage:
//   node scripts/record-lean-recipe.mjs \
//     --repo-name karpenter --chart karpenter --version 1.14.0 \
//     --tarball /path/karpenter-1.14.0.tgz --exact-url oci://... \
//     [--oci-digest sha256:...] --values /path/values.yaml \
//     --values-origin "eks-inference src/karpenter/values/karpenter.yaml" \
//     --release karpenter --namespace kube-system --kube-version 1.31.0 \
//     --variant eks-inference

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { readYamlText, repoRoot, sha256, sha256File, toYaml, write } from "./lib/proof-common.mjs";

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  if (!argv[i].startsWith("--") || argv[i + 1] === undefined) {
    console.error(`bad argument pair at: ${argv[i]}`);
    process.exit(1);
  }
  args[argv[i].slice(2)] = argv[i + 1];
}
for (const required of [
  "repo-name",
  "chart",
  "version",
  "tarball",
  "exact-url",
  "values",
  "values-origin",
  "release",
  "namespace",
  "kube-version",
  "variant",
]) {
  if (!args[required]) {
    console.error(`missing --${required}`);
    process.exit(1);
  }
}

const recipeRel = `recipes/${args["repo-name"]}/${args.chart}/${args.version}`;
const recipeDir = join(repoRoot, recipeRel);
const variant = args.variant;

const tarballSha = sha256File(args.tarball);
const tarballBytes = statSync(args.tarball).size;

const chartMeta = execFileSync("helm", ["show", "chart", args.tarball], { encoding: "utf8" });
const appVersion = chartMeta.match(/^appVersion:\s*"?([^"\n]+)"?/m)?.[1] ?? "";

const valuesText = readFileSync(args.values, "utf8");
const valuesSha = sha256(valuesText);
// effective-values.yaml is a house EffectiveValues artifact; the producer's
// values file is kept verbatim beside it, comments and all, as the render input.
const effectiveValues = {
  apiVersion: "helm-expt.confighub.com/v1alpha1",
  kind: "EffectiveValues",
  metadata: { name: `${args["repo-name"]}-${args.chart}-${args.version}-${args.variant}` },
  spec: {
    profile: "producer-declared",
    sourceValuesFile: `values/${args.variant}.yaml`,
    sourceValuesSHA256: valuesSha,
    mergedValuesCaptured: false,
    values: readYamlText(valuesText),
  },
};

const rendered = execFileSync(
  "helm",
  [
    "template",
    args.release,
    args.tarball,
    "--namespace",
    args.namespace,
    "--kube-version",
    args["kube-version"],
    "--include-crds",
    "--values",
    args.values,
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const objects = [];
for (const doc of rendered.split(/^---$/m)) {
  const kind = doc.match(/^kind:\s*"?([A-Za-z0-9.]+)"?\s*$/m)?.[1];
  if (!kind) continue;
  const metaBlock = doc.match(/^metadata:\n((?:[ \t].*\n|\n)*)/m)?.[1] ?? "";
  const name = metaBlock.match(/^ {2}name:\s*"?([^"\n]+)"?/m)?.[1] ?? "";
  const namespace = metaBlock.match(/^ {2}namespace:\s*"?([^"\n]+)"?/m)?.[1] ?? "";
  objects.push({ kind, name, ...(namespace ? { namespace } : {}) });
}
objects.sort((a, b) =>
  `${a.kind}/${a.namespace ?? ""}/${a.name}` < `${b.kind}/${b.namespace ?? ""}/${b.name}` ? -1 : 1,
);

const sourceLock = {
  apiVersion: "helm-expt.confighub.com/v1alpha1",
  kind: "SourceLock",
  metadata: { name: `${args["repo-name"]}-${args.chart}-${args.version}` },
  spec: {
    sourceType: "HelmChart",
    repositoryName: args["repo-name"],
    chart: args.chart,
    version: args.version,
    appVersion,
    packageSHA256: tarballSha,
    packageBytes: tarballBytes,
    exactArtifact: {
      url: args["exact-url"],
      sha256: tarballSha,
      ...(args["oci-digest"] ? { manifestDigest: args["oci-digest"] } : {}),
      resolution: "artifact-addressed",
    },
  },
};

const variantRecord = {
  apiVersion: "helm-expt.confighub.com/v1alpha1",
  kind: "Variant",
  metadata: { name: variant },
  spec: {
    namespace: args.namespace,
    releaseName: args.release,
    valuesProfile: "../../effective-values.yaml",
    valuesOrigin: args["values-origin"],
    capabilityProfile: { kubeVersion: args["kube-version"], apiVersions: [] },
    hookPolicy: "hooks-rendered-visible",
  },
};

const variantSha = sha256(`${toYaml(variantRecord)}\n`);
const renderedSha = sha256(rendered);
const revisionDigest = sha256([tarballSha, variantSha, valuesSha, renderedSha].join("\n"));

const revision = {
  apiVersion: "helm-expt.confighub.com/v1alpha1",
  kind: "VariantRevision",
  metadata: { name: `${variant}-r001` },
  spec: {
    variant: `../../../variants/${variant}/variant.yaml`,
    revision: "r001",
    digest: revisionDigest,
    digestInputs: {
      chartPackageSHA256: tarballSha,
      variantSHA256: variantSha,
      effectiveValuesSHA256: valuesSha,
      renderedObjectSetSHA256: renderedSha,
    },
    rendered: {
      releaseObjects: "rendered/release-objects.yaml",
      objectInventory: "rendered/object-inventory.yaml",
      objectCount: objects.length,
    },
  },
};

const inventory = {
  apiVersion: "helm-expt.confighub.com/v1alpha1",
  kind: "RenderedObjectInventory",
  metadata: { name: `${variant}-r001` },
  spec: {
    objectCount: objects.length,
    renderedObjectSetSHA256: renderedSha,
    objects,
  },
};

write(join(recipeDir, "source-lock.yaml"), `${toYaml(sourceLock)}\n`);
write(join(recipeDir, "effective-values.yaml"), `${toYaml(effectiveValues)}\n`);
write(join(recipeDir, "values", `${args.variant}.yaml`), valuesText);
write(join(recipeDir, "variants", variant, "variant.yaml"), `${toYaml(variantRecord)}\n`);
write(
  join(recipeDir, "revisions", variant, "r001", "variant-revision.yaml"),
  `${toYaml(revision)}\n`,
);
write(join(recipeDir, "revisions", variant, "r001", "rendered", "release-objects.yaml"), rendered);
write(
  join(recipeDir, "revisions", variant, "r001", "rendered", "object-inventory.yaml"),
  `${toYaml(inventory)}\n`,
);
console.log(`recorded ${recipeRel} (${objects.length} objects, render sha ${renderedSha.slice(0, 12)})`);
