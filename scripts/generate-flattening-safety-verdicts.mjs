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
          "the webhook-cert helper goes live (lookup, genSelfSignedCert, webhook CA); that base needs its own verdict and trends unsafe-to-flatten",
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
    repo: "jetstack",
    chart: "cert-manager",
    version: "v1.21.0",
    recipe: "recipes/jetstack/cert-manager/v1.21.0",
    auditedBase: "crds-enabled",
    verdictFile: "flattening-safety-verdict-crds-enabled.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present-gated",
        detail:
          "the startupapicheck Job is a post-install hook, and this base renders with hooks excluded, so no hook object reaches the bundle",
        disposition:
          "the check does not run from a flattened bundle; enable it through the render-late route or accept that the API readiness probe is skipped",
      },
      "resource-policy-keep": {
        detail:
          "the six cert-manager CRDs render into this base and each carries helm.sh/resource-policy keep",
        disposition: "prune protection ships beside the bundle",
      },
      "webhook-ca": {
        disposition:
          "the cainjector controller maintains the CA at runtime and ships inside the bundle; no external route needed",
      },
      "crd-ordering": {
        detail: "the six CRDs render into this base, so per-file Units can race them",
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "prune protection for the six keep-annotated CRDs",
      "CRD ordering declaration for the six cert-manager CRDs",
    ],
    rationale:
      "This base renders the CRDs, so it carries both the keep promise and the ordering hazard, and each has a companion artifact that discharges it. The startupapicheck hook is excluded from the render rather than routed, which the hooks row states plainly.",
    variantScope: [
      {
        values: "the default base",
        effect:
          "renders no CRDs, so the keep promise and the ordering hazard both move to whoever installs the definitions",
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
    lane: "unsafe-to-flatten",
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
          "lookup-reuse plus genSelfSignedCert go live and freeze cert material into the bundle; that base is unsafe-to-flatten unless certificates come from an external reference",
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
    lane: "unsafe-to-flatten",
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
    repo: "aws-controllers-k8s",
    chart: "ec2-chart",
    version: "1.18.4",
    recipe: "recipes/aws-controllers-k8s/ec2-chart/1.18.4",
    auditedBase: "eks-inference",
    overrides: {
      "crd-ordering": {
        disposition:
          "ordering declaration ships with the bundle; the eks-inference producer already emits exactly this as the crds/controller split at Argo sync waves -20 and -10",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 22 EC2 CRDs"],
    rationale:
      "The chart is hook-free and template-clean at the audited values; the CRDs are the one construct needing a companion, and the producer's pipeline already ships it.",
    variantScope: [],
  },
  {
    repo: "aws-controllers-k8s",
    chart: "iam-chart",
    version: "1.7.3",
    recipe: "recipes/aws-controllers-k8s/iam-chart/1.7.3",
    auditedBase: "eks-inference",
    overrides: {
      "crd-ordering": {
        disposition:
          "ordering declaration ships with the bundle; the eks-inference producer already emits exactly this as the crds/controller split at Argo sync waves -20 and -10",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 9 IAM CRDs"],
    rationale:
      "The chart is hook-free and template-clean at the audited values; the CRDs are the one construct needing a companion, and the producer's pipeline already ships it.",
    variantScope: [],
  },
  {
    repo: "aws-controllers-k8s",
    chart: "eks-chart",
    version: "1.16.3",
    recipe: "recipes/aws-controllers-k8s/eks-chart/1.16.3",
    auditedBase: "eks-inference",
    overrides: {
      "crd-ordering": {
        disposition:
          "ordering declaration ships with the bundle; the eks-inference producer already emits exactly this as the crds/controller split at Argo sync waves -20 and -10",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 10 EKS CRDs"],
    rationale:
      "The chart is hook-free and template-clean at the audited values; the CRDs are the one construct needing a companion, and the producer's pipeline already ships it.",
    variantScope: [],
  },
  {
    repo: "karpenter",
    chart: "karpenter",
    version: "1.14.0",
    recipe: "recipes/karpenter/karpenter/1.14.0",
    auditedBase: "eks-inference",
    overrides: {
      "capabilities-api-versions": {
        detail:
          "the ServiceMonitor template opens on a monitoring.coreos.com capability guard; the audited render pins the kube version with no extra api-versions, so the guard stays closed",
      },
      "crd-ordering": {
        disposition:
          "ordering declaration ships with the bundle; the eks-inference producer already emits it as karpenter-crds.yaml at sync wave -20",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 5 Karpenter CRDs"],
    rationale:
      "No hooks, no lookup, no generated values; the capability guard is closed by the pinned render inputs and only the CRDs need a companion.",
    variantScope: [
      {
        values: "serviceMonitor.enabled with monitoring.coreos.com in api-versions",
        effect:
          "the capability guard opens; the render inputs must pin the api-versions list explicitly or the flattened bundle silently lacks the ServiceMonitor",
      },
    ],
  },
  {
    repo: "nvidia",
    chart: "nvidia-device-plugin",
    version: "0.19.3",
    recipe: "recipes/nvidia/nvidia-device-plugin/0.19.3",
    auditedBase: "eks-inference",
    overrides: {
      "helm-hooks": {
        finding: "present-gated",
        detail:
          "a post-delete cleanup Job lives in the vendored node-feature-discovery subchart, gated by nfd.enabled and gfd.enabled, both off in the audited base",
        disposition: "no route needed for the audited base",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail:
          "the NodeFeature CRDs ship in the node-feature-discovery subchart behind the same gate",
        disposition: "no route needed for the audited base",
      },
      "subchart-conditions": {
        disposition:
          "the flatten step must render with the audited base's condition set; the producer's committed values leave the gate off",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The audited render carries nothing render time discards; the chart's only hazards sit in the condition-gated node-feature-discovery subchart, which the audited base leaves off. This confirms the producer's guard-clean published bundle at template level.",
    variantScope: [
      {
        values: "nfd.enabled or gfd.enabled",
        effect:
          "the node-feature-discovery subchart adds a post-delete cleanup hook and NodeFeature CRDs; that base is at least flatten-with-routes and needs its own verdict",
      },
    ],
  },
  {
    repo: "aws-controllers-k8s",
    chart: "ec2-chart",
    version: "1.18.4",
    recipe: "recipes/aws-controllers-k8s/ec2-chart/1.18.4",
    auditedBase: "default",
    verdictFile: "flattening-safety-verdict-default.yaml",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle (crds split or sync waves)",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 22 EC2 CRDs"],
    rationale:
      "Chart defaults change no quirk class against the eks-inference base; the CRDs remain the one construct needing a companion.",
    variantScope: [
      {
        values: "deletionPolicy (chart default deletes AWS resources on prune; the eks-inference base sets retain)",
        effect:
          "not a flattening hazard, but the single most consequential values choice for this chart under a pruning reconciler",
      },
    ],
  },
  {
    repo: "aws-controllers-k8s",
    chart: "iam-chart",
    version: "1.7.3",
    recipe: "recipes/aws-controllers-k8s/iam-chart/1.7.3",
    auditedBase: "default",
    verdictFile: "flattening-safety-verdict-default.yaml",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle (crds split or sync waves)",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 9 IAM CRDs"],
    rationale:
      "Chart defaults change no quirk class against the eks-inference base; the CRDs remain the one construct needing a companion.",
    variantScope: [
      {
        values: "deletionPolicy (chart default deletes AWS resources on prune; the eks-inference base sets retain)",
        effect:
          "not a flattening hazard, but the single most consequential values choice for this chart under a pruning reconciler",
      },
    ],
  },
  {
    repo: "aws-controllers-k8s",
    chart: "eks-chart",
    version: "1.16.3",
    recipe: "recipes/aws-controllers-k8s/eks-chart/1.16.3",
    auditedBase: "default",
    verdictFile: "flattening-safety-verdict-default.yaml",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle (crds split or sync waves)",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 10 EKS CRDs"],
    rationale:
      "Chart defaults change no quirk class against the eks-inference base; the CRDs remain the one construct needing a companion.",
    variantScope: [
      {
        values: "deletionPolicy (chart default deletes AWS resources on prune; the eks-inference base sets retain)",
        effect:
          "not a flattening hazard, but the single most consequential values choice for this chart under a pruning reconciler",
      },
    ],
  },
  {
    repo: "karpenter",
    chart: "karpenter",
    version: "1.14.0",
    recipe: "recipes/karpenter/karpenter/1.14.0",
    auditedBase: "default",
    verdictFile: "flattening-safety-verdict-default.yaml",
    overrides: {
      "capabilities-api-versions": {
        detail:
          "the ServiceMonitor template opens on a monitoring.coreos.com capability guard; the audited render pins the kube version with no extra api-versions, so the guard stays closed",
      },
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle (crds split or sync waves)",
      },
    },
    lane: "flatten-with-routes",
    routes: ["CRD ordering declaration for the 5 Karpenter CRDs"],
    rationale:
      "The chart refuses to render without settings.clusterName, so this base sets it to the ConfigHub placeholder sentinel and publishing gates refuse while it remains; beyond that required value, chart defaults change no quirk class and only the CRDs need a companion.",
    variantScope: [
      {
        values: "settings.clusterName",
        effect:
          "required with no chart default; environment-owned, filled per variant by a link, never baked into a published bundle",
      },
    ],
  },
  {
    repo: "nvidia",
    chart: "nvidia-device-plugin",
    version: "0.19.3",
    recipe: "recipes/nvidia/nvidia-device-plugin/0.19.3",
    auditedBase: "default",
    verdictFile: "flattening-safety-verdict-default.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present-gated",
        detail:
          "a post-delete cleanup Job lives in the vendored node-feature-discovery subchart, gated by nfd.enabled and gfd.enabled, both off by chart default",
        disposition: "no route needed for the audited base",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail:
          "the NodeFeature CRDs ship in the node-feature-discovery subchart behind the same gate",
        disposition: "no route needed for the audited base",
      },
      "subchart-conditions": {
        disposition:
          "the flatten step must render with the audited base's condition set; chart defaults leave the gate off",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Chart defaults leave the node-feature-discovery gate off, so nothing this base renders is discharged at render time; the default and eks-inference bases agree.",
    variantScope: [
      {
        values: "nfd.enabled or gfd.enabled",
        effect:
          "the subchart adds a post-delete cleanup hook and NodeFeature CRDs; the nfd-enabled base's verdict records that lane",
      },
    ],
  },
  {
    repo: "karpenter",
    chart: "karpenter",
    version: "1.14.0",
    recipe: "recipes/karpenter/karpenter/1.14.0",
    auditedBase: "crds-managed",
    verdictFile: "flattening-safety-verdict-crds-managed.yaml",
    overrides: {
      "capabilities-api-versions": {
        detail:
          "the ServiceMonitor template opens on a monitoring.coreos.com capability guard; the audited render pins the kube version with no extra api-versions, so the guard stays closed",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail:
          "the chart's five CRDs are excluded from this base's render; the karpenter-crd chart owns them out of band",
        disposition:
          "nothing ships in this bundle; CRD presence is a declared precondition on the platform's CRD owner",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "With the CRDs managed out of band, nothing this base renders is discharged at render time; the ordering hazard moves to the platform's CRD owner and is recorded as a precondition rather than a companion artifact. Same chart version as the eks-inference base, different lane, which is why bundles key on version and variant together.",
    variantScope: [
      {
        values: "rendering with --include-crds (the eks-inference base)",
        effect:
          "the five CRDs enter the bundle and the lane is flatten-with-routes with an ordering declaration",
      },
    ],
  },
  {
    repo: "nvidia",
    chart: "nvidia-device-plugin",
    version: "0.19.3",
    recipe: "recipes/nvidia/nvidia-device-plugin/0.19.3",
    auditedBase: "nfd-enabled",
    verdictFile: "flattening-safety-verdict-nfd-enabled.yaml",
    overrides: {
      "helm-hooks": {
        detail:
          "opening the node-feature-discovery gate renders its post-delete cleanup Job into this base",
        disposition: "post-delete lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        detail: "three NodeFeature CRDs render in this base",
        disposition: "ordering declaration ships with the bundle",
      },
      "subchart-conditions": {
        disposition:
          "the flatten step must render with this base's condition set; the gate is deliberately open here",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "post-delete cleanup lifecycle route for the node-feature-discovery Job",
      "CRD ordering declaration for the three NodeFeature CRDs",
    ],
    rationale:
      "Opening the gate the producer leaves closed pulls the subchart's cleanup hook and CRDs into the render; the same chart version that is safe-to-flatten at the eks-inference base needs two companion artifacts here.",
    variantScope: [
      {
        values: "nfd.enabled false (the eks-inference base)",
        effect: "the subchart drops out and the lane returns to safe-to-flatten",
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
    lane: "unsafe-to-flatten",
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
  {
    repo: "argo-cd",
    chart: "argo-cd",
    version: "9.5.15",
    recipe: "recipes/argo-cd/argo-cd/9.5.15",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "templates/redis-secret-init/job.yaml runs at pre-install and pre-upgrade to mint the redis credential; the other hook objects are chart tests",
        disposition: "lifecycle route executed by the delivery runtime, or values that supply the credential",
      },
      "resource-policy-keep": {
        finding: "present",
        detail: "the three Argo CRDs carry helm.sh/resource-policy keep",
        disposition: "prune protection ships beside the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the redis-secret-init Job",
      "prune protection for the three keep-annotated CRDs",
      "CRD ordering declaration",
    ],
    rationale:
      "A pre-install Job mints the redis credential and three CRDs carry the keep promise, so this base needs companions rather than refusing flattening. The remaining hooks are test hooks, pruned from any bundle.",
    variantScope: [
      {
        values: "redis-ha.enabled or an external redis",
        effect:
          "removes the redis-secret-init Job and its route",
      },
    ],
  },
  {
    repo: "grafana",
    chart: "grafana",
    version: "10.5.15",
    recipe: "recipes/grafana/grafana/10.5.15",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present",
        detail: "templates/_helpers.tpl reads the existing admin Secret before deciding whether to generate one",
        disposition: "no emitted route discharges a live lookup-or-generate credential path",
      },
      "generated-secrets": {
        finding: "present",
        detail: "the admin password is generated on render when no existing Secret is named",
        disposition: "a flattened bundle would freeze one credential draw into a shared artifact",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "The admin credential is read from the cluster and generated when absent, in the same helper pair, so a flattened bundle either freezes one draw into a shared artifact or renders against a cluster that was not there.",
    variantScope: [
      {
        values: "admin.existingSecret",
        effect:
          "supplies the credential externally and removes both hazards; that base deserves its own verdict and trends flatten-with-routes",
      },
    ],
  },
  {
    repo: "grafana",
    chart: "loki",
    version: "7.0.0",
    recipe: "recipes/grafana/loki/7.0.0",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        finding: "present",
        detail: "ten CRD documents render with the chart",
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the ten CRD documents",
    ],
    rationale:
      "Every credential and webhook hazard sits in a condition-gated subchart or behind the enterprise provisioner, and the CRDs are the one construct the audited base always carries.",
    variantScope: [
      {
        values: "minio.enabled",
        effect:
          "adds the minio credential helpers, which read the cluster and generate when absent",
      },
      {
        values: "rollout_operator.enabled",
        effect:
          "adds four admission webhooks whose CA must come from somewhere",
      },
      {
        values: "the enterprise provisioner",
        effect:
          "adds a hook Job that provisions tenants",
      },
    ],
  },
  {
    repo: "grafana",
    chart: "tempo",
    version: "1.24.4",
    recipe: "recipes/grafana/tempo/1.24.4",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The scan found none of the constructs that render-time flattening loses, which is what makes a chart cheap to certify.",
    variantScope: [],
  },
  {
    repo: "hashicorp",
    chart: "consul",
    version: "2.0.0",
    recipe: "recipes/hashicorp/consul/2.0.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "hooks span pre-install, post-install, post-upgrade, and pre-delete, including the Job that creates the federation secret",
        disposition: "no emitted route discharges a hook set this broad",
      },
      "webhook-ca": {
        finding: "present",
        detail: "the connect-inject mutating and validating webhooks need a CA that the chart's own lifecycle supplies",
        disposition: "route to cert-manager or a certgen lifecycle route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Forty-four hook objects across install, upgrade, and delete, a Job that creates the federation secret, two connect-inject webhooks needing a CA, and thirty-nine CRDs. No set of emitted companions discharges that today.",
    variantScope: [],
  },
  {
    repo: "hashicorp",
    chart: "vault",
    version: "0.32.0",
    recipe: "recipes/hashicorp/vault/0.32.0",
    auditedBase: "default",
    overrides: {
      "webhook-ca": {
        finding: "present",
        detail:
          "the injector mutating webhook renders with an empty caBundle, and the injector fills it at runtime: AGENT_INJECT_TLS_AUTO names that webhook configuration and the injector ClusterRole grants patch on mutatingwebhookconfigurations",
        disposition: "the injector maintains its own CA from inside the bundle; no external route needed",
      },
      "helm-hooks": {
        finding: "present",
        detail: "the only hook object is the chart's server test",
        disposition: "pruned from any bundle",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The only hook is a chart test, and the empty webhook caBundle is filled by the injector the bundle itself ships, which holds the patch permission to do it. Nothing this base renders is discharged at render time.",
    variantScope: [
      {
        values: "injector.certs.secretName",
        effect:
          "supplies the certificate externally instead, which removes the runtime dependency but adds an external Secret requirement",
      },
    ],
  },
  {
    repo: "ingress-nginx",
    chart: "ingress-nginx",
    version: "4.15.1",
    recipe: "recipes/ingress-nginx/ingress-nginx/4.15.1",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "the job-patch chain creates the webhook Secret at pre-install and patches the caBundle at post-install",
        disposition: "the catalog's observed webhook-cert lifecycle routes exist but run render-late today",
      },
      "webhook-ca": {
        finding: "present",
        detail: "the validating webhook renders with an empty caBundle that only the hook chain fills",
        disposition: "route to cert-manager or a certgen lifecycle route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "The admission webhook's certificate comes from a hook Job chain that creates a Secret and patches the caBundle after install. A flattened bundle ships the webhook with an empty caBundle and nothing to fill it, so admission fails closed.",
    variantScope: [
      {
        values: "controller.admissionWebhooks.enabled: false",
        effect:
          "removes the webhook and its certgen chain; that base trends safe-to-flatten",
      },
    ],
  },
  {
    repo: "jetstack",
    chart: "cert-manager",
    version: "v1.20.2",
    recipe: "recipes/jetstack/cert-manager/v1.20.2",
    auditedBase: "default",
    overrides: {
      "resource-policy-keep": {
        finding: "present",
        detail: "the CRD templates carry helm.sh/resource-policy keep",
        disposition: "prune protection must ship beside the bundle",
      },
      "webhook-ca": {
        finding: "present",
        detail: "the cainjector maintains the CA at runtime and ships inside the bundle",
        disposition: "no external route needed",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "startupapicheck lifecycle route, or values that disable it",
      "prune protection for the keep-annotated CRDs",
      "CRD ordering declaration",
    ],
    rationale:
      "The same shape as the audited v1.21.0: a post-install check, keep annotations riding the CRDs, and CRDs that need ordering. Each has a nameable companion.",
    variantScope: [
      {
        values: "startupapicheck.enabled: false",
        effect:
          "removes the only lifecycle hook and shrinks the route list to keep and ordering",
      },
    ],
  },
  {
    repo: "longhorn",
    chart: "longhorn",
    version: "1.11.2",
    recipe: "recipes/longhorn/longhorn/1.11.2",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present",
        detail: "templates/validate-psp-install.yaml reads the cluster while rendering",
        disposition: "no emitted route discharges a live validation lookup",
      },
      "helm-hooks": {
        finding: "present",
        detail: "pre-upgrade, post-upgrade, and uninstall Jobs carry the chart's lifecycle",
        disposition: "no emitted route discharges an uninstall Job",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "A default-path template reads the cluster to decide what to render, and the chart carries pre-upgrade, post-upgrade, and uninstall Jobs that a flattened bundle would silently skip.",
    variantScope: [],
  },
  {
    repo: "metrics-server",
    chart: "metrics-server",
    version: "3.13.0",
    recipe: "recipes/metrics-server/metrics-server/3.13.0",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail: "the APIService certificate reuse lookup sits behind tls.type helm, off in the audited base",
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
      "No construct the audited base renders is discharged at render time; the chart's one hazard path is values-gated TLS material, exactly as in the audited 3.13.1.",
    variantScope: [
      {
        values: "tls.type: helm",
        effect:
          "freezes certificate material into the bundle; that base is unsafe-to-flatten unless certificates come from an external reference",
      },
    ],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "85.3.3",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/85.3.3",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "the admission-webhook certgen hook chain mints the CA at install time",
        disposition: "the catalog's observed webhook-cert lifecycle routes exist but run render-late today",
      },
      lookup: {
        finding: "present",
        detail: "grafana's admin-credential helper and PVC reuse read the live cluster",
        disposition: "no emitted route discharges a live lookup-or-generate credential path",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "The same shape as the audited 87.19.2: an admission-webhook certgen hook chain and grafana credentials read from the cluster and generated when absent.",
    variantScope: [
      {
        values: "grafana.admin.existingSecret with the admission webhooks disabled or cert-manager-owned",
        effect:
          "removes both hazards and deserves a fresh verdict",
      },
    ],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus",
    version: "29.8.0",
    recipe: "recipes/prometheus-community/prometheus/29.8.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The scan found no hook template, no lookup, no generated credential, no webhook, and no CRD anywhere in the package. Alertmanager, kube-state-metrics, node-exporter, and pushgateway are all enabled in the audited base, so this reading already covers them.",
    variantScope: [
      {
        values: "testFramework.enabled on any subchart",
        effect:
          "adds test-hook annotations, which a bundle prunes rather than ships; the alertmanager subchart carries the only such default and it is off",
      },
      {
        values: "alertmanager, kube-state-metrics, node-exporter, or pushgateway disabled",
        effect: "shrinks the rendered set; the verdict still holds",
      },
    ],
  },
  {
    repo: "secrets-store-csi-driver",
    chart: "secrets-store-csi-driver",
    version: "1.6.0",
    recipe: "recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "templates/crds-upgrade-hook.yaml runs a Job that installs and upgrades the driver CRDs",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "resource-policy-keep": {
        finding: "present",
        detail: "the CRD upgrade hook objects carry helm.sh/resource-policy keep",
        disposition: "prune protection ships beside the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the CRD upgrade hook Job",
      "prune protection for the keep-annotated CRD hook objects",
      "CRD ordering declaration",
    ],
    rationale:
      "The chart upgrades its CRDs through a hook Job and marks part of that machinery keep, so a flattened bundle needs both a lifecycle route and prune protection.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "mongodb",
    version: "19.0.7",
    recipe: "recipes/bitnami/mongodb/19.0.7",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present",
        detail:
          "the chart's own credential template calls the shared password-manage helper, which reads an existing Secret from the cluster before deciding whether to mint one",
        disposition: "no emitted route discharges a live lookup-or-generate credential path",
      },
      "generated-secrets": {
        finding: "present",
        detail:
          "the audited base mints its credentials on render, in the chart's own templates rather than only in the vendored library",
        disposition: "a flattened bundle would freeze one credential draw into a shared artifact",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "The credentials are lookup-or-generate at render time in the shared bitnami secret helpers: the chart reads an existing Secret and mints one when absent. That is the exact construct a public flattened artifact must never freeze, and it is the same finding that decided the audited redis 27.0.0.",
    variantScope: [
      {
        values: "auth.existingSecret, the catalog's static-passwords lane",
        effect:
          "an external Secret reference discharges the credential hazard; that base deserves a fresh verdict and trends flatten-with-routes",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "mysql",
    version: "14.0.3",
    recipe: "recipes/bitnami/mysql/14.0.3",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present",
        detail:
          "the chart's own credential template calls the shared password-manage helper, which reads an existing Secret from the cluster before deciding whether to mint one",
        disposition: "no emitted route discharges a live lookup-or-generate credential path",
      },
      "generated-secrets": {
        finding: "present",
        detail:
          "the audited base mints its credentials on render, in the chart's own templates rather than only in the vendored library",
        disposition: "a flattened bundle would freeze one credential draw into a shared artifact",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "The credentials are lookup-or-generate at render time in the shared bitnami secret helpers: the chart reads an existing Secret and mints one when absent. That is the exact construct a public flattened artifact must never freeze, and it is the same finding that decided the audited redis 27.0.0.",
    variantScope: [
      {
        values: "auth.existingSecret, the catalog's static-passwords lane",
        effect:
          "an external Secret reference discharges the credential hazard; that base deserves a fresh verdict and trends flatten-with-routes",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "nginx",
    version: "24.0.2",
    recipe: "recipes/bitnami/nginx/24.0.2",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail:
          "the two deployment lookups read an existing server-block ConfigMap to compute a rollout checksum, and both sit behind existingServerBlockConfigmap and existingStreamServerBlockConfigmap, empty in the audited base; the remaining hits are the vendored bitnami library, which this chart never calls for credentials",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present",
        detail:
          "templates/tls-secret.yaml calls genCA and mints the server certificate on render, and tls.enabled and tls.autoGenerated are both true in the audited base",
        disposition: "a flattened bundle would freeze one keypair draw into a shared artifact",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Unlike the bitnami databases, this chart has no credential to manage. Its hazard is certificate material: the audited base generates a self-signed CA and server certificate at render time, which a public flattened artifact must never freeze.",
    variantScope: [
      {
        values: "tls.existingSecret, or tls.autoGenerated: false",
        effect:
          "certificate material comes from outside the render; that base trends flatten-with-routes with an external secret reference",
      },
      {
        values: "ingress.enabled with ingress.tls",
        effect: "adds an ingress TLS secret that generates its own certificate the same way",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "postgresql",
    version: "18.6.7",
    recipe: "recipes/bitnami/postgresql/18.6.7",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present",
        detail:
          "the chart's own credential template calls the shared password-manage helper, which reads an existing Secret from the cluster before deciding whether to mint one",
        disposition: "no emitted route discharges a live lookup-or-generate credential path",
      },
      "generated-secrets": {
        finding: "present",
        detail:
          "the audited base mints its credentials on render, in the chart's own templates rather than only in the vendored library",
        disposition: "a flattened bundle would freeze one credential draw into a shared artifact",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "The credentials are lookup-or-generate at render time in the shared bitnami secret helpers: the chart reads an existing Secret and mints one when absent. That is the exact construct a public flattened artifact must never freeze, and it is the same finding that decided the audited redis 27.0.0.",
    variantScope: [
      {
        values: "auth.existingSecret, the catalog's static-passwords lane",
        effect:
          "an external Secret reference discharges the credential hazard; that base deserves a fresh verdict and trends flatten-with-routes",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "rabbitmq",
    version: "16.0.14",
    recipe: "recipes/bitnami/rabbitmq/16.0.14",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present",
        detail:
          "the chart's own credential template calls the shared password-manage helper, which reads an existing Secret from the cluster before deciding whether to mint one",
        disposition: "no emitted route discharges a live lookup-or-generate credential path",
      },
      "generated-secrets": {
        finding: "present",
        detail:
          "the audited base mints its credentials on render, in the chart's own templates rather than only in the vendored library",
        disposition: "a flattened bundle would freeze one credential draw into a shared artifact",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "The credentials are lookup-or-generate at render time in the shared bitnami secret helpers: the chart reads an existing Secret and mints one when absent. That is the exact construct a public flattened artifact must never freeze, and it is the same finding that decided the audited redis 27.0.0.",
    variantScope: [
      {
        values: "auth.existingSecret, the catalog's static-passwords lane",
        effect:
          "an external Secret reference discharges the credential hazard; that base deserves a fresh verdict and trends flatten-with-routes",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "redis",
    version: "25.5.3",
    recipe: "recipes/bitnami/redis/25.5.3",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present",
        detail:
          "the chart's own credential template calls the shared password-manage helper, which reads an existing Secret from the cluster before deciding whether to mint one",
        disposition: "no emitted route discharges a live lookup-or-generate credential path",
      },
      "generated-secrets": {
        finding: "present",
        detail:
          "the audited base mints its credentials on render, in the chart's own templates rather than only in the vendored library",
        disposition: "a flattened bundle would freeze one credential draw into a shared artifact",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "The credentials are lookup-or-generate at render time in the shared bitnami secret helpers: the chart reads an existing Secret and mints one when absent. That is the exact construct a public flattened artifact must never freeze, and it is the same finding that decided the audited redis 27.0.0.",
    variantScope: [
      {
        values: "auth.existingSecret, the catalog's static-passwords lane",
        effect:
          "an external Secret reference discharges the credential hazard; that base deserves a fresh verdict and trends flatten-with-routes",
      },
    ],
  },
  {
    repo: "external-secrets",
    chart: "external-secrets",
    version: "2.5.0",
    recipe: "recipes/external-secrets/external-secrets/2.5.0",
    auditedBase: "default",
    overrides: {
      "webhook-ca": {
        finding: "present",
        detail: "the cert-controller maintains the webhook CA at runtime and ships inside the bundle",
        disposition: "no external route needed",
      },
      "crd-ordering": {
        finding: "present",
        detail: "the chart's CRDs render with it",
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the CRD documents",
    ],
    rationale:
      "No hooks, no keep, no generated values; the webhook CA is runtime-owned by the cert-controller and only the CRDs need a companion, exactly as in the audited 2.8.0.",
    variantScope: [
      {
        values: "the catalog's no-crds base",
        effect:
          "removes the CRDs and the ordering route; that base trends safe-to-flatten",
      },
    ],
  },
  // The first chart whose hook lane is decided from a live run rather than from
  // reading the chart. runs/hook-lifecycle/gatekeeper-gatekeeper watched the
  // install and upgrade routes on a fresh cluster, which is what lets the hook
  // disposition name a companion instead of describing an intention.
  {
    repo: "gatekeeper",
    chart: "gatekeeper",
    version: "3.22.2",
    recipe: "recipes/gatekeeper/gatekeeper/3.22.2",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail:
          "17 hook objects across pre-install, pre-upgrade, post-install, post-upgrade and pre-delete, none of which travel in the rendered base; a recorded live run observed the install and upgrade phases running as explicit ordered actions instead",
        disposition:
          "lifecycle route built from the recorded observation, executed by the delivery runtime",
      },
      "webhook-ca": {
        finding: "present",
        detail:
          "two webhook configurations whose serving certificate the controller writes itself; the same live run observed the Secret populated and admission routed after it",
        disposition:
          "the controller maintains its own material from inside the bundle; no external route needed",
      },
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the hook phases, with stages taken from the recorded live observation",
      "CRD ordering declaration for the 17 constraint CRDs",
    ],
    rationale:
      "The chart's hooks do not survive flattening, and for once that is not a guess: a recorded run installed this base without them and watched the same work happen as explicit ordered actions. That observation is what the lifecycle route declares, so the lane names a companion the catalog can point at rather than one it hopes exists.",
    variantScope: [
      {
        values: "the catalog's no-crds base",
        effect: "removes the CRDs and the ordering route, leaving the lifecycle route alone",
      },
      {
        values: "a values-supplied webhook certificate",
        effect:
          "replaces the controller-written Secret with external material, which removes the runtime dependency and adds an external secret reference",
      },
    ],
  },
  {
    repo: "fluent",
    chart: "fluent-bit",
    version: "0.57.6",
    recipe: "recipes/fluent/fluent-bit/0.57.6",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail:
          "the only hook object is templates/tests/test-connection.yaml, and a recorded live run confirmed the chart's whole lifecycle route is that one post-install check",
        disposition: "pruned from any bundle",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "No CRDs, no keep policy, no lookup, no generated material, and the single hook is a chart test. A recorded run reached the same conclusion from the other direction, finding nothing to route but an explicit post-install check.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-blackbox-exporter",
    version: "11.15.1",
    recipe: "recipes/prometheus-community/prometheus-blackbox-exporter/11.15.1",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The scan found no hook, no keep policy, no lookup, no generated material, no webhook and no CRD. The one construct it does carry is an API-version branch in the autoscaler template, which the render inputs pin.",
    variantScope: [],
  },
  {
    repo: "projectcalico",
    chart: "tigera-operator",
    version: "v3.32.0",
    recipe: "recipes/projectcalico/tigera-operator/v3.32.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail:
          "templates/tigera-operator/00-uninstall.yaml is a pre-delete Job that tears the installation down; a recorded live run observed that teardown running as an explicit delete-cleanup action instead",
        disposition:
          "lifecycle route built from the recorded observation, executed by the delivery runtime",
      },
      lookup: {
        finding: "present-gated",
        detail:
          "the felix-configuration template reads the cluster to choose an apiVersion, behind defaultFelixConfiguration.enabled, false in the audited base",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: ["lifecycle route for the pre-delete teardown, with stages taken from the recorded live observation"],
    rationale:
      "Everything this base renders survives flattening except the teardown, which only matters when the release goes away and is exactly what a flattened bundle drops in silence. A recorded run watched that teardown happen as an explicit action, so the lane names a companion rather than hoping for one.",
    variantScope: [
      {
        values: "defaultFelixConfiguration.enabled: true",
        effect:
          "renders the felix configuration, whose apiVersion is chosen by reading the cluster; that base trends unsafe-to-flatten",
      },
    ],
  },
  {
    repo: "autoscaler",
    chart: "cluster-autoscaler",
    version: "9.57.0",
    recipe: "recipes/autoscaler/cluster-autoscaler/9.57.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "coredns",
    chart: "coredns",
    version: "1.45.2",
    recipe: "recipes/coredns/coredns/1.45.2",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "crossplane-stable",
    chart: "crossplane",
    version: "2.3.1",
    recipe: "recipes/crossplane-stable/crossplane/2.3.1",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "descheduler",
    chart: "descheduler",
    version: "0.36.0",
    recipe: "recipes/descheduler/descheduler/0.36.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "elastic",
    chart: "filebeat",
    version: "8.5.1",
    recipe: "recipes/elastic/filebeat/8.5.1",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "elastic",
    chart: "logstash",
    version: "8.5.1",
    recipe: "recipes/elastic/logstash/8.5.1",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "elastic",
    chart: "metricbeat",
    version: "8.5.1",
    recipe: "recipes/elastic/metricbeat/8.5.1",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "gitlab",
    chart: "gitlab-runner",
    version: "0.89.0",
    recipe: "recipes/gitlab/gitlab-runner/0.89.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "istio",
    chart: "gateway",
    version: "1.30.0",
    recipe: "recipes/istio/gateway/1.30.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "jetstack",
    chart: "cert-manager-csi-driver",
    version: "v0.14.0",
    recipe: "recipes/jetstack/cert-manager-csi-driver/v0.14.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "nats",
    chart: "surveyor",
    version: "0.20.9",
    recipe: "recipes/nats/surveyor/0.20.9",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "nfs-subdir-external-provisioner",
    chart: "nfs-subdir-external-provisioner",
    version: "4.0.18",
    recipe: "recipes/nfs-subdir-external-provisioner/nfs-subdir-external-provisioner/4.0.18",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "opencost",
    chart: "opencost",
    version: "2.5.21",
    recipe: "recipes/opencost/opencost/2.5.21",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-state-metrics",
    version: "7.4.0",
    recipe: "recipes/prometheus-community/kube-state-metrics/7.4.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-adapter",
    version: "5.3.0",
    recipe: "recipes/prometheus-community/prometheus-adapter/5.3.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-blackbox-exporter",
    version: "11.10.0",
    recipe: "recipes/prometheus-community/prometheus-blackbox-exporter/11.10.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-node-exporter",
    version: "4.55.0",
    recipe: "recipes/prometheus-community/prometheus-node-exporter/4.55.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-pushgateway",
    version: "3.6.0",
    recipe: "recipes/prometheus-community/prometheus-pushgateway/3.6.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "stakater",
    chart: "reloader",
    version: "2.2.12",
    recipe: "recipes/stakater/reloader/2.2.12",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "stakater",
    chart: "reloader",
    version: "2.2.14",
    recipe: "recipes/stakater/reloader/2.2.14",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "vm",
    chart: "victoria-metrics-single",
    version: "0.39.0",
    recipe: "recipes/vm/victoria-metrics-single/0.39.0",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart carries no hook, keep policy, lookup, generated credential, webhook or CRD, and the committed render agrees: nothing it produces is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "rook-release",
    chart: "rook-ceph-cluster",
    version: "v1.19.5",
    recipe: "recipes/rook-release/rook-ceph-cluster/v1.19.5",
    auditedBase: "default",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Nothing this base renders is discharged at render time. What it does render is custom resources, so the definitions are a declared precondition on the rook-ceph operator chart rather than a companion this bundle can ship, which is how the catalog already treats karpenter's crds-managed base.",
    variantScope: [
      {
        values: "the rook-ceph operator chart is not installed first",
        effect:
          "the custom resources this base renders have no definitions to validate against, and applying them fails",
      },
    ],
  },
  {
    repo: "grafana",
    chart: "promtail",
    version: "6.17.1",
    recipe: "recipes/grafana/promtail/6.17.1",
    auditedBase: "default",
    overrides: {
      "generated-secrets": {
        finding: "present",
        detail:
          "the rendered Secret holds promtail.yaml, which is configuration rather than a credential; the audited base's file carries log level, listen ports and scrape config and no secret material",
        disposition: "nothing to externalise: the Secret carries configuration the bundle is meant to deliver",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The one Secret this base renders is the agent's own configuration file, which the chart stores as a Secret because a config may embed credentials. The audited base's does not.",
    variantScope: [
      {
        values: "a config section carrying credentials, such as a client basic-auth block",
        effect:
          "puts secret material into the rendered bytes; that base is unsafe-to-flatten until the credential comes from an external reference",
      },
    ],
  },
  {
    repo: "nats",
    chart: "nats",
    version: "2.14.0",
    recipe: "recipes/nats/nats/2.14.0",
    auditedBase: "default",
    overrides: {
      "generated-secrets": {
        finding: "present",
        detail:
          "the rendered Secret is nats-box-contexts and holds a connection URL, with no credential in the audited base",
        disposition: "nothing to externalise: the Secret carries a connection context the bundle is meant to deliver",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The single Secret holds the nats-box connection context, which is a server URL. No credential reaches the rendered bytes in the audited base.",
    variantScope: [
      {
        values: "a context configured with a token, nkey or user credential",
        effect:
          "writes that material into the rendered Secret; that base needs an external secret reference",
      },
    ],
  },
  {
    repo: "minio-operator",
    chart: "tenant",
    version: "7.1.1",
    recipe: "recipes/minio-operator/tenant/7.1.1",
    auditedBase: "default",
    overrides: {
      "generated-secrets": {
        finding: "present",
        detail:
          "the rendered configuration Secret carries MINIO_ROOT_USER and MINIO_ROOT_PASSWORD as literal values from the chart's defaults",
        disposition: "a flattened bundle would publish a working root credential in bytes that read as certified",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "The audited base writes the tenant's root credential into the rendered bytes as a literal value. That is worse than a generated one: every consumer of a published bundle would get the same known root password, from an artifact whose whole point is that it can be trusted. The installer package is this chart's certified route, because it renders at install time where the value can be replaced without republishing anything.",
    variantScope: [
      {
        values: "a configuration Secret supplied from outside the render",
        effect:
          "removes the credential from the bytes; that base trends flatten-with-routes with an external secret reference",
      },
    ],
  },
  {
    repo: "external-dns",
    chart: "external-dns",
    version: "1.21.1",
    recipe: "recipes/external-dns/external-dns/1.21.1",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 1 definition(s) this base renders",
    ],
    rationale:
      "The definitions are the only construct needing a companion: per-file Units can otherwise apply a custom resource before the definition that gives it meaning.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "alloy",
    version: "1.11.0",
    recipe: "recipes/grafana/alloy/1.11.0",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 1 definition(s) this base renders",
    ],
    rationale:
      "The definitions are the only construct needing a companion: per-file Units can otherwise apply a custom resource before the definition that gives it meaning.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "alloy",
    version: "1.8.2",
    recipe: "recipes/grafana/alloy/1.8.2",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 1 definition(s) this base renders",
    ],
    rationale:
      "The definitions are the only construct needing a companion: per-file Units can otherwise apply a custom resource before the definition that gives it meaning.",
    variantScope: [],
  },
  {
    repo: "linkerd",
    chart: "linkerd-crds",
    version: "1.8.0",
    recipe: "recipes/linkerd/linkerd-crds/1.8.0",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 8 definition(s) this base renders",
    ],
    rationale:
      "The definitions are the only construct needing a companion: per-file Units can otherwise apply a custom resource before the definition that gives it meaning.",
    variantScope: [],
  },
  {
    repo: "minio-operator",
    chart: "operator",
    version: "7.1.1",
    recipe: "recipes/minio-operator/operator/7.1.1",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 2 definition(s) this base renders",
    ],
    rationale:
      "The definitions are the only construct needing a companion: per-file Units can otherwise apply a custom resource before the definition that gives it meaning.",
    variantScope: [],
  },
  {
    repo: "nats",
    chart: "nack",
    version: "0.34.0",
    recipe: "recipes/nats/nack/0.34.0",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 6 definition(s) this base renders",
    ],
    rationale:
      "The definitions are the only construct needing a companion: per-file Units can otherwise apply a custom resource before the definition that gives it meaning.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-operator-crds",
    version: "29.0.0",
    recipe: "recipes/prometheus-community/prometheus-operator-crds/29.0.0",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 10 definition(s) this base renders",
    ],
    rationale:
      "The definitions are the only construct needing a companion: per-file Units can otherwise apply a custom resource before the definition that gives it meaning.",
    variantScope: [],
  },
  {
    repo: "strimzi",
    chart: "strimzi-kafka-operator",
    version: "1.0.0",
    recipe: "recipes/strimzi/strimzi-kafka-operator/1.0.0",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 10 definition(s) this base renders",
    ],
    rationale:
      "The definitions are the only construct needing a companion: per-file Units can otherwise apply a custom resource before the definition that gives it meaning.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-events",
    version: "2.4.21",
    recipe: "recipes/argo-cd/argo-events/2.4.21",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
      "resource-policy-keep": {
        disposition: "prune protection ships beside the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 3 definition(s) this base renders",
      "prune protection for the 3 object(s) carrying the keep promise",
    ],
    rationale:
      "Two constructs need companions and both have one. The 3 definitions need ordering, and the 3 object(s) carrying the keep promise need prune protection, or a reconciler that deletes anything absent from its desired state takes them with the release.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-rollouts",
    version: "2.40.9",
    recipe: "recipes/argo-cd/argo-rollouts/2.40.9",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
      "resource-policy-keep": {
        disposition: "prune protection ships beside the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 5 definition(s) this base renders",
      "prune protection for the 5 object(s) carrying the keep promise",
    ],
    rationale:
      "Two constructs need companions and both have one. The 5 definitions need ordering, and the 5 object(s) carrying the keep promise need prune protection, or a reconciler that deletes anything absent from its desired state takes them with the release.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argocd-image-updater",
    version: "1.2.2",
    recipe: "recipes/argo-cd/argocd-image-updater/1.2.2",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
      "resource-policy-keep": {
        disposition: "prune protection ships beside the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 1 definition(s) this base renders",
      "prune protection for the 1 object(s) carrying the keep promise",
    ],
    rationale:
      "Two constructs need companions and both have one. The 1 definitions need ordering, and the 1 object(s) carrying the keep promise need prune protection, or a reconciler that deletes anything absent from its desired state takes them with the release.",
    variantScope: [],
  },
  {
    repo: "rook-release",
    chart: "rook-ceph",
    version: "v1.19.5",
    recipe: "recipes/rook-release/rook-ceph/v1.19.5",
    auditedBase: "default",
    overrides: {
      "crd-ordering": {
        disposition: "ordering declaration ships with the bundle",
      },
      "resource-policy-keep": {
        disposition: "prune protection ships beside the bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 25 definition(s) this base renders",
      "prune protection for the 20 object(s) carrying the keep promise",
    ],
    rationale:
      "Two constructs need companions and both have one. The 25 definitions need ordering, and the 20 object(s) carrying the keep promise need prune protection, or a reconciler that deletes anything absent from its desired state takes them with the release.",
    variantScope: [],
  },
  {
    repo: "policy-reporter",
    chart: "policy-reporter",
    version: "3.9.1",
    recipe: "recipes/policy-reporter/policy-reporter/3.9.1",
    auditedBase: "default",
    overrides: {
      "generated-secrets": {
        finding: "present",
        detail:
          "the rendered Secret holds config.yaml, the reporter's own target configuration, whose host fields are empty in the audited base",
        disposition: "nothing to externalise: the Secret carries configuration the bundle is meant to deliver",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The audited base renders no definitions and no lifecycle construct. Its one Secret is the reporter's own configuration file, and the target hosts it names are empty until someone fills them.",
    variantScope: [
      {
        values: "a target configured with a host and credentials",
        effect:
          "writes that material into the rendered Secret; that base needs an external secret reference",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "apache",
    version: "11.4.29",
    recipe: "recipes/bitnami/apache/11.4.29",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail: "the chart manages no credential; its generated-secret hits are TLS material in templates/tls-secrets.yaml, behind ingress TLS, off in the audited base",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the chart manages no credential; its generated-secret hits are TLS material in templates/tls-secrets.yaml, behind ingress TLS, off in the audited base",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "No credential, no definitions, no lifecycle construct. The certificate material this chart can generate sits behind ingress TLS, which the audited base leaves off, and the render carries no Secret at all.",
    variantScope: [
      {
        values: "authentication or TLS enabled",
        effect:
          "renders the credential or certificate this base leaves out, and freezes it into the bytes; that base is unsafe-to-flatten until the material comes from an external reference",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "elasticsearch",
    version: "22.1.6",
    recipe: "recipes/bitnami/elasticsearch/22.1.6",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail: "the only helm-hooks hit is a values.yaml key at line 2236, not a template, so no hook object exists; the credential helper is packaged in the vendored library and this chart never calls it",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the only helm-hooks hit is a values.yaml key at line 2236, not a template, so no hook object exists; the credential helper is packaged in the vendored library and this chart never calls it",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The scan's hook finding is a values key rather than a template, and the credential helper it packages is never called from its own templates. The render confirms it: no Secret, no definitions, no hook.",
    variantScope: [
      {
        values: "authentication or TLS enabled",
        effect:
          "renders the credential or certificate this base leaves out, and freezes it into the bytes; that base is unsafe-to-flatten until the material comes from an external reference",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "memcached",
    version: "8.5.5",
    recipe: "recipes/bitnami/memcached/8.5.5",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail: "templates/secrets.yaml calls the shared password helper, and auth.enabled is false in the audited base, so no Secret renders at all",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "templates/secrets.yaml calls the shared password helper, and auth.enabled is false in the audited base, so no Secret renders at all",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "This is where the bitnami databases and the bitnami caches part company. memcached does call the credential helper, and its auth is off by default, so the audited base renders no Secret. The lane follows what the base renders rather than what the chart could render.",
    variantScope: [
      {
        values: "authentication or TLS enabled",
        effect:
          "renders the credential or certificate this base leaves out, and freezes it into the bytes; that base is unsafe-to-flatten until the material comes from an external reference",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "opensearch",
    version: "2.0.10",
    recipe: "recipes/bitnami/opensearch/2.0.10",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail: "the credential and certificate hits are in the dashboards and ingress TLS templates, off in the audited base, and the keep annotation rides templates/snapshots/pvc.yaml behind snapshots",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the credential and certificate hits are in the dashboards and ingress TLS templates, off in the audited base, and the keep annotation rides templates/snapshots/pvc.yaml behind snapshots",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Every construct the scan found is behind a value the audited base leaves off, and the render agrees: no Secret, no keep-annotated object, no definition.",
    variantScope: [
      {
        values: "authentication or TLS enabled",
        effect:
          "renders the credential or certificate this base leaves out, and freezes it into the bytes; that base is unsafe-to-flatten until the material comes from an external reference",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "phpmyadmin",
    version: "20.0.0",
    recipe: "recipes/bitnami/phpmyadmin/20.0.0",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail: "the credential helper is packaged in the vendored library and this chart never calls it from its own templates",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the credential helper is packaged in the vendored library and this chart never calls it from its own templates",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The chart packages the shared credential helper and never calls it. Its render carries no Secret, no definitions and no lifecycle construct.",
    variantScope: [
      {
        values: "authentication or TLS enabled",
        effect:
          "renders the credential or certificate this base leaves out, and freezes it into the bytes; that base is unsafe-to-flatten until the material comes from an external reference",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "spark",
    version: "10.0.3",
    recipe: "recipes/bitnami/spark/10.0.3",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail: "templates/secret.yaml renders behind security.passwordsSecretName being unset, and the Secret it produces in the audited base carries no data",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "templates/secret.yaml renders behind security.passwordsSecretName being unset, and the Secret it produces in the audited base carries no data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "The audited base renders one Secret and it is empty. Nothing is frozen into the bytes, which is the distinction between a placeholder and a credential.",
    variantScope: [
      {
        values: "authentication or TLS enabled",
        effect:
          "renders the credential or certificate this base leaves out, and freezes it into the bytes; that base is unsafe-to-flatten until the material comes from an external reference",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "zookeeper",
    version: "13.8.7",
    recipe: "recipes/bitnami/zookeeper/13.8.7",
    auditedBase: "default",
    overrides: {
      lookup: {
        finding: "present-gated",
        detail: "templates/secrets.yaml calls the shared password helper, and auth.client.enabled is false in the audited base, so no Secret renders at all",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "templates/secrets.yaml calls the shared password helper, and auth.client.enabled is false in the audited base, so no Secret renders at all",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Like memcached, this chart calls the credential helper and leaves client authentication off by default, so the audited base renders no Secret. The lane follows the base.",
    variantScope: [
      {
        values: "authentication or TLS enabled",
        effect:
          "renders the credential or certificate this base leaves out, and freezes it into the bytes; that base is unsafe-to-flatten until the material comes from an external reference",
      },
    ],
  },
  {
    repo: "bitnami",
    chart: "contour",
    version: "21.1.4",
    recipe: "recipes/bitnami/contour/21.1.4",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail:
          "templates/certgen/job.yaml runs at pre-install and pre-upgrade to mint the TLS material Contour and Envoy use to talk to each other, and no recorded observation exists to route it",
        disposition:
          "the catalog's observed lifecycle routes cover other charts; nothing here has been watched, so no companion can be named",
      },
      lookup: {
        finding: "present-gated",
        detail: "the remaining credential and certificate hits are in the default-backend TLS templates, off in the audited base",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the remaining credential and certificate hits are in the default-backend TLS templates, off in the audited base",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "A pre-install hook mints the certificates Contour and Envoy present to each other, and a flattened bundle carries neither the hook nor the material it would have produced. A lifecycle route could discharge that, but naming one without a recorded run would be inventing it, so the lane refuses rather than promises. The installer package is this chart's certified route.",
    variantScope: [
      {
        values: "certificates supplied from outside the render",
        effect:
          "removes the certgen hook from the install path; that base trends flatten-with-routes with an ordering declaration for the definitions",
      },
    ],
  },
// --- Mechanically-derived entries (issue #1736) ---
// Everything below this line was generated from the committed flattening
// witness for each chart version and the committed render for the specific
// audited base, by a documented, evidence-grounded rule (see
// scripts/generate-flattening-safety-verdicts.mjs's own comment above this
// block, and the PR that added it): a real (non-test) lookup call or a
// pre-delete/post-delete lifecycle hook makes a base unsafe-to-flatten; a
// Secret this base's own render carries with data makes it unsafe-to-flatten;
// a non-test hook, a CRD, a keep annotation, or a webhook configuration this
// base's render carries makes it flatten-with-routes; otherwise the base is
// safe-to-flatten. A hazard the witness finds in the packaged chart that this
// base's own render does not produce is recorded present-gated for this base.
// No per-chart hand read backs these; that is stated plainly in each entry's
// rationale, and the unsafe lane is the deliberately conservative default
// whenever the mechanical rule cannot clear a base.
  {
    repo: "aqua",
    chart: "trivy-operator",
    version: "0.32.1",
    recipe: "recipes/aqua/trivy-operator/0.32.1",
    auditedBase: "default",
    overrides: {},
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "aqua",
    chart: "trivy-operator",
    version: "0.32.1",
    recipe: "recipes/aqua/trivy-operator/0.32.1",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-cd",
    version: "10.1.3",
    recipe: "recipes/argo-cd/argo-cd/10.1.3",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 3 CustomResourceDefinition(s) this base renders",
      "prune protection for the 3 keep-annotated object(s) this base renders",
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s), 3 CustomResourceDefinition(s), 3 keep-annotated object(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-cd",
    version: "10.1.3",
    recipe: "recipes/argo-cd/argo-cd/10.1.3",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-cd",
    version: "10.2.1",
    recipe: "recipes/argo-cd/argo-cd/10.2.1",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 3 CustomResourceDefinition(s) this base renders",
      "prune protection for the 3 keep-annotated object(s) this base renders",
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s), 3 CustomResourceDefinition(s), 3 keep-annotated object(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-cd",
    version: "10.2.1",
    recipe: "recipes/argo-cd/argo-cd/10.2.1",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-cd",
    version: "9.5.15",
    recipe: "recipes/argo-cd/argo-cd/9.5.15",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-cd",
    version: "9.5.17",
    recipe: "recipes/argo-cd/argo-cd/9.5.17",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 3 CustomResourceDefinition(s) this base renders",
      "prune protection for the 3 keep-annotated object(s) this base renders",
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s), 3 CustomResourceDefinition(s), 3 keep-annotated object(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-cd",
    version: "9.5.17",
    recipe: "recipes/argo-cd/argo-cd/9.5.17",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-events",
    version: "2.4.21",
    recipe: "recipes/argo-cd/argo-events/2.4.21",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-rollouts",
    version: "2.40.9",
    recipe: "recipes/argo-cd/argo-rollouts/2.40.9",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-workflows",
    version: "1.0.14",
    recipe: "recipes/argo-cd/argo-workflows/1.0.14",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-workflows",
    version: "1.0.14",
    recipe: "recipes/argo-cd/argo-workflows/1.0.14",
    auditedBase: "controller-default-reviewed",
    verdictFile: "flattening-safety-verdict-controller-default-reviewed.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "argo-cd",
    chart: "argo-workflows",
    version: "1.0.14",
    recipe: "recipes/argo-cd/argo-workflows/1.0.14",
    auditedBase: "minimal-crds",
    verdictFile: "flattening-safety-verdict-minimal-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 8 CustomResourceDefinition(s) this base renders",
      "prune protection for the 8 keep-annotated object(s) this base renders",
      "lifecycle route for the packaged chart's 4 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 non-test lifecycle hook occurrence(s), 8 CustomResourceDefinition(s), 8 keep-annotated object(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "autoscaler",
    chart: "cluster-autoscaler",
    version: "9.57.0",
    recipe: "recipes/autoscaler/cluster-autoscaler/9.57.0",
    auditedBase: "controller-default-reviewed",
    verdictFile: "flattening-safety-verdict-controller-default-reviewed.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "autoscaler",
    chart: "vertical-pod-autoscaler",
    version: "0.9.0",
    recipe: "recipes/autoscaler/vertical-pod-autoscaler/0.9.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "7 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 2 CustomResourceDefinition(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
      "lifecycle route for the packaged chart's 7 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 7 non-test lifecycle hook occurrence(s), 2 CustomResourceDefinition(s), 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "autoscaler",
    chart: "vertical-pod-autoscaler",
    version: "0.9.0",
    recipe: "recipes/autoscaler/vertical-pod-autoscaler/0.9.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "7 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
      "lifecycle route for the packaged chart's 7 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 7 non-test lifecycle hook occurrence(s), 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "aws-ebs-csi-driver",
    chart: "aws-ebs-csi-driver",
    version: "2.60.1",
    recipe: "recipes/aws-ebs-csi-driver/aws-ebs-csi-driver/2.60.1",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "5 hook occurrence(s) in the packaged chart, all test hooks (values: test)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "apache",
    version: "11.4.29",
    recipe: "recipes/bitnami/apache/11.4.29",
    auditedBase: "legacy",
    verdictFile: "flattening-safety-verdict-legacy.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "contour",
    version: "21.1.4",
    recipe: "recipes/bitnami/contour/21.1.4",
    auditedBase: "legacy",
    verdictFile: "flattening-safety-verdict-legacy.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "contour",
    version: "21.1.4",
    recipe: "recipes/bitnami/contour/21.1.4",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "elasticsearch",
    version: "22.1.6",
    recipe: "recipes/bitnami/elasticsearch/22.1.6",
    auditedBase: "ha",
    verdictFile: "flattening-safety-verdict-ha.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (6 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "elasticsearch",
    version: "22.1.6",
    recipe: "recipes/bitnami/elasticsearch/22.1.6",
    auditedBase: "legacy",
    verdictFile: "flattening-safety-verdict-legacy.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (6 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "mongodb",
    version: "19.0.7",
    recipe: "recipes/bitnami/mongodb/19.0.7",
    auditedBase: "existing-secret-replicaset",
    verdictFile: "flattening-safety-verdict-existing-secret-replicaset.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "mongodb",
    version: "19.0.7",
    recipe: "recipes/bitnami/mongodb/19.0.7",
    auditedBase: "static-passwords",
    verdictFile: "flattening-safety-verdict-static-passwords.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "mongodb",
    version: "19.0.9",
    recipe: "recipes/bitnami/mongodb/19.0.9",
    auditedBase: "existing-secret-replicaset",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "mongodb",
    version: "19.0.9",
    recipe: "recipes/bitnami/mongodb/19.0.9",
    auditedBase: "static-passwords",
    verdictFile: "flattening-safety-verdict-static-passwords.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "mongodb",
    version: "19.1.0",
    recipe: "recipes/bitnami/mongodb/19.1.0",
    auditedBase: "existing-secret-replicaset",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "mongodb",
    version: "19.1.0",
    recipe: "recipes/bitnami/mongodb/19.1.0",
    auditedBase: "static-passwords",
    verdictFile: "flattening-safety-verdict-static-passwords.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "mysql",
    version: "14.0.3",
    recipe: "recipes/bitnami/mysql/14.0.3",
    auditedBase: "existing-secret",
    verdictFile: "flattening-safety-verdict-existing-secret.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "mysql",
    version: "14.0.3",
    recipe: "recipes/bitnami/mysql/14.0.3",
    auditedBase: "static-passwords",
    verdictFile: "flattening-safety-verdict-static-passwords.yaml",
    overrides: {},
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "nginx",
    version: "24.0.2",
    recipe: "recipes/bitnami/nginx/24.0.2",
    auditedBase: "existing-tls-ingress",
    verdictFile: "flattening-safety-verdict-existing-tls-ingress.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (5 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "nginx",
    version: "24.0.2",
    recipe: "recipes/bitnami/nginx/24.0.2",
    auditedBase: "http-clusterip",
    verdictFile: "flattening-safety-verdict-http-clusterip.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (5 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "nginx",
    version: "24.0.4",
    recipe: "recipes/bitnami/nginx/24.0.4",
    auditedBase: "existing-tls-ingress",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (5 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "nginx",
    version: "24.0.4",
    recipe: "recipes/bitnami/nginx/24.0.4",
    auditedBase: "http-clusterip",
    verdictFile: "flattening-safety-verdict-http-clusterip.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (5 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "nginx",
    version: "25.0.0",
    recipe: "recipes/bitnami/nginx/25.0.0",
    auditedBase: "existing-tls-ingress",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (5 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "nginx",
    version: "25.0.0",
    recipe: "recipes/bitnami/nginx/25.0.0",
    auditedBase: "http-clusterip",
    verdictFile: "flattening-safety-verdict-http-clusterip.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (5 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "opensearch",
    version: "2.0.10",
    recipe: "recipes/bitnami/opensearch/2.0.10",
    auditedBase: "ha",
    verdictFile: "flattening-safety-verdict-ha.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "opensearch",
    version: "2.0.10",
    recipe: "recipes/bitnami/opensearch/2.0.10",
    auditedBase: "legacy",
    verdictFile: "flattening-safety-verdict-legacy.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "phpmyadmin",
    version: "20.0.0",
    recipe: "recipes/bitnami/phpmyadmin/20.0.0",
    auditedBase: "legacy",
    verdictFile: "flattening-safety-verdict-legacy.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (7 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "postgresql",
    version: "18.6.10",
    recipe: "recipes/bitnami/postgresql/18.6.10",
    auditedBase: "existing-secret",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "postgresql",
    version: "18.6.10",
    recipe: "recipes/bitnami/postgresql/18.6.10",
    auditedBase: "static-passwords",
    verdictFile: "flattening-safety-verdict-static-passwords.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "postgresql",
    version: "18.6.7",
    recipe: "recipes/bitnami/postgresql/18.6.7",
    auditedBase: "existing-secret",
    verdictFile: "flattening-safety-verdict-existing-secret.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "postgresql",
    version: "18.6.7",
    recipe: "recipes/bitnami/postgresql/18.6.7",
    auditedBase: "static-passwords",
    verdictFile: "flattening-safety-verdict-static-passwords.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "postgresql",
    version: "18.7.0",
    recipe: "recipes/bitnami/postgresql/18.7.0",
    auditedBase: "existing-secret",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "postgresql",
    version: "18.7.0",
    recipe: "recipes/bitnami/postgresql/18.7.0",
    auditedBase: "static-passwords",
    verdictFile: "flattening-safety-verdict-static-passwords.yaml",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "rabbitmq",
    version: "16.0.14",
    recipe: "recipes/bitnami/rabbitmq/16.0.14",
    auditedBase: "existing-secret",
    verdictFile: "flattening-safety-verdict-existing-secret.yaml",
    overrides: {},
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "rabbitmq",
    version: "16.0.14",
    recipe: "recipes/bitnami/rabbitmq/16.0.14",
    auditedBase: "static-passwords",
    verdictFile: "flattening-safety-verdict-static-passwords.yaml",
    overrides: {},
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "redis",
    version: "25.5.3",
    recipe: "recipes/bitnami/redis/25.5.3",
    auditedBase: "reuse-existing-secret",
    verdictFile: "flattening-safety-verdict-reuse-existing-secret.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (8 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "redis",
    version: "27.0.0",
    recipe: "recipes/bitnami/redis/27.0.0",
    auditedBase: "reuse-existing-secret",
    verdictFile: "flattening-safety-verdict-reuse-existing-secret.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (8 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "spark",
    version: "10.0.3",
    recipe: "recipes/bitnami/spark/10.0.3",
    auditedBase: "ha",
    verdictFile: "flattening-safety-verdict-ha.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "spark",
    version: "10.0.3",
    recipe: "recipes/bitnami/spark/10.0.3",
    auditedBase: "legacy",
    verdictFile: "flattening-safety-verdict-legacy.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "zookeeper",
    version: "13.8.7",
    recipe: "recipes/bitnami/zookeeper/13.8.7",
    auditedBase: "ha",
    verdictFile: "flattening-safety-verdict-ha.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "bitnami",
    chart: "zookeeper",
    version: "13.8.7",
    recipe: "recipes/bitnami/zookeeper/13.8.7",
    auditedBase: "legacy",
    verdictFile: "flattening-safety-verdict-legacy.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "cloudnative-pg",
    chart: "cloudnative-pg",
    version: "0.28.2",
    recipe: "recipes/cloudnative-pg/cloudnative-pg/0.28.2",
    auditedBase: "default",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 10 CustomResourceDefinition(s) this base renders",
      "prune protection for the 10 keep-annotated object(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 10 CustomResourceDefinition(s), 10 keep-annotated object(s), 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "cloudnative-pg",
    chart: "cloudnative-pg",
    version: "0.28.2",
    recipe: "recipes/cloudnative-pg/cloudnative-pg/0.28.2",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "dex",
    chart: "dex",
    version: "0.24.0",
    recipe: "recipes/dex/dex/0.24.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test)",
        disposition: "pruned from any bundle",
      },
      "generated-secrets": {
        finding: "present",
        detail: "this base's own committed render carries a Secret with data; the witness's credential-generation pattern did not match it, so the value is a literal from values rather than a randAlphaNum-style draw, but this base still ships it as data in a public bundle",
        disposition: "this base's render freezes a Secret's data into any flattened bundle; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base's committed render carries 1 Secret object(s) with data; no content review confirmed the data is non-credential configuration. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "elastic",
    chart: "eck-operator",
    version: "3.4.0",
    recipe: "recipes/elastic/eck-operator/3.4.0",
    auditedBase: "default",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 12 CustomResourceDefinition(s) this base renders",
      "prune protection for the 12 keep-annotated object(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 12 CustomResourceDefinition(s), 12 keep-annotated object(s), 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "elastic",
    chart: "eck-operator",
    version: "3.4.0",
    recipe: "recipes/elastic/eck-operator/3.4.0",
    auditedBase: "ha",
    verdictFile: "flattening-safety-verdict-ha.yaml",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 12 CustomResourceDefinition(s) this base renders",
      "prune protection for the 12 keep-annotated object(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 12 CustomResourceDefinition(s), 12 keep-annotated object(s), 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "elastic",
    chart: "eck-operator",
    version: "3.4.0",
    recipe: "recipes/elastic/eck-operator/3.4.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "elastic",
    chart: "filebeat",
    version: "8.5.1",
    recipe: "recipes/elastic/filebeat/8.5.1",
    auditedBase: "node-or-cluster-collector",
    verdictFile: "flattening-safety-verdict-node-or-cluster-collector.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "elastic",
    chart: "kibana",
    version: "8.5.1",
    recipe: "recipes/elastic/kibana/8.5.1",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "9 non-test lifecycle hook occurrence(s) (values: post-delete | pre-install,pre-upgrade | pre-install,pre-upgrade,post-delete); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-delete | pre-install,pre-upgrade | pre-install,pre-upgrade,post-delete); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "elastic",
    chart: "logstash",
    version: "8.5.1",
    recipe: "recipes/elastic/logstash/8.5.1",
    auditedBase: "ha",
    verdictFile: "flattening-safety-verdict-ha.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "external-dns",
    chart: "external-dns",
    version: "1.21.1",
    recipe: "recipes/external-dns/external-dns/1.21.1",
    auditedBase: "dry-run-txt-registry",
    verdictFile: "flattening-safety-verdict-dry-run-txt-registry.yaml",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 1 CustomResourceDefinition(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 1 CustomResourceDefinition(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "external-dns",
    chart: "external-dns",
    version: "1.21.1",
    recipe: "recipes/external-dns/external-dns/1.21.1",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "external-secrets",
    chart: "external-secrets",
    version: "2.5.0",
    recipe: "recipes/external-secrets/external-secrets/2.5.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "external-secrets",
    chart: "external-secrets",
    version: "2.7.0",
    recipe: "recipes/external-secrets/external-secrets/2.7.0",
    auditedBase: "default",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 24 CustomResourceDefinition(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 24 CustomResourceDefinition(s), 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "external-secrets",
    chart: "external-secrets",
    version: "2.7.0",
    recipe: "recipes/external-secrets/external-secrets/2.7.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "external-secrets",
    chart: "external-secrets",
    version: "2.8.0",
    recipe: "recipes/external-secrets/external-secrets/2.8.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "falcosecurity",
    chart: "falco",
    version: "9.0.0",
    recipe: "recipes/falcosecurity/falco/9.0.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test-success)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "falcosecurity",
    chart: "falcosidekick",
    version: "0.13.1",
    recipe: "recipes/falcosecurity/falcosidekick/0.13.1",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test-success)",
        disposition: "pruned from any bundle",
      },
      "generated-secrets": {
        finding: "present",
        detail: "this base's own committed render carries a Secret with data; the witness's credential-generation pattern did not match it, so the value is a literal from values rather than a randAlphaNum-style draw, but this base still ships it as data in a public bundle",
        disposition: "this base's render freezes a Secret's data into any flattened bundle; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base's committed render carries 1 Secret object(s) with data; no content review confirmed the data is non-credential configuration. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "fluent",
    chart: "fluentd",
    version: "0.5.3",
    recipe: "recipes/fluent/fluentd/0.5.3",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test-success)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "gatekeeper",
    chart: "gatekeeper",
    version: "3.22.2",
    recipe: "recipes/gatekeeper/gatekeeper/3.22.2",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "17 non-test lifecycle hook occurrence(s) (values: post-install | post-upgrade | pre-delete | pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-install | post-upgrade | pre-delete | pre-install,pre-upgrade); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "alloy",
    version: "1.8.2",
    recipe: "recipes/grafana/alloy/1.8.2",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "grafana",
    version: "10.5.15",
    recipe: "recipes/grafana/grafana/10.5.15",
    auditedBase: "existing-secret-ingress",
    verdictFile: "flattening-safety-verdict-existing-secret-ingress.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "6 hook occurrence(s) in the packaged chart, all test hooks (values: {{ .Values.testFramework.hookType | default \"test\" }})",
        disposition: "pruned from any bundle",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "grafana",
    version: "10.5.15",
    recipe: "recipes/grafana/grafana/10.5.15",
    auditedBase: "static-passwords",
    verdictFile: "flattening-safety-verdict-static-passwords.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "6 hook occurrence(s) in the packaged chart, all test hooks (values: {{ .Values.testFramework.hookType | default \"test\" }})",
        disposition: "pruned from any bundle",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "loki",
    version: "7.0.0",
    recipe: "recipes/grafana/loki/7.0.0",
    auditedBase: "simple-scalable-minio",
    verdictFile: "flattening-safety-verdict-simple-scalable-minio.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "9 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-upgrade | {{ .Values.enterprise.provisioner.hookType | quote }}); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "webhook-ca": {
        finding: "present-gated",
        detail: "the packaged chart carries a webhook configuration template; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "loki",
    version: "7.0.0",
    recipe: "recipes/grafana/loki/7.0.0",
    auditedBase: "single-binary-filesystem",
    verdictFile: "flattening-safety-verdict-single-binary-filesystem.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "9 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-upgrade | {{ .Values.enterprise.provisioner.hookType | quote }}); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "webhook-ca": {
        finding: "present-gated",
        detail: "the packaged chart carries a webhook configuration template; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "loki",
    version: "7.1.0",
    recipe: "recipes/grafana/loki/7.1.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "9 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-upgrade | {{ .Values.enterprise.provisioner.hookType | quote }}); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "webhook-ca": {
        finding: "present-gated",
        detail: "the packaged chart carries a webhook configuration template; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "pyroscope",
    version: "2.0.2",
    recipe: "recipes/grafana/pyroscope/2.0.2",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "pyroscope",
    version: "2.0.2",
    recipe: "recipes/grafana/pyroscope/2.0.2",
    auditedBase: "ha",
    verdictFile: "flattening-safety-verdict-ha.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "pyroscope",
    version: "2.0.2",
    recipe: "recipes/grafana/pyroscope/2.0.2",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "4 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "rollout-operator",
    version: "0.49.0",
    recipe: "recipes/grafana/rollout-operator/0.49.0",
    auditedBase: "default",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 2 CustomResourceDefinition(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 4 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 2 CustomResourceDefinition(s), 4 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "rollout-operator",
    version: "0.49.0",
    recipe: "recipes/grafana/rollout-operator/0.49.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 4 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 4 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "tempo",
    version: "1.24.4",
    recipe: "recipes/grafana/tempo/1.24.4",
    auditedBase: "local-persistent",
    verdictFile: "flattening-safety-verdict-local-persistent.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "grafana",
    chart: "tempo",
    version: "1.24.4",
    recipe: "recipes/grafana/tempo/1.24.4",
    auditedBase: "s3-query-observability",
    verdictFile: "flattening-safety-verdict-s3-query-observability.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "haproxytech",
    chart: "kubernetes-ingress",
    version: "1.52.0",
    recipe: "recipes/haproxytech/kubernetes-ingress/1.52.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "5 non-test lifecycle hook occurrence(s) (values: post-install,pre-upgrade | pre-install); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "hashicorp",
    chart: "consul",
    version: "2.0.0",
    recipe: "recipes/hashicorp/consul/2.0.0",
    auditedBase: "default-control-plane",
    verdictFile: "flattening-safety-verdict-default-control-plane.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "43 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | post-upgrade | post-upgrade, post-install | post-upgrade,post-install | pre-delete | pre-install | pre-install,pre-upgrade | pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-install,post-upgrade | post-upgrade | post-upgrade, post-install | post-upgrade,post-install | pre-delete | pre-install | pre-install,pre-upgrade | pre-upgrade | test-success); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "hashicorp",
    chart: "consul",
    version: "2.0.0",
    recipe: "recipes/hashicorp/consul/2.0.0",
    auditedBase: "secure-mesh-existing-secrets",
    verdictFile: "flattening-safety-verdict-secure-mesh-existing-secrets.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "43 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | post-upgrade | post-upgrade, post-install | post-upgrade,post-install | pre-delete | pre-install | pre-install,pre-upgrade | pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-install,post-upgrade | post-upgrade | post-upgrade, post-install | post-upgrade,post-install | pre-delete | pre-install | pre-install,pre-upgrade | pre-upgrade | test-success); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "hashicorp",
    chart: "terraform",
    version: "1.1.2",
    recipe: "recipes/hashicorp/terraform/1.1.2",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "3 hook occurrence(s) in the packaged chart, all test hooks (values: test)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 1 CustomResourceDefinition(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 1 CustomResourceDefinition(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "hashicorp",
    chart: "terraform",
    version: "1.1.2",
    recipe: "recipes/hashicorp/terraform/1.1.2",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "3 hook occurrence(s) in the packaged chart, all test hooks (values: test)",
        disposition: "pruned from any bundle",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "hashicorp",
    chart: "vault",
    version: "0.32.0",
    recipe: "recipes/hashicorp/vault/0.32.0",
    auditedBase: "dev-mode",
    verdictFile: "flattening-safety-verdict-dev-mode.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "hashicorp",
    chart: "vault",
    version: "0.32.0",
    recipe: "recipes/hashicorp/vault/0.32.0",
    auditedBase: "ha-raft-ui",
    verdictFile: "flattening-safety-verdict-ha-raft-ui.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "ingress-nginx",
    chart: "ingress-nginx",
    version: "4.15.1",
    recipe: "recipes/ingress-nginx/ingress-nginx/4.15.1",
    auditedBase: "admission-disabled",
    verdictFile: "flattening-safety-verdict-admission-disabled.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "8 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "webhook-ca": {
        finding: "present-gated",
        detail: "the packaged chart carries a webhook configuration template; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the packaged chart's 8 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 8 non-test lifecycle hook occurrence(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "ingress-nginx",
    chart: "ingress-nginx",
    version: "4.15.1",
    recipe: "recipes/ingress-nginx/ingress-nginx/4.15.1",
    auditedBase: "internal-clusterip",
    verdictFile: "flattening-safety-verdict-internal-clusterip.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "8 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "webhook-ca": {
        finding: "present-gated",
        detail: "the packaged chart carries a webhook configuration template; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "lifecycle route for the packaged chart's 8 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 8 non-test lifecycle hook occurrence(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "istio",
    chart: "gateway",
    version: "1.30.0",
    recipe: "recipes/istio/gateway/1.30.0",
    auditedBase: "controller-default-reviewed",
    verdictFile: "flattening-safety-verdict-controller-default-reviewed.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "istio",
    chart: "istiod",
    version: "1.30.0",
    recipe: "recipes/istio/istiod/1.30.0",
    auditedBase: "default",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "jaegertracing",
    chart: "jaeger-operator",
    version: "2.57.0",
    recipe: "recipes/jaegertracing/jaeger-operator/2.57.0",
    auditedBase: "default",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 1 CustomResourceDefinition(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 1 CustomResourceDefinition(s), 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "jaegertracing",
    chart: "jaeger-operator",
    version: "2.57.0",
    recipe: "recipes/jaegertracing/jaeger-operator/2.57.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "jaegertracing",
    chart: "jaeger",
    version: "4.8.0",
    recipe: "recipes/jaegertracing/jaeger/4.8.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "2 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "jetstack",
    chart: "cert-manager",
    version: "v1.20.2",
    recipe: "recipes/jetstack/cert-manager/v1.20.2",
    auditedBase: "crds-enabled",
    verdictFile: "flattening-safety-verdict-crds-enabled.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "3 non-test lifecycle hook occurrence(s) (values: post-install); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 6 CustomResourceDefinition(s) this base renders",
      "prune protection for the 6 keep-annotated object(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
      "lifecycle route for the packaged chart's 3 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 3 non-test lifecycle hook occurrence(s), 6 CustomResourceDefinition(s), 6 keep-annotated object(s), 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "jetstack",
    chart: "trust-manager",
    version: "v0.22.1",
    recipe: "recipes/jetstack/trust-manager/v0.22.1",
    auditedBase: "default",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 1 CustomResourceDefinition(s) this base renders",
      "prune protection for the 1 keep-annotated object(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 1 CustomResourceDefinition(s), 1 keep-annotated object(s), 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "jetstack",
    chart: "trust-manager",
    version: "v0.22.1",
    recipe: "recipes/jetstack/trust-manager/v0.22.1",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "kedacore",
    chart: "keda",
    version: "2.19.0",
    recipe: "recipes/kedacore/keda/2.19.0",
    auditedBase: "default",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 6 CustomResourceDefinition(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 6 CustomResourceDefinition(s), 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "kedacore",
    chart: "keda",
    version: "2.19.0",
    recipe: "recipes/kedacore/keda/2.19.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "route to cert-manager or a certgen lifecycle route for the 1 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 1 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "kyverno",
    chart: "kyverno-policies",
    version: "3.8.0",
    recipe: "recipes/kyverno/kyverno-policies/3.8.0",
    auditedBase: "default",
    overrides: {},
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "kyverno",
    chart: "kyverno-policies",
    version: "3.8.2",
    recipe: "recipes/kyverno/kyverno-policies/3.8.2",
    auditedBase: "default",
    overrides: {},
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "kyverno",
    chart: "kyverno",
    version: "3.8.1",
    recipe: "recipes/kyverno/kyverno/3.8.1",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "7 non-test lifecycle hook occurrence(s) (values: post-upgrade | pre-delete); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-upgrade | pre-delete | test); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "kyverno",
    chart: "kyverno",
    version: "3.8.2",
    recipe: "recipes/kyverno/kyverno/3.8.2",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "7 non-test lifecycle hook occurrence(s) (values: post-upgrade | pre-delete); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-upgrade | pre-delete | test); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "longhorn",
    chart: "longhorn",
    version: "1.11.2",
    recipe: "recipes/longhorn/longhorn/1.11.2",
    auditedBase: "ui-ingress",
    verdictFile: "flattening-safety-verdict-ui-ingress.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "3 non-test lifecycle hook occurrence(s) (values: post-upgrade | pre-delete | pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-upgrade | pre-delete | pre-upgrade); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "longhorn",
    chart: "longhorn",
    version: "1.12.0",
    recipe: "recipes/longhorn/longhorn/1.12.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "3 non-test lifecycle hook occurrence(s) (values: post-upgrade | pre-delete | pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-upgrade | pre-delete | pre-upgrade); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "metallb",
    chart: "metallb",
    version: "0.16.1",
    recipe: "recipes/metallb/metallb/0.16.1",
    auditedBase: "default",
    overrides: {},
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 13 CustomResourceDefinition(s) this base renders",
      "route to cert-manager or a certgen lifecycle route for the 2 webhook configuration(s) this base renders",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 13 CustomResourceDefinition(s), 2 webhook configuration(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "metrics-server",
    chart: "metrics-server",
    version: "3.13.0",
    recipe: "recipes/metrics-server/metrics-server/3.13.0",
    auditedBase: "external-tls-ca",
    verdictFile: "flattening-safety-verdict-external-tls-ca.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (2 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "metrics-server",
    chart: "metrics-server",
    version: "3.13.1",
    recipe: "recipes/metrics-server/metrics-server/3.13.1",
    auditedBase: "external-tls-ca",
    verdictFile: "flattening-safety-verdict-external-tls-ca.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (2 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "nats",
    chart: "nack",
    version: "0.34.0",
    recipe: "recipes/nats/nack/0.34.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "nats",
    chart: "nats",
    version: "2.14.0",
    recipe: "recipes/nats/nats/2.14.0",
    auditedBase: "ha",
    verdictFile: "flattening-safety-verdict-ha.yaml",
    overrides: {
      "generated-secrets": {
        finding: "present",
        detail: "this base's own committed render carries a Secret with data; the witness's credential-generation pattern did not match it, so the value is a literal from values rather than a randAlphaNum-style draw, but this base still ships it as data in a public bundle",
        disposition: "this base's render freezes a Secret's data into any flattened bundle; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base's committed render carries 1 Secret object(s) with data; no content review confirmed the data is non-credential configuration. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "nats",
    chart: "surveyor",
    version: "0.20.9",
    recipe: "recipes/nats/surveyor/0.20.9",
    auditedBase: "default-reviewed",
    verdictFile: "flattening-safety-verdict-default-reviewed.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "oauth2-proxy",
    chart: "oauth2-proxy",
    version: "10.7.0",
    recipe: "recipes/oauth2-proxy/oauth2-proxy/10.7.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "2 hook occurrence(s) in the packaged chart, all test hooks (values: test-success)",
        disposition: "pruned from any bundle",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present",
        detail: "this base's own committed render carries a Secret with data; the witness's credential-generation pattern did not match it, so the value is a literal from values rather than a randAlphaNum-style draw, but this base still ships it as data in a public bundle",
        disposition: "this base's render freezes a Secret's data into any flattened bundle; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base's committed render carries 1 Secret object(s) with data; no content review confirmed the data is non-credential configuration. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "open-telemetry",
    chart: "opentelemetry-operator",
    version: "0.114.0",
    recipe: "recipes/open-telemetry/opentelemetry-operator/0.114.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (2 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "open-telemetry",
    chart: "opentelemetry-operator",
    version: "0.114.0",
    recipe: "recipes/open-telemetry/opentelemetry-operator/0.114.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (2 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "percona",
    chart: "pg-operator",
    version: "3.0.0",
    recipe: "recipes/percona/pg-operator/3.0.0",
    auditedBase: "default",
    overrides: {},
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "percona",
    chart: "pg-operator",
    version: "3.0.0",
    recipe: "recipes/percona/pg-operator/3.0.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "percona",
    chart: "psmdb-operator",
    version: "1.22.0",
    recipe: "recipes/percona/psmdb-operator/1.22.0",
    auditedBase: "default",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "percona",
    chart: "psmdb-operator",
    version: "1.22.0",
    recipe: "recipes/percona/psmdb-operator/1.22.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "percona",
    chart: "pxc-operator",
    version: "1.19.1",
    recipe: "recipes/percona/pxc-operator/1.19.1",
    auditedBase: "default",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "percona",
    chart: "pxc-operator",
    version: "1.19.1",
    recipe: "recipes/percona/pxc-operator/1.19.1",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (1 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "alertmanager",
    version: "1.37.0",
    recipe: "recipes/prometheus-community/alertmanager/1.37.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test-success)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "alertmanager",
    version: "1.37.0",
    recipe: "recipes/prometheus-community/alertmanager/1.37.0",
    auditedBase: "ha",
    verdictFile: "flattening-safety-verdict-ha.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test-success)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "85.3.3",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/85.3.3",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "16 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "86.1.0",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/86.1.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "16 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "86.1.0",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/86.1.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "16 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "87.15.1",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/87.15.1",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "16 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "87.15.1",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/87.15.1",
    auditedBase: "existing-secret",
    verdictFile: "flattening-safety-verdict-existing-secret.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "16 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "87.15.1",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/87.15.1",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "16 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "87.19.2",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/87.19.2",
    auditedBase: "existing-secret",
    verdictFile: "flattening-safety-verdict-existing-secret.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "16 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-prometheus-stack",
    version: "87.19.2",
    recipe: "recipes/prometheus-community/kube-prometheus-stack/87.19.2",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "16 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade | pre-install,pre-upgrade | pre-install,pre-upgrade,post-install,post-upgrade | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (4 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "kube-state-metrics",
    version: "7.4.0",
    recipe: "recipes/prometheus-community/kube-state-metrics/7.4.0",
    auditedBase: "cluster-metrics-readonly",
    verdictFile: "flattening-safety-verdict-cluster-metrics-readonly.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-adapter",
    version: "5.3.0",
    recipe: "recipes/prometheus-community/prometheus-adapter/5.3.0",
    auditedBase: "apiservice-v1-capability",
    verdictFile: "flattening-safety-verdict-apiservice-v1-capability.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-adapter",
    version: "5.3.0",
    recipe: "recipes/prometheus-community/prometheus-adapter/5.3.0",
    auditedBase: "cluster-metrics-readonly",
    verdictFile: "flattening-safety-verdict-cluster-metrics-readonly.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-blackbox-exporter",
    version: "11.10.0",
    recipe: "recipes/prometheus-community/prometheus-blackbox-exporter/11.10.0",
    auditedBase: "cluster-metrics-readonly",
    verdictFile: "flattening-safety-verdict-cluster-metrics-readonly.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus-node-exporter",
    version: "4.55.0",
    recipe: "recipes/prometheus-community/prometheus-node-exporter/4.55.0",
    auditedBase: "cluster-metrics-readonly",
    verdictFile: "flattening-safety-verdict-cluster-metrics-readonly.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus",
    version: "29.8.0",
    recipe: "recipes/prometheus-community/prometheus/29.8.0",
    auditedBase: "server-only-ephemeral",
    verdictFile: "flattening-safety-verdict-server-only-ephemeral.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test-success)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus",
    version: "29.9.0",
    recipe: "recipes/prometheus-community/prometheus/29.9.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test-success)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "prometheus-community",
    chart: "prometheus",
    version: "29.9.0",
    recipe: "recipes/prometheus-community/prometheus/29.9.0",
    auditedBase: "server-only-ephemeral",
    verdictFile: "flattening-safety-verdict-server-only-ephemeral.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test-success)",
        disposition: "pruned from any bundle",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "runix",
    chart: "pgadmin4",
    version: "1.62.0",
    recipe: "recipes/runix/pgadmin4/1.62.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "1 hook occurrence(s) in the packaged chart, all test hooks (values: test)",
        disposition: "pruned from any bundle",
      },
      "generated-secrets": {
        finding: "present",
        detail: "this base's own committed render carries a Secret with data; the witness's credential-generation pattern did not match it, so the value is a literal from values rather than a randAlphaNum-style draw, but this base still ships it as data in a public bundle",
        disposition: "this base's render freezes a Secret's data into any flattened bundle; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base's committed render carries 1 Secret object(s) with data; no content review confirmed the data is non-credential configuration. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "secrets-store-csi-driver",
    chart: "secrets-store-csi-driver",
    version: "1.6.0",
    recipe: "recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0",
    auditedBase: "sync-secret-rotation",
    verdictFile: "flattening-safety-verdict-sync-secret-rotation.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "10 non-test lifecycle hook occurrence(s) (values: pre-install,pre-upgrade | pre-upgrade); a mechanical sweep, not a per-hook read",
        disposition: "lifecycle route executed by the delivery runtime",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "flatten-with-routes",
    routes: [
      "CRD ordering declaration for the 2 CustomResourceDefinition(s) this base renders",
      "lifecycle route for the packaged chart's 10 non-test hook occurrence(s)",
    ],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. This base carries 10 non-test lifecycle hook occurrence(s), 2 CustomResourceDefinition(s). Each is a nameable companion; CRD ordering and prune protection are built automatically from this base's own render when a bundle is generated.",
    variantScope: [],
  },
  {
    repo: "stakater",
    chart: "reloader",
    version: "2.2.12",
    recipe: "recipes/stakater/reloader/2.2.12",
    auditedBase: "controller-default-reviewed",
    verdictFile: "flattening-safety-verdict-controller-default-reviewed.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "strimzi",
    chart: "strimzi-kafka-operator",
    version: "1.0.0",
    recipe: "recipes/strimzi/strimzi-kafka-operator/1.0.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "traefik",
    chart: "traefik",
    version: "40.2.0",
    recipe: "recipes/traefik/traefik/40.2.0",
    auditedBase: "default",
    overrides: {
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "webhook-ca": {
        finding: "present-gated",
        detail: "the packaged chart carries a webhook configuration template; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (2 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "traefik",
    chart: "traefik",
    version: "40.2.0",
    recipe: "recipes/traefik/traefik/40.2.0",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "webhook-ca": {
        finding: "present-gated",
        detail: "the packaged chart carries a webhook configuration template; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
      "generated-secrets": {
        finding: "present-gated",
        detail: "the packaged chart calls a credential-generating helper somewhere in its templates; this base's own committed render carries no Secret with data",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (2 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "valkey",
    chart: "valkey",
    version: "0.11.0",
    recipe: "recipes/valkey/valkey/0.11.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "2 hook occurrence(s) in the packaged chart, all test hooks (values: test)",
        disposition: "pruned from any bundle",
      },
      "resource-policy-keep": {
        finding: "present-gated",
        detail: "the packaged chart carries a helm.sh/resource-policy annotation; this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
  },
  {
    repo: "velero",
    chart: "velero",
    version: "12.0.1",
    recipe: "recipes/velero/velero/12.0.1",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "6 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade,post-rollback | pre-delete | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-install,post-upgrade,post-rollback | pre-delete | pre-install,pre-upgrade,pre-rollback); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "velero",
    chart: "velero",
    version: "12.0.1",
    recipe: "recipes/velero/velero/12.0.1",
    auditedBase: "no-crds",
    verdictFile: "flattening-safety-verdict-no-crds.yaml",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "6 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade,post-rollback | pre-delete | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
      "crd-ordering": {
        finding: "present-gated",
        detail: "the packaged chart carries a crds directory or templated CustomResourceDefinition(s); this base's own committed render carries none",
        disposition: "no route needed for the audited base",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-install,post-upgrade,post-rollback | pre-delete | pre-install,pre-upgrade,pre-rollback); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "velero",
    chart: "velero",
    version: "12.1.0",
    recipe: "recipes/velero/velero/12.1.0",
    auditedBase: "default",
    overrides: {
      "helm-hooks": {
        finding: "present",
        detail: "6 non-test lifecycle hook occurrence(s) (values: post-install,post-upgrade,post-rollback | pre-delete | pre-install,pre-upgrade,pre-rollback); a mechanical sweep, not a per-hook read",
        disposition: "no route emitted for a destructive lifecycle hook; the render-late installer package stays the certified route",
      },
    },
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart defines a pre-delete/post-delete lifecycle hook (values: post-install,post-upgrade,post-rollback | pre-delete | pre-install,pre-upgrade,pre-rollback); no observed live run exists to prove what a flattened bundle would silently drop at removal. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "vm",
    chart: "victoria-logs-single",
    version: "0.12.5",
    recipe: "recipes/vm/victoria-logs-single/0.12.5",
    auditedBase: "default",
    overrides: {},
    lane: "unsafe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Packaged chart calls Helm's live-cluster lookup function (3 occurrence(s)); no per-base gating analysis was done. No per-base gating study or observed live run was done to discharge it, so the render-late installer package stays this base's certified route.",
    variantScope: [],
  },
  {
    repo: "vm",
    chart: "victoria-metrics-single",
    version: "0.39.0",
    recipe: "recipes/vm/victoria-metrics-single/0.39.0",
    auditedBase: "default-reviewed",
    verdictFile: "flattening-safety-verdict-default-reviewed.yaml",
    overrides: {},
    lane: "safe-to-flatten",
    routes: [],
    rationale:
      "Mechanical, evidence-based assessment (not a hand read of the chart): the packaged chart's committed flattening witness and this base's own committed render were compared, and a hazard the witness finds that this base's render does not produce is recorded present-gated for this base. Neither source shows a hazard for this base: no lookup call, no non-test lifecycle hook, and this base's render carries no CRD, keep annotation, webhook configuration, or Secret with data. Nothing this base renders is discharged at render time.",
    variantScope: [],
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
  const nameSuffix = entry.verdictFile ? `-${entry.auditedBase}` : "";
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "FlatteningSafetyVerdict",
    metadata: { name: `${entry.repo}-${entry.chart}-${entry.version}${nameSuffix}` },
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
    "repo,chart,version,base,lane,hooks,lookup,keep,webhooks,generated_secrets,crd_evidence,verdict";
  return `${[
    header,
    ...rows.map((row) =>
      [
        row.repo,
        row.chart,
        row.version,
        row.base,
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
  const chartCount = new Set(rows.map((row) => `${row.repo}/${row.chart}`)).size;
  const lines = [];
  lines.push("# Flattening-safety verdicts");
  lines.push("");
  lines.push(
    "Each audited chart version gets one receipted answer to one question: what happens if you ship it as literal rendered YAML instead of running Helm? Findings come from a template-level scan of the pinned chart package (the witnesses directory), joined with the catalog's recorded hook and lifecycle evidence. The verdict schema is schemas/flattening-safety-verdict.schema.json and the model it feeds is docs/reference/certified-bundle-spec.md.",
  );
  lines.push("");
  lines.push("| chart | version | base | lane | verdict |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const row of rows) {
    lines.push(
      `| ${row.repo}/${row.chart} | ${row.version} | ${row.base} | ${row.lane} | ${row.verdictPath} |`,
    );
  }
  lines.push("");
  lines.push(
    "A lane holds for the audited base named in the verdict. The variantScope block records how other values move the finding set; a different base deserves its own verdict, which is why certified bundles key on chart version and recipe variant together.",
  );
  lines.push("");
  lines.push(
    `This lane scans helm.sh/resource-policy at template level, which the catalog's quirk coverage recorded as a missing axis (data/quirk-coverage/coverage.csv). The ${chartCount} charts here now have that axis answered from source, across ${rows.length} chart-and-base verdicts; the catalog-wide rendered-object scan remains open.`,
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
    const verdictPath = `${entry.recipe}/publication/${entry.verdictFile ?? "flattening-safety-verdict.yaml"}`;
    outputs.push({ path: join(repoRoot, verdictPath), contents: `${toYaml(verdict)}\n` });
    const byClass = Object.fromEntries(
      verdict.spec.dispositions.map((row) => [row.class, row.finding]),
    );
    rows.push({
      repo: entry.repo,
      chart: entry.chart,
      version: entry.version,
      base: entry.auditedBase,
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
