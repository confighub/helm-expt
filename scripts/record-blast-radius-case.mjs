#!/usr/bin/env node
// Records a blast-radius case receipt for a single value path: render the
// recipe's default variant, re-render with exactly one value overridden,
// diff the two object sets, and score the diff against the value-source-map
// prediction. The receipt is the committed evidence; the offline verifier in
// generate-blast-radius-accuracy.mjs rescores it against the committed
// value-source-map, so a later map edit invalidates the receipt instead of
// silently keeping its old score.
//
// This needs network + helm (it pulls and renders the chart). Verification
// of the recorded receipt does not.
//
//   node scripts/record-blast-radius-case.mjs <repo>/<chart>/<version> --value-path <path> --set k=v
//   node scripts/record-blast-radius-case.mjs <repo>/<chart>/<version> --value-path <path> --set-string k=v

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, command, parseDocs, readYaml, relativeRepo, repoRoot, sha256, writeYaml } from "./lib/proof-common.mjs";

// Same render contract as generate-variant-proof.mjs, so a recorded case is
// comparable with the committed revision renders.
const kubeVersion = "1.30.0";
const RENDER_FLAGS = ["--kube-version", kubeVersion, "--include-crds", "--skip-tests", "--no-hooks"];

function usage() {
  console.log(`usage:
  node scripts/record-blast-radius-case.mjs <repo>/<chart>/<version> --value-path <path> --set k=v
  node scripts/record-blast-radius-case.mjs <repo>/<chart>/<version> --value-path <path> --set-string k=v
    [--case-id <id>]   override the derived case id`);
}

function parseArgs(argv) {
  const chartPath = argv[0];
  if (!chartPath || chartPath.startsWith("--")) return null;
  let valuePath = null;
  let overrideFlag = null;
  let overrideArg = null;
  let caseId = null;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--value-path") valuePath = argv[++i];
    else if (argv[i] === "--set" || argv[i] === "--set-string") {
      overrideFlag = argv[i];
      overrideArg = argv[++i];
    } else if (argv[i] === "--case-id") caseId = argv[++i];
  }
  if (!valuePath || !overrideFlag || !overrideArg) return null;
  return { chartPath, valuePath, overrideFlag, overrideArg, caseId };
}

function normalizeRelease(text) {
  return `${text.split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n*$/, "")}\n`;
}

function objectMap(text) {
  return new Map(
    parseDocs(text)
      .map((doc) => {
        const metadata = doc.metadata ?? {};
        const identity = [doc.apiVersion ?? "", doc.kind ?? "", metadata.namespace ?? "", metadata.name ?? ""].join("|");
        return [identity, stableJson(doc)];
      })
      .filter(([identity]) => identity.replaceAll("|", "")),
  );
}

function stableJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortKeys(item)]));
  }
  return value;
}

function renderTwice(args) {
  const first = normalizeRelease(command("helm", args));
  const second = normalizeRelease(command("helm", args));
  check(first === second, `helm template did not render deterministically for: helm ${args.join(" ")}`);
  return first;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return usage();
  const { chartPath, valuePath, overrideFlag, overrideArg, caseId } = args;
  check(overrideArg.split("=")[0] === valuePath, `--set path ${overrideArg.split("=")[0]} must equal --value-path ${valuePath}; the case measures exactly one value`);

  const recipeRel = `recipes/${chartPath}`;
  const recipeRoot = join(repoRoot, recipeRel);
  check(existsSync(join(recipeRoot, "recipe.yaml")), `no recipe at ${recipeRel}`);
  const sourceLock = readYaml(join(recipeRoot, "source-lock.yaml"));
  const variantDir = join(recipeRoot, "variants", "default");
  const variant = readYaml(join(variantDir, "variant.yaml"));
  const valuesProfile = join(variantDir, variant.spec?.valuesProfile ?? "../../effective-values.yaml");
  check(existsSync(valuesProfile), `no values profile at ${relativeRepo(valuesProfile)}`);
  // The committed values profile is an EffectiveValues wrapper; helm needs the
  // plain values under spec.values. Generated facts are pinned in there by
  // design, which is what makes the base render deterministic.
  const valuesDoc = readYaml(valuesProfile);
  let helmValuesFile = valuesProfile;
  if (valuesDoc?.kind === "EffectiveValues") {
    helmValuesFile = join(mkdtempSync(join(tmpdir(), "blast-radius-")), "values.yaml");
    writeYaml(helmValuesFile, valuesDoc.spec?.values ?? {});
  }

  const valueSourceMap = readYaml(join(recipeRoot, "value-source-map.yaml"));
  const entry = (valueSourceMap.spec?.entries ?? []).find((item) => item.valuePath === valuePath);
  check(entry, `${chartPath} has no value-source-map entry for ${valuePath}`);
  const predicted = [...new Set(entry.renderedFields.map((field) => field.object))].sort();

  const chart = {
    repository: sourceLock.spec.repositoryName,
    repositoryURL: sourceLock.spec.repositoryURL,
    ref: sourceLock.spec.ref ?? `${sourceLock.spec.repositoryName}/${sourceLock.spec.chart}`,
    version: String(sourceLock.spec.version),
    namespace: variant.spec?.namespace ?? "default",
    releaseName: variant.spec?.releaseName ?? sourceLock.spec.chart,
  };
  try {
    command("helm", ["repo", "add", chart.repository, chart.repositoryURL]);
  } catch {
    /* repo may already exist */
  }

  const baseArgs = ["template", chart.releaseName, chart.ref, "--version", chart.version, "--namespace", chart.namespace, ...RENDER_FLAGS, "--values", helmValuesFile];
  const baseRender = renderTwice(baseArgs);
  const overrideRender = renderTwice([...baseArgs, overrideFlag, overrideArg]);

  const baseObjects = objectMap(baseRender);
  const overrideObjects = objectMap(overrideRender);
  check(baseObjects.size > 0, `${chart.ref} rendered zero objects`);

  // The prediction was authored against the committed default revision render.
  // If this fresh base render does not even cover the same object identities,
  // the diff would be scored against the wrong baseline — refuse to record.
  const committedRenderPath = join(recipeRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml");
  let baseMatchesCommittedRevision = "no-committed-revision";
  if (existsSync(committedRenderPath)) {
    const committedText = normalizeRelease(readFileSync(committedRenderPath, "utf8"));
    const committed = objectMap(committedText);
    const sameIdentities = committed.size === baseObjects.size && [...committed.keys()].every((identity) => baseObjects.has(identity));
    check(sameIdentities, `${chart.ref}: fresh default render object identities diverge from ${relativeRepo(committedRenderPath)}; re-pin the chart or refresh the revision before recording`);
    const sameObjects = [...committed.keys()].every((identity) => baseObjects.get(identity) === committed.get(identity));
    baseMatchesCommittedRevision = committedText === baseRender ? "byte-identical" : sameObjects ? "object-identical" : "identity-set-equal";
  }

  const removed = [...baseObjects.keys()].filter((identity) => !overrideObjects.has(identity)).sort();
  const added = [...overrideObjects.keys()].filter((identity) => !baseObjects.has(identity)).sort();
  const changed = [...baseObjects.keys()].filter((identity) => overrideObjects.has(identity) && baseObjects.get(identity) !== overrideObjects.get(identity)).sort();
  const affected = new Set([...removed, ...added, ...changed]);
  check(affected.size > 0, `${chart.ref}: overriding ${overrideArg} changed nothing; a no-op override is not a measurable case`);

  const falseNegatives = [...affected].filter((identity) => !predicted.includes(identity)).sort();
  const falsePositives = predicted.filter((identity) => !affected.has(identity)).sort();
  const truePositives = predicted.filter((identity) => affected.has(identity)).length;
  const result = falseNegatives.length === 0 && falsePositives.length === 0 ? "pass" : "fail";

  const name = caseId ?? `${sourceLock.spec.chart}-${chart.version}-${valuePath.replaceAll(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-rerender`;
  const receiptPath = join(repoRoot, "data", "blast-radius-accuracy", "case-receipts", `${name}.yaml`);
  writeYaml(receiptPath, {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "BlastRadiusCaseReceipt",
    metadata: { name },
    spec: {
      chart: chart.ref,
      version: chart.version,
      recipe: recipeRel,
      valuePath,
      valueSourceEntryId: entry.id ?? valuePath,
      override: { flag: overrideFlag, argument: overrideArg },
      renderContext: {
        helmVersion: command("helm", ["version", "--template", "{{.Version}}"]).trim(),
        flags: RENDER_FLAGS,
        namespace: chart.namespace,
        releaseName: chart.releaseName,
        valuesProfile: relativeRepo(valuesProfile),
        valuesProfileSHA256: sha256(readFileSync(valuesProfile, "utf8")),
      },
      baseRender: { objectCount: baseObjects.size, sha256: sha256(baseRender), matchesCommittedRevision: baseMatchesCommittedRevision },
      overrideRender: { objectCount: overrideObjects.size, sha256: sha256(overrideRender) },
      predictedObjects: predicted,
      actual: { removed, added, changed },
      score: {
        falseNegatives,
        falsePositives,
        truePositives,
        precision: predicted.length === 0 ? null : Number((truePositives / predicted.length).toFixed(3)),
        recall: affected.size === 0 ? null : Number((truePositives / affected.size).toFixed(3)),
        result,
      },
    },
  });
  console.log(`${result.toUpperCase()} ${name}: predicted ${predicted.length}, affected ${affected.size} (-${removed.length} +${added.length} ~${changed.length}), FN ${falseNegatives.length}, FP ${falsePositives.length}`);
  console.log(`wrote ${relativeRepo(receiptPath)}`);
}

main();
