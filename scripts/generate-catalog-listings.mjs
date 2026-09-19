#!/usr/bin/env node

// Project every retained BaseVariantRecord into one uniform catalog listing and
// publish each listing on its own URL.
//
// The catalog already holds one source-neutral record per maintained base, but
// it holds them in a single index. An agent that wants one entry has to read the
// whole file, and a reader comparing a Helm base with a Timoni base has to know
// which fields each format happens to fill. This writes the same nine sections
// for every format and gives each listing a predictable address, so resolving an
// entry is building a URL from its id rather than downloading the catalog.
//
// This is a projection. Catalog membership is decided by
// data/base-variant-records/records.json and nothing here adds to it, removes
// from it, or edits it. Every value below is copied or classified from a
// committed record, and each classification table is exhaustive: an unrecorded
// status word fails the run rather than landing in a default bucket, because a
// silent default is how an unchecked lane starts reading as a pass.

import { existsSync, readFileSync, readdirSync, rmSync, lstatSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, sha256, trackedExists, write } from "./lib/proof-common.mjs";

const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const GITHUB_BLOB_BASE_URL = "https://github.com/confighub/helm-expt/blob/main/";

// The committed successor survey, as data. A withdrawn or repriced chart is only
// useful to an agent if the listing says what this catalog reviewed instead, so a
// listing for a surveyed component carries the rank-one pick, and the entries in
// this catalog that are it.
const catalogImagesFile = "data/catalog-images/images.json";
let catalogImages = null;
// What this entry would run, read from its own retained objects by
// scripts/generate-catalog-images.mjs. Nothing here is resolved: a tag can answer to
// different bytes later, and `cub config check <file> --images` is what asks.
function buildImages(id) {
  if (!catalogImages) {
    const index = JSON.parse(readFileSync(join(repoRoot, catalogImagesFile), "utf8"));
    catalogImages = new Map((index.entries ?? []).map((entry) => [entry.id, entry]));
  }
  const entry = catalogImages.get(id);
  if (!entry || !entry.read) return null;
  return compact({
    count: entry.images.length,
    pinnedByDigest: entry.images.filter((image) => image.pinned).length,
    namedByTag: entry.images.filter((image) => !image.pinned).length,
    references: entry.images.map((image) => ({ reference: image.reference, pinned: image.pinned })),
    readFrom: entry.objects,
    record: catalogImagesFile,
    recordUrl: `${GITHUB_BLOB_BASE_URL}${catalogImagesFile}`,
    boundary: "what the objects name, not what the registry holds now; cub config check --images resolves a tag to the bytes behind it",
  });
}

const successorSurveyFile = "data/bitnami-successors/survey.json";
let successorSurvey = null;
function surveyPick(component) {
  if (!successorSurvey) successorSurvey = JSON.parse(readFileSync(join(repoRoot, successorSurveyFile), "utf8"));
  const entry = (successorSurvey.components ?? []).find((item) => item.component === component);
  if (!entry) return null;
  const pick = (entry.candidates ?? []).find((candidate) => candidate.rank === 1);
  return pick ?? null;
}

function buildSuccessors(id, spec, labels, allRecords) {
  // A record names its chart as publisher/chart, in one string.
  const [publisher, component] = String(labels.component ?? spec.source?.name ?? "").split("/");
  if (publisher !== "bitnami" || !component) return null;
  const pick = surveyPick(component);
  if (!pick) return null;
  // The pick names one or more charts, in prose or as an OCI reference. The entries are
  // whichever records in this catalog name one of those charts, so a pick this catalog
  // has not reviewed yet simply has none.
  const names = new Set();
  for (const token of pick.chartRef.split(/[\s();,]+/)) {
    if (!token.includes("/")) continue;
    // The last two segments name the chart, whether the token is a bare
    // publisher/chart or a whole oci:// reference with a registry in front.
    const parts = token.replace(/^oci:\/\//, "").split("/").filter(Boolean);
    if (parts.length >= 2) names.add(parts.slice(-2).join("/"));
  }
  const chartName = names.size === 1 ? [...names][0] : undefined;
  const componentOf = (record) => String(record.metadata?.labels?.component ?? record.spec?.source?.name ?? "");
  const entries = allRecords
    .filter((record) => {
      const component = componentOf(record);
      if (names.has(component)) return true;
      // "mysql-operator/mysql-innodbcluster" and "percona/psmdb-db" name the chart; the
      // catalog files it under its own publisher, so match on the chart itself too.
      // A pick can name a chart without its catalog publisher, as
      // "mysql-operator/mysql-innodbcluster" does. Match on the chart alone, but never
      // back onto the publisher this listing is trying to leave.
      const [recordPublisher, chart] = component.split("/");
      if (recordPublisher === publisher || !chart) return false;
      return [...names].some((name) => name.split("/")[1] === chart);
    })
    .map((record) => record.metadata.name)
    .sort()
    .map((successorId) => ({ id: successorId, url: `${SITE_BASE_URL}listings/${successorId}.json` }));
  return compact({
    reason: "the publisher moved this chart's versioned images behind a paid tier",
    reviewed: pick.name,
    chart: chartName || undefined,
    chartRef: pick.chartRef,
    shape: pick.shape,
    license: pick.license,
    entries: entries.length ? entries : undefined,
    entriesNote: entries.length ? undefined : "this catalog reviews no entry for the pick yet; the survey records the source status",
    survey: successorSurveyFile,
    surveyUrl: `${GITHUB_BLOB_BASE_URL}${successorSurveyFile}`,
    boundary: "a successor is a different chart, so its values, shape and object set differ; migration is separate reviewed work",
  });
}

const LISTING_VERSION = "1";
const COMMAND_CONTRACT_PATH = "data/config-workshop-command-contract/summary.md";

const catalogPath = join(repoRoot, "data", "base-variant-records", "records.json");
const recordRoot = join(repoRoot, "data", "base-variant-records", "records");
const listingRoot = join(repoRoot, "site", "listings");
const schemaPath = join(repoRoot, "schemas", "catalog-listing.schema.json");
const chartPageRoot = join(repoRoot, "site", "charts");

// The catalog records these lanes under their own names. The listing publishes
// them under stable snake_case keys so a consumer reads the same eight lanes on
// every entry, whatever format it came from.
const COVERAGE_LANES = [
  ["renderParity", "render_parity"],
  ["confighubScanOps", "confighub_scan_ops"],
  ["localKind", "local_kubernetes"],
  ["lifecycleObserved", "lifecycle_observation"],
  ["gitopsOciLive", "gitops_oci_live"],
  ["liveDualParity", "live_dual_parity"],
  ["twoClusterKind", "two_cluster_kind"],
  ["variantPromotion", "variant_promotion"],
];

// Only yes and proven are a pass. A watch row means the lane ran and left a
// recorded caveat, which is partial and never checked. Everything a reader
// might charitably round up stays not_checked.
const COVERAGE_STATUS = new Map([
  ["yes", "checked"],
  ["proven", "checked"],
  ["watch", "partial"],
  ["proven-with-watch", "partial"],
  ["no", "not_checked"],
  ["todo", "not_checked"],
  ["missing-confighub-proof", "not_checked"],
  ["blocked", "not_checked"],
  ["not-run", "not_checked"],
  ["n/a", "not_applicable"],
]);

const OCI_STATE = new Map([
  ["public", "published"],
  ["public-anonymous-pull-proved", "published"],
  ["immutable-public-source", "published"],
  ["published-and-pulled-by-digest", "published"],
  ["base-variant-uploaded", "published"],
  ["base-and-development-variant-retained", "published"],
  ["pass", "published"],
  ["local-only", "local"],
  ["temporary-pass", "local"],
  ["private-pass", "local"],
  ["separately-proved-with-an-added-Namespace", "recorded-elsewhere"],
  ["not-published", "not-published"],
  ["not-published-in-this-record", "not-published"],
  ["not-separately-published", "not-published"],
  ["not-published-for-this-base", "not-published"],
  ["not-published-for-this-five-object-base", "not-published"],
  ["not-recorded-for-this-base", "not-published"],
  ["not-run", "not-published"],
  ["not-run-for-this-base", "not-published"],
]);

const DELIVERY_STATE = new Map([
  ["pass", "pass"],
  ["live-pass-two-revisions", "pass"],
  ["applications-uploaded-not-reconciled", "partial"],
  ["applications-retained-not-reconciled", "partial"],
  ["oci-bundle-generated-local-pull-pass-not-live", "partial"],
  ["not-run", "not-run"],
  ["not-run-for-this-base", "not-run"],
  ["not-recorded-for-this-base", "not-run"],
  ["not-generated", "not-run"],
  ["not-applicable-to-this-base", "not-applicable"],
  ["not-run-for-argo-application-wrapper", "not-applicable"],
  ["not-used-in-this-run", "not-applicable"],
  ["separately-proved-with-an-added-Namespace", "recorded-elsewhere"],
]);

const PROMOTION_STATE = new Map([
  ["pass", "pass"],
  ["proven", "proven"],
  ["proven-with-watch", "partial"],
  ["blocked", "blocked"],
  ["missing-confighub-proof", "not-recorded"],
]);

const FORMAT_LABEL = new Map([
  ["helm", "Helm chart"],
  ["aicr", "AICR recipe"],
  ["timoni", "Timoni module"],
  ["cub-installer", "cub installer package"],
  ["kubara", "Kubara platform"],
  ["sveltos", "Sveltos ClusterProfile"],
  ["source-oci", "Source OCI package"],
  ["configuration-oci", "Configuration OCI bundle"],
  ["kubernetes-yaml", "Plain Kubernetes YAML"],
  ["confighub", "ConfigHub configuration"],
  ["rendered-config", "Rendered configuration"],
]);

const OCI_ROLES = [
  ["sourcePackageOci", "source-package"],
  ["literalConfigOci", "literal-config"],
  ["configHubUpload", "confighub-upload"],
  ["configHubReleaseOci", "confighub-release"],
];

// Reference fields in priority order. The field a reference was recorded under
// does not decide whether it is published: one AICR entry records a proved
// public anonymous pull under plannedRef, because the field was written before
// the push and the status was raised afterwards. The recorded status is the
// catalog's decision, so it settles referenceState, and referenceField keeps
// the provenance visible instead of smoothing the mismatch away.
const OCI_REFERENCE_FIELDS = ["reference", "sourceRef", "observedReference", "plannedRef"];

const OCI_DIGEST_FIELDS = [
  "digest",
  "sourceDigest",
  "sourceOciDigest",
  "manifestDigest",
  "bundleDigest",
  "localDigest",
  "pilotDigest",
  "fleetDigest",
  "objectSetSha256",
  "sourceObjectSetSha256",
  "configHubDataHash",
];

const mode = process.argv[2] ?? "--generate";

if (mode === "--self-test") {
  runSelfTest();
  console.log("verified catalog listing projection self-test");
  process.exit(0);
}

if (!["--generate", "--verify"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-catalog-listings.mjs --generate
  node scripts/generate-catalog-listings.mjs --verify
  node scripts/generate-catalog-listings.mjs --self-test`);
  process.exit(1);
}

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
check(
  schema.$id === `${SITE_BASE_URL}listing.schema.json`,
  "the listing schema must be published at the site listing schema URL",
);
check(
  schema.properties?.listingVersion?.const === LISTING_VERSION,
  `the listing schema must pin major version ${LISTING_VERSION}`,
);

const outputs = buildOutputs();

if (mode === "--generate") {
  rmSync(listingRoot, { recursive: true, force: true });
  for (const [path, contents] of outputs) write(path, contents);
  console.log(`wrote ${outputs.size - 1} catalog listing(s) and one listing index`);
} else {
  for (const [path, expected] of outputs) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run catalog:listings`);
    check(
      readFileSync(path, "utf8") === expected,
      `${relativeRepo(path)} is stale; run npm run catalog:listings`,
    );
  }
  // A listing that leaves the catalog must lose its URL. Comparing only the
  // expected files would leave a withdrawn entry answering forever.
  const published = existsSync(listingRoot) ? readdirSync(listingRoot).sort() : [];
  const expectedNames = [...outputs.keys()].map((path) => path.slice(listingRoot.length + 1)).sort();
  check(
    JSON.stringify(published) === JSON.stringify(expectedNames),
    `site/listings holds ${published.length} file(s) and the catalog projects ${expectedNames.length}; run npm run catalog:listings`,
  );
  console.log(`verified ${outputs.size - 1} catalog listing(s) against ${relativeRepo(schemaPath)}`);
}

function buildOutputs() {
  const bytes = readFileSync(catalogPath);
  const catalog = JSON.parse(bytes.toString("utf8"));
  const records = catalog.records ?? [];
  check(Array.isArray(records) && records.length > 0, "the base variant record index contains no records");
  const catalogFile = {
    path: relativeRepo(catalogPath),
    sha256: `sha256:${sha256(bytes)}`,
    url: `${GITHUB_BLOB_BASE_URL}${relativeRepo(catalogPath)}`,
  };

  const ids = records.map((record) => record.metadata?.name ?? "");
  check(new Set(ids).size === ids.length, "two catalog records share one name, so they cannot have separate URLs");

  const siblings = new Map();
  for (const record of records) {
    const key = sourceKey(record);
    if (!siblings.has(key)) siblings.set(key, []);
    siblings.get(key).push(record);
  }

  const listings = records
    .map((record) => buildListing(record, { catalogFile, siblings: siblings.get(sourceKey(record)), allRecords: records }))
    .sort((left, right) => byText(left.identity.id, right.identity.id));

  const entries = new Map();
  for (const listing of listings) {
    const errors = validate(schema, listing, "listing");
    check(errors.length === 0, `${listing.identity.id}: ${errors[0]}`);
    entries.set(join(listingRoot, `${listing.identity.id}.json`), serialize(listing));
  }
  entries.set(join(listingRoot, "index.json"), serialize(buildIndex(listings, catalogFile)));
  return new Map([...entries].sort(([left], [right]) => byText(left, right)));
}

function buildIndex(listings, catalogFile) {
  const formats = {};
  for (const listing of listings) {
    formats[listing.identity.format] = (formats[listing.identity.format] ?? 0) + 1;
  }
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "CatalogListingIndex",
    listingVersion: LISTING_VERSION,
    schema: `${SITE_BASE_URL}listing.schema.json`,
    urlPattern: `${SITE_BASE_URL}listings/{id}.json`,
    contract: [
      "Every maintained catalog entry has one listing at listings/{id}.json, whatever format it came from.",
      "Build that URL from the id to read one entry. Downloading this index first is optional.",
      "A listing is a projection of the BaseVariantRecord it names in generatedFrom. The record decides membership.",
      "Read coverage before citing a verdict. Only checked counts as evidence, and not_declared is not a pass.",
      "A route stays a proposal until a destination resolves it. automatic is false until a run proves otherwise.",
      "A planned OCI reference names where a bundle would go. It has not been pushed.",
    ],
    generatedFrom: { catalog: catalogFile, recordKind: "BaseVariantRecord" },
    counts: {
      listings: listings.length,
      formats: Object.fromEntries(Object.entries(formats).sort(([left], [right]) => byText(left, right))),
    },
    listings: listings.map((listing) => ({
      id: listing.identity.id,
      url: listing.identity.url,
      name: listing.identity.name,
      format: listing.identity.format,
      version: listing.identity.version,
      base: listing.identity.base,
      objectCount: listing.flattened.objectCount,
      digest: listing.flattened.digest,
      flatteningVerdict: listing.flattened.verdict,
      ...(listing.images ? { images: listing.images.count, imagesNamedByTag: listing.images.namedByTag } : {}),
    })),
  };
}

function buildListing(record, { catalogFile, siblings, allRecords = [] }) {
  const spec = record.spec ?? {};
  const id = record.metadata?.name ?? "";
  const labels = record.metadata?.labels ?? {};
  const format = spec.source?.type ?? "";
  check(FORMAT_LABEL.has(format), `${id}: source format ${format} has no listing label`);

  const recordPath = join(recordRoot, `${id}.yaml`);
  check(existsSync(recordPath), `${id}: the retained record file is missing`);
  const digest = normalizeDigest(spec.configuration?.digest, `${id}: configuration digest`);

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "CatalogListing",
    listingVersion: LISTING_VERSION,
    generatedFrom: {
      catalog: catalogFile,
      record: {
        path: relativeRepo(recordPath),
        sha256: `sha256:${sha256(readFileSync(recordPath))}`,
        url: `${GITHUB_BLOB_BASE_URL}${relativeRepo(recordPath)}`,
      },
      recordKind: "BaseVariantRecord",
      recordSchema: "schemas/base-variant-record.schema.json",
    },
    identity: buildIdentity(id, labels, spec, format),
    source: buildSource(spec),
    flattened: buildFlattened(id, spec, digest),
    oci: buildOci(id, spec),
    ...(buildImages(id) ? { images: buildImages(id) } : {}),
    variants: buildVariants(id, spec, siblings, digest),
    ...(buildSuccessors(id, spec, labels, allRecords) ? { successors: buildSuccessors(id, spec, labels, allRecords) } : {}),
    routing: buildRouting(spec),
    lifecycle: buildLifecycle(spec),
    assessment: buildAssessment(spec),
    evidence: buildEvidence(spec),
  };
}

function buildIdentity(id, labels, spec, format) {
  const identity = {
    id,
    url: `${SITE_BASE_URL}listings/${id}.json`,
    name: labels.component || spec.source?.name || id,
    format,
    formatLabel: FORMAT_LABEL.get(format),
    version: labels.sourceVersion || spec.source?.version || "",
    base: labels.base || spec.baseVariant?.name || "",
  };
  const page = chartPageName(spec);
  if (page) identity.page = `${SITE_BASE_URL}charts/${page}`;
  return identity;
}

// A listing links the human page only when the site actually publishes one, so
// the link is never a guess derived from the entry's name.
function chartPageName(spec) {
  const name = `${slug(spec.source?.name ?? "")}-${slug(spec.source?.version ?? "")}.html`;
  return existsSync(join(chartPageRoot, name)) ? name : "";
}

function buildSource(spec) {
  const source = spec.source ?? {};
  const baseVariant = spec.baseVariant ?? {};
  return compact({
    format: source.type ?? "",
    name: source.name ?? "",
    version: source.version ?? "",
    // The coordinate every format can be addressed by, so two listings are
    // comparable without knowing which tool produced them. ociRef carries the
    // pinned artifact when the source is distributed as one.
    reference: source.name && source.version ? `${source.name}@${source.version}` : (source.name ?? ""),
    ociRef: source.packageOciRef ?? "",
    record: source.record ?? "",
    recordUrl: blobUrl(source.record),
    selection: compact({
      name: source.selection?.name ?? "",
      kind: source.selection?.kind ?? "",
      provider: source.selection?.provider ?? "",
      record: source.selection?.record ?? "",
      recordUrl: blobUrl(source.selection?.record),
    }),
    pin: compact({
      digest: normalizeDigest(baseVariant.digest, "base variant digest"),
      role: baseVariant.digestRole ?? "",
      revision: baseVariant.revision ?? "",
      record: baseVariant.digestRecord ?? "",
      recordUrl: blobUrl(baseVariant.digestRecord),
    }),
    fixedAtBuildTime: [...(spec.inputs?.fixedAtBuildTime ?? [])],
  });
}

function retainedObjectFile(path) {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..")) return null;
  if (!trackedExists(join(repoRoot, path)) || !existsSync(join(repoRoot, path)) || !lstatSync(join(repoRoot, path)).isFile()) return null;
  return {
    path,
    url: `https://raw.githubusercontent.com/confighub/helm-expt/main/${path.split("/").map(encodeURIComponent).join("/")}`,
    sha256: `sha256:${sha256(readFileSync(join(repoRoot, path)))}`,
  };
}

function buildFlattened(id, spec, digest) {
  const configuration = spec.configuration ?? {};
  const flattening = spec.processing?.flattening ?? {};
  const materialization = spec.processing?.materialization ?? {};
  const result = {
    method: materialization.method ?? "",
    materializationStatus: materialization.status ?? "",
    format: configuration.format ?? "",
    objectCount: configuration.objectCount ?? 0,
    digest,
    digestRole: configuration.digestRole ?? "",
    verdict: flattening.verdict ?? "not-assessed",
    verdictStatus: flattening.status ?? "not-assessed",
    action: flattening.action ?? "",
    scope: flattening.scope ?? "",
    boundaries: [...(spec.processing?.boundaries ?? [])],
  };
  for (const [field, value] of [
    ["objects", configuration.objects],
    ["inventory", configuration.inventory],
    ["digestRecord", configuration.digestRecord],
    ["verdictRecord", flattening.record],
  ]) {
    if (!value) continue;
    result[field] = value;
    const url = blobUrl(value);
    if (url) result[`${field}Url`] = url;
  }
  const retained = retainedObjectFile(configuration.objects);
  if (retained) result.retainedObjects = retained;
  check(result.method, `${id}: the record does not say how the source became objects`);
  return result;
}

function buildOci(id, spec) {
  const delivery = spec.delivery ?? {};
  // Every listing declares all four roles. A role the entry never mentions says
  // not-recorded rather than vanishing, so an agent indexing by role gets the
  // same four answers from a Helm base and a plain-YAML one.
  const bundles = [];
  for (const [deliveryField, role] of OCI_ROLES) {
    const leg = delivery[deliveryField];
    if (!leg || typeof leg !== "object") {
      bundles.push({ role, state: "not-recorded", status: "not-recorded", reference: "", referenceState: "none", digests: [] });
      continue;
    }
    const status = leg.status ?? "";
    check(OCI_STATE.has(status), `${id}: OCI status ${JSON.stringify(status)} on ${deliveryField} is not classified`);
    const state = OCI_STATE.get(status);
    const referenceField = OCI_REFERENCE_FIELDS.find((name) => leg[name]);
    const bundle = {
      role,
      state,
      status,
      reference: referenceField ? leg[referenceField] : "",
      referenceState: referenceState(state, referenceField),
      digests: OCI_DIGEST_FIELDS.filter((field) => leg[field]).map((field) => ({
        field,
        value: normalizeDigest(leg[field], `${id}: ${role} ${field}`),
      })),
    };
    if (leg.receipt) {
      bundle.receipt = leg.receipt;
      const url = blobUrl(leg.receipt);
      if (url) bundle.receiptUrl = url;
    }
    if (referenceField) bundle.referenceField = referenceField;
    if (leg.note) bundle.note = leg.note;
    bundles.push(bundle);
  }

  const runtimes = [];
  for (const [field, runtime] of [["argoCd", "argo-cd"], ["flux", "flux"], ["direct", "direct"]]) {
    const status = delivery[field];
    if (typeof status !== "string" || !status) {
      runtimes.push({ runtime, state: "not-recorded", status: "not-recorded" });
      continue;
    }
    check(DELIVERY_STATE.has(status), `${id}: delivery status ${JSON.stringify(status)} on ${field} is not classified`);
    runtimes.push({ runtime, state: DELIVERY_STATE.get(status), status });
  }

  const result = { sourcePackageRef: spec.source?.packageOciRef ?? "", bundles, runtimes };
  if (delivery.receipt) {
    result.receipt = delivery.receipt;
    const url = blobUrl(delivery.receipt);
    if (url) result.receiptUrl = url;
  }
  return result;
}

// A reference on a bundle the catalog has not published names where the bundle
// would go. Only a published bundle has a published address.
function referenceState(state, referenceField) {
  if (!referenceField) return "none";
  return state === "published" ? "published" : "planned";
}

function buildVariants(id, spec, siblings, digest) {
  const base = spec.baseVariant?.name ?? "";
  const known = (siblings ?? [])
    .map((sibling) => {
      const siblingId = sibling.metadata?.name ?? "";
      const entry = {
        id: siblingId,
        base: sibling.metadata?.labels?.base || sibling.spec?.baseVariant?.name || "",
        url: `${SITE_BASE_URL}listings/${siblingId}.json`,
        self: siblingId === id,
      };
      const siblingDigest = normalizeDigest(sibling.spec?.configuration?.digest, `${siblingId}: configuration digest`);
      if (siblingDigest) entry.digest = siblingDigest;
      return entry;
    })
    .sort((left, right) => byText(left.id, right.id));
  check(known.some((entry) => entry.self), `${id}: the listing is missing from its own variant set`);

  const component = slug(spec.source?.name ?? id);
  const annotation = `workshop.confighub.com/object-set-sha256=${digest}`;
  const upload = `--component ${component} --variant ${base} --space ${id} --granularity minimal --annotation ${annotation} ./rendered`;
  return {
    base,
    known,
    howToMakeOne: {
      model:
        "The catalog builds a base by pinning one source version, fixing one set of inputs, and retaining the exact objects that come out. A new variant starts from a retained base and changes only the fields it owns, so the base stays comparable and the change stays reviewable.",
      steps: [
        `Materialize this base and confirm the object set hashes to ${digest}. The exact objects are recorded at ${spec.configuration?.objects ?? "the path named in flattened.objects"}.`,
        "Put those objects in a local directory called rendered, then preview the retention before writing anything.",
        "Retain the base in ConfigHub, carrying the object-set hash as an annotation so the accepted identity travels with it.",
        "Create the new variant from that base and change only the fields the variant owns.",
        "Preview the promotion and read the mutations before any write command runs.",
      ],
      commands: [
        { step: "Preview the retention", command: `cub variant upload --dry-run ${upload}`, writes: false },
        { step: "Retain this base", command: `cub variant upload ${upload}`, writes: true },
        {
          step: "Create a staging variant",
          command: `cub variant create staging ${id} --space-pattern template:${id}-staging --environment Staging --unit-annotation ${annotation}`,
          writes: true,
        },
        {
          step: "Preview the promotion",
          command: `cub variant promote ${id}-staging --dry-run -o mutations`,
          writes: false,
        },
      ],
      reference: `${GITHUB_BLOB_BASE_URL}${COMMAND_CONTRACT_PATH}`,
    },
  };
}

function buildRouting(spec) {
  const lifecycle = spec.lifecycle ?? {};
  const records = new Map();
  for (const group of ["requirements", "routeIntent", "targetFacts", "resolution"]) {
    for (const path of lifecycle[group]?.records ?? []) {
      if (!records.has(path)) records.set(path, link(path));
    }
  }
  return compact({
    routeStatus: lifecycle.routeIntent?.status ?? "gap",
    requirementsStatus: lifecycle.requirements?.status ?? "gap",
    targetFactsStatus: lifecycle.targetFacts?.status ?? "gap",
    resolutionStatus: lifecycle.resolution?.status ?? "gap",
    resolutionRule: lifecycle.resolution?.rule ?? "",
    requirements: (lifecycle.requirements?.items ?? []).map((item) => ({
      id: item.id ?? "",
      type: item.type ?? "",
      origin: item.origin ?? "",
      detail: item.detail ?? "",
    })),
    routes: (lifecycle.routeIntent?.routes ?? []).map((route) => {
      const projected = {
        id: route.id ?? "",
        phase: route.phase ?? "",
        status: route.status ?? "",
        sourceStatus: route.sourceStatus ?? "",
        automatic: route.automatic === true,
        actor: route.proposedActor || "not selected",
        mechanism: route.proposedMechanism ?? "",
        supportedRuntimes: [...(route.supportedRuntimes ?? [])],
        requirementRefs: [...(route.requirementRefs ?? [])],
        checks: [...(route.checks ?? [])],
        evidence: [...(route.evidence ?? [])],
      };
      if (Number.isInteger(route.orderHint)) projected.orderHint = route.orderHint;
      return compact(projected);
    }),
    records: [...records.values()].filter(Boolean),
  });
}

function buildLifecycle(spec) {
  const evidence = spec.evidence ?? {};
  const coverage = {};
  for (const [recordKey, listingKey] of COVERAGE_LANES) {
    const declared = evidence[recordKey];
    if (declared === undefined) {
      coverage[listingKey] = { status: "not_declared", declared: null };
      continue;
    }
    const word = String(declared);
    check(COVERAGE_STATUS.has(word), `coverage word ${JSON.stringify(word)} on ${recordKey} is not classified`);
    coverage[listingKey] = { status: COVERAGE_STATUS.get(word), declared: word };
  }

  const ownership = spec.ownership ?? {};
  return {
    installTimeStatus: spec.inputs?.installTimeStatus ?? "not-declared",
    installTimeInputs: (spec.inputs?.installTime ?? []).map(installTimeInput),
    promotion: buildPromotion(spec, evidence),
    coverage,
    policy: {
      profile: spec.policy?.profile ?? "",
      productionAdds: [...(spec.policy?.productionAdds ?? [])],
    },
    operations: {
      resourceClass: spec.operations?.resourceClass ?? "",
      ownerClass: spec.operations?.ownerClass ?? "",
      changeCadence: spec.operations?.changeCadence ?? "",
    },
    ownership: compact({
      status: ownership.status ?? "",
      sourceControlled: [...(ownership.sourceControlled ?? [])],
      variantControlled: [...(ownership.variantControlled ?? [])],
      targetSupplied: [...(ownership.targetSupplied ?? [])],
      deliveryProtected: [...(ownership.deliveryProtected ?? [])],
      rule: ownership.rule ?? "",
    }),
    notes: lifecycleNotes(evidence),
  };
}

// The eight lanes are the catalog's verdicts. An entry can also record an
// upgrade, rollback, or delivery result that was never measured against a lane,
// such as a version-to-version upgrade pass or the artifact digest a GitOps run
// pulled. Those are kept as named values here rather than folded into a lane
// they do not belong to. Values that name something other than a committed file
// and are not lifecycle results belong to evidence.attributes instead, so the
// same fact is never published twice.
function lifecycleNotes(evidence) {
  return Object.entries(evidence)
    .filter(([key]) => isLifecycleFact(key))
    .filter(([, value]) => typeof value === "string" && value && !link(value))
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => byText(left.name, right.name));
}

function isLifecycleFact(key) {
  if (COVERAGE_LANES.some(([recordKey]) => recordKey === key)) return false;
  return key.startsWith("lifecycle");
}

function buildPromotion(spec, evidence) {
  const promotion = spec.promotion;
  const lane = evidence.variantPromotion;
  const status = promotion?.status ?? (typeof lane === "string" ? lane : "");
  if (!status) return { state: "not-recorded" };
  check(PROMOTION_STATE.has(status), `promotion status ${JSON.stringify(status)} is not classified`);
  const result = { state: PROMOTION_STATE.get(status), status };
  if (!promotion) return result;
  if (promotion.path) result.path = promotion.path;
  const sourceDigest = normalizeDigest(promotion.sourceDigest, "promotion source digest");
  if (sourceDigest) result.sourceDigest = sourceDigest;
  if (promotion.receipt) {
    result.receipt = promotion.receipt;
    const url = blobUrl(promotion.receipt);
    if (url) result.receiptUrl = url;
  }
  const notes = Object.entries(promotion)
    .filter(([key]) => !["status", "path", "receipt", "sourceDigest"].includes(key))
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join("; ") : String(value)}`)
    .sort();
  if (notes.length) result.notes = notes;
  return result;
}

// The catalog records a destination prerequisite in four shapes, from a bare
// sentence to a typed CRD requirement with its own detail object. They become
// one shape here, because a reader deciding whether a destination is ready
// should not have to learn which format wrote the entry.
function installTimeInput(item) {
  if (typeof item === "string") return { name: item, status: "declared-not-checked" };
  const details = item.details ?? {};
  const detail = [item.value, item.purpose, details.purpose, details.suggestedSource]
    .filter((part) => typeof part === "string" && part)
    .join(". ");
  return compact({
    name: item.name ?? "",
    kind: item.type ?? item.category ?? "",
    detail,
    status: item.status ?? (item.required === false ? "optional-not-checked" : "declared-not-checked"),
  });
}

function buildAssessment(spec) {
  const stages = (spec.assessment?.stages ?? []).map((stage) =>
    compact({
      id: stage.id ?? "",
      question: stage.question ?? "",
      answer: stage.answer ?? "",
      evidenceState: stage.evidenceState ?? "",
      resultState: stage.resultState ?? "",
      nextAction: stage.nextAction ?? "",
      destinationAccessRequired: stage.destinationAccessRequired === true,
      deploymentRequired: stage.deploymentRequired === true,
      requiredInputs: [...(stage.requiredInputs ?? [])],
      records: (stage.records ?? []).map((path) => link(path)).filter(Boolean),
    }),
  );
  const expected = ["inspection", "materialization", "destination", "post-deployment"];
  check(
    JSON.stringify(stages.map((stage) => stage.id)) === JSON.stringify(expected),
    "a listing must keep the four assessment stages in order",
  );
  return { stages };
}

function buildEvidence(spec) {
  const links = new Map();
  const attributes = [];
  for (const [name, value] of Object.entries(spec.evidence ?? {})) {
    if (COVERAGE_LANES.some(([recordKey]) => recordKey === name)) continue;
    if (typeof value !== "string" || !value) continue;
    const resolved = link(value, name);
    if (resolved) links.set(value, resolved);
    // A lifecycle result is published once, under lifecycle.notes.
    else if (!isLifecycleFact(name)) attributes.push({ name, value });
  }
  for (const path of [
    spec.source?.record,
    spec.configuration?.objects,
    spec.configuration?.inventory,
    spec.processing?.flattening?.record,
    spec.baseVariant?.digestRecord,
  ]) {
    const resolved = link(path);
    if (resolved && !links.has(resolved.path)) links.set(resolved.path, resolved);
  }
  return {
    links: [...links.values()].sort((left, right) => byText(left.path, right.path)),
    attributes: attributes.sort((left, right) => byText(left.name, right.name)),
  };
}

// A path becomes a link only when the repository actually tracks it. Records
// also carry prose that happens to contain a slash, and runs/ is gitignored, so
// neither a slash nor a file on this machine is enough to publish a URL.
function link(path, name) {
  if (typeof path !== "string" || !path || path.startsWith("oci://") || path.startsWith("http")) return null;
  if (!trackedExists(join(repoRoot, path))) return null;
  return { name: name ?? path.split("/").pop(), path, url: `${GITHUB_BLOB_BASE_URL}${path}` };
}

function blobUrl(path) {
  return link(path)?.url ?? "";
}

function sourceKey(record) {
  const source = record.spec?.source ?? {};
  return [source.type ?? "", source.name ?? "", source.version ?? ""].join("|");
}

function normalizeDigest(value, label) {
  if (value === undefined || value === null || value === "") return "";
  const text = String(value);
  const match = /^(?:sha256:)?([0-9a-f]{64})$/.exec(text);
  check(match, `${label} is not a sha256 digest: ${text}`);
  return `sha256:${match[1]}`;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// An optional field the record left blank is dropped rather than published as
// an empty string, so a reader never has to decide whether "" means absent or
// means empty. An empty array is kept: a list with nothing in it is itself the
// answer, and every listing declaring the same lists is what makes the shape
// uniform.
function compact(object) {
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === "" || value === undefined) continue;
    result[key] = value;
  }
  return result;
}

// Sorting decides the byte order of 257 committed files, and localeCompare
// depends on the ICU data of whatever machine runs it, so a developer and CI
// could disagree about the same input. Compare code units instead.
function byText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// A small draft-07 subset validator. The repository carries no dependencies, and
// a schema nothing checks drifts from the files it describes, so the generator
// validates its own output against the published schema on every run.
function validate(node, value, path, root = node) {
  if (node.$ref) {
    const target = node.$ref.replace(/^#\//, "").split("/").reduce((carry, key) => carry?.[key], root);
    return target ? validate(target, value, path, root) : [`${path}: unresolved $ref ${node.$ref}`];
  }
  const errors = [];
  if (node.const !== undefined && value !== node.const) {
    errors.push(`${path}: expected ${JSON.stringify(node.const)}, found ${JSON.stringify(value)}`);
  }
  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${node.enum.join(", ")}`);
  }
  const types = node.type ? [node.type].flat() : [];
  if (types.length && !types.some((type) => matchesType(type, value))) {
    errors.push(`${path}: expected type ${types.join(" or ")}, found ${describe(value)}`);
    return errors;
  }
  if (typeof value === "string") {
    if (node.minLength !== undefined && value.length < node.minLength) errors.push(`${path}: is shorter than ${node.minLength}`);
    if (node.pattern && !new RegExp(node.pattern).test(value)) errors.push(`${path}: ${JSON.stringify(value)} does not match ${node.pattern}`);
  }
  if (typeof value === "number") {
    if (node.minimum !== undefined && value < node.minimum) errors.push(`${path}: is below ${node.minimum}`);
  }
  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) errors.push(`${path}: has fewer than ${node.minItems} item(s)`);
    if (node.maxItems !== undefined && value.length > node.maxItems) errors.push(`${path}: has more than ${node.maxItems} item(s)`);
    if (node.items) value.forEach((item, index) => errors.push(...validate(node.items, item, `${path}[${index}]`, root)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of node.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required`);
    }
    for (const [key, child] of Object.entries(value)) {
      const childSchema = node.properties?.[key];
      if (childSchema) errors.push(...validate(childSchema, child, `${path}.${key}`, root));
      else if (node.additionalProperties === false) errors.push(`${path}.${key} is not in the schema`);
      else if (node.additionalProperties && typeof node.additionalProperties === "object") {
        errors.push(...validate(node.additionalProperties, child, `${path}.${key}`, root));
      }
    }
  }
  return errors;
}

function matchesType(type, value) {
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number";
  if (type === "null") return value === null;
  return typeof value === type;
}

function describe(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function runSelfTest() {
  for (const path of ["../README.md", "/README.md", "README.md/../README.md", "missing-untracked-objects.yaml", "data"]) {
    check(retainedObjectFile(path) === null, `self-test: invalid or non-file retained source ${path} must be omitted`);
  }
  const retained = retainedObjectFile("README.md");
  check(retained?.sha256 === `sha256:${sha256(readFileSync(join(repoRoot, "README.md")))}`, "self-test: retained source identity hashes exact file bytes");

  const loaded = JSON.parse(readFileSync(schemaPath, "utf8"));

  // The validator is the only thing keeping the schema honest, so it is tested
  // in both directions before it is trusted to pass 257 listings.
  const good = { apiVersion: "catalog.confighub.com/v1alpha1", kind: "CatalogListing" };
  const shape = {
    type: "object",
    additionalProperties: false,
    required: ["apiVersion", "kind"],
    properties: { apiVersion: { const: "catalog.confighub.com/v1alpha1" }, kind: { const: "CatalogListing" } },
  };
  check(validate(shape, good, "case").length === 0, "self-test: a conforming object must validate");
  check(validate(shape, { ...good, extra: 1 }, "case").some((message) => message.includes("not in the schema")), "self-test: an undeclared field must fail");
  check(validate(shape, { apiVersion: good.apiVersion }, "case").some((message) => message.includes("required")), "self-test: a missing required field must fail");
  check(validate(shape, { ...good, kind: "Other" }, "case").some((message) => message.includes("expected")), "self-test: a wrong const must fail");
  check(
    validate(loaded.$defs.digest, "sha256:not-a-digest", "case").some((message) => message.includes("does not match")),
    "self-test: a malformed digest must fail the published schema",
  );
  check(validate(loaded.$defs.digest, `sha256:${"a".repeat(64)}`, "case").length === 0, "self-test: a real digest must pass");
  check(
    validate(loaded.$defs.coverageLane, { status: "passed", declared: "yes" }, "case").length > 0,
    "self-test: a coverage status outside the enum must fail",
  );

  // An unclassified status word must stop the run. That is what stops a new
  // vocabulary word from quietly reading as a pass.
  check(!COVERAGE_STATUS.has("probably"), "self-test: the coverage table must not accept an unrecorded word");
  check(!OCI_STATE.has("maybe-published"), "self-test: the OCI table must not accept an unrecorded word");
  check(
    COVERAGE_STATUS.get("watch") === "partial" && COVERAGE_STATUS.get("proven-with-watch") === "partial",
    "self-test: a watch row must never be a pass",
  );
  check(COVERAGE_STATUS.get("todo") === "not_checked", "self-test: undone work must not be applicable or checked");

  // Every format the catalog can retain needs a label, or its entries could not
  // be projected at all.
  const formats = loaded.$defs.sourceFormat.enum;
  for (const format of formats) check(FORMAT_LABEL.has(format), `self-test: format ${format} has no listing label`);
  check(FORMAT_LABEL.size === formats.length, "self-test: the label table and the schema formats disagree");

  // A reference on an unpublished bundle must stay planned, and a published one
  // must read as published even when the record wrote it under plannedRef.
  check(referenceState("not-published", "plannedRef") === "planned", "self-test: an unpublished reference must stay planned");
  check(referenceState("local", "reference") === "planned", "self-test: a local push is not a published address");
  check(referenceState("published", "plannedRef") === "published", "self-test: a proved publication must read as published");
  check(referenceState("published", undefined) === "none", "self-test: a bundle with no reference must say none");

  // The uniformity the listing type exists for: an entry that records no
  // delivery at all still declares all four OCI roles and all three runtimes.
  const bare = buildOci("self-test", {});
  check(bare.bundles.length === 4, "self-test: every listing must declare all four OCI roles");
  check(
    JSON.stringify(bare.bundles.map((bundle) => bundle.role)) ===
      JSON.stringify(OCI_ROLES.map(([, role]) => role)),
    "self-test: the OCI roles must keep their order",
  );
  check(
    bare.bundles.every((bundle) => bundle.state === "not-recorded"),
    "self-test: an unmentioned OCI role must say not-recorded rather than not-published",
  );
  check(bare.runtimes.length === 3, "self-test: every listing must declare all three runtimes");
  const bundleStates = loaded.properties.oci.properties.bundles.items.properties.state.$ref;
  check(bundleStates === "#/$defs/ociState", "self-test: the bundle state must use the published enum");
  for (const state of ["published", "local", "recorded-elsewhere", "not-published", "not-recorded"]) {
    check(loaded.$defs.ociState.enum.includes(state), `self-test: the OCI state enum lost ${state}`);
  }
  for (const state of [...OCI_STATE.values()]) {
    check(loaded.$defs.ociState.enum.includes(state), `self-test: OCI table state ${state} is not in the schema`);
  }
  for (const state of [...DELIVERY_STATE.values()]) {
    check(loaded.$defs.deliveryState.enum.includes(state), `self-test: delivery table state ${state} is not in the schema`);
  }
  for (const state of [...COVERAGE_STATUS.values()]) {
    check(
      loaded.$defs.coverageLane.properties.status.enum.includes(state),
      `self-test: coverage table state ${state} is not in the schema`,
    );
  }
  for (const state of [...PROMOTION_STATE.values()]) {
    check(
      loaded.properties.lifecycle.properties.promotion.properties.state.enum.includes(state),
      `self-test: promotion table state ${state} is not in the schema`,
    );
  }
  check(byText("README.md", "rendered") < 0, "self-test: sorting must compare code units, not collated text");

  const digest = normalizeDigest("b".repeat(64), "self-test digest");
  check(digest === `sha256:${"b".repeat(64)}`, "self-test: a bare hex digest must gain its algorithm prefix");
  let refused = false;
  try {
    normalizeDigest("deadbeef", "self-test digest");
  } catch {
    refused = true;
  }
  check(refused, "self-test: a short digest must be refused rather than published");
  check(slug("bitnami/redis") === "bitnami-redis", "self-test: component slug changed");

  // A recorded value belongs to exactly one section, so no listing publishes
  // the same fact twice.
  const mixed = { lifecycleUpgrade: "1.0.0-to-2.0.0-pass", configHubSpace: "some-space", renderParity: "yes" };
  const notes = lifecycleNotes(mixed);
  const projected = buildEvidence({ evidence: mixed });
  check(notes.length === 1 && notes[0].name === "lifecycleUpgrade", "self-test: an upgrade result belongs to lifecycle.notes");
  check(
    projected.attributes.length === 1 && projected.attributes[0].name === "configHubSpace",
    "self-test: a recorded name that is not a lifecycle result belongs to evidence.attributes",
  );
  check(
    !projected.attributes.some((entry) => notes.some((note) => note.name === entry.name)),
    "self-test: a recorded value must not be published in two sections",
  );
  check(
    !notes.some((note) => note.name === "renderParity") && !projected.attributes.some((entry) => entry.name === "renderParity"),
    "self-test: a coverage lane must stay in coverage",
  );
}
