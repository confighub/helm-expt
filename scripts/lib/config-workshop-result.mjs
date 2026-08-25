import { createHash } from "node:crypto";
import {
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";

import { py, readYamlText, relativeRepo, repoRoot } from "./proof-common.mjs";

const OBJECT_SET_ALGORITHM = "cub-scan-canonical-json-v1";
const NOT_CHECKED = [
  "source rendering and values provenance beyond the supplied source record",
  "Kubernetes schema and admission behavior",
  "hook execution and CRD establishment",
  "live workload health and drift",
  "database migrations and external services",
];

export function composeWorkshopResult(options) {
  const candidate = loadObjectInput(options.candidatePath);
  const scanText = canonicalFileText(
    options.cubCheckText ?? readFileSync(options.cubCheckPath, "utf8"),
  );
  const scan = JSON.parse(scanText);
  const candidateIdentity = scannerObjectSetIdentity(candidate.documents);
  const advisoryReceipt = advisoryReceiptFor(scan, candidateIdentity);
  const candidateContentSha256 = sha256(candidate.content);
  const comparison = options.comparisonPath
    ? loadObjectInput(options.comparisonPath)
    : null;
  const comparisonContentSha256 = comparison ? sha256(comparison.content) : "";
  const compared = comparison ? compareObjectSets(comparison.documents, candidate.documents) : null;
  const sourceRecordText = options.sourceRecordPath
    ? canonicalFileText(readFileSync(options.sourceRecordPath, "utf8"))
    : "";
  const sourceRecord = sourceRecordText ? readYamlText(sourceRecordText) : null;
  if (sourceRecord && sourceRecord.kind !== "BaseVariantRecord") {
    throw new Error("--source-record must contain one BaseVariantRecord");
  }
  const decisionText = options.configurationDecisionPath
    ? canonicalFileText(readFileSync(options.configurationDecisionPath, "utf8"))
    : "";
  const decision = decisionText ? readYamlText(decisionText) : null;
  const findingDecisions = findingDecisionsFor(
    scan,
    decision,
    candidateIdentity,
    options.configurationDecisionPath,
    decisionText,
  );

  const createdAt = options.createdAt || new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("--created-at must be an ISO timestamp");
  const source = {
    type: options.sourceType,
    visibility: options.visibility || "private",
    identity: options.sourceIdentity,
    version: options.sourceVersion || "",
    valuesSummary: options.valuesSummary || "",
  };
  const question = {
    code: options.questionCode || "config-check",
    text: options.question || "Is this configuration right?",
  };
  const review = {
    apiVersion: "workshop.confighub.com/v1alpha1",
    kind: "ConfigurationReview",
    metadata: {
      id: `review-${candidateContentSha256.slice(7, 19)}`,
      createdAt,
    },
    spec: {
      question,
      source,
      candidate: contentObjectSetRecord(candidate, candidateContentSha256),
      comparison: comparison
        ? {
            status: "compared",
            objectSet: contentObjectSetRecord(comparison, comparisonContentSha256),
            ...compared,
          }
        : { status: "not-supplied" },
      checks: {
        method: "cub-check-workshop-composition-v1",
        scope: "Kubernetes object inventory, optional semantic comparison, and the supplied matching cub check result.",
        findings: scan.findings.map(reviewFinding),
        notChecked: NOT_CHECKED,
        advisoryReceipts: [advisoryReceipt],
      },
      findingDecisions,
      finding: "",
      recommendation: "Review the findings and the checks that did not run before keeping or promoting this configuration.",
      lifecycle: lifecycleFromRecord(sourceRecord),
      catalog: sourceRecord
        ? { status: "exact", url: options.catalogUrl || "" }
        : { status: "not-looked-up", url: options.catalogUrl || "" },
    },
  };
  const reviewText = `${JSON.stringify(review, null, 2)}\n`;
  const files = [
    fileRecord("candidate.yaml", "application/yaml", candidate.content),
  ];
  if (comparison) files.push(fileRecord("comparison.yaml", "application/yaml", comparison.content));
  if (sourceRecordText) files.push(fileRecord("source-and-intent.yaml", "application/yaml", sourceRecordText));
  files.push(fileRecord("cub-check.json", "application/json", scanText));
  if (decisionText) files.push(fileRecord("configuration-decision.yaml", "application/yaml", decisionText));
  files.push(fileRecord("workshop-review.json", "application/json", reviewText));

  const result = {
    apiVersion: "workshop.confighub.com/v1alpha2",
    kind: "WorkshopResult",
    metadata: {
      id: `result-${candidateContentSha256.slice(7, 19)}`,
      createdAt,
    },
    spec: {
      question,
      source,
      candidate: {
        content: {
          path: "candidate.yaml",
          sha256: candidateContentSha256,
        },
        objectSet: candidateIdentity,
      },
      files,
      checks: {
        completed: [
          "Kubernetes object inventory",
          "shared local configuration checks from a matching cub check result",
          ...(comparison ? ["semantic comparison with the supplied object set"] : []),
          ...(sourceRecordText ? ["Catalog source and lifecycle record retained with the result"] : []),
          ...(decisionText ? ["finding decisions bound to the accepted object set"] : []),
        ],
        notRun: NOT_CHECKED,
        advisoryReceipts: [advisoryReceipt],
      },
      findingDecisions,
      next: {
        local: findingDecisions.status === "recorded"
          ? "Keep this result with the change, or publish candidate.yaml as OCI using the local tools you already use. Reopen the decision when the object set, destination, or review date changes."
          : "Review every finding before you call this result accepted. Keep the result with the change, or publish candidate.yaml as OCI using the local tools you already use.",
        managed: `Retain candidate.yaml in ConfigHub with annotation workshop.confighub.com/object-set-sha256=${candidateIdentity.sha256} when the result needs shared history, validation, variants, promotion, release, or live comparison.`,
      },
    },
  };
  return {
    result,
    text: `${JSON.stringify(result, null, 2)}\n`,
    review,
    candidate,
    candidateIdentity,
  };
}

function findingDecisionsFor(scan, decision, candidateIdentity, decisionPath, decisionText) {
  if (!decision) {
    return {
      status: scan.findings.length ? "not-recorded" : "not-required",
      candidateObjectSetSha256: candidateIdentity.sha256,
      outcomes: scan.findings.map((finding) => ({
        findingId: finding.id,
        decision: "unreviewed",
        rationale: "No configuration decision was supplied for this finding.",
        controlIds: finding.control_ids ?? [],
      })),
    };
  }
  requireValue(decision.kind === "ConfigurationDecision", "--configuration-decision must contain one ConfigurationDecision");
  requireValue(
    decision.spec?.acceptedCandidate?.scannerObjectSetSha256 === candidateIdentity.sha256,
    "configuration decision does not describe the candidate objects",
  );
  const outcomes = new Map();
  for (const outcome of decision.spec?.outcomes ?? []) {
    requireValue(!outcomes.has(outcome.findingId), `configuration decision repeats ${outcome.findingId}`);
    outcomes.set(outcome.findingId, outcome);
  }
  const acceptedOutcomes = scan.findings.map((finding) => {
    const outcome = outcomes.get(finding.id);
    requireValue(outcome, `configuration decision has no outcome for ${finding.id}`);
    return {
      findingId: finding.id,
      decision: outcome.decision,
      rationale: outcome.rationale,
      controlIds: finding.control_ids ?? [],
      ...(outcome.exception
        ? {
            exception: {
              appliesTo: outcome.exception.appliesTo,
              excludes: outcome.exception.excludes,
              reviewBy: outcome.exception.reviewBy,
            },
          }
        : {}),
    };
  });
  return {
    status: "recorded",
    candidateObjectSetSha256: candidateIdentity.sha256,
    record: {
      path: portablePath(decisionPath),
      sha256: sha256(decisionText),
      apiVersion: decision.apiVersion,
      kind: decision.kind,
      name: decision.metadata?.name ?? "",
    },
    outcomes: acceptedOutcomes,
    managedControls: decision.spec?.checks?.managed?.controls ?? [],
  };
}

function portablePath(path) {
  const absolute = resolve(path);
  return absolute === repoRoot || absolute.startsWith(`${repoRoot}/`)
    ? relativeRepo(absolute)
    : basename(absolute);
}

export function loadObjectInput(inputPath) {
  const absolute = resolve(inputPath);
  const files = collectFiles(absolute);
  if (!files.length) throw new Error(`${inputPath} contains no YAML files`);
  const root = statSync(absolute).isDirectory() ? absolute : resolve(absolute, "..");
  const inputs = files.map((path) => ({
    path,
    displayPath: relative(root, path).replaceAll("\\", "/") || basename(path),
    content: canonicalFileText(readFileSync(path, "utf8")),
  }));
  const documents = parseDocuments(inputs);
  if (!documents.length) throw new Error(`${inputPath} contains no Kubernetes objects`);
  for (const document of documents) {
    if (!document.apiVersion || !document.kind || !document.metadata?.name) {
      throw new Error(`${document.source}: every document must have apiVersion, kind, and metadata.name`);
    }
  }
  const content = inputs
    .map((input) => `# Source: ${input.displayPath}\n${input.content.trim()}`)
    .join("\n---\n") + "\n";
  return { inputPath, inputs, documents, content };
}

export function scannerObjectSetIdentity(documents) {
  const objects = documents.map(({ source: _source, ...document }) => scannerJson(document)).sort();
  return {
    algorithm: OBJECT_SET_ALGORITHM,
    objectCount: objects.length,
    sha256: sha256(objects.map((object) => `${object}\n`).join("")),
  };
}

function collectFiles(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) return [path];
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(child));
    else if ([".yaml", ".yml"].includes(extname(entry.name).toLowerCase())) files.push(child);
  }
  return files.sort();
}

function parseDocuments(inputs) {
  return py(
    String.raw`
import datetime, json, os, sys, yaml
payload = json.load(sys.stdin)
documents = []
class ManifestLoader(yaml.SafeLoader):
    pass
ManifestLoader.add_constructor("tag:yaml.org,2002:value", lambda loader, node: loader.construct_scalar(node))
def scalar(value):
    if isinstance(value, (datetime.datetime, datetime.date)):
        text = value.isoformat()
        return text.replace("+00:00", "Z")
    if isinstance(value, bytes):
        return value.decode("utf-8")
    raise TypeError(type(value).__name__)
for source in payload:
    default_name = os.path.splitext(os.path.basename(source["displayPath"]))[0]
    for document in yaml.load_all(source["content"], Loader=ManifestLoader):
        if not isinstance(document, dict):
            continue
        metadata = document.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
            document["metadata"] = metadata
        if not str(metadata.get("name") or "").strip():
            metadata["name"] = default_name
        if not str(metadata.get("namespace") or "").strip():
            metadata["namespace"] = "default"
        document["source"] = source["displayPath"]
        documents.append(document)
print(json.dumps(documents, sort_keys=True, default=scalar))
`,
    JSON.stringify(inputs.map(({ displayPath, content }) => ({ displayPath, content }))),
  );
}

function advisoryReceiptFor(scan, candidateIdentity) {
  requireValue(scan.schema_version === "risk-scan-findings-v1", "cub check result has the wrong schema_version");
  requireValue(scan.surface === "cub-scan", "cub check result has the wrong surface");
  requireValue(scan.input?.object_count === candidateIdentity.objectCount, "cub check result has a different object count");
  requireValue(scan.input?.object_set_sha256 === candidateIdentity.sha256, "cub check result does not describe the candidate objects");
  requireValue(scan.finding_count === scan.findings?.length, "cub check finding_count does not match findings");
  const bundle = scan.pattern_bundle;
  const provenance = scan.provenance;
  requireValue(bundle?.schema_version === "bundle-manifest-v1", "cub check result has no pattern bundle identity");
  requireValue(provenance?.source_version, "cub check result has no scanner version");
  requireValue(!Number.isNaN(Date.parse(provenance.scan_time)), "cub check result has no valid scan time");
  return {
    authority: "local-advisory",
    tool: "cub-scan",
    version: provenance.source_version,
    schemaVersion: scan.schema_version,
    scanTime: provenance.scan_time,
    catalogVersion: provenance.catalog_version,
    patternBundle: {
      schemaVersion: bundle.schema_version,
      version: bundle.version,
      sourceRepo: bundle.source_repo,
      manifestSha256: prefixedSha(bundle.manifest_sha256),
      catalogSha256: prefixedSha(bundle.catalog_sha256),
    },
    input: {
      objectCount: scan.input.object_count,
      objectSetSha256: scan.input.object_set_sha256,
    },
    findingCount: scan.finding_count,
    findingIds: scan.findings.map((finding) => finding.id),
  };
}

function lifecycleFromRecord(record) {
  if (!record) return { record: "not supplied", requirements: [], routes: [], targetFacts: {} };
  return {
    record: record.metadata?.name || "supplied BaseVariantRecord",
    requirements: record.spec?.lifecycle?.requirements?.items || [],
    routes: record.spec?.lifecycle?.routeIntent?.routes || [],
    targetFacts: record.spec?.lifecycle?.targetFacts || {},
    resolution: record.spec?.lifecycle?.resolution || {},
  };
}

function compareObjectSets(before, after) {
  const oldObjects = new Map(before.map((document) => [objectRef(document), scannerJson(stripSource(document))]));
  const newObjects = new Map(after.map((document) => [objectRef(document), scannerJson(stripSource(document))]));
  const added = [...newObjects.keys()].filter((ref) => !oldObjects.has(ref)).sort();
  const removed = [...oldObjects.keys()].filter((ref) => !newObjects.has(ref)).sort();
  const shared = [...newObjects.keys()].filter((ref) => oldObjects.has(ref));
  return {
    added,
    removed,
    changed: shared.filter((ref) => oldObjects.get(ref) !== newObjects.get(ref)).sort(),
    unchanged: shared.filter((ref) => oldObjects.get(ref) === newObjects.get(ref)).sort(),
    noOp: [],
  };
}

function contentObjectSetRecord(input, contentSha256) {
  return {
    name: basename(input.inputPath),
    sha256: contentSha256,
    objectCount: input.documents.length,
    objects: input.documents.map(objectRef).sort(),
  };
}

function objectRef(document) {
  return `${document.kind}/${document.metadata?.namespace || "default"}/${document.metadata?.name || "unnamed"}`;
}

function reviewFinding(finding) {
  const level = finding.severity === "info"
    ? "information"
    : ["critical", "warning"].includes(finding.severity)
      ? "warning"
      : "review";
  const resource = finding.resource || {};
  const object = [resource.kind, resource.namespace || "default", resource.name].filter(Boolean).join("/");
  return { code: finding.id, level, object, message: finding.message };
}

function fileRecord(path, mediaType, content) {
  return { path, mediaType, sha256: sha256(content), content };
}

function stripSource(document) {
  const { source: _source, ...rest } = document;
  return rest;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function scannerJson(value) {
  return JSON.stringify(stableValue(value))
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function canonicalFileText(value) {
  return `${String(value).replaceAll("\r\n", "\n").replace(/\n*$/, "")}\n`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function prefixedSha(value) {
  const digest = String(value || "").toLowerCase();
  requireValue(/^[0-9a-f]{64}$/.test(digest), `invalid SHA-256: ${value}`);
  return `sha256:${digest}`;
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
