// Shared extraction and rendering logic for the NIM-Operator model-profile
// generator: NVIDIA's own k8s-nim-operator sample corpus, retained under
// data/aicr-nim-operator-models/upstream/serving/, profiled one record per
// retained `kind: NIMService` object.
//
// This corpus is distinct from the kserve-nim-inference entry's retained
// nim-deploy KServe subtree (scripts/lib/aicr-nim-model-profiles.mjs): that
// one retains InferenceService/ClusterServingRuntime pairs from a different
// upstream repository. This one retains NIMService samples (paired with a
// NIMCache where the sample precaches a model) straight from the operator
// that defines the NIMService custom resource, and validates every sample
// against the operator's own retained CRD
// (examples/aicr/eks-h100-inference-nim/operator-crds/apps.nvidia.com_nimservices.yaml).
//
// Slug derivation: a slug starts as `<scenario>-<metadata.name>` (both
// kebab-cased), where scenario is the sample's leaf directory name (for
// example "basic", "full", "lora", or "example0" under
// advanced/dra/auto-creation/). Several retained directories hold more than
// one sample file, and several of those files reuse the same NIMService
// metadata.name as a sibling file in the same directory (for example
// standalone/basic/llm.yaml and standalone/basic/multi-llm.yaml both name
// their NIMService meta-llama-3-2-1b-instruct). Where that produces a
// duplicate, the file's own stem (its filename without extension) is
// appended to disambiguate; a file-local document index is appended after
// that only if a single file ever defined more than one NIMService under the
// same name, which does not happen anywhere in the retained corpus today.
// Uniqueness is asserted, not assumed: buildReport fails closed if two
// targets still produce the same slug.
//
// GPU count derivation: most retained NIMServices request a GPU the
// conventional way, spec.resources.limits["nvidia.com/gpu"]. One retained
// sample (standalone/confidential-computing/llm-kata-sandbox.yaml) requests
// a Kata-VM passthrough GPU under the physical-GPU key
// spec.resources.limits["nvidia.com/pgpu"] instead. Four retained samples
// (the advanced/dra/ ones) request a GPU through Dynamic Resource Allocation
// (spec.draResources) instead of spec.resources at all; for those, the count
// is the sum of each claimed device's own `count` (CRD default 1) for an
// inline claimCreationSpec, or the sum of the referenced
// ResourceClaimTemplate's own `spec.spec.devices.requests[].exactly.count`
// for a resourceClaimTemplateName reference resolved against a
// ResourceClaimTemplate object in the same retained file. Every fact records
// which of these three sources supplied its gpuCount.
//
// Accelerator derivation: no NIMService in the retained corpus carries a
// GPU-product nodeSelector (the corpus's DRA samples select a GPU by
// architecture or capacity instead, through attributeSelectors or
// celExpressions, which is a different mechanism this module does not read
// as a product pin). Every retained sample is therefore "generic" today:
// its `accelerator` fact is null. If a future retained sample ever does
// carry a nodeSelector, extractAccelerator requires it to use the
// `nvidia.com/gpu.product` key and fails closed with a message to extend
// this module otherwise, rather than silently ignoring or misreading it.
//
// The generator and the verifier both call buildReport(), so they cannot
// disagree. scripts/lib/aicr-platform-members.mjs imports buildReport() too,
// to attach these facts to the platform=nim inference platforms; that keeps
// this module the single source of truth for the retained corpus, the way
// the module header there already promises.
//
// Everything here reads committed bytes only. No network, no cluster, no NGC
// contact, and no wall-clock time enters the output; the only date recorded
// anywhere is the source `retrievedAt` pinned in the retention receipt.

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { check, listYamlFiles, readYaml, readYamlText, relativeRepo, repoRoot, serializeYaml, sha256File } from "./proof-common.mjs";

const ROOT_DIR = join("data", "aicr-nim-operator-models");
const UPSTREAM_DIR = join(ROOT_DIR, "upstream");
const SERVING_DIR = join(UPSTREAM_DIR, "serving");
const CHECKSUMS_PATH = join(ROOT_DIR, "upstream-checksums.txt");
const RETENTION_RECEIPT_PATH = join(ROOT_DIR, "retention-receipt.yaml");
const LICENSE_READ_DOC = "docs/planning/nim-ngc-license-read.md";
const NIMSERVICE_CRD_PATH = join("examples", "aicr", "eks-h100-inference-nim", "operator-crds", "apps.nvidia.com_nimservices.yaml");
const NIMSERVICE_CRD_VERSION = "v1alpha1";
const NIMSERVICE_API_VERSION = "apps.nvidia.com/v1alpha1";
const GPU_PRODUCT_NODE_SELECTOR_KEY = "nvidia.com/gpu.product";

export const OUTPUT_ROOT = ROOT_DIR;
export const PROFILES_DIR = join(ROOT_DIR, "profiles");
export const RECEIPTS_DIR = join(ROOT_DIR, "receipts");
export const SUMMARY_PATH = join(ROOT_DIR, "summary.md");

function repoJoin(root, ...parts) {
  return join(root, ...parts);
}

function kebab(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readAllDocs(absPath) {
  const parsed = readYamlText(readFileSync(absPath, "utf8"));
  const docs = Array.isArray(parsed) ? parsed : [parsed];
  return docs.filter((doc) => doc && typeof doc === "object");
}

// upstream-checksums.txt is a standard `sha256sum` listing: 64 hex
// characters, two spaces, then a path relative to `upstream/`.
function loadChecksums(root) {
  const path = repoJoin(root, CHECKSUMS_PATH);
  const text = readFileSync(path, "utf8");
  const map = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const match = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
    check(match, `${relativeRepo(path)}: malformed checksum line: ${JSON.stringify(line)}`);
    map.set(match[2], match[1]);
  }
  return map;
}

function loadSource(root) {
  const path = repoJoin(root, RETENTION_RECEIPT_PATH);
  const doc = readYaml(path);
  check(doc.kind === "SourceRetentionReceipt", `${relativeRepo(path)}: expected kind SourceRetentionReceipt`);
  const source = doc.spec?.source ?? {};
  for (const field of ["name", "repository", "commit", "subtree", "license", "retrievedAt"]) {
    check(source[field], `${relativeRepo(path)}: source.${field} is missing`);
  }
  return {
    name: source.name,
    repository: source.repository,
    commit: source.commit,
    subtree: source.subtree,
    license: source.license,
    retrievedAt: source.retrievedAt,
  };
}

// Reads the retained NIMService CRD once and returns the two required-field
// lists this module validates every sample against: the top-level spec
// fields (authSecret, image) and the nested spec.image fields
// (repository, tag). Read from the committed CRD itself rather than
// hardcoded, so a future CRD update that changes what is required would
// surface here instead of silently going unchecked.
let cachedCrdRequirements;
function loadCrdRequirements(root) {
  if (cachedCrdRequirements) return cachedCrdRequirements;
  const path = repoJoin(root, NIMSERVICE_CRD_PATH);
  check(existsSync(path), `missing retained NIMService CRD: ${relativeRepo(path)}`);
  const doc = readYaml(path);
  check(doc.kind === "CustomResourceDefinition", `${relativeRepo(path)}: expected a CustomResourceDefinition`);
  const versions = doc.spec?.versions ?? [];
  const version = versions.find((entry) => entry.name === NIMSERVICE_CRD_VERSION);
  check(version, `${relativeRepo(path)}: no ${NIMSERVICE_CRD_VERSION} version found`);
  const specSchema = version.schema?.openAPIV3Schema?.properties?.spec;
  const specRequired = specSchema?.required;
  check(Array.isArray(specRequired) && specRequired.length > 0, `${relativeRepo(path)}: spec.required is missing or empty`);
  const imageRequired = specSchema?.properties?.image?.required;
  check(Array.isArray(imageRequired) && imageRequired.length > 0, `${relativeRepo(path)}: spec.image.required is missing or empty`);
  cachedCrdRequirements = { path: relativeRepo(path), specRequired, imageRequired };
  return cachedCrdRequirements;
}

function scenarioFor(fileAbsPath) {
  return basename(dirname(fileAbsPath));
}

function fileStemFor(fileAbsPath) {
  return basename(fileAbsPath).replace(/\.ya?ml$/, "");
}

// Walks every retained serving sample file (sorted, so discovery order is
// deterministic) and collects one raw target per `kind: NIMService` document
// found. Slugs are assigned afterward, across the whole set, because
// disambiguation depends on seeing every target's base slug first.
function discoverTargets(root) {
  const servingAbsDir = repoJoin(root, SERVING_DIR);
  const files = listYamlFiles(servingAbsDir);
  check(files.length > 0, `no retained serving sample files found under ${relativeRepo(servingAbsDir)}`);

  const targets = [];
  for (const fileAbsPath of files) {
    const fileRepoPath = relativeRepo(fileAbsPath);
    const docsInFile = readAllDocs(fileAbsPath);
    const scenario = scenarioFor(fileAbsPath);
    const fileStem = fileStemFor(fileAbsPath);
    const nimServiceDocs = docsInFile.filter((doc) => doc.kind === "NIMService");
    check(nimServiceDocs.length > 0, `${fileRepoPath}: no NIMService document found`);
    nimServiceDocs.forEach((doc, indexInFile) => {
      check(
        doc.apiVersion === NIMSERVICE_API_VERSION,
        `${fileRepoPath}: NIMService apiVersion "${doc.apiVersion}" does not match ${NIMSERVICE_API_VERSION}`,
      );
      const name = doc.metadata?.name;
      check(name, `${fileRepoPath}: NIMService metadata.name is missing`);
      targets.push({ fileAbsPath, fileRepoPath, scenario, fileStem, docsInFile, doc, name, indexInFile });
    });
  }
  return targets;
}

// See the module header for the disambiguation rule. Mutates each target
// in place with a `slug` field and returns the same array for convenience.
function assignSlugs(targets) {
  const baseSlugOf = (target) => `${kebab(target.scenario)}-${kebab(target.name)}`;
  const baseCounts = new Map();
  for (const target of targets) {
    const base = baseSlugOf(target);
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
  }

  const seen = new Set();
  for (const target of targets) {
    const base = baseSlugOf(target);
    let slug = baseCounts.get(base) > 1 ? `${base}-${kebab(target.fileStem)}` : base;
    if (seen.has(slug)) slug = `${slug}-${target.indexInFile + 1}`;
    check(!seen.has(slug), `two NIMService targets still produced the same slug after disambiguation: ${slug}`);
    seen.add(slug);
    target.slug = slug;
  }
  return targets;
}

// A device request's GPU count for an inline claimCreationSpec device
// defaults to 1 per the CRD schema (`count` has `default: 1`); a
// resourceClaimTemplateName reference is resolved against a
// ResourceClaimTemplate object in the same retained file, and its own
// spec.spec.devices.requests[].exactly.count values are summed instead
// (that object is a plain Kubernetes resource.k8s.io/v1 resource, not part
// of the NIMService CRD, so it carries its own count field directly).
function gpuCountFromDraResources(draResources, docsInFile, fileRepoPath) {
  let total = 0;
  for (const entry of draResources) {
    if (Array.isArray(entry.claimCreationSpec?.devices)) {
      for (const device of entry.claimCreationSpec.devices) {
        const count = device.count ?? 1;
        check(Number.isInteger(count) && count > 0, `${fileRepoPath}: draResources device "${device.name}" has a non-positive count`);
        total += count;
      }
      continue;
    }
    if (typeof entry.resourceClaimTemplateName === "string") {
      const template = docsInFile.find(
        (doc) => doc.kind === "ResourceClaimTemplate" && doc.metadata?.name === entry.resourceClaimTemplateName,
      );
      check(
        template,
        `${fileRepoPath}: draResources references resourceClaimTemplateName "${entry.resourceClaimTemplateName}" but no ResourceClaimTemplate with that name is in the same file`,
      );
      const requests = template.spec?.spec?.devices?.requests ?? [];
      check(requests.length > 0, `${fileRepoPath}: ResourceClaimTemplate "${entry.resourceClaimTemplateName}" has no spec.spec.devices.requests`);
      for (const request of requests) {
        const count = request.exactly?.count;
        check(
          Number.isInteger(count) && count > 0,
          `${fileRepoPath}: ResourceClaimTemplate "${entry.resourceClaimTemplateName}" carries no positive exactly.count`,
        );
        total += count;
      }
      continue;
    }
    check(
      false,
      `${fileRepoPath}: draResources entry has neither claimCreationSpec.devices nor resourceClaimTemplateName; extend gpuCountFromDraResources in scripts/lib/aicr-nim-operator-models.mjs`,
    );
  }
  check(total > 0, `${fileRepoPath}: draResources produced a zero gpu count`);
  return total;
}

function extractGpuCount(spec, docsInFile, fileRepoPath) {
  const limits = spec.resources?.limits ?? {};
  if (limits["nvidia.com/gpu"] != null) {
    const gpuCount = Number.parseInt(String(limits["nvidia.com/gpu"]), 10);
    check(Number.isInteger(gpuCount) && gpuCount > 0, `${fileRepoPath}: resources.limits["nvidia.com/gpu"] did not parse to a positive integer`);
    return { gpuCount, gpuCountSource: 'resources.limits."nvidia.com/gpu"' };
  }
  if (limits["nvidia.com/pgpu"] != null) {
    const gpuCount = Number.parseInt(String(limits["nvidia.com/pgpu"]), 10);
    check(Number.isInteger(gpuCount) && gpuCount > 0, `${fileRepoPath}: resources.limits["nvidia.com/pgpu"] did not parse to a positive integer`);
    return { gpuCount, gpuCountSource: 'resources.limits."nvidia.com/pgpu"' };
  }
  const draResources = spec.draResources;
  if (Array.isArray(draResources) && draResources.length > 0) {
    return { gpuCount: gpuCountFromDraResources(draResources, docsInFile, fileRepoPath), gpuCountSource: "draResources" };
  }
  check(
    false,
    `${fileRepoPath}: no gpu count source found (resources.limits["nvidia.com/gpu"], resources.limits["nvidia.com/pgpu"], or draResources)`,
  );
  return null;
}

// See the module header: no retained sample carries a GPU-product
// nodeSelector today, so every fact's accelerator is null (generic, attaches
// to every platform=nim inference platform). This fails closed rather than
// silently misreading a future sample that does carry one.
function extractAccelerator(spec, fileRepoPath) {
  const nodeSelector = spec.nodeSelector;
  if (!nodeSelector || Object.keys(nodeSelector).length === 0) return null;
  check(
    Object.prototype.hasOwnProperty.call(nodeSelector, GPU_PRODUCT_NODE_SELECTOR_KEY),
    `${fileRepoPath}: spec.nodeSelector is set but carries no "${GPU_PRODUCT_NODE_SELECTOR_KEY}" key; extend extractAccelerator in scripts/lib/aicr-nim-operator-models.mjs before profiling this NIMService`,
  );
  return String(nodeSelector[GPU_PRODUCT_NODE_SELECTOR_KEY]);
}

// Derived programmatically from the image repository, never from a
// hardcoded team map: nvcr.io/nim/<team>/<container> becomes the NGC catalog
// page for that team's container. Returns null for a repository outside
// that public naming convention (the retained corpus has exactly one: an
// internal staging path in advanced/epp/nimservice.yaml) rather than
// inventing a page that would not resolve.
export function ngcCatalogPageFor(repository) {
  const match = repository.match(/^nvcr\.io\/nim\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9.-]*)$/);
  if (!match) return null;
  const [, team, container] = match;
  return `https://catalog.ngc.nvidia.com/orgs/nim/teams/${team}/containers/${container}`;
}

function extractFacts(root, target, checksums, crdRequirements) {
  const { fileAbsPath, fileRepoPath, scenario, slug, name, doc, docsInFile } = target;
  const spec = doc.spec ?? {};

  for (const field of crdRequirements.specRequired) {
    const value = spec[field];
    check(value !== undefined && value !== null && value !== "", `${fileRepoPath}: NIMService "${name}" is missing required spec.${field}`);
  }

  const image = spec.image ?? {};
  for (const field of crdRequirements.imageRequired) {
    check(image[field], `${fileRepoPath}: NIMService "${name}" is missing required spec.image.${field}`);
  }
  const repository = image.repository;
  const tag = String(image.tag);
  check(repository.startsWith("nvcr.io/"), `${fileRepoPath}: spec.image.repository is not an nvcr.io reference: ${repository}`);
  check(
    !repository.includes("@sha256:") && !tag.includes("@") && !tag.startsWith("sha256:"),
    `${fileRepoPath}: image is not a plain tagged nvcr.io reference: ${repository}:${tag}`,
  );
  const imageRef = `${repository}:${tag}`;

  const { gpuCount, gpuCountSource } = extractGpuCount(spec, docsInFile, fileRepoPath);
  const accelerator = extractAccelerator(spec, fileRepoPath);

  // A referenced NIMCache is not always defined in the same file: one
  // retained sample (advanced/epp/nimservice.yaml) names a NIMCache the
  // operator is expected to have created separately, the same way a
  // secretKeyRef names a Secret this catalog never defines either. This
  // records the reference; it does not require the cache to be co-located.
  const nimCacheName = spec.storage?.nimCache?.name ?? null;

  const authSecret = spec.authSecret;
  check(typeof authSecret === "string" && authSecret.length > 0, `${fileRepoPath}: spec.authSecret is not a name string`);
  const pullSecretsRaw = image.pullSecrets ?? [];
  for (const entry of pullSecretsRaw) {
    check(typeof entry === "string" && entry.length > 0, `${fileRepoPath}: image.pullSecrets carries a non-name entry`);
  }

  const checksumsAbsPath = repoJoin(root, CHECKSUMS_PATH);
  const pinnedSha256 = checksums.get(fileRepoPath.slice(relativeRepo(repoJoin(root, UPSTREAM_DIR)).length + 1).replaceAll("\\", "/"));
  check(pinnedSha256, `${relativeRepo(checksumsAbsPath)}: no pinned checksum for ${fileRepoPath}`);
  const observedSha256 = sha256File(fileAbsPath);
  check(observedSha256 === pinnedSha256, `${fileRepoPath}: observed sha256 ${observedSha256} does not match pinned ${pinnedSha256}`);

  const ngcCatalogPage = ngcCatalogPageFor(repository);

  const checks = [
    {
      name: "api-version-matches-crd",
      result: "pass",
      detail: `apiVersion "${doc.apiVersion}" matches the retained CRD's ${NIMSERVICE_CRD_VERSION} version.`,
    },
    { name: "kind-matches-crd", result: "pass", detail: 'kind "NIMService" matches the retained CRD.' },
    {
      name: "required-spec-fields-present",
      result: "pass",
      detail: `spec carries every field the retained CRD requires (${crdRequirements.specRequired.join(", ")}), and spec.image carries every field its own required list names (${crdRequirements.imageRequired.join(", ")}).`,
    },
    {
      name: "image-is-tagged-reference-not-digest",
      result: "pass",
      detail: `${imageRef} names an nvcr.io repository and tag; it is configuration data and was never resolved to a digest.`,
    },
    {
      name: "secrets-are-names-only",
      result: "pass",
      detail: "spec.authSecret and every spec.image.pullSecrets entry carry a name only; no literal secret value is present.",
    },
    {
      name: "source-sha256-matches-pin",
      result: "pass",
      detail: `sha256 of ${fileRepoPath} matches the pin in ${relativeRepo(checksumsAbsPath)}.`,
    },
  ];

  return {
    slug,
    scenario,
    name,
    namespace: doc.metadata?.namespace ?? null,
    fileRepoPath,
    sha256: observedSha256,
    repository,
    tag,
    image: imageRef,
    gpuCount,
    gpuCountSource,
    accelerator,
    nimCacheName,
    authSecret,
    imagePullSecrets: [...pullSecretsRaw],
    ngcCatalogPage,
    checks,
  };
}

function descriptionFor(fact) {
  const gpuWord = fact.gpuCount === 1 ? "one GPU" : `${fact.gpuCount} GPUs`;
  return (
    `A generated model profile for a retained NIMService sample from NVIDIA's ` +
    `k8s-nim-operator config/samples/nim/serving corpus, scenario ` +
    `"${fact.scenario}". It requests ${gpuWord}. This record is ` +
    "configuration data about the sample; it grants nothing and fetches nothing."
  );
}

function governingTermsSentenceFor(fact) {
  if (fact.ngcCatalogPage) {
    return (
      "The per-artifact governing terms for this image have not been read from " +
      `the NGC catalog page. Read them at deploy time from ${fact.ngcCatalogPage} ` +
      `and see ${LICENSE_READ_DOC} for how this catalog treats NIM licensing ` +
      "generally; per-artifact terms override any general statement recorded " +
      "elsewhere."
    );
  }
  return (
    `The image ${fact.image} sits outside the public nvcr.io/nim/<team>/<container> ` +
    "catalog naming convention, so no NGC catalog page was derived for it. See " +
    `${LICENSE_READ_DOC} for how this catalog treats NIM licensing generally.`
  );
}

function profileDocFor(fact) {
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "NIMModelProfileRecord",
    metadata: { name: fact.slug },
    spec: {
      description: descriptionFor(fact),
      delivery: "nim",
      nimService: fact.name,
      nimServiceNamespace: fact.namespace,
      nimServiceFile: fact.fileRepoPath,
      nimServiceSha256: fact.sha256,
      nimCacheName: fact.nimCacheName,
      scenario: fact.scenario,
      image: fact.image,
      gpuCount: fact.gpuCount,
      gpuCountSource: fact.gpuCountSource,
      licensing: {
        imageRegistry:
          "nvcr.io is NGC-gated. The image is pulled only by the user's cluster with " +
          "the user's NGC API key under the user's own NVIDIA entitlement.",
        ngcCatalogPage: fact.ngcCatalogPage,
        governingTermsReadAt: null,
        governingTermsNamed: [],
        governingTerms: governingTermsSentenceFor(fact),
        licenseRead: LICENSE_READ_DOC,
      },
    },
    status: {
      result: "described-offline-terms-pending",
      imagePulled: false,
      modelFetched: false,
    },
  };
}

function receiptDocFor(fact, source, checksumsPathRepo, retentionReceiptPathRepo) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "NIMOperatorModelReceipt",
    metadata: { name: fact.slug },
    spec: {
      nimService: fact.name,
      scenario: fact.scenario,
      source: {
        name: source.name,
        repository: source.repository,
        commit: source.commit,
        subtree: source.subtree,
        license: source.license,
        retrievedAt: source.retrievedAt,
        retentionReceipt: retentionReceiptPathRepo,
      },
      file: {
        path: fact.fileRepoPath,
        role: "nimService",
        pinnedSha256: fact.sha256,
        observedSha256: fact.sha256,
        checksumsFile: checksumsPathRepo,
      },
      facts: {
        image: fact.image,
        gpuCount: fact.gpuCount,
        gpuCountSource: fact.gpuCountSource,
        nimCacheName: fact.nimCacheName,
        authSecret: fact.authSecret,
        imagePullSecrets: fact.imagePullSecrets,
      },
      checks: fact.checks,
      boundary: {
        configPlaneOnly: true,
        nimContainersRan: false,
        modelsFetched: false,
        ngcArtifactsPulled: false,
        secretValuesIncluded: false,
        statement:
          `This receipt describes retained configuration only for the ${fact.slug} ` +
          "NIMService sample. No NIM container ran, no model was fetched, and no NGC " +
          "surface was contacted to produce it.",
      },
    },
    status: {
      result: "described-offline",
    },
  };
}

function summaryFor(facts, context) {
  const { checksumsPathRepo, retentionReceiptPathRepo, source, crdPathRepo } = context;
  const genericCount = facts.filter((fact) => fact.accelerator === null).length;
  const noCatalogPage = facts.filter((fact) => fact.ngcCatalogPage === null);
  const draCount = facts.filter((fact) => fact.gpuCountSource === "draResources").length;
  const pgpuCount = facts.filter((fact) => fact.gpuCountSource === 'resources.limits."nvidia.com/pgpu"').length;

  const rows = facts.map(
    (fact) => `| \`${fact.slug}\` | ${fact.scenario} | \`${fact.image}\` | ${fact.gpuCount} | ${fact.gpuCountSource} |`,
  );

  return `# ${facts.length} generated NIM-Operator model profiles from the retained sample corpus

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-nim-operator-models:generate\` and checked by
\`npm run aicr-nim-operator-models:verify\`. Both read the same retained
samples under \`${SERVING_DIR.replaceAll("\\", "/")}/\`, pinned in
\`${checksumsPathRepo}\` and provenanced by \`${retentionReceiptPathRepo}\`.

The corpus is NVIDIA's own k8s-nim-operator sample library
(\`${source.repository}\`, commit \`${source.commit}\`, subtree
\`${source.subtree}\`), licensed ${source.license} and retained
byte-for-byte on ${source.retrievedAt}. It is distinct from the
kserve-nim-inference entry's retained nim-deploy KServe subtree: this one
retains NIMService samples straight from the operator that defines the
NIMService custom resource.

This generator reads every \`kind: NIMService\` document across the retained
samples and writes one profile record plus one receipt for each. It found
${facts.length} such documents across as many files, one NIMService per
retained file throughout this corpus. It creates no new catalog entry and
changes no catalog count.

| Model shape | Scenario | Image | GPU count | GPU count source |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

## What the samples request and how that was checked

Every profile's \`gpuCount\` is read from one of three places, recorded as
its \`gpuCountSource\`: the conventional \`resources.limits["nvidia.com/gpu"]\`
field, the Kata-VM passthrough field
\`resources.limits["nvidia.com/pgpu"]\` (${pgpuCount} sample), or a Dynamic
Resource Allocation claim under \`draResources\` (${draCount} samples, each
requesting one GPU either directly or through a paired
ResourceClaimTemplate in the same file). Every receipt's checks validate the
sample against the retained NIMService CRD,
\`${crdPathRepo}\`: the apiVersion and kind match, every field the CRD's
\`v1alpha1\` schema requires is present, the image is a tagged \`nvcr.io\`
reference rather than a resolved digest, every secret field (\`authSecret\`
and each \`image.pullSecrets\` entry) carries a name only, and the sample
file's sha256 matches the pin in \`${checksumsPathRepo}\`.

None of the ${facts.length} retained samples carries a GPU-product
nodeSelector, so all ${genericCount} of them are generic: nothing in this
corpus is pinned to a specific accelerator. ${
    noCatalogPage.length > 0
      ? `${noCatalogPage.length} sample (\`${noCatalogPage[0].slug}\`) references an image outside the public NGC catalog naming convention, so its profile records no derived catalog page rather than inventing one.`
      : "Every sample's image resolved to a derived NGC catalog page."
  }

## What ran and what did not

Every check above ran offline against the retained files. No image was
pulled, no model weight moved, no NGC catalog page was fetched by this
generator, and no cluster or GPU took part. The receipts record that
boundary directly: \`configPlaneOnly: true\`, \`nimContainersRan: false\`,
\`modelsFetched: false\`, \`ngcArtifactsPulled: false\`, and
\`secretValuesIncluded: false\`.

## The NGC governing terms are pending a human read

None of these ${facts.length} profiles names governing terms. Each one sets
\`governingTermsReadAt\` to \`null\` and \`governingTermsNamed\` to an empty
list, and its \`governingTerms\` sentence points at its derived NGC catalog
page (where one exists) and at \`${LICENSE_READ_DOC}\`. That is a deliberate
gap rather than an oversight: nobody has read these catalog pages by hand
yet. Reading them is the one step a person still has to take before any of
these ${facts.length} samples is treated as license-cleared for a specific
deployment.

## Regenerate and verify

\`\`\`sh
npm run aicr-nim-operator-models:generate
npm run aicr-nim-operator-models:verify
\`\`\`
`;
}

// The pure function the generator and the verifier both call, and that
// scripts/lib/aicr-platform-members.mjs calls to attach these facts to the
// platform=nim inference platforms. It reads committed bytes only under
// `root`, asserts every consistency rule inline via `check`, and returns the
// exact text every output file must hold, plus the structured facts.
export function buildReport(root = repoRoot) {
  const checksums = loadChecksums(root);
  const source = loadSource(root);
  const crdRequirements = loadCrdRequirements(root);
  const checksumsPathRepo = relativeRepo(repoJoin(root, CHECKSUMS_PATH));
  const retentionReceiptPathRepo = relativeRepo(repoJoin(root, RETENTION_RECEIPT_PATH));

  const targets = assignSlugs(discoverTargets(root));
  const facts = targets.map((target) => extractFacts(root, target, checksums, crdRequirements));

  const slugs = new Set();
  for (const fact of facts) {
    check(!slugs.has(fact.slug), `two facts produced the same slug: ${fact.slug}`);
    slugs.add(fact.slug);
  }

  const profiles = facts.map((fact) => ({
    slug: fact.slug,
    path: repoJoin(root, PROFILES_DIR, `${fact.slug}.yaml`),
    yaml: serializeYaml(profileDocFor(fact)),
  }));
  const receipts = facts.map((fact) => ({
    slug: fact.slug,
    path: repoJoin(root, RECEIPTS_DIR, `${fact.slug}.yaml`),
    yaml: serializeYaml(receiptDocFor(fact, source, checksumsPathRepo, retentionReceiptPathRepo)),
  }));

  return {
    facts,
    profiles,
    receipts,
    summaryPath: repoJoin(root, SUMMARY_PATH),
    summaryMd: summaryFor(facts, {
      checksumsPathRepo,
      retentionReceiptPathRepo,
      source,
      crdPathRepo: crdRequirements.path,
    }),
  };
}
