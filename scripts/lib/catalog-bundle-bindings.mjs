import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { listTrackedFiles, readYamlFiles, repoRoot, sha256File } from "./proof-common.mjs";

const CERTIFIED_RECEIPTS_CSV = "data/certified-bundles/receipts.csv";
const PUBLICATION_ROOT = "runs/certified-bundles";

// Loads only committed evidence. Callers can then ask for one exact
// BaseVariantRecord binding with findCatalogBundleBinding().
export function loadCatalogBundleBindings(root = repoRoot) {
  const rows = readCsv(join(root, CERTIFIED_RECEIPTS_CSV));
  const receiptRows = rows.filter((row) => row.receipt && row.contents_kind === "rendered-config");
  const receiptPaths = receiptRows.map((row) => join(root, row.receipt));
  const receipts = readYamlBatches(receiptPaths);
  const publicationPaths = listTrackedFiles(join(root, PUBLICATION_ROOT))
    .filter((path) => path.endsWith("/publication-receipt.yaml"));
  const publications = readYamlBatches(publicationPaths);
  const publicationsByReceipt = new Map();
  for (const [path, publication] of publications) {
    if (publication?.kind === "CertifiedBundlePublicationReceipt" && typeof publication.spec?.receipt === "string") {
      const receiptPublications = publicationsByReceipt.get(publication.spec.receipt) ?? [];
      receiptPublications.push({ path: repoPath(root, path), document: publication });
      publicationsByReceipt.set(publication.spec.receipt, receiptPublications);
    }
  }

  return receiptRows.map((row) => {
    const receiptPath = join(root, row.receipt);
    const receipt = receipts.get(receiptPath);
    const publicationsForReceipt = publicationsByReceipt.get(row.receipt) ?? [];
    const matchingPublications = publicationsForReceipt.filter((publication) => publicationProblem(row, receipt, publication.document) === null);
    const publication = matchingPublications.length === 1 ? matchingPublications[0] : null;
    return {
      root,
      row,
      receiptPath: row.receipt,
      receipt,
      publicationPath: publication?.path ?? null,
      publication: publication?.document ?? null,
      publicationProblem: publication
        ? null
        : matchingPublications.length > 1
          ? "multiple publication receipts agree with the certified bundle receipt"
          : publicationProblem(row, receipt, publicationsForReceipt[0]?.document ?? null),
    };
  });
}

// Returns null when this record has no exact certified bundle. A matching
// candidate with broken publication evidence is refused so a caller cannot
// silently treat a planned or disagreeing reference as published evidence.
export function findCatalogBundleBinding(record, candidates) {
  const identity = recordIdentity(record, candidates[0]?.root ?? repoRoot);
  if (!identity) return null;
  const matches = candidates.filter((item) => matchesRecord(item, identity) && item.row.oci_published === "published");
  if (matches.length === 0) return null;
  if (matches.length > 1) throw new Error(`refusing catalog bundle binding for ${record.metadata?.name ?? "record"}: multiple exact certified bundle receipts match`);
  const [candidate] = matches;
  const problem = candidate.publicationProblem ?? publicationProblem(candidate.row, candidate.receipt, candidate.publication);
  if (problem) throw new Error(`refusing catalog bundle binding for ${record.metadata?.name ?? "record"}: ${problem}`);

  const bundle = candidate.receipt.spec.bundle;
  const sourceFile = bundle.files.find((file) => file.path === identity.packagePath);
  const routeFiles = bundle.files
    .filter((file) => typeof file.role === "string" && file.role.startsWith("route: "))
    .map((file) => ({ path: file.path, sha256: withSha256(file.sha256), role: file.role }));
  return {
    ociRef: `oci://${bundle.reference}@${withSha256(bundle.manifestDigest)}`,
    hashes: {
      configuration: withSha256(identity.configurationDigest),
      manifest: withSha256(bundle.manifestDigest),
      layer: withSha256(bundle.layerDigest),
      sourceFile: withSha256(sourceFile.sha256),
      certifiedReceipt: withSha256(sha256File(join(candidate.root, candidate.receiptPath))),
      publicationReceipt: withSha256(sha256File(join(candidate.root, candidate.publicationPath))),
    },
    sourcePaths: {
      configuration: identity.configurationPath,
      bundleConfiguration: sourceFile.path,
      receipt: candidate.receiptPath,
      publicationReceipt: candidate.publicationPath,
    },
    routeFiles,
    verdict: { lane: candidate.receipt.spec.verdict.lane, status: candidate.receipt.spec.verdict.status },
    boundaries: {
      routesNotExecuted: "The receipt and publication receipt declare these route files; this binding does not prove a remote pullback or route execution.",
    },
  };
}

function recordIdentity(record, root) {
  const source = record?.spec?.source;
  const configuration = record?.spec?.configuration;
  const base = record?.spec?.baseVariant?.name;
  if (!source || typeof source.name !== "string" || typeof source.version !== "string" || typeof base !== "string" || typeof configuration?.objects !== "string" || !digest(configuration.digest)) return null;
  const identity = {
    sourceName: source.name,
    version: source.version,
    base,
    configurationPath: configuration.objects,
    configurationDigest: digest(configuration.digest),
    objectCount: configuration.objectCount,
    packagePath: `packages/${source.name}/${source.version}/bases/${base}/upstream.yaml`,
  };
  if (!Object.hasOwn(configuration, "packagePath")) return identity;

  const name = record.metadata?.name ?? "record";
  const packagePath = configuration.packagePath;
  if (!safeRepoPath(packagePath)) {
    throw new Error(`refusing catalog bundle binding for ${name}: configuration.packagePath must be a safe repo-relative file path`);
  }
  if (!safeRepoPath(identity.configurationPath)) {
    throw new Error(`refusing catalog bundle binding for ${name}: configuration.objects must be a safe repo-relative file path`);
  }

  const configurationFile = checkedFile(root, identity.configurationPath, name, "configuration.objects");
  const packageFile = checkedFile(root, packagePath, name, "configuration.packagePath");
  const configurationHash = digest(sha256File(configurationFile));
  const packageHash = digest(sha256File(packageFile));
  if (configurationHash !== identity.configurationDigest) {
    throw new Error(`refusing catalog bundle binding for ${name}: configuration.objects does not match configuration.digest`);
  }
  if (packageHash !== configurationHash) {
    throw new Error(`refusing catalog bundle binding for ${name}: configuration.packagePath does not match configuration.objects`);
  }
  identity.packagePath = packagePath;
  return identity;
}

function safeRepoPath(path) {
  return typeof path === "string"
    && path.length > 0
    && !path.startsWith("/")
    && !path.includes("\\")
    && !path.split("/").some((part) => !part || part === "." || part === "..");
}

function checkedFile(root, path, name, field) {
  const absolute = join(root, path);
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) {
    throw new Error(`refusing catalog bundle binding for ${name}: ${field} is not a readable regular file`);
  }
  return absolute;
}

function matchesRecord(candidate, identity) {
  const receipt = candidate.receipt;
  if (receipt?.kind !== "CertifiedBundleReceipt" || receipt.spec?.bundle?.contentsKind !== "rendered-config") return false;
  const chart = receipt.spec.source?.charts?.find((entry) => entry?.name === identity.sourceName.split("/").at(-1) && entry.version === identity.version);
  if (!chart) return false;
  const bundle = receipt.spec.bundle;
  const configurationFiles = bundle.files?.filter((file) => !file.role || file.role === "rendered object set") ?? [];
  if (configurationFiles.length !== 1 || bundle.objectCount !== identity.objectCount) return false;
  const sourceFile = configurationFiles.find((file) => file?.path === identity.packagePath && digest(file.sha256) === identity.configurationDigest);
  if (!sourceFile || !bundle.manifestDigest || !bundle.layerDigest || !receipt.spec?.provenance?.generatedFrom?.includes(identity.configurationPath)) return false;
  try {
    return digest(sha256File(join(candidate.root, identity.configurationPath))) === identity.configurationDigest
      && digest(sha256File(join(candidate.root, sourceFile.path))) === identity.configurationDigest
      && bundle.files.filter((file) => typeof file.role === "string" && file.role.startsWith("route: ")).every((file) => digest(sha256File(join(candidate.root, file.path))) === digest(file.sha256));
  } catch {
    return false;
  }
}

function publicationProblem(row, receipt, publication) {
  const bundle = receipt?.spec?.bundle;
  if (receipt?.kind !== "CertifiedBundleReceipt" || !bundle) return "receipt is not a CertifiedBundleReceipt";
  if (row.oci_published !== "published") return "receipt index does not mark the OCI reference published";
  if (row.oci_reference !== bundle.reference || digest(row.bundle_digest) !== digest(bundle.manifestDigest)) return "receipt index disagrees with the bundle reference or manifest digest";
  if (row.verdict_lane !== receipt.spec?.verdict?.lane || row.verdict_status !== receipt.spec?.verdict?.status) return "receipt index disagrees with the verdict";
  if (!publication) return "publication receipt is missing";
  const published = publication.spec;
  if (published.receipt !== row.receipt || published.reference !== bundle.reference || digest(published.manifestDigest) !== digest(bundle.manifestDigest) || digest(published.layerDigest) !== digest(bundle.layerDigest) || published.artifactType !== bundle.artifactType || published.reproducible !== true) {
    return "publication receipt disagrees with the certified bundle receipt";
  }
  if (/planned/i.test(bundle.reference) || /planned/i.test(published.reference)) return "planned OCI references are not bindings";
  return null;
}

function readYamlBatches(paths) {
  const result = new Map();
  for (let index = 0; index < paths.length; index += 32) {
    for (const [path, document] of readYamlFiles(paths.slice(index, index + 32))) result.set(path, document);
  }
  return result;
}

function readCsv(path) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const headers = rows.shift() ?? [];
  return rows.filter((row) => row.some((value) => value !== "")).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function digest(value) {
  return typeof value === "string" && /^(?:sha256:)?[a-f0-9]{64}$/.test(value) ? value.replace(/^sha256:/, "") : null;
}

function withSha256(value) {
  const normalized = digest(value);
  if (!normalized) throw new Error("bundle evidence has an invalid digest");
  return `sha256:${normalized}`;
}

function repoPath(root, path) {
  return relative(root, path).split("\\").join("/");
}
