import { existsSync } from "node:fs";
import { join, relative } from "node:path";

import { readYaml, repoRoot, sha256File } from "./proof-common.mjs";

const LEADING_BLANK_LINE_RULE = "leading-blank-line-pruned-by-kustomize";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function rootRelative(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

// Load the narrow exception already reviewed for the exact source chart and version. The
// retained default receipt is part of the binding: a corpus rule alone never authorizes a
// variant to normalize its own comparison.
export function loadLeadingBlankLineNormalization({ chart, recipeRoot, root = repoRoot }) {
  const corpusPath = join(root, "data", "successor-track", "corpus.yaml");
  const corpus = readYaml(corpusPath);
  check(corpus.kind === "SuccessorTrackCorpus", `${chart.ref}@${chart.version} normalization corpus kind is invalid`);
  const entry = (corpus.spec?.charts ?? []).find(
    (candidate) => candidate.key === chart.ref && String(candidate.version) === String(chart.version),
  );
  if (!entry) return null;

  const expectedRecipeRoot = join(root, "recipes", chart.ref, String(chart.version));
  check(recipeRoot === expectedRecipeRoot, `${chart.ref}@${chart.version} normalization is not bound to its current recipe root`);
  const sourceLockPath = join(recipeRoot, "source-lock.yaml");
  check(existsSync(sourceLockPath), `${chart.ref}@${chart.version} current SourceLock is missing`);
  const sourceLock = readYaml(sourceLockPath);
  check(sourceLock.spec?.ref === chart.ref, `${chart.ref}@${chart.version} current SourceLock chart is not bound`);
  check(String(sourceLock.spec?.version) === String(chart.version), `${chart.ref}@${chart.version} current SourceLock version is not bound`);
  const rule = (entry.allowedSemanticDiffs ?? []).find(
    (candidate) => candidate.rule === LEADING_BLANK_LINE_RULE,
  );
  if (!rule) return null;
  check(typeof rule.identity === "string" && rule.identity.split("|").length === 4, `${chart.ref}@${chart.version} normalization identity is invalid`);
  check(typeof rule.reason === "string" && rule.reason.length > 0, `${chart.ref}@${chart.version} normalization reason is missing`);

  const receiptPath = join(recipeRoot, "revisions", "default", "r001", "receipts", "helm-equivalence-receipt.yaml");
  const renderedPath = join(recipeRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml");
  check(existsSync(receiptPath), `${chart.ref}@${chart.version} normalization receipt is missing`);
  check(existsSync(renderedPath), `${chart.ref}@${chart.version} retained default render is missing`);
  const receipt = readYaml(receiptPath);
  const labels = receipt.metadata?.labels ?? {};
  check(receipt.kind === "HelmEquivalenceReceipt", `${chart.ref}@${chart.version} normalization receipt kind is invalid`);
  check(receipt.spec?.result === "pass", `${chart.ref}@${chart.version} retained default equivalence receipt is not pass`);
  check(labels["confighub.io/chart-ref"] === chart.ref, `${chart.ref}@${chart.version} normalization receipt chart label is not bound`);
  check(String(labels["confighub.io/chart-version"]) === String(chart.version), `${chart.ref}@${chart.version} normalization receipt version label is not bound`);
  check(labels["confighub.io/variant"] === "default", `${chart.ref}@${chart.version} normalization receipt is not bound to the default variant`);
  const renderedSHA256 = sha256File(renderedPath);
  check(receipt.spec?.regularHelm?.renderedSHA256 === renderedSHA256, `${chart.ref}@${chart.version} retained default render digest is not bound`);
  const classification = (receipt.spec?.classifications ?? []).find(
    (candidate) => candidate.identity === rule.identity && candidate.classification === rule.rule,
  );
  check(classification?.disposition === "allowed", `${chart.ref}@${chart.version} retained default receipt does not authorize its declared normalization`);
  check(classification.reason === rule.reason, `${chart.ref}@${chart.version} normalization reason differs from the retained receipt`);
  check(Array.isArray(classification.paths) && classification.paths.length > 0, `${chart.ref}@${chart.version} retained normalization paths are missing`);
  check(classification.paths.every((path) => typeof path === "string"), `${chart.ref}@${chart.version} retained normalization paths are invalid`);
  check(
    classification.paths.every((path) => /^spec\.template\.spec\.containers\[\d+\]\.(?:livenessProbe|readinessProbe|startupProbe)\.exec\.command\[\d+\]$/.test(path)),
    `${chart.ref}@${chart.version} retained normalization paths must name probe exec commands`,
  );
  check(
    receipt.spec?.semanticNormalizations?.includes(rule.rule),
    `${chart.ref}@${chart.version} retained receipt does not list its normalization rule`,
  );

  return {
    rule,
    paths: [...classification.paths],
    evidence: {
      corpus: rootRelative(root, corpusPath),
      corpusSHA256: sha256File(corpusPath),
      sourceLock: rootRelative(root, sourceLockPath),
      sourceLockSHA256: sha256File(sourceLockPath),
      retainedDefaultReceipt: rootRelative(root, receiptPath),
      retainedDefaultReceiptSHA256: sha256File(receiptPath),
      retainedDefaultRenderedObjects: rootRelative(root, renderedPath),
      chartRef: chart.ref,
      chartVersion: String(chart.version),
      renderedSHA256,
    },
  };
}

// The installer round trip may remove one template-emitted blank first line from a
// block scalar. Every other leaf and the complete object structure remain strict.
export function leadingBlankLinePruneMatches(helmJson, cubJson, expectedPaths = null) {
  const paths = [];
  const allowedPaths = expectedPaths ? new Set(expectedPaths) : null;
  const matches = (left, right, path) => {
    if (typeof left === "string" && typeof right === "string") {
      if (left === right) return true;
      if (allowedPaths?.has(path) && left.startsWith("\n") && left.slice(1) === right) {
        paths.push(path);
        return true;
      }
      if (!allowedPaths && left.startsWith("\n") && left.slice(1) === right) {
        paths.push(path);
        return true;
      }
      return false;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      return left.every((item, index) => matches(item, right[index], `${path}[${index}]`));
    }
    if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(left) && !Array.isArray(right)) {
      const leftKeys = Object.keys(left).sort();
      const rightKeys = Object.keys(right).sort();
      if (JSON.stringify(leftKeys) !== JSON.stringify(rightKeys)) return false;
      return leftKeys.every((key) => matches(left[key], right[key], path ? `${path}.${key}` : key));
    }
    return left === right;
  };
  const allowed = matches(JSON.parse(helmJson), JSON.parse(cubJson), "");
  const exactPaths = expectedPaths
    ? allowed && paths.length === expectedPaths.length && paths.every((path) => allowedPaths.has(path))
    : true;
  return { allowed: exactPaths && paths.length > 0, paths };
}

export { LEADING_BLANK_LINE_RULE };
