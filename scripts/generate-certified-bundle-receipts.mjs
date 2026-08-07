#!/usr/bin/env node
// Emits the four reference CertifiedBundleReceipt artifacts for the certified
// bundle model (docs/planning/certified-bundle-model-brief.md). One bundle comes
// from each producer: the catalog (traefik), Kubara (metrics-server),
// eks-inference (gpu-runtime, from its published bundle via a committed
// witness), and the Sveltos example (the kyverno-fleet ClusterProfile). Output
// is a pure function
// of the committed source files. No wall-clock timestamps, no network, no
// cluster. Spec: docs/reference/certified-bundle-spec.md, schema:
// schemas/certified-bundle-receipt.schema.json.

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  check,
  listFiles,
  relativeRepo,
  repoRoot,
  sha256File,
  toYaml,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const OUT_DIR = join(repoRoot, "data", "certified-bundles");
const WITNESS_DIR = join(OUT_DIR, "witnesses", "eks-inference-gpu-runtime");

const SOURCES = {
  traefikRecipe: "recipes/traefik/traefik/41.0.2",
  traefikPackage: "packages/traefik/traefik/41.0.2",
  kubaraComponent:
    "examples/kubara/current-platform/generated/platform-components/helm/metrics-server",
  kubaraArtifacts: "examples/kubara/current-platform/component-artifacts.yaml",
  kubaraGeneration: "examples/kubara/current-platform/generation-receipt.yaml",
  metricsServerRender:
    "recipes/metrics-server/metrics-server/3.13.1/revisions/default/r001/rendered/release-objects.yaml",
  sveltosProfile: "examples/sveltos/kyverno-fleet/clusterprofile-pilot.yaml",
  sveltosLock: "examples/sveltos/kyverno-fleet/source-lock.yaml",
  sveltosProof: "runs/sveltos-oci-delivery-proof/receipt.yaml",
  witness: "data/certified-bundles/witnesses/eks-inference-gpu-runtime/witness.yaml",
};

// The canonical home of the Kubara collateral. helm-expt keeps a byte-faithful
// mirror under examples/kubara; when that mirror is stripped, re-point the
// kubara sources above at this repository and path.
const KUBARA_CANONICAL_HOME = {
  repository: "https://github.com/confighub/kubara-confighub",
  commit: "da2c5d81060ead9a8c22d2d0491adcc5c736dfc1",
  path: "examples/kubara/current-platform/generated/platform-components/helm/metrics-server",
};

const EKS_INFERENCE = {
  repository: "https://github.com/confighub/eks-inference",
  commit: "2e1a8823920ca4fc6f124db754b7f8f2cfe7d574",
};

const QUIRK_CLASSES = [
  "helm-hooks",
  "resource-policy-keep",
  "lookup",
  "webhook-ca",
  "capabilities-api-versions",
  "generated-secrets",
  "crd-ordering",
  "immutable-fields",
  "namespace-creation",
  "subchart-conditions",
  "test-hooks",
];

function repoPath(rel) {
  return join(repoRoot, rel);
}

function fileEntry(rel, path) {
  return { path: rel, sha256: sha256File(path), bytes: statSync(path).size };
}

function splitDocs(text) {
  return text
    .split(/^---\s*$/m)
    .map((doc) => doc.trim())
    .filter((doc) => doc.length > 0);
}

function scanRendered(text) {
  const docs = splitDocs(text);
  const kinds = new Map();
  let hookDocs = 0;
  let testHookDocs = 0;
  let keepDocs = 0;
  let emptyCaBundle = 0;
  for (const doc of docs) {
    const kindMatch = doc.match(/^kind:\s*"?([A-Za-z0-9.]+)"?\s*$/m);
    const kind = kindMatch ? kindMatch[1] : "unknown";
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    const hookMatch = doc.match(/helm\.sh\/hook["']?\s*:\s*["']?([^"'\n]*)/);
    if (hookMatch) {
      hookDocs += 1;
      if (hookMatch[1].includes("test")) testHookDocs += 1;
    }
    if (/helm\.sh\/resource-policy/.test(doc)) keepDocs += 1;
    if (/caBundle:\s*(""|'')?\s*$/m.test(doc)) emptyCaBundle += 1;
  }
  const count = (kind) => kinds.get(kind) ?? 0;
  return {
    docCount: docs.length,
    kinds,
    hookDocs,
    testHookDocs,
    keepDocs,
    emptyCaBundle,
    crds: count("CustomResourceDefinition"),
    secrets: count("Secret"),
    namespaces: count("Namespace"),
    webhookConfigs:
      count("MutatingWebhookConfiguration") + count("ValidatingWebhookConfiguration"),
    jobs: count("Job") + count("CronJob"),
  };
}

// One disposition row per quirk class, derived from a static scan of rendered
// or literal files. Template-time classes cannot be read off rendered output,
// so they land as not-evaluated with the audit named as the closer.
function scanDispositions(scan, { renderScope, templateEvidence }) {
  const rows = [];
  const audit = "the flattening-safety audit decides the certified disposition";
  rows.push({
    class: "helm-hooks",
    finding: scan.hookDocs > 0 ? "present" : "absent",
    detail:
      scan.hookDocs > 0
        ? `${scan.hookDocs} object(s) carry helm.sh/hook in ${renderScope}`
        : `no helm.sh/hook annotation in ${renderScope}`,
    disposition:
      scan.hookDocs > 0
        ? "lifecycle route executed by the delivery runtime"
        : "none required",
  });
  rows.push({
    class: "resource-policy-keep",
    finding: scan.keepDocs > 0 ? "present" : "absent",
    detail:
      scan.keepDocs > 0
        ? `${scan.keepDocs} object(s) carry helm.sh/resource-policy in ${renderScope}`
        : `no helm.sh/resource-policy annotation in ${renderScope}; the catalog does not yet scan this class as its own axis (data/quirk-coverage/coverage.csv)`,
    disposition:
      scan.keepDocs > 0 ? "prune protection emitted beside the bundle" : "none required",
  });
  rows.push({
    class: "lookup",
    finding: "not-evaluated",
    detail: `template-time construct, invisible in ${renderScope}; ${templateEvidence}`,
    disposition: audit,
  });
  rows.push({
    class: "webhook-ca",
    finding: scan.webhookConfigs > 0 ? "present" : "absent",
    detail:
      scan.webhookConfigs > 0
        ? `${scan.webhookConfigs} webhook configuration(s), ${scan.emptyCaBundle} with an empty caBundle, in ${renderScope}`
        : `no webhook configuration in ${renderScope}`,
    disposition:
      scan.webhookConfigs > 0
        ? "route to cert-manager or a certgen lifecycle route"
        : "none required",
  });
  rows.push({
    class: "capabilities-api-versions",
    finding: "not-evaluated",
    detail: `template-time construct, invisible in ${renderScope}; ${templateEvidence}`,
    disposition: "render inputs pin the kube version and are recorded in this receipt",
  });
  rows.push({
    class: "generated-secrets",
    finding: scan.secrets > 0 ? "present" : "absent",
    detail:
      scan.secrets > 0
        ? `${scan.secrets} Secret object(s) in ${renderScope}; a flattened bundle freezes one draw into a public artifact`
        : `no Secret object in ${renderScope}`,
    disposition:
      scan.secrets > 0
        ? "external Secret reference required before certification"
        : "none required",
  });
  rows.push({
    class: "crd-ordering",
    finding: scan.crds > 0 ? "present" : "absent",
    detail:
      scan.crds > 0
        ? `${scan.crds} CustomResourceDefinition(s) in ${renderScope}; per-file Units can race their CRDs`
        : `no CustomResourceDefinition in ${renderScope}`,
    disposition:
      scan.crds > 0
        ? "explicit ordering declared at ingest (file split or sync waves)"
        : "none required",
  });
  rows.push({
    class: "immutable-fields",
    finding: "not-evaluated",
    detail: "a cross-version property; no second version is compared in this receipt",
    disposition: "versioned replacement route when an upgrade pair is audited",
  });
  rows.push({
    class: "namespace-creation",
    finding: scan.namespaces > 0 ? "present" : "absent",
    detail:
      scan.namespaces > 0
        ? `${scan.namespaces} Namespace object(s) ship in the bundle`
        : "no Namespace object ships in the bundle; the target namespace must exist before apply",
    disposition:
      scan.namespaces > 0 ? "namespace ships as its own Unit" : "declared at ingest",
  });
  rows.push({
    class: "subchart-conditions",
    finding: "not-evaluated",
    detail: `template-time construct, invisible in ${renderScope}; ${templateEvidence}`,
    disposition: audit,
  });
  rows.push({
    class: "test-hooks",
    finding: scan.testHookDocs > 0 ? "present" : "absent",
    detail:
      scan.testHookDocs > 0
        ? `${scan.testHookDocs} object(s) carry a test hook in ${renderScope}`
        : `no test hook in ${renderScope}`,
    disposition: scan.testHookDocs > 0 ? "pruned from the bundle" : "none required",
  });
  return rows;
}

function grab(text, pattern, label) {
  const match = text.match(pattern);
  check(match, `could not read ${label}`);
  return match[1];
}

// When the flattening-safety audit has decided a chart's lane, the receipt
// carries the certified verdict; until then the receipt stays provisional.
function readVerdict(recipeRel) {
  const rel = `${recipeRel}/publication/flattening-safety-verdict.yaml`;
  const path = repoPath(rel);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  return { rel, lane: grab(text, /lane:\s*"([a-z-]+)"/, `${rel} lane`) };
}

function buildLane(verdict, { provisionalLane, provisionalDecidedBy, openQuestions, notes }) {
  if (verdict) {
    return {
      lane: verdict.lane,
      status: "certified",
      decidedBy: `the flattening-safety audit at ${verdict.rel}`,
      notes,
    };
  }
  return {
    lane: provisionalLane,
    status: "provisional",
    decidedBy: provisionalDecidedBy,
    openQuestions,
    notes,
  };
}

function buildTraefikReceipt() {
  const recipe = SOURCES.traefikRecipe;
  const sourceLock = readFileSync(repoPath(`${recipe}/source-lock.yaml`), "utf8");
  const variant = readFileSync(repoPath(`${recipe}/variants/default/variant.yaml`), "utf8");
  const revision = readFileSync(
    repoPath(`${recipe}/revisions/default/r001/variant-revision.yaml`),
    "utf8",
  );
  const renderRel = `${recipe}/revisions/default/r001/rendered/release-objects.yaml`;
  const scan = scanRendered(readFileSync(repoPath(renderRel), "utf8"));
  const bundleFileRel = `${SOURCES.traefikPackage}/bases/default/upstream.yaml`;
  const bundleFile = fileEntry(bundleFileRel, repoPath(bundleFileRel));
  const renderedSetSha = grab(
    revision,
    /renderedObjectSetSHA256:\s*"([a-f0-9]{64})"/,
    "traefik renderedObjectSetSHA256",
  );
  check(
    bundleFile.sha256 === renderedSetSha,
    "traefik package upstream.yaml no longer matches the recorded rendered object set",
  );
  const dispositions = scanDispositions(scan, {
    renderScope: "the committed default-variant render",
    templateEvidence:
      "the chart family shows lookup and capabilities use in data/master-catalog-matrix (40.2.0 rows)",
  });
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: "catalog-traefik-traefik-41.0.2-default" },
    spec: {
      producer: {
        name: "config-workshop-catalog",
        repository: "https://github.com/confighub/helm-expt",
      },
      source: {
        kind: "helm-chart",
        charts: [
          {
            repository: grab(sourceLock, /repositoryURL:\s*"([^"]+)"/, "traefik repositoryURL"),
            name: "traefik",
            version: grab(sourceLock, /^\s+version:\s*"([^"]+)"/m, "traefik version"),
            appVersion: grab(sourceLock, /appVersion:\s*"([^"]+)"/, "traefik appVersion"),
            packageSHA256: grab(sourceLock, /packageSHA256:\s*"([a-f0-9]{64})"/, "traefik packageSHA256"),
            exactArtifactUrl: grab(sourceLock, /url:\s*"([^"]+)"/, "traefik exactArtifact url"),
          },
        ],
        evidence: [
          `${recipe}/source-lock.yaml`,
          `${recipe}/variants/default/variant.yaml`,
          `${recipe}/revisions/default/r001/variant-revision.yaml`,
          `${recipe}/publication/installer-package-receipt.yaml`,
        ],
      },
      renderInputs: {
        renderer: "helm",
        kubeVersion: grab(variant, /kubeVersion:\s*"([^"]+)"/, "traefik kubeVersion"),
        apiVersions: [],
        hookPolicy: grab(variant, /hookPolicy:\s*"([^"]+)"/, "traefik hookPolicy"),
        releaseName: grab(variant, /releaseName:\s*"([^"]+)"/, "traefik releaseName"),
        namespace: grab(variant, /namespace:\s*"([^"]+)"/, "traefik namespace"),
        valuesRef: `${recipe}/effective-values.yaml`,
        valuesSHA256: grab(
          revision,
          /effectiveValuesSHA256:\s*"([a-f0-9]{64})"/,
          "traefik effectiveValuesSHA256",
        ),
      },
      bundle: {
        contentsKind: "rendered-config",
        files: [{ ...bundleFile, role: "rendered object set" }],
        objectCount: Number(grab(revision, /objectCount:\s*(\d+)/, "traefik objectCount")),
        objectInventoryRef: `${recipe}/revisions/default/r001/rendered/object-inventory.yaml`,
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
      },
      dispositions,
      verdict: buildLane(readVerdict(recipe), {
        provisionalLane: "flatten-with-routes",
        provisionalDecidedBy:
          "static scan over the committed default-variant render; hooks, keep-policy, webhooks, and generated secrets are absent there, and 25 CRDs need an ordering declaration",
        openQuestions: [
          "lookup and capabilities use needs the template-level audit",
          "webhook and generated-secret templates are values-gated in this chart, so other variants can change the disposition set",
        ],
        notes:
          "The lane holds for the default base; the verdict's variantScope records how hub webhooks and persistence move it.",
      }),
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [
          `${recipe}/source-lock.yaml`,
          `${recipe}/variants/default/variant.yaml`,
          `${recipe}/revisions/default/r001/variant-revision.yaml`,
          renderRel,
          bundleFileRel,
        ],
      },
    },
  };
}

function buildKubaraReceipt() {
  const componentDir = repoPath(SOURCES.kubaraComponent);
  const files = listFiles(componentDir)
    .map((path) => ({
      rel: relative(componentDir, path).split("/").join("/"),
      path,
    }))
    .sort((a, b) => (a.rel < b.rel ? -1 : 1))
    .map(({ rel, path }) => fileEntry(rel, path));
  const artifacts = readFileSync(repoPath(SOURCES.kubaraArtifacts), "utf8");
  const entry = artifacts.match(
    /- service: metrics-server\n\s+canonicalIdentity: ([^\n]+)\n\s+wrapperVersion: ([^\n]+)\n\s+version: ([^\n]+)\n\s+url: ([^\n]+)\n\s+sha256: ([a-f0-9]{64})/,
  );
  check(entry, "could not read the metrics-server entry in component-artifacts.yaml");
  const [, canonicalIdentity, wrapperVersion, version, url, sha] = entry;
  const scan = scanRendered(readFileSync(repoPath(SOURCES.metricsServerRender), "utf8"));
  const dispositions = scanDispositions(scan, {
    renderScope:
      "the catalog's committed metrics-server 3.13.1 default-variant render (the same chart version this wrapper pins; wrapper values can differ)",
    templateEvidence:
      "the catalog recipe at recipes/metrics-server/metrics-server/3.13.1 carries the chart-level evidence",
  });
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: "kubara-current-platform-metrics-server" },
    spec: {
      producer: {
        name: "kubara",
        repository: KUBARA_CANONICAL_HOME.repository,
        commit: KUBARA_CANONICAL_HOME.commit,
      },
      source: {
        kind: "kubara-component",
        charts: [
          {
            repository: canonicalIdentity.trim(),
            name: "metrics-server",
            version: version.trim(),
            packageSHA256: sha,
            exactArtifactUrl: url.trim(),
          },
        ],
        canonicalHome: KUBARA_CANONICAL_HOME,
        evidence: [SOURCES.kubaraArtifacts, SOURCES.kubaraGeneration],
      },
      bundle: {
        contentsKind: "component-definition",
        files: files.map((file) => ({
          ...file,
          role: file.path === "templates/namespace.yaml" ? "namespace template" : "wrapper chart file",
        })),
        compositionIndexRef: SOURCES.kubaraArtifacts,
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
      },
      dispositions,
      verdict: buildLane(readVerdict("recipes/metrics-server/metrics-server/3.13.1"), {
        provisionalLane: "safe-to-flatten",
        provisionalDecidedBy: `static scan over the catalog's render of the wrapped chart version (wrapper version ${wrapperVersion.trim()}); no hooks, keep-policy, webhooks, CRDs, or Secrets there`,
        openQuestions: [
          "the wrapper's own values were not rendered; certification renders the wrapper composition",
          "lookup, capabilities, and subchart conditions need the template-level audit",
        ],
        notes:
          "This bundle carries the component definition, which renders late today. The lane is the wrapped chart's, scoped to the audited base named in its verdict; the wrapper's own values were not rendered.",
      }),
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [
          SOURCES.kubaraComponent,
          SOURCES.kubaraArtifacts,
          SOURCES.metricsServerRender,
        ],
      },
    },
  };
}

function buildEksInferenceReceipt() {
  const witness = readFileSync(repoPath(SOURCES.witness), "utf8");
  const manifestDigest = grab(
    witness,
    /manifestDigest:\s*"(sha256:[a-f0-9]{64})"/,
    "witness manifestDigest",
  );
  const layerDigest = grab(witness, /\bdigest:\s*"(sha256:[a-f0-9]{64})"/, "witness layer digest");
  const reference = grab(witness, /reference:\s*"([^"]+)"/, "witness reference");
  const fileRows = [];
  const filePattern =
    /- path: "([^"]+)"\n\s+bundlePath: "([^"]+)"\n\s+sha256: "([a-f0-9]{64})"\n\s+bytes: (\d+)/g;
  for (const match of witness.matchAll(filePattern)) {
    const [, witnessRel, bundlePath, sha, bytes] = match;
    const onDisk = join(WITNESS_DIR, witnessRel);
    check(existsSync(onDisk), `witness file missing: ${witnessRel}`);
    check(
      sha256File(onDisk) === sha,
      `witness file drifted from its recorded hash: ${witnessRel}`,
    );
    fileRows.push({ path: bundlePath, sha256: sha, bytes: Number(bytes) });
  }
  check(fileRows.length === 2, "expected two files in the gpu-runtime witness");
  const scanText = fileRows
    .map((row) =>
      readFileSync(
        join(
          WITNESS_DIR,
          "files",
          row.path,
        ),
        "utf8",
      ),
    )
    .join("\n---\n");
  const scan = scanRendered(scanText);
  const dispositions = scanDispositions(scan, {
    renderScope: "the witnessed bundle files",
    templateEvidence:
      "the chart has no catalog entry yet; the producer's guard checked its five hazard patterns at build time",
  });
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: "eks-inference-gpu-runtime" },
    spec: {
      producer: {
        name: "eks-inference",
        repository: EKS_INFERENCE.repository,
        commit: EKS_INFERENCE.commit,
      },
      source: {
        kind: "helm-chart",
        charts: [
          {
            repository: grab(witness, /chartRepository:\s*"([^"]+)"/, "witness chartRepository"),
            name: grab(witness, /chart:\s*"([^"]+)"/, "witness chart"),
            version: grab(witness, /chartVersion:\s*"([^"]+)"/, "witness chartVersion"),
          },
        ],
        evidence: [SOURCES.witness],
      },
      renderInputs: {
        renderer: "helm",
        kubeVersion: grab(witness, /kubeVersion:\s*"([^"]+)"/, "witness kubeVersion"),
        includeCrds: true,
        valuesRef: `${grab(witness, /valuesPath:\s*"([^"]+)"/, "witness valuesPath")} in the producer repository`,
      },
      bundle: {
        artifactType: "application/vnd.confighub.config.bundle.v1",
        reference,
        manifestDigest,
        layerDigest,
        reproducible: true,
        contentsKind: "rendered-config",
        files: fileRows.map((row) => ({
          ...row,
          role: row.path === "00-namespace.yaml" ? "namespace" : "controller",
        })),
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
        uploadCommand:
          "cub variant upload --component gpu-runtime --variant base --granularity per-file oci://ghcr.io/confighub/configs/eks-inference/gpu-runtime",
      },
      dispositions,
      verdict: buildLane(readVerdict("recipes/nvidia/nvidia-device-plugin/0.19.3"), {
        provisionalLane: "safe-to-flatten",
        provisionalDecidedBy:
          "static scan over the witnessed bundle files, agreeing with the producer's build-time guard; no hooks, keep-policy, webhooks, CRDs, or Secrets",
        openQuestions: [
          "lookup, capabilities, and subchart conditions need the template-level audit, which lands with the chart's catalog entry",
        ],
        notes:
          "This receipt certifies a bundle the producer published, not one this repository built. The witness records the pulled digests and the byte agreement with the producer's committed render.",
      }),
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [SOURCES.witness],
        witness: SOURCES.witness,
      },
    },
  };
}

function sveltosNotes() {
  const base =
    "The profile tells Sveltos to install kyverno/kyverno 3.8.1 with Helm on matching clusters. That chart's own lane is decided by its flattening-safety verdict, not by this bundle.";
  const verdict = readVerdict("recipes/kyverno/kyverno/3.8.1");
  if (!verdict) return base;
  return `${base} That verdict is ${verdict.lane} (${verdict.rel}), so the render-late delivery this profile ships is the chart's certified route.`;
}

function buildSveltosReceipt() {
  const profileRel = SOURCES.sveltosProfile;
  const profile = fileEntry("clusterprofile-pilot.yaml", repoPath(profileRel));
  const proof = readFileSync(repoPath(SOURCES.sveltosProof), "utf8");
  const rawSha = grab(proof, /rawSha256:\s*"([a-f0-9]{64})"/, "sveltos rawSha256");
  check(
    profile.sha256 === rawSha,
    "the committed ClusterProfile no longer matches the delivery proof's recorded hash",
  );
  const pilot = proof.match(
    /reference:\s*"(oci:\/\/127\.0\.0\.1:32807\/sveltos-kyverno-staging:pilot)"[\s\S]*?manifestDigest:\s*"(sha256:[a-f0-9]{64})"/,
  );
  check(pilot, "could not read the portable pilot artifact from the delivery proof");
  const scan = scanRendered(readFileSync(repoPath(profileRel), "utf8"));
  const dispositions = scanDispositions(scan, {
    renderScope: "the literal profile",
    templateEvidence: "nothing templates; the source is literal YAML",
  }).map((row) =>
    row.finding === "not-evaluated"
      ? {
          ...row,
          finding: "absent",
          detail: "literal YAML; no template-time construct exists",
          disposition: "none required",
        }
      : row,
  );
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: "sveltos-kyverno-fleet-clusterprofile" },
    spec: {
      producer: {
        name: "sveltos-example",
        repository: "https://github.com/confighub/helm-expt",
      },
      source: {
        kind: "confighub-unit",
        evidence: [
          SOURCES.sveltosLock,
          "examples/sveltos/kyverno-fleet/live-receipt.yaml",
          SOURCES.sveltosProof,
        ],
      },
      bundle: {
        reference: pilot[1],
        manifestDigest: pilot[2],
        contentsKind: "literal-config",
        files: [{ ...profile, role: "ClusterProfile" }],
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
      },
      dispositions,
      verdict: {
        lane: "born-flattened",
        status: "certified",
        decidedBy: "the source is literal YAML; nothing renders, so nothing is lost at render time",
        notes: sveltosNotes(),
      },
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [profileRel, SOURCES.sveltosProof],
      },
    },
  };
}

function toCsv(rows) {
  const header =
    "producer,name,source_kind,contents_kind,chart,chart_version,bundle_digest,file_count,verdict_lane,verdict_status,receipt";
  const lines = rows.map((row) =>
    [
      row.producer,
      row.name,
      row.sourceKind,
      row.contentsKind,
      row.chart,
      row.chartVersion,
      row.digest,
      row.fileCount,
      row.lane,
      row.status,
      row.receipt,
    ].join(","),
  );
  return `${[header, ...lines].join("\n")}\n`;
}

function summaryRow(receipt, receiptRel) {
  const spec = receipt.spec;
  const chart = spec.source.charts?.[0];
  return {
    producer: spec.producer.name,
    name: receipt.metadata.name,
    sourceKind: spec.source.kind,
    contentsKind: spec.bundle.contentsKind,
    chart: chart ? chart.name : "",
    chartVersion: chart ? chart.version : "",
    digest: spec.bundle.manifestDigest ?? spec.bundle.files[0].sha256,
    fileCount: spec.bundle.files.length,
    lane: spec.verdict.lane,
    status: spec.verdict.status,
    receipt: receiptRel,
  };
}

function summaryMd(rows) {
  const lines = [];
  lines.push("# Certified bundle receipts");
  lines.push("");
  lines.push(
    "One receipt shape covers a bundle from every producer. These four reference receipts prove it: the catalog's flattened traefik render, a Kubara component definition, a bundle eks-inference published to its own registry, and the Sveltos example's literal ClusterProfile. The spec lives at docs/reference/certified-bundle-spec.md and the schema at schemas/certified-bundle-receipt.schema.json.",
  );
  lines.push("");
  lines.push("| producer | bundle | contents | lane | status | receipt |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.producer} | ${row.name} | ${row.contentsKind} | ${row.lane} | ${row.status} | ${row.receipt} |`,
    );
  }
  lines.push("");
  lines.push(
    "A provisional verdict states what current evidence supports and names its open questions in the receipt. The flattening-safety audit certifies lanes; a lane moves when its receipt changes, never by hand.",
  );
  lines.push("");
  lines.push(
    "The eks-inference receipt certifies an artifact this repository did not build. Its witness under witnesses/eks-inference-gpu-runtime records the pulled digests, and every extracted file hashed identically to the producer's committed render.",
  );
  lines.push("");
  lines.push(
    "The Kubara receipt reads the byte-faithful mirror under examples/kubara. Its canonicalHome block pins the maintained copy in kubara-confighub, so removing the mirror re-points the generator instead of breaking it silently.",
  );
  lines.push("");
  lines.push("Regenerate with `npm run certified-bundles`. Verify with `npm run certified-bundles:verify`.");
  lines.push("");
  return lines.join("\n");
}

function buildAll() {
  const receipts = [
    { rel: "data/certified-bundles/receipts/catalog/traefik-traefik-41.0.2-default/receipt.yaml", value: buildTraefikReceipt() },
    { rel: "data/certified-bundles/receipts/kubara/current-platform-metrics-server/receipt.yaml", value: buildKubaraReceipt() },
    { rel: "data/certified-bundles/receipts/eks-inference/gpu-runtime/receipt.yaml", value: buildEksInferenceReceipt() },
    { rel: "data/certified-bundles/receipts/sveltos/kyverno-fleet-clusterprofile/receipt.yaml", value: buildSveltosReceipt() },
  ];
  for (const receipt of receipts) {
    const classes = receipt.value.spec.dispositions.map((row) => row.class);
    check(
      QUIRK_CLASSES.every((cls) => classes.includes(cls)),
      `${receipt.rel} is missing a quirk class row`,
    );
  }
  const rows = receipts.map((receipt) => summaryRow(receipt.value, receipt.rel));
  const outputs = receipts.map((receipt) => ({
    path: repoPath(receipt.rel),
    contents: `${toYaml(receipt.value)}\n`,
  }));
  outputs.push({ path: join(OUT_DIR, "receipts.csv"), contents: toCsv(rows) });
  outputs.push({ path: join(OUT_DIR, "summary.md"), contents: summaryMd(rows) });
  return outputs;
}

const outputs = buildAll();
if (mode === "--generate") {
  for (const output of outputs) write(output.path, output.contents);
  console.log(`wrote ${outputs.length} certified-bundle file(s)`);
} else if (mode === "--verify") {
  for (const output of outputs) {
    const rel = relativeRepo(output.path);
    check(existsSync(output.path), `${rel} is missing; run npm run certified-bundles`);
    check(
      readFileSync(output.path, "utf8") === output.contents,
      `${rel} is stale; run npm run certified-bundles`,
    );
  }
  console.log(`verified ${outputs.length} certified-bundle file(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-certified-bundle-receipts.mjs --generate
  node scripts/generate-certified-bundle-receipts.mjs --verify`);
}
