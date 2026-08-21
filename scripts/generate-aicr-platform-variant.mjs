#!/usr/bin/env node

// Gate an AI-proposed change to an AICR platform configuration.
//
// The request names a reviewed control point and proposes exact field edits.
// The gate does not trust those edits. It compares the proposed result with the
// retained base at three levels:
//
//   1. the Kubernetes object identities must stay the same;
//   2. the changed Applications must equal the control point's declared reach;
//   3. only the control point's exact field may change inside each Application.
//
// An accepted request produces a complete candidate object set and a receipt.
// A refused request produces only a receipt, so a failed candidate never becomes
// a catalog variant by accident. Everything runs against committed files and
// needs no ConfigHub account, cluster, cloud account, GPU, or network.

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  identityFor,
  listFiles,
  parseDocs,
  readYaml,
  readYamlText,
  relativeRepo,
  repoRoot,
  serializeYaml,
  sha256,
  write,
} from "./lib/proof-common.mjs";

const acceptedRequestPath = join(
  repoRoot,
  "examples",
  "aicr",
  "platform-variants",
  "cpu-starter-standard-storage.yaml",
);
const refusedRequestPath = join(
  repoRoot,
  "examples",
  "aicr",
  "platform-variants",
  "cpu-starter-overbroad-storage.yaml",
);
const outputRoot = join(repoRoot, "data", "aicr-platform-variant");
const recordedAt = "2026-08-21";
const acceptedCandidatePath = join(outputRoot, "cpu-starter-standard-storage.yaml");
const acceptedReceiptPath = join(repoRoot, "runs", "aicr-platform-variant", "accepted-receipt.yaml");
const refusedReceiptPath = join(repoRoot, "runs", "aicr-platform-variant", "refused-receipt.yaml");
const summaryPath = join(outputRoot, "summary.md");

const cases = [
  {
    requestPath: acceptedRequestPath,
    expected: "pass",
    candidatePath: acceptedCandidatePath,
    receiptPath: acceptedReceiptPath,
  },
  {
    requestPath: refusedRequestPath,
    expected: "refused",
    candidatePath: null,
    forbiddenCandidatePath: join(outputRoot, "cpu-starter-overbroad-storage.yaml"),
    receiptPath: refusedReceiptPath,
  },
];

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-aicr-platform-variant.mjs --generate
  node scripts/generate-aicr-platform-variant.mjs --verify
  node scripts/generate-aicr-platform-variant.mjs --self-test`);
  process.exit(2);
}

if (mode === "--generate") {
  const results = cases.map((testCase) => evaluateCase(testCase));
  for (const result of results) writeResult(result);
  write(summaryPath, renderSummary(results));
  console.log(`wrote ${relativeRepo(summaryPath)} and ${results.length} parity receipt(s)`);
} else if (mode === "--verify") {
  const results = cases.map((testCase) => evaluateCase(testCase));
  for (const result of results) verifyResult(result);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-platform-variant:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(results),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-platform-variant:generate`,
  );
  console.log("verified one accepted and one refused AICR platform variant request");
} else {
  selfTest();
  console.log("verified document-set, blast-radius, and field-level platform variant refusals");
}

function evaluateCase(testCase, requestOverride = null) {
  const request = requestOverride ?? loadRequest(testCase.requestPath);
  const controlRecordPath = join(repoRoot, request.spec.controlPointRecord);
  check(existsSync(controlRecordPath), `${relativeRepo(testCase.requestPath)} names a missing control-point record`);
  const controlRecord = readYaml(controlRecordPath);
  check(controlRecord.kind === "ControlPointRecord", `${relativeRepo(controlRecordPath)} is not a ControlPointRecord`);
  const controlPoint = (controlRecord.spec?.controlPoints ?? []).find(
    (point) => point.id === request.spec.controlPoint,
  );
  check(controlPoint, `${relativeRepo(testCase.requestPath)} names the unknown control point ${request.spec.controlPoint}`);

  const base = loadEntryDocuments(controlRecord);
  const allowedField = allowedFieldFor(controlPoint);
  if (allowedField && Object.hasOwn(controlPoint.locator ?? {}, "equals")) {
    for (const identity of controlPoint.governs ?? []) {
      const doc = base.docs.get(identity);
      check(doc, `${relativeRepo(controlRecordPath)} governs the missing document ${identity}`);
      check(
        stable(getFieldValue(doc, allowedField)) === stable(controlPoint.locator.equals),
        `${relativeRepo(controlRecordPath)} records the wrong starting value for ${identity} ${allowedField}`,
      );
    }
  }
  const candidate = clone(base.docs);
  const candidateSources = clone(base.sources);
  for (const change of request.spec.changes) applyChange(candidate, candidateSources, change);

  const baseIds = [...base.docs.keys()].sort();
  const candidateIds = [...candidate.keys()].sort();
  const added = candidateIds.filter((identity) => !base.docs.has(identity));
  const removed = baseIds.filter((identity) => !candidate.has(identity));
  const documentSetPass = added.length === 0 && removed.length === 0;

  const commonIds = baseIds.filter((identity) => candidate.has(identity));
  const differences = commonIds.flatMap((identity) =>
    collectDifferences(base.docs.get(identity), candidate.get(identity), "", [], identity),
  );
  const changedDocuments = [...new Set(differences.map((difference) => difference.document))].sort();
  const declaredDocuments = [...(controlPoint.governs ?? [])].sort();
  const blastRadiusPass = documentSetPass && sameStrings(changedDocuments, declaredDocuments);

  const changedFields = [...new Set(differences.map((difference) => difference.field))].sort();
  const fieldLevelPass = Boolean(allowedField)
    && differences.length > 0
    && differences.every((difference) => difference.field === allowedField)
    && declaredDocuments.every((identity) =>
      differences.some((difference) => difference.document === identity && difference.field === allowedField),
    );

  const result = documentSetPass && blastRadiusPass && fieldLevelPass ? "pass" : "refused";
  check(
    result === testCase.expected,
    `${relativeRepo(testCase.requestPath)} expected ${testCase.expected} but evaluated as ${result}`,
  );

  const candidateDocs = [...candidate.values()].sort((left, right) => identityFor(left).localeCompare(identityFor(right)));
  const candidateYaml = candidateIds
    .map((identity) => normalizeSourceDocument(candidateSources.get(identity)))
    .join("");
  check(
    objectSetDigest(parseDocs(candidateYaml)) === objectSetDigest(candidateDocs),
    `${relativeRepo(testCase.requestPath)} produced YAML that does not match the checked candidate objects`,
  );
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AicrPlatformVariantParityReceipt",
    metadata: { name: request.metadata.name, recordedAt },
    spec: {
      request: relativeRepo(testCase.requestPath),
      intent: request.spec.intent,
      mappedBy: request.spec.mappedBy,
      source: {
        entry: controlRecord.spec.entry,
        controlPointRecord: request.spec.controlPointRecord,
        controlPoint: request.spec.controlPoint,
        documentCount: baseIds.length,
        objectSetDigest: objectSetDigest([...base.docs.values()]),
      },
      proposal: {
        changes: request.spec.changes,
        candidateDocumentCount: candidateIds.length,
        candidateObjectSetDigest: objectSetDigest(candidateDocs),
      },
      checks: {
        documentSet: {
          result: documentSetPass ? "pass" : "refused",
          added,
          removed,
        },
        blastRadius: {
          result: blastRadiusPass ? "pass" : "refused",
          declaredDocuments,
          changedDocuments,
        },
        fieldLevel: {
          result: fieldLevelPass ? "pass" : "refused",
          allowedField: allowedField || "structured locator required",
          changedFields,
          differences,
        },
      },
      boundary: {
        configPlaneOnly: true,
        contactedConfigHub: false,
        contactedKubernetes: false,
        gpuWorkloadProven: false,
      },
    },
    status: {
      result,
      reason: verdictReason({ documentSetPass, blastRadiusPass, fieldLevelPass }),
      correctRouteForward: result === "pass"
        ? "The candidate may be retained as a reviewed ConfigHub variant or kept as local files or OCI. Deployment and workload checks remain separate."
        : correctRouteForward({ documentSetPass, blastRadiusPass, fieldLevelPass, allowedField }),
    },
  };

  return { ...testCase, request, receipt, candidateYaml: result === "pass" ? candidateYaml : null };
}

function loadRequest(path) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
  const request = readYaml(path);
  check(request.apiVersion === "catalog.confighub.com/v1alpha1", `${relativeRepo(path)} has an unsupported apiVersion`);
  check(request.kind === "PlatformVariantRequest", `${relativeRepo(path)} is not a PlatformVariantRequest`);
  check(request.metadata?.name, `${relativeRepo(path)} has no name`);
  check(request.spec?.intent, `${relativeRepo(path)} has no intent`);
  check(request.spec?.mappedBy, `${relativeRepo(path)} does not say who mapped the request`);
  check(request.spec?.controlPointRecord, `${relativeRepo(path)} has no controlPointRecord`);
  check(request.spec?.controlPoint, `${relativeRepo(path)} has no controlPoint`);
  check(Array.isArray(request.spec?.changes) && request.spec.changes.length > 0, `${relativeRepo(path)} has no changes`);
  for (const change of request.spec.changes) {
    check(change.document && change.field, `${relativeRepo(path)} has a change without a document or field`);
    check(Object.hasOwn(change, "before") && Object.hasOwn(change, "after"), `${relativeRepo(path)} has a change without before and after values`);
  }
  return request;
}

function loadEntryDocuments(controlRecord) {
  const entryRoot = join(repoRoot, controlRecord.spec.entry);
  check(existsSync(entryRoot), `${controlRecord.spec.entry} does not exist`);
  const docs = new Map();
  const sources = new Map();
  for (const scope of controlRecord.spec.documentScope ?? []) {
    const scopeRoot = join(entryRoot, scope);
    check(existsSync(scopeRoot), `${controlRecord.spec.entry}/${scope} does not exist`);
    for (const path of listFiles(scopeRoot).filter((file) => /\.ya?ml$/u.test(file))) {
      const source = readFileSync(path, "utf8");
      const parsed = parseDocs(source);
      check(parsed.length === 1, `${relativeRepo(path)} must contain one object for readable variant output`);
      for (const doc of parsed) {
        const identity = identityFor(doc);
        check(identity.replaceAll("|", ""), `${relativeRepo(path)} contains an object without an identity`);
        check(!docs.has(identity), `${relativeRepo(path)} duplicates ${identity}`);
        docs.set(identity, doc);
        sources.set(identity, source);
      }
    }
  }
  check(docs.size > 0, `${controlRecord.spec.entry} contains no scoped Kubernetes objects`);
  return { docs, sources };
}

function applyChange(docs, sources, change) {
  const doc = docs.get(change.document);
  check(doc, `the proposal names the missing document ${change.document}`);
  const source = sources.get(change.document);
  check(typeof source === "string", `the proposal has no readable source for ${change.document}`);
  const [outerPath, embeddedPath] = String(change.field).split("::");
  if (embeddedPath !== undefined) {
    const text = getPath(doc, outerPath);
    check(typeof text === "string", `${change.document} ${outerPath} is not an embedded YAML string`);
    const embedded = readYamlText(text);
    check(
      stable(getPath(embedded, embeddedPath)) === stable(change.before),
      `${change.document} ${change.field} does not equal the proposal's before value`,
    );
    setPath(embedded, embeddedPath, change.after);
    setPath(doc, outerPath, serializeYaml(embedded).trimEnd());
    sources.set(
      change.document,
      replaceScalarLine(source, embeddedPath.split(".").at(-1), change.before, change.after, change.field),
    );
  } else {
    check(
      stable(getPath(doc, outerPath)) === stable(change.before),
      `${change.document} ${change.field} does not equal the proposal's before value`,
    );
    setPath(doc, outerPath, change.after);
    sources.set(
      change.document,
      replaceScalarLine(source, outerPath.split(".").at(-1), change.before, change.after, change.field),
    );
  }

  // Re-index after every operation. A proposal that changes identity is not
  // blocked here; the document-set gate records and refuses it below.
  const nextIdentity = identityFor(doc);
  if (nextIdentity !== change.document) {
    docs.delete(change.document);
    check(!docs.has(nextIdentity), `the proposal creates the duplicate identity ${nextIdentity}`);
    docs.set(nextIdentity, doc);
    const changedSource = sources.get(change.document);
    sources.delete(change.document);
    sources.set(nextIdentity, changedSource);
  }
}

function replaceScalarLine(source, key, before, after, field) {
  const escapedKey = escapeRegex(key);
  const escapedBefore = escapeRegex(String(before));
  const pattern = new RegExp(`^(\\s*${escapedKey}:\\s*)(["']?)${escapedBefore}\\2(\\s*(?:#.*)?)$`, "gmu");
  const matches = [...source.matchAll(pattern)];
  check(matches.length === 1, `${field} must match exactly one readable YAML line, found ${matches.length}`);
  return source.replace(
    pattern,
    (_match, prefix, quote, suffix) => `${prefix}${quote || ""}${String(after)}${quote || ""}${suffix}`,
  );
}

function normalizeSourceDocument(source) {
  check(typeof source === "string" && source.trim(), "candidate source is empty");
  const normalized = `${source.trimEnd()}\n`;
  return normalized.trimStart().startsWith("---") ? normalized : `---\n${normalized}`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectDifferences(before, after, path, differences, document) {
  if (stable(before) === stable(after)) return differences;
  if (path === "spec.source.helm.values" && typeof before === "string" && typeof after === "string") {
    const beforeValues = readYamlText(before);
    const afterValues = readYamlText(after);
    return collectDifferences(beforeValues, afterValues, `${path}::`, differences, document);
  }
  if (
    before === null
    || after === null
    || typeof before !== "object"
    || typeof after !== "object"
    || Array.isArray(before) !== Array.isArray(after)
  ) {
    differences.push({ document, field: path || "<root>", before, after });
    return differences;
  }
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  for (const key of keys) {
    const next = path.endsWith("::") ? `${path}${key}` : path ? `${path}.${key}` : key;
    collectDifferences(before?.[key], after?.[key], next, differences, document);
  }
  return differences;
}

function allowedFieldFor(controlPoint) {
  const locator = controlPoint.locator ?? {};
  if (locator.valuesPath) return `spec.source.helm.values::${locator.valuesPath}`;
  if (locator.path) return String(locator.path);
  return "";
}

function getFieldValue(doc, field) {
  const [outerPath, embeddedPath] = String(field).split("::");
  const outerValue = getPath(doc, outerPath);
  if (embeddedPath === undefined) return outerValue;
  check(typeof outerValue === "string", `${outerPath} is not an embedded YAML string`);
  return getPath(readYamlText(outerValue), embeddedPath);
}

function getPath(value, path) {
  return String(path).split(".").reduce((current, segment) => {
    if (current === undefined || current === null) return undefined;
    return current[segment];
  }, value);
}

function setPath(value, path, replacement) {
  const parts = String(path).split(".");
  let current = value;
  for (const segment of parts.slice(0, -1)) {
    check(current && typeof current === "object" && segment in current, `${path} does not exist`);
    current = current[segment];
  }
  const last = parts.at(-1);
  check(current && typeof current === "object" && last in current, `${path} does not exist`);
  current[last] = replacement;
}

function objectSetDigest(docs) {
  return `sha256:${sha256(stable(
    [...docs]
      .map((doc) => ({ identity: identityFor(doc), document: normalizeEmbeddedValues(doc) }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  ))}`;
}

function normalizeEmbeddedValues(doc) {
  const result = clone(doc);
  const values = getPath(result, "spec.source.helm.values");
  if (typeof values === "string") setPath(result, "spec.source.helm.values", readYamlText(values));
  return result;
}

function writeResult(result) {
  if (result.candidatePath && result.candidateYaml) write(result.candidatePath, result.candidateYaml);
  if (result.forbiddenCandidatePath && existsSync(result.forbiddenCandidatePath)) {
    rmSync(result.forbiddenCandidatePath);
  }
  write(result.receiptPath, serializeYaml(result.receipt));
}

function verifyResult(result) {
  check(existsSync(result.receiptPath), `${relativeRepo(result.receiptPath)} is missing; run npm run aicr-platform-variant:generate`);
  check(
    readFileSync(result.receiptPath, "utf8") === serializeYaml(result.receipt),
    `${relativeRepo(result.receiptPath)} is stale; run npm run aicr-platform-variant:generate`,
  );
  if (result.candidatePath) {
    check(existsSync(result.candidatePath), `${relativeRepo(result.candidatePath)} is missing; run npm run aicr-platform-variant:generate`);
    check(
      readFileSync(result.candidatePath, "utf8") === result.candidateYaml,
      `${relativeRepo(result.candidatePath)} is stale; run npm run aicr-platform-variant:generate`,
    );
  }
  if (result.forbiddenCandidatePath) {
    check(
      !existsSync(result.forbiddenCandidatePath),
      `${relativeRepo(result.forbiddenCandidatePath)} must not exist because the request was refused`,
    );
  }
}

function renderSummary(results) {
  const accepted = results.find((result) => result.receipt.status.result === "pass");
  const refused = results.find((result) => result.receipt.status.result === "refused");
  return `# AICR platform variant parity

An AI can suggest a platform change. This gate decides whether the suggestion
changed only the field the operator asked for, in exactly the Applications the
catalog says that field controls.

The accepted example changes the CPU starter's Prometheus StorageClass from
\`gp3\` to \`standard\`. The object set stays at ${accepted.receipt.spec.source.documentCount},
only \`kube-prometheus-stack\` changes, and the only changed field is
\`${accepted.receipt.spec.checks.fieldLevel.allowedField}\`.

The refused example asks for the same StorageClass change but also moves the
Application to another namespace. The extra edit looks valid as YAML, but it was
not requested and is outside the selected control point, so no candidate file is
written.

| Request | Result | Object identities | Declared reach | Exact fields |
| --- | --- | --- | --- | --- |
${results.map((result) => `| \`${result.request.metadata.name}\` | **${result.receipt.status.result}** | ${result.receipt.spec.checks.documentSet.result} | ${result.receipt.spec.checks.blastRadius.result} | ${result.receipt.spec.checks.fieldLevel.result} |`).join("\n")}

## Files

- [Accepted request](../../${relativeRepo(accepted.requestPath)})
- [Accepted candidate](./${accepted.candidatePath.split("/").at(-1)})
- [Accepted receipt](../../${relativeRepo(accepted.receiptPath)})
- [Refused request](../../${relativeRepo(refused.requestPath)})
- [Refused receipt](../../${relativeRepo(refused.receiptPath)})
- [Control-point record](../../${accepted.request.spec.controlPointRecord})

## Boundary

This is a configuration check. It does not contact ConfigHub or Kubernetes and
does not run a GPU workload. An accepted candidate may be kept as files or OCI,
or retained as a ConfigHub variant for review and promotion. Deployment and
workload evidence remain separate.
`;
}

function verdictReason({ documentSetPass, blastRadiusPass, fieldLevelPass }) {
  if (!documentSetPass) return "The proposal added, removed, or renamed a Kubernetes object.";
  if (!blastRadiusPass) return "The proposal changed Applications outside the control point's declared reach, or missed one it had to change.";
  if (!fieldLevelPass) return "The proposal changed a field outside the selected control point.";
  return "The object identities, changed Applications, and exact changed field match the selected control point.";
}

function correctRouteForward({ documentSetPass, blastRadiusPass, fieldLevelPass, allowedField }) {
  if (!documentSetPass) return "Remove the object addition, deletion, or rename, or submit a separate reviewed request that explicitly changes the platform shape.";
  if (!blastRadiusPass) return "Limit the change to every Application named by the control point, and no others.";
  if (!allowedField) return "Replace the control point's text token with a structured path before an AI-authored change can be accepted.";
  if (!fieldLevelPass) return `Remove every edit except ${allowedField}, then run the gate again.`;
  return "Review the request and its control-point record before trying again.";
}

function selfTest() {
  const acceptedCase = cases[0];
  const accepted = evaluateCase(acceptedCase);
  check(accepted.receipt.status.result === "pass", "the accepted fixture did not pass");

  const fieldRefusal = evaluateCase(cases[1]);
  check(
    fieldRefusal.receipt.spec.checks.documentSet.result === "pass"
      && fieldRefusal.receipt.spec.checks.blastRadius.result === "pass"
      && fieldRefusal.receipt.spec.checks.fieldLevel.result === "refused",
    "the over-broad fixture did not isolate the field-level refusal",
  );

  const renamed = clone(loadRequest(acceptedRequestPath));
  renamed.spec.changes = [{
    document: "argoproj.io/v1alpha1|Application|argocd|kube-prometheus-stack",
    field: "metadata.name",
    before: "kube-prometheus-stack",
    after: "kube-prometheus-stack-copy",
  }];
  const renamedResult = evaluateCase({ ...acceptedCase, expected: "refused", candidatePath: null }, renamed);
  check(
    renamedResult.receipt.spec.checks.documentSet.result === "refused",
    "renaming an object did not fail document-set parity",
  );

  const wrongReach = clone(loadRequest(acceptedRequestPath));
  wrongReach.spec.changes = [{
    document: "argoproj.io/v1alpha1|Application|argocd|cert-manager",
    field: "spec.destination.namespace",
    before: "cert-manager",
    after: "cert-manager-review",
  }];
  const wrongReachResult = evaluateCase({ ...acceptedCase, expected: "refused", candidatePath: null }, wrongReach);
  check(
    wrongReachResult.receipt.spec.checks.blastRadius.result === "refused",
    "changing an undeclared Application did not fail blast-radius parity",
  );

  const replacementSyntax = clone(loadRequest(acceptedRequestPath));
  replacementSyntax.spec.changes[0].after = "$&literal";
  const replacementSyntaxResult = evaluateCase(acceptedCase, replacementSyntax);
  check(
    replacementSyntaxResult.candidateYaml.includes("storageClassName: $&literal"),
    "a dollar sign in a scalar was interpreted as replacement syntax",
  );
}

function clone(value) {
  if (value instanceof Map) return new Map([...value.entries()].map(([key, item]) => [key, clone(item)]));
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameStrings(left, right) {
  return stable([...left].sort()) === stable([...right].sort());
}
