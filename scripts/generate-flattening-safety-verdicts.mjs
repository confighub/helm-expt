#!/usr/bin/env node
// Emits one FlatteningSafetyVerdict per audited chart version, executing the
// first increment of docs/planning/flattening-safety-brief.md. Findings come
// mechanically from the committed template-level witnesses under
// data/flattening-safety/witnesses (recorded once per pinned package by
// scripts/scan-flattening-witness.mjs); dispositions, gating judgments, lanes,
// and variant scopes are the audit's reviewable decision table below, and every
// judgment cites witness file:line evidence or a catalog dataset. Output is a
// pure function of committed files. No network, no cluster, no wall clock.
// Schema: schemas/flattening-safety-verdict.schema.json.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, toYaml, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const OUT_DIR = join(repoRoot, "data", "flattening-safety");

const CLASSES = [
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

const WITNESS_KEY = {
  "helm-hooks": "helm-hooks",
  "resource-policy-keep": "resource-policy-keep",
  lookup: "lookup",
  "webhook-ca": "webhook-config",
  "capabilities-api-versions": "capabilities",
  "generated-secrets": "generated-secrets",
  "namespace-creation": "namespace-creation",
  "test-hooks": "test-hooks",
};

const BOUNDEDNESS = [
  "immutable-field changes are a cross-version property; this verdict compares no second version (the CRD upgrade delta lane holds that precedent)",
  "the scan is static and does not execute templates, so values-gated reachability is a recorded judgment, not a render",
  "the witness scans the packaged chart including its vendored subcharts; charts pulled at deploy time are out of scope",
];

// The audit's decision table. finding overrides mark witnessed constructs the
// audited base does not reach (present-gated), with the gate named in detail.
const CHARTS = [
  {
    repo: "traefik",
    chart: "traefik",
    version: "41.0.2",
    recipe: "recipes/traefik/traefik/41.0.2",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail:
          "NOTES.txt use is cosmetic; the webhook-cert helper lookup sits behind hub.apimanagement.admission, off in the audited base",
        disposition: "no route needed for the audited base",
      },
      "webhook-ca": {
        finding: "present-gated",
        detail: "Traefik Hub admission webhooks, off in the audited base",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "genSelfSignedCert lives in the same gated hub webhook-cert helper",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "keep rides on the PVC template behind persistence.enabled, off in the audited base",
        disposition: "no route needed for the audited base",
      },
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle (crds split or sync waves)",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 25 gateway and traefik CRDs"],
    rationale:
      "Every witnessed hazard is values-gated off the audited base; the CRDs are the one construct that needs a companion artifact.",
    variantScope: [
      {
        values: "hub.apimanagement.* enabled",
        effect:
          "the webhook-cert helper goes live (lookup, genSelfSignedCert, webhook CA); that base needs its own verdict and trends do-not-flatten",
      },
      {
        values: "persistence.enabled: true",
        effect: "the keep-annotated PVC renders; the bundle must ship prune protection",
      },
    ],
  },
  {
    repo: "jetstack",
    chart: "cert-manager",
    version: "v1.21.0",
    recipe: "recipes/jetstack/cert-manager/v1.21.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        disposition:
          "post-install startupapicheck routes to a lifecycle route or ships disabled by values",
      },
      "resource-policy-keep": {
        disposition:
          "prune protection must ship beside the bundle; the keep annotations ride the templated CRDs",
      },
      "webhook-ca": {
        disposition:
          "the cainjector controller maintains the CA at runtime and ships inside the bundle; no external route needed",
      },
      "crd-ordering": {
        detail: "the CRDs are templates, not a crds directory, so they flatten into the bundle",
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "startupapicheck lifecycle route, or values that disable it",
      "prune protection for the six keep-annotated CRDs",
      "CRD ordering declaration",
    ],
    rationale:
      "The hook is a post-install check, the webhook CA is runtime-owned by cainjector, and the keep promise needs prune protection; each has a nameable companion.",
    variantScope: [
      {
        values: "startupapicheck.enabled: false",
        effect: "removes the only hooks; the route list shrinks to keep and ordering",
      },
      {
        values: "crds.keep: false",
        effect: "drops the keep annotations and the prune-protection route",
      },
    ],
  },
  {
    repo: "external-secrets",
    chart: "external-secrets",
    version: "2.8.0",
    recipe: "recipes/external-secrets/external-secrets/2.8.0",
    auditedBase: "default",
    overrides: {
      "webhook-ca": {
        disposition:
          "the cert-controller maintains the webhook CA at runtime and ships inside the bundle; no external route needed",
      },
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle (crds split or sync waves)",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 25 CRD files"],
    rationale:
      "No hooks, no keep, no generated values; the webhook CA is runtime-owned and only the CRDs need a companion artifact.",
    variantScope: [
      {
        values: "the catalog's no-crds base",
        effect: "removes the CRDs and the ordering route; that base trends safe-to-flatten",
      },
    ],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "87.19.2",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/87.19.2",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        disposition:
          "the admission-webhook certgen hook chain mints the CA at install time; the catalog's observed webhook-cert lifecycle routes exist but run render-late today",
      },
      lookup: {
        detail: "grafana's admin-credential helper and PVC reuse read the live cluster",
        disposition: "no emitted route discharges a live lookup-or-generate credential path",
      },
      "generated-secrets": {
        detail: "grafana admin credentials generate on render when no existing secret is named",
        disposition: "a flattened bundle would freeze one credential draw into a public artifact",
      },
      "crd-ordering": {
        disposition: "ordering declaration would ship with any bundle",
      },
    },
    lane: "do-not-flatten",
    routes: [],
    rationale:
      "The certgen hook chain, live lookup-or-generate grafana credentials, and 86 capability branches exceed what emitted routes discharge today; the render-late installer package with its observed webhook-cert lifecycle evidence stays the certified route.",
    variantScope: [
      {
        values: "grafana.admin.existingSecret plus prometheusOperator.admissionWebhooks disabled or cert-manager-owned",
        effect:
          "removes the generated-credential and certgen hazards; such a base deserves a fresh verdict and could reach flatten-with-routes",
      },
    ],
  },
  {
    repo: "metrics-server",
    chart: "metrics-server",
    version: "3.13.1",
    recipe: "recipes/metrics-server/metrics-server/3.13.1",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail: "the APIService cert reuse lookup sits behind tls.type helm, off in the audited base",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "genSelfSignedCert sits behind the same tls.type helm gate",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "No construct the audited base renders is discharged at render time; the chart's one hazard path is values-gated TLS material.",
    variantScope: [
      {
        values: "tls.type: helm",
        effect:
          "lookup-reuse plus genSelfSignedCert go live and freeze cert material into the bundle; that base is do-not-flatten unless certificates come from an external reference",
      },
    ],
  },
  {
    repo: "kyverno",
    chart: "kyverno",
    version: "3.8.1",
    recipe: "recipes/kyverno/kyverno/3.8.1",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        disposition:
          "post-upgrade migration and pre-delete cleanup hooks; the catalog's observed routes are target-owned and not safe as automatic (data/hook-disposition)",
      },
      lookup: {
        detail: "templates/validate.yaml reads the live cluster in a default-path template",
        disposition: "no emitted route discharges a live validation lookup",
      },
      "resource-policy-keep": {
        detail: "keep rides on kyverno's own config configmap",
        disposition: "prune protection would be required beside any bundle",
      },
      "generated-secrets": {
        detail: "the gated reports-server postgres subchart carries the password-manage helpers",
        disposition: "external Secret reference would be required where that subchart is enabled",
      },
      "crd-ordering": {
        disposition: "ordering declaration would ship with any bundle",
      },
    },
    lane: "do-not-flatten",
    routes: [],
    rationale:
      "Migration and cleanup hooks with target-owned routes, a live lookup in config validation, and keep on the chart's own configmap exceed emitted routes; render-late stays certified, exactly the route the Sveltos fleet example ships (Sveltos installs this chart by Helm on the workload cluster).",
    variantScope: [
      {
        values: "reports-server.enabled and its postgres subchart",
        effect: "adds the generated-password hazard the audited base avoids",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "redis",
    version: "27.0.0",
    recipe: "recipes/bitnami/redis/27.0.0",
    auditedBase: "default",
    overrides: {
      lookup: {
        detail:
          "the password-manage helpers read the live cluster to reuse an existing secret before generating",
        disposition: "no emitted route discharges a live lookup-or-generate credential path",
      },
      "generated-secrets": {
        detail: "the audited base generates the redis password on render",
        disposition: "a flattened bundle would freeze one password draw into a public artifact",
      },
    },
    lane: "do-not-flatten",
    routes: [],
    rationale:
      "The default base's credentials are lookup-or-generate at render time, the exact construct a public flattened artifact must never freeze; the catalog's existing-secret work is the named exit.",
    variantScope: [
      {
        values: "auth.existingSecret (the catalog's static-passwords lane)",
        effect:
          "external Secret reference discharges the credential hazard; that base deserves a fresh verdict and trends flatten-with-routes",
      },
    ],
  },
];

function witnessPath(entry) {
  return `data/flattening-safety/witnesses/${entry.repo}-${entry.chart}-${entry.version}.yaml`;
}

function classRow(entry, witness, cls) {
  const spec = witness.spec;
  const override = entry.overrides[cls] ?? {};
  let count = 0;
  let evidence = [];
  if (cls === "crd-ordering") {
    count = spec.crds.files + spec.crds.documents;
    evidence = [`${spec.crds.files} crds-directory file(s), ${spec.crds.documents} CRD document(s)`];
  } else if (cls === "subchart-conditions") {
    count = spec.subcharts.conditions.length;
    evidence = spec.subcharts.conditions.map(
      (row) => `${row.dependency} gated by ${row.condition}`,
    );
    if (count === 0 && spec.subcharts.count > 0)
      evidence = [`${spec.subcharts.count} vendored subchart(s), none condition-gated`];
  } else if (cls === "immutable-fields") {
    return {
      class: cls,
      finding: "not-evaluated",
      detail: "cross-version property; see boundedness",
      disposition: "versioned replacement route when an upgrade pair is audited",
      ...(override.detail ? { detail: override.detail } : {}),
    };
  } else {
    const found = spec.findings[WITNESS_KEY[cls]];
    count = found.count;
    evidence = found.files.slice(0, 6);
  }
  const finding = override.finding ?? (count > 0 ? "present" : "absent");
  const detail =
    override.detail ??
    (count > 0 ? `${count} occurrence(s) in the packaged chart` : "absent from the packaged chart");
  let disposition = override.disposition;
  if (!disposition) {
    if (finding !== "present") disposition = "none required";
    else if (cls === "capabilities-api-versions")
      disposition = "render inputs pin the kube version; recorded in every certified bundle receipt";
    else if (cls === "helm-hooks") disposition = "lifecycle route executed by the delivery runtime";
    else if (cls === "test-hooks") disposition = "pruned from any bundle";
    else if (cls === "namespace-creation") disposition = "namespace ships as its own Unit";
    else if (cls === "subchart-conditions")
      disposition = "the flatten step must render with the audited base's condition set";
    else disposition = "named companion artifact required";
  }
  const row = { class: cls, finding, detail, disposition };
  if (evidence.length > 0 && finding !== "absent") row.evidence = evidence;
  return row;
}

function buildVerdict(entry) {
  const witnessRel = witnessPath(entry);
  const witness = readYaml(join(repoRoot, witnessRel));
  const sourceLock = readFileSync(join(repoRoot, `${entry.recipe}/source-lock.yaml`), "utf8");
  const lockSha = sourceLock.match(/(?:packageSHA256|archiveSHA256):\s*"([a-f0-9]{64})"/);
  check(lockSha, `${entry.recipe}/source-lock.yaml has no package hash`);
  check(
    lockSha[1] === witness.spec.package.sha256,
    `${witnessRel} does not match the source-lock package hash`,
  );
  const dispositions = CLASSES.map((cls) => classRow(entry, witness, cls));
  const verdict = { lane: entry.lane, rationale: entry.rationale };
  if (entry.routes.length > 0) verdict.routes = entry.routes;
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "FlatteningSafetyVerdict",
    metadata: { name: `${entry.repo}-${entry.chart}-${entry.version}` },
    spec: {
      chart: {
        repository: entry.repo,
        name: entry.chart,
        version: entry.version,
        packageSHA256: witness.spec.package.sha256,
      },
      witnessRef: witnessRel,
      auditedBase: entry.auditedBase,
      dispositions,
      variantScope: entry.variantScope,
      verdict,
      boundedness: BOUNDEDNESS,
      provenance: {
        emittedBy: "scripts/generate-flattening-safety-verdicts.mjs",
        generatedFrom: [witnessRel, `${entry.recipe}/source-lock.yaml`],
      },
    },
  };
}

function toCsv(rows) {
  const header =
    "repo,chart,version,lane,hooks,lookup,keep,webhooks,generated_secrets,crd_evidence,verdict";
  return `${[
    header,
    ...rows.map((row) =>
      [
        row.repo,
        row.chart,
        row.version,
        row.lane,
        row.hooks,
        row.lookup,
        row.keep,
        row.webhooks,
        row.gensec,
        row.crds,
        row.verdictPath,
      ].join(","),
    ),
  ].join("\n")}\n`;
}

function summaryMd(rows) {
  const lines = [];
  lines.push("# Flattening-safety verdicts");
  lines.push("");
  lines.push(
    "Each audited chart version gets one receipted answer to one question: what happens if you ship it as literal rendered YAML instead of running Helm? Findings come from a template-level scan of the pinned chart package (the witnesses directory), joined with the catalog's recorded hook and lifecycle evidence. The verdict schema is schemas/flattening-safety-verdict.schema.json and the model it feeds is docs/reference/certified-bundle-spec.md.",
  );
  lines.push("");
  lines.push("| chart | version | lane | verdict |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(`| ${row.repo}/${row.chart} | ${row.version} | ${row.lane} | ${row.verdictPath} |`);
  }
  lines.push("");
  lines.push(
    "A lane holds for the audited base named in the verdict. The variantScope block records how other values move the finding set; a different base deserves its own verdict, which is why certified bundles key on chart version and recipe variant together.",
  );
  lines.push("");
  lines.push(
    "This lane scans helm.sh/resource-policy at template level, which the catalog's quirk coverage recorded as a missing axis (data/quirk-coverage/coverage.csv). The seven charts here now have that axis answered from source; the catalog-wide rendered-object scan remains open.",
  );
  lines.push("");
  lines.push(
    "Witnesses are recorded once per pinned package by scripts/scan-flattening-witness.mjs, which needs the chart tarball and so runs outside the verify chain. Every witness hash is checked against the recipe source-lock here. Regenerate with `npm run flattening-safety`. Verify with `npm run flattening-safety:verify`.",
  );
  lines.push("");
  return lines.join("\n");
}

function buildAll() {
  const outputs = [];
  const rows = [];
  for (const entry of CHARTS) {
    const verdict = buildVerdict(entry);
    const verdictPath = `${entry.recipe}/publication/flattening-safety-verdict.yaml`;
    outputs.push({ path: join(repoRoot, verdictPath), contents: `${toYaml(verdict)}\n` });
    const byClass = Object.fromEntries(
      verdict.spec.dispositions.map((row) => [row.class, row.finding]),
    );
    rows.push({
      repo: entry.repo,
      chart: entry.chart,
      version: entry.version,
      lane: entry.lane,
      hooks: byClass["helm-hooks"],
      lookup: byClass.lookup,
      keep: byClass["resource-policy-keep"],
      webhooks: byClass["webhook-ca"],
      gensec: byClass["generated-secrets"],
      crds: byClass["crd-ordering"],
      verdictPath,
    });
  }
  outputs.push({ path: join(OUT_DIR, "verdicts.csv"), contents: toCsv(rows) });
  outputs.push({ path: join(OUT_DIR, "summary.md"), contents: summaryMd(rows) });
  return outputs;
}

const outputs = buildAll();
if (mode === "--generate") {
  for (const output of outputs) write(output.path, output.contents);
  console.log(`wrote ${outputs.length} flattening-safety file(s)`);
} else if (mode === "--verify") {
  for (const output of outputs) {
    const rel = relativeRepo(output.path);
    check(existsSync(output.path), `${rel} is missing; run npm run flattening-safety`);
    check(
      readFileSync(output.path, "utf8") === output.contents,
      `${rel} is stale; run npm run flattening-safety`,
    );
  }
  console.log(`verified ${outputs.length} flattening-safety file(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-flattening-safety-verdicts.mjs --generate
  node scripts/generate-flattening-safety-verdicts.mjs --verify`);
}
