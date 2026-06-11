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
//   node scripts/record-blast-radius-case.mjs <repo>/<chart>/<version> --value-path releaseName --rename release-name=<new>
//   node scripts/record-blast-radius-case.mjs <repo>/<chart>/<version> --value-path namespace --rename namespace=<new>
//
// The --rename form measures the whole-release identity paths with
// rename-aware pairing: objects in the renamed render are mapped back to
// their base identity (release token in metadata.name, or the namespace
// component), then paired objects are content-diffed. Renames touch every
// object that embeds the release name or namespace, so these cases are
// expected to expose under-prediction in the value-source-map — a failing
// row here is the benchmark catching a real coverage gap, and it is
// published, not suppressed.

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
  node scripts/record-blast-radius-case.mjs <repo>/<chart>/<version> --value-path releaseName --rename release-name=<new>
  node scripts/record-blast-radius-case.mjs <repo>/<chart>/<version> --value-path namespace --rename namespace=<new>
    [--case-id <id>]   override the derived case id`);
}

function parseArgs(argv) {
  const chartPath = argv[0];
  if (!chartPath || chartPath.startsWith("--")) return null;
  let valuePath = null;
  let overrideFlag = null;
  let overrideArg = null;
  let rename = null;
  let caseId = null;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--value-path") valuePath = argv[++i];
    else if (argv[i] === "--set" || argv[i] === "--set-string") {
      overrideFlag = argv[i];
      overrideArg = argv[++i];
    } else if (argv[i] === "--rename") {
      const [kind, to] = argv[++i].split("=");
      rename = { kind, to };
    } else if (argv[i] === "--case-id") caseId = argv[++i];
  }
  if (!valuePath) return null;
  if (rename && (overrideFlag || !["release-name", "namespace"].includes(rename.kind) || !rename.to)) return null;
  if (!rename && (!overrideFlag || !overrideArg)) return null;
  return { chartPath, valuePath, overrideFlag, overrideArg, rename, caseId };
}

// diffPaths walks two plain JS values and returns the JSON-ish paths whose
// values differ, so a rename receipt can show WHERE a paired object changed
// (labels, namespace fields, embedded DNS names) instead of just that it did.
function diffPaths(a, b, path = "", out = []) {
  if (a === b) return out;
  const aObj = a && typeof a === "object";
  const bObj = b && typeof b === "object";
  if (!aObj || !bObj || Array.isArray(a) !== Array.isArray(b)) {
    out.push(path || "(root)");
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of [...keys].sort()) {
    const next = Array.isArray(a) ? `${path}[${key}]` : path ? `${path}.${key}` : key;
    diffPaths(a[key], b[key], next, out);
  }
  return out;
}

function normalizeRelease(text) {
  return `${text.split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n*$/, "")}\n`;
}

function objectMap(text, identityFn = (identity) => identity) {
  const map = new Map();
  for (const doc of parseDocs(text)) {
    const metadata = doc.metadata ?? {};
    const raw = [doc.apiVersion ?? "", doc.kind ?? "", metadata.namespace ?? "", metadata.name ?? ""].join("|");
    if (!raw.replaceAll("|", "")) continue;
    map.set(identityFn(raw), { json: stableJson(doc), doc });
  }
  return map;
}

// mapIdentity maps an identity from the renamed render back into base
// identity space, which is what makes objects pairable across a rename:
// the namespace component maps directly; a renamed release token is
// replaced inside the name component (the new release name is chosen to be
// collision-free, so plain replacement is exact).
function mapIdentity(identity, rename, from) {
  const [api, kind, ns, name] = identity.split("|");
  if (rename.kind === "namespace") return [api, kind, ns === rename.to ? from : ns, name].join("|");
  return [api, kind, ns, name.replaceAll(rename.to, from)].join("|");
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
  const { chartPath, valuePath, overrideFlag, overrideArg, rename, caseId } = args;
  if (rename) {
    const expectedPath = rename.kind === "release-name" ? "releaseName" : "namespace";
    check(valuePath === expectedPath, `--rename ${rename.kind} measures the ${expectedPath} value path; got --value-path ${valuePath}`);
  } else {
    check(overrideArg.split("=")[0] === valuePath, `--set path ${overrideArg.split("=")[0]} must equal --value-path ${valuePath}; the case measures exactly one value`);
  }

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

  const renameFrom = rename ? (rename.kind === "namespace" ? chart.namespace : chart.releaseName) : null;
  if (rename) {
    check(rename.to !== renameFrom, `--rename ${rename.kind}=${rename.to} is a no-op; the base already uses ${renameFrom}`);
    // The new token is what gets replaced during identity mapping, so it must
    // not be a substring of the old one (ambiguous). The old being a prefix of
    // the new is fine — and for release names it is often REQUIRED: chart
    // fullname helpers collapse the chart name into the release name only when
    // the release contains it, so a rename target that drops the chart name
    // changes the name SHAPE (redis-master -> <new>-redis-master) and no
    // pairing is possible. Pick a target that preserves the fullname rule.
    check(!renameFrom.includes(rename.to), `--rename target ${rename.to} is a substring of base ${renameFrom}; identity mapping would be ambiguous`);
  }
  const templateArgs = (releaseName, namespace) => ["template", releaseName, chart.ref, "--version", chart.version, "--namespace", namespace, ...RENDER_FLAGS, "--values", helmValuesFile];
  const baseArgs = templateArgs(chart.releaseName, chart.namespace);
  const overrideArgs = rename
    ? templateArgs(rename.kind === "release-name" ? rename.to : chart.releaseName, rename.kind === "namespace" ? rename.to : chart.namespace)
    : [...baseArgs, overrideFlag, overrideArg];
  const baseRender = renderTwice(baseArgs);
  const overrideRender = renderTwice(overrideArgs);

  const baseObjects = objectMap(baseRender);
  const overrideObjects = objectMap(overrideRender, rename ? (identity) => mapIdentity(identity, rename, renameFrom) : undefined);
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
    const sameObjects = [...committed.keys()].every((identity) => baseObjects.get(identity)?.json === committed.get(identity)?.json);
    baseMatchesCommittedRevision = committedText === baseRender ? "byte-identical" : sameObjects ? "object-identical" : "identity-set-equal";
  }

  const removed = [...baseObjects.keys()].filter((identity) => !overrideObjects.has(identity)).sort();
  const added = [...overrideObjects.keys()].filter((identity) => !baseObjects.has(identity)).sort();
  const changed = [...baseObjects.keys()].filter((identity) => overrideObjects.has(identity) && baseObjects.get(identity).json !== overrideObjects.get(identity).json).sort();
  const affected = new Set([...removed, ...added, ...changed]);
  check(affected.size > 0, `${chart.ref}: the override changed nothing; a no-op override is not a measurable case`);
  const changedDetails = changed.map((identity) => {
    const paths = diffPaths(baseObjects.get(identity).doc, overrideObjects.get(identity).doc);
    return { object: identity, changedPathCount: paths.length, samplePaths: paths.slice(0, 8) };
  });

  const falseNegatives = [...affected].filter((identity) => !predicted.includes(identity)).sort();
  const falsePositives = predicted.filter((identity) => !affected.has(identity)).sort();
  const truePositives = predicted.filter((identity) => affected.has(identity)).length;
  const result = falseNegatives.length === 0 && falsePositives.length === 0 ? "pass" : "fail";

  const name = caseId ?? `${sourceLock.spec.chart}-${chart.version}-${valuePath.replaceAll(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-${rename ? "rename" : "rerender"}`;
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
      measurementType: rename ? "whole-release-rename-diff" : "single-value-rerender-diff",
      ...(rename ? { rename: { kind: valuePath, from: renameFrom, to: rename.to } } : { override: { flag: overrideFlag, argument: overrideArg } }),
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
      changedDetails,
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
