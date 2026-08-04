#!/usr/bin/env node

// Deterministically reconcile the current Kubara + ConfigHub mini-IDP.
//
// The required path is deliberately conventional: committed Kubara v0.13.0
// output is stored as ConfigHub Units, ConfigHub variants bind it to four
// persistent targets, and ConfigHub-owned Argo CD/argobot reconciles each
// target. No AI authoring or migration step is required.
//
// Modes:
//   --plan            validate local inputs and print the exact offline plan
//   --apply           reconcile the allowlisted live state and write a receipt
//   --verify          read-only comparison of live state with the plan
//   --receipt-verify  verify the committed live receipt without a login
//
// Safety properties:
//   * live modes require the Kubara organization;
//   * every writable Space, Unit, Trigger, Filter, and Link is allowlisted;
//   * hx-app-* clusters are persistent and are never deleted by this script;
//   * a completely absent cluster may be created with `cub cluster up`;
//   * partial local/ConfigHub cluster state is rejected rather than repaired
//     destructively;
//   * apply refuses to overlap the serial live-parity harness;
//   * PILOT_ACTIVE and other mutation-guard environment variables are ignored,
//     as explicitly requested for this example.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";

import {
  check,
  identityFor,
  parseDocs,
  readYaml,
  readYamlText,
  relativeRepo,
  repoRoot,
  sha256,
  sha256File,
  toYaml,
  writeYaml,
} from "./lib/proof-common.mjs";

const modes = new Set(["--plan", "--apply", "--verify", "--receipt-verify"]);
validateCliArgs();
const requestedModes = process.argv.filter((arg) => modes.has(arg));
check(requestedModes.length <= 1, `choose one mode: ${[...modes].join(", ")}`);
const mode = requestedModes[0] ?? "--plan";
const contextValue = optionValue("--context") || process.env.CUB_CONTEXT?.trim() || "";
const contextArgs = contextValue ? ["--context", contextValue] : [];

const ORGANIZATION = "Kubara";
const KUBARA_VERSION = "v0.13.0";
const CATALOG_VERSION = "1.1.0";
const MIN_CUB_VERSION = "0.2.11";
const EXAMPLE_COHORT = "kubara-v0.13.0";
const PRIOR_COHORT = "kubara-v0.12.0";
const CONTROL_SPACE = "hx-platform";
const APPROVAL_TRIGGER = "require-approval";
const APPROVAL_FILTER = "prod-approval";
const APPROVAL_GATE = `${CONTROL_SPACE}/${APPROVAL_TRIGGER}/vet-approvedby`;
const PROD_SAFETY_GATE = "prod-critical";
const SCENARIO_VERSION = "hx-web-promotion-v1";
const LINK_REASON_ANNOTATION = "helm-expt.confighub.com/reason";
const CONFIGHUB_OCI_SPACE_PREFIX = "oci://oci.hub.confighub.com:443/space/";
const MATRIX_PUBLICATION_PATH = "data/kubara-platform-matrix/matrix.json";
const RECEIPT_PATH = join(repoRoot, "runs", "kubara-mini-idp-reconcile", "receipt.yaml");
const FAITHFUL_PROOF_SCRIPT = "scripts/run-kubara-faithful-hub-spoke-proof.mjs";
const FAITHFUL_FAILURE_PATH = "runs/kubara-faithful-hub-spoke/failure.yaml";
const FAITHFUL_ATTEMPT_PATH = "runs/kubara-faithful-hub-spoke/attempt.yaml";
const PRESERVED_FAITHFUL_CONTROL_UNITS = [
  {
    slug: "faithful-hub-spoke-plan",
    receiptKey: "planCheckAndApproval",
    role: "FaithfulLanePlan",
    proofPhase: "Plan",
  },
  {
    slug: "faithful-hub-spoke-attestation",
    receiptKey: "observedAttestation",
    role: "FaithfulLaneAttestation",
    proofPhase: "Observed",
  },
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let cachedCubVersions = null;
let cachedFaithfulReceipt = null;

const paths = {
  config: "examples/kubara/current-platform/source/config.yaml",
  sourceLock: "examples/kubara/current-platform/source-lock.yaml",
  componentArtifacts: "examples/kubara/current-platform/component-artifacts.yaml",
  generationReceipt: "examples/kubara/current-platform/generation-receipt.yaml",
  appSourceLock: "examples/kubara/current-platform/apps/source-lock.yaml",
  adapterOutput: "data/kubara-catalog-adapter/adapter-output.yaml",
  adapterReceipt: "data/kubara-catalog-adapter/receipt.yaml",
  desiredMatrix: "data/kubara-platform-matrix/desired-matrix.json",
  wiring: "data/kubara-wiring/graph.json",
  effectiveReceipt: "data/kubara-effective-renders/current-platform/receipt.yaml",
  qualificationReceipt: "runs/kubara-current-live-qualification/receipt.yaml",
  promotionReceipt: "data/kubara-catalog-refresh/current-root-promotion/receipt.yaml",
  faithfulReceipt: "runs/kubara-faithful-hub-spoke/receipt.yaml",
};

const requiredApplyEvidence = [
  paths.qualificationReceipt,
  paths.promotionReceipt,
  paths.faithfulReceipt,
];

const FLEET = [
  target("dev", "hx-app-dev", "Dev", "local"),
  target("staging", "hx-app-staging", "Staging", "local"),
  target("prod-a", "hx-app-prod-a", "Prod", "us-east"),
  target("prod-b", "hx-app-prod-b", "Prod", "us-west"),
];
const DEV = FLEET[0];

const EXPECTED_VERSIONS = {
  "argo-cd": "10.2.1",
  "cert-manager": "v1.21.0",
  "external-secrets": "2.8.0",
  "homer-dashboard": "0.1.0",
  "kube-prometheus-stack": "87.19.2",
  "prometheus-blackbox-exporter": "11.15.1",
  "metrics-server": "3.13.1",
  traefik: "41.0.2",
};

const CONTROL_UNITS = [
  controlUnit("platform-contract", paths.config, "AppConfig/YAML", "PlatformContract"),
  controlUnit("component-catalog-selection", paths.componentArtifacts, "AppConfig/YAML", "ComponentCatalogSelection"),
  controlUnit("catalog-adapter", paths.adapterOutput, "AppConfig/YAML", "CatalogAdapter"),
  controlUnit("catalog-adapter-receipt", paths.adapterReceipt, "AppConfig/YAML", "CatalogAdapterReceipt"),
  controlUnit("platform-matrix", paths.desiredMatrix, "AppConfig/JSON", "PlatformMatrixDesired"),
  controlUnit("wiring-ledger", paths.wiring, "AppConfig/JSON", "WiringLedger"),
  controlUnit("current-generation-receipt", paths.generationReceipt, "AppConfig/YAML", "GenerationReceipt"),
  controlUnit("current-live-qualification", paths.qualificationReceipt, "AppConfig/YAML", "QualificationReceipt", true),
  controlUnit("catalog-root-promotion", paths.promotionReceipt, "AppConfig/YAML", "CatalogPromotionReceipt", true),
  controlUnit("faithful-hub-spoke-receipt", paths.faithfulReceipt, "AppConfig/YAML", "FaithfulLaneReceipt", true),
  {
    slug: "kubara-argo-definition",
    source: "examples/kubara/current-platform/effective-renders/hx-app-dev/argo-cd/release-objects.yaml",
    toolchain: "Kubernetes/YAML",
    role: "KubaraDeliveryDefinition",
    requiredForApply: false,
  },
];

const SURFACES = [
  surface({
    prefix: "hx-kps-crds",
    component: "kube-prometheus-stack",
    version: EXPECTED_VERSIONS["kube-prometheus-stack"],
    role: "Lifecycle",
    part: "crds",
    targets: [DEV],
    materialize: ({ kps }) => renderDocuments(kps.filter((doc) => doc.kind === "CustomResourceDefinition")),
    order: 10,
    serverSideApply: true,
  }),
  surface({
    prefix: "hx-cm",
    component: "cert-manager",
    version: EXPECTED_VERSIONS["cert-manager"],
    targets: FLEET,
    sourceFor: (item) => effectiveRender(item.cluster, "cert-manager"),
    order: 20,
    serverSideApply: true,
    ignoreInjectedCertificateData: true,
  }),
  surface({
    prefix: "hx-eso",
    component: "external-secrets",
    version: EXPECTED_VERSIONS["external-secrets"],
    targets: [DEV],
    sourceFor: () => effectiveRender(DEV.cluster, "external-secrets"),
    order: 30,
    serverSideApply: true,
  }),
  surface({
    prefix: "hx-eso-store",
    component: "external-secrets",
    version: EXPECTED_VERSIONS["external-secrets"],
    role: "Prerequisite",
    part: "cluster-secret-store",
    targets: [DEV],
    sourceFor: () => "examples/kubara/current-platform/target-facts/hx-app-dev/cluster-secret-store.yaml",
    order: 40,
  }),
  surface({
    prefix: "hx-eso-grafana-es",
    component: "external-secrets",
    version: EXPECTED_VERSIONS["external-secrets"],
    role: "Wiring",
    part: "grafana-admin-credentials",
    targets: [DEV],
    materialize: ({ kps }) => renderDocuments(kps.filter(
      (doc) => doc.kind === "ExternalSecret" || isKpsNamespace(doc),
    )),
    order: 45,
  }),
  surface({
    prefix: "hx-kps-main",
    component: "kube-prometheus-stack",
    version: EXPECTED_VERSIONS["kube-prometheus-stack"],
    targets: [DEV],
    materialize: ({ kps }) => renderDocuments(
      kps.filter((doc) => !["CustomResourceDefinition", "ExternalSecret"].includes(doc.kind) && !isKpsNamespace(doc)),
    ),
    order: 50,
    serverSideApply: true,
  }),
  surface({
    prefix: "hx-metrics",
    component: "metrics-server",
    version: EXPECTED_VERSIONS["metrics-server"],
    targets: [DEV],
    sourceFor: () => effectiveRender(DEV.cluster, "metrics-server"),
    order: 60,
    serverSideApply: true,
  }),
  surface({
    prefix: "hx-traefik",
    component: "traefik",
    version: EXPECTED_VERSIONS.traefik,
    targets: FLEET,
    sourceFor: (item) => effectiveRender(item.cluster, "traefik"),
    order: 70,
    serverSideApply: true,
    acceptedHealth: ["Healthy", "Progressing"],
  }),
  surface({
    prefix: "hx-homer",
    component: "homer-dashboard",
    version: EXPECTED_VERSIONS["homer-dashboard"],
    targets: [DEV],
    sourceFor: () => effectiveRender(DEV.cluster, "homer-dashboard"),
    order: 80,
    serverSideApply: true,
  }),
];

const APP_FAMILIES = [
  appFamily({
    prefix: "hx-web",
    role: "Application",
    units: [
      appUnit("hx-web-namespace", "examples/kubara/current-platform/apps/hx-web/base/namespace.yaml"),
      appUnit("hx-web-deployment", "examples/kubara/current-platform/apps/hx-web/base/deployment.yaml", { scenario: true }),
      appUnit("hx-web-service", "examples/kubara/current-platform/apps/hx-web/base/service.yaml"),
    ],
    order: 90,
    scenario: true,
  }),
  appFamily({
    prefix: "hx-web-platform",
    role: "PlatformBinding",
    units: [appUnit("hx-web-platform", [
      "examples/kubara/current-platform/apps/hx-web/platform/certificate.yaml",
      "examples/kubara/current-platform/apps/hx-web/platform/ingress.yaml",
    ])],
    order: 100,
  }),
  appFamily({
    prefix: "hx-cubbychat",
    role: "Application",
    units: [appUnit("hx-cubbychat", [
      "examples/kubara/current-platform/apps/cubbychat/base/namespace.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/credentials.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/postgres-service.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/postgres.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/backend-service.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/backend.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/frontend-service.yaml",
      "examples/kubara/current-platform/apps/cubbychat/base/frontend.yaml",
      "examples/kubara/current-platform/apps/cubbychat/platform/certificate.yaml",
      "examples/kubara/current-platform/apps/cubbychat/platform/ingress.yaml",
    ])],
    order: 110,
  }),
];

const OWNED_SPACE_LABELS = new Set([
  "ExampleCohort",
  "KubaraVersion",
  "CatalogVersion",
  "Cluster",
  "Environment",
  "Region",
  "Role",
  "Scope",
  "DefinitionScope",
  "Component",
  "KubaraComponent",
  "ComponentVersion",
  "Part",
  "Layer",
  "SourceType",
]);

function target(suffix, cluster, environment, region) {
  return { suffix, cluster, environment, region };
}

function controlUnit(slug, source, toolchain, role, requiredForApply = false) {
  return { slug, source, toolchain, role, requiredForApply };
}

function surface(definition) {
  return {
    role: "Component",
    acceptedHealth: ["Healthy"],
    serverSideApply: false,
    ignoreInjectedCertificateData: false,
    ...definition,
  };
}

function appUnit(slug, source, extra = {}) {
  return { slug, source: Array.isArray(source) ? source : [source], ...extra };
}

function appFamily(definition) {
  return { targets: FLEET, acceptedHealth: ["Healthy"], ...definition };
}

function effectiveRender(cluster, service) {
  return `examples/kubara/current-platform/effective-renders/${cluster}/${service}/release-objects.yaml`;
}

function isKpsNamespace(doc) {
  return doc.kind === "Namespace" && doc.metadata?.name === "kube-prometheus-stack";
}

function absolute(relative) {
  return join(repoRoot, relative);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  check(process.argv[index + 1], `${name} requires a value`);
  return process.argv[index + 1];
}

function validateCliArgs() {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (modes.has(arg)) continue;
    if (arg === "--context") {
      check(args[index + 1] && !args[index + 1].startsWith("--"), "--context requires a value");
      index += 1;
      continue;
    }
    check(false, `unknown argument ${arg}`);
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function renderDocuments(documents) {
  check(documents.length > 0, "refusing to materialize an empty Kubernetes Unit");
  return `${documents.map((doc) => toYaml(doc)).join("\n---\n")}\n`;
}

function joinedSource(pathsToJoin) {
  return `${pathsToJoin.map((item) => readFileSync(absolute(item), "utf8").trimEnd()).join("\n---\n")}\n`;
}

function expectedLabels(extra = {}) {
  return {
    ExampleCohort: EXAMPLE_COHORT,
    KubaraVersion: KUBARA_VERSION,
    CatalogVersion: CATALOG_VERSION,
    ...extra,
  };
}

function definitionLabels(prefix, role, extra = {}) {
  return expectedLabels({
    Component: prefix,
    Layer: role.includes("Application") ? "App" : "Platform",
    Scope: "Fleet",
    DefinitionScope: "Base",
    Role: `${role}Definition`,
    ...extra,
  });
}

function instanceLabels(prefix, role, item, extra = {}) {
  return expectedLabels({
    Component: prefix,
    Layer: role.includes("Application") ? "App" : "Platform",
    Cluster: item.cluster,
    Environment: item.environment,
    Region: item.region,
    Role: `${role}Instance`,
    ...extra,
  });
}

function sourceAnnotation(payload, sourcePaths, transform = "none") {
  const annotations = {
    // cub's repeated --annotation flag still uses its StringSlice parser, so
    // commas and additional equals signs inside a value are ambiguous. Keep
    // the stored provenance readable while using unambiguous separators.
    "confighub.com/source-path": sourcePaths.join(";"),
    "confighub.com/source-sha256": `sha256:${sha256(payload)}`,
    "confighub.com/source-transform": transform,
  };
  for (const [key, value] of Object.entries(annotations)) {
    assertCubAnnotationValue(key, value);
  }
  return annotations;
}

function materializeInputs() {
  const missing = [];
  for (const item of Object.values(paths)) {
    if (!existsSync(absolute(item))) missing.push(item);
  }
  for (const item of SURFACES) {
    for (const fleetItem of item.targets) {
      if (item.sourceFor) {
        const source = item.sourceFor(fleetItem);
        if (!existsSync(absolute(source))) missing.push(source);
      }
    }
  }
  for (const family of APP_FAMILIES) {
    for (const unit of family.units) {
      for (const source of unit.source) if (!existsSync(absolute(source))) missing.push(source);
    }
  }

  const kpsPath = effectiveRender(DEV.cluster, "kube-prometheus-stack");
  const kps = existsSync(absolute(kpsPath))
    ? parseDocs(readFileSync(absolute(kpsPath), "utf8"))
    : [];
  const payloads = new Map();
  const payload = (key, value, sourcePaths, toolchain = "Kubernetes/YAML", transform = "none") => {
    check(!payloads.has(key), `duplicate payload key ${key}`);
    const documents = toolchain === "Kubernetes/YAML" ? parseDocs(value) : [];
    const identities = documents.map(identityFor);
    const duplicateIdentities = identities.filter((identity, index) => identities.indexOf(identity) !== index);
    check(
      duplicateIdentities.length === 0,
      `${key}: duplicate Kubernetes resource identities: ${[...new Set(duplicateIdentities)].join(", ")}`,
    );
    payloads.set(key, {
      key,
      value,
      sourcePaths,
      toolchain,
      transform,
      sha256: sha256(value),
      objectCount: toolchain === "Kubernetes/YAML" ? documents.length : 1,
    });
  };

  if (kps.length) {
    check(kps.filter((doc) => doc.kind === "CustomResourceDefinition").length === 10, "current KPS render must contain 10 CRDs");
    check(kps.filter((doc) => doc.kind === "ExternalSecret").length === 1, "current KPS render must contain one Grafana ExternalSecret");
    check(kps.filter(isKpsNamespace).length === 1, "current KPS render must contain one kube-prometheus-stack Namespace");
  }

  for (const item of SURFACES) {
    for (const fleetItem of item.targets) {
      let value = "";
      let sourcePaths = [];
      let transform = "none";
      if (item.materialize && kps.length) {
        value = item.materialize({ kps });
        sourcePaths = [kpsPath];
        transform = item.part === "crds"
          ? "select-kind:CustomResourceDefinition"
          : item.part === "grafana-admin-credentials"
            ? "select-kind:Namespace/kube-prometheus-stack;ExternalSecret"
            : "exclude-kinds:CustomResourceDefinition;ExternalSecret;Namespace/kube-prometheus-stack";
      } else if (item.sourceFor) {
        const source = item.sourceFor(fleetItem);
        sourcePaths = [source];
        if (existsSync(absolute(source))) value = readFileSync(absolute(source), "utf8");
      }
      if (value) payload(`${item.prefix}/${fleetItem.suffix}`, value, sourcePaths, "Kubernetes/YAML", transform);
    }
  }

  for (const family of APP_FAMILIES) {
    for (const unit of family.units) {
      const value = unit.source.every((source) => existsSync(absolute(source)))
        ? joinedSource(unit.source)
        : "";
      if (!value) continue;
      if (unit.scenario) {
        const initialDocs = parseDocs(value);
        for (const stage of ["initial", "v1", "v2"]) {
          const transformed = hxWebPayload(initialDocs, { stage, target: null });
          payload(`${family.prefix}/base/${unit.slug}/${stage}`, transformed, unit.source, "Kubernetes/YAML", `hx-web-${stage}`);
        }
        payload(
          `${family.prefix}/staging/${unit.slug}/departure`,
          hxWebPayload(initialDocs, { stage: "departure", target: FLEET[1] }),
          unit.source,
          "Kubernetes/YAML",
          "hx-web-staging-departure",
        );
        for (const fleetItem of family.targets) {
          const transformed = hxWebPayload(initialDocs, { stage: "final", target: fleetItem });
          payload(`${family.prefix}/${fleetItem.suffix}/${unit.slug}/final`, transformed, unit.source, "Kubernetes/YAML", `hx-web-final-${fleetItem.suffix}`);
        }
      } else {
        payload(`${family.prefix}/base/${unit.slug}`, value, unit.source);
        for (const fleetItem of family.targets) payload(`${family.prefix}/${fleetItem.suffix}/${unit.slug}`, value, unit.source);
      }
    }
  }

  for (const control of CONTROL_UNITS) {
    if (!existsSync(absolute(control.source))) continue;
    const value = readFileSync(absolute(control.source), "utf8");
    payload(`${CONTROL_SPACE}/${control.slug}`, value, [control.source], control.toolchain);
  }

  return { missing: [...new Set(missing)].sort(), kps, payloads };
}

function hxWebPayload(initialDocs, { stage, target: fleetItem }) {
  const docs = structuredClone(initialDocs);
  const deployment = docs.find((doc) => doc.kind === "Deployment" && doc.metadata?.name === "hx-web");
  check(deployment, "hx-web deployment fixture is missing");
  deployment.metadata.annotations ??= {};
  const effectiveStage = stage === "final"
    ? fleetItem?.suffix === "prod-a"
      ? "initial"
      : fleetItem?.suffix === "prod-b"
        ? "v1"
        : "v2"
    : stage;
  if (effectiveStage !== "initial") {
    deployment.spec.replicas = 3;
    deployment.metadata.annotations["platform.confighub.com/revision"] = "promotion-v1";
  }
  if (effectiveStage === "v2") {
    deployment.metadata.annotations["platform.confighub.com/promotion"] = "promotion-v2";
  }
  if (["departure", "final"].includes(stage) && fleetItem?.suffix === "staging") {
    const container = deployment.spec?.template?.spec?.containers?.[0];
    check(container, "hx-web deployment has no first container");
    container.env ??= [];
    if (!container.env.some((entry) => entry.name === "SANDBOX_URL")) {
      container.env.push({
        name: "SANDBOX_URL",
        value: "http://sandbox.hx-web.svc:8080",
      });
    }
  }
  return renderDocuments(docs);
}

function buildPlan(inputs) {
  verifyLocalContract(inputs, { requireLiveEvidence: false });
  const spaces = [];
  const managedUnits = [];
  const deployments = [];

  spaces.push({
    slug: CONTROL_SPACE,
    type: "control",
    labels: expectedLabels({
      Component: "platform-control",
      Layer: "Platform",
      Scope: "Fleet",
      Role: "PlatformControl",
      SourceType: "Kubara+ConfigHub",
    }),
  });
  for (const item of FLEET) {
    spaces.push({
      slug: item.cluster,
      type: "cluster-target",
      labels: expectedLabels({
        Component: "cluster-target",
        Layer: "Platform",
        Cluster: item.cluster,
        Environment: item.environment,
        Region: item.region,
        Role: "ClusterTarget",
      }),
    });
    spaces.push({
      slug: `${item.cluster}-argo-apps`,
      type: "delivery-instance",
      labels: instanceLabels("argocd-delivery", "Delivery", item),
    });
  }
  spaces.push({
    slug: "argobot-base",
    type: "delivery-definition",
    labels: definitionLabels("argobot", "Delivery"),
  });
  for (const item of FLEET) {
    spaces.push({
      slug: `argobot-${item.cluster}`,
      type: "delivery-instance",
      labels: instanceLabels("argobot", "Delivery", item),
    });
  }

  for (const control of CONTROL_UNITS) {
    const content = inputs.payloads.get(`${CONTROL_SPACE}/${control.slug}`);
    managedUnits.push({
      space: CONTROL_SPACE,
      slug: control.slug,
      role: control.role,
      payloadKey: content?.key ?? "",
      toolchain: control.toolchain,
      provider: "None",
      target: null,
      requiredForApply: control.requiredForApply,
      labels: expectedLabels({ Role: control.role, SourceType: "CommittedEvidence" }),
    });
  }

  for (const item of SURFACES) {
    const surfaceLabels = {
      KubaraComponent: item.component,
      ComponentVersion: item.version,
      ...(item.part ? { Part: item.part } : {}),
    };
    spaces.push({
      slug: `${item.prefix}-base`,
      type: "component-definition",
      labels: definitionLabels(item.prefix, item.role, surfaceLabels),
    });
    managedUnits.push({
      space: `${item.prefix}-base`,
      slug: item.prefix,
      role: `${item.role}Definition`,
      payloadKey: `${item.prefix}/${item.targets[0].suffix}`,
      toolchain: "Kubernetes/YAML",
      provider: null,
      target: null,
      labels: expectedLabels({ Role: `${item.role}Definition`, KubaraComponent: item.component }),
    });
    for (const fleetItem of item.targets) {
      const space = `${item.prefix}-${fleetItem.suffix}`;
      spaces.push({
        slug: space,
        type: "component-instance",
        upstreamSpace: `${item.prefix}-base`,
        target: `${fleetItem.cluster}/target`,
        prodProtected: fleetItem.environment === "Prod",
        labels: instanceLabels(item.prefix, item.role, fleetItem, surfaceLabels),
      });
      managedUnits.push({
        space,
        slug: item.prefix,
        role: `${item.role}Instance`,
        payloadKey: `${item.prefix}/${fleetItem.suffix}`,
        toolchain: "Kubernetes/YAML",
        provider: null,
        target: `${fleetItem.cluster}/target`,
        upstream: `${item.prefix}-base/${item.prefix}`,
        prodProtected: fleetItem.environment === "Prod",
        labels: expectedLabels({ Role: `${item.role}Instance`, KubaraComponent: item.component }),
      });
      deployments.push({
        id: space,
        type: "platform",
        order: item.order,
        cluster: fleetItem.cluster,
        space,
        appSpace: `${fleetItem.cluster}-argo-apps`,
        appUnit: space,
        serverSideApply: item.serverSideApply,
        ignoreInjectedCertificateData: item.ignoreInjectedCertificateData,
        acceptedHealth: item.acceptedHealth,
      });
    }
  }

  for (const family of APP_FAMILIES) {
    spaces.push({
      slug: `${family.prefix}-base`,
      type: "app-definition",
      labels: definitionLabels(family.prefix, family.role),
    });
    for (const unit of family.units) {
      managedUnits.push({
        space: `${family.prefix}-base`,
        slug: unit.slug,
        role: `${family.role}Definition`,
        payloadKey: unit.scenario
          ? `${family.prefix}/base/${unit.slug}/v2`
          : `${family.prefix}/base/${unit.slug}`,
        initialPayloadKey: unit.scenario
          ? `${family.prefix}/base/${unit.slug}/initial`
          : "",
        toolchain: "Kubernetes/YAML",
        provider: null,
        target: null,
        labels: expectedLabels({ Role: `${family.role}Definition` }),
      });
    }
    for (let index = 0; index < family.targets.length; index += 1) {
      const fleetItem = family.targets[index];
      const upstreamSpace = index === 0
        ? `${family.prefix}-base`
        : index === 1
          ? `${family.prefix}-dev`
          : `${family.prefix}-staging`;
      const space = `${family.prefix}-${fleetItem.suffix}`;
      spaces.push({
        slug: space,
        type: "app-instance",
        upstreamSpace,
        target: `${fleetItem.cluster}/target`,
        prodProtected: fleetItem.environment === "Prod",
        labels: instanceLabels(family.prefix, family.role, fleetItem),
      });
      for (const unit of family.units) {
        managedUnits.push({
          space,
          slug: unit.slug,
          role: `${family.role}Instance`,
          payloadKey: unit.scenario
            ? `${family.prefix}/${fleetItem.suffix}/${unit.slug}/final`
            : `${family.prefix}/${fleetItem.suffix}/${unit.slug}`,
          initialPayloadKey: unit.scenario
            ? `${family.prefix}/base/${unit.slug}/initial`
            : "",
          toolchain: "Kubernetes/YAML",
          provider: null,
          target: `${fleetItem.cluster}/target`,
          upstream: `${upstreamSpace}/${unit.slug}`,
          prodProtected: fleetItem.environment === "Prod",
          labels: expectedLabels({ Role: `${family.role}Instance` }),
        });
      }
      deployments.push({
        id: space,
        type: "application",
        order: family.order,
        cluster: fleetItem.cluster,
        space,
        appSpace: `${fleetItem.cluster}-argo-apps`,
        appUnit: space,
        serverSideApply: false,
        acceptedHealth: family.acceptedHealth,
      });
    }
  }

  const links = buildLinks();
  spaces.sort((left, right) => left.slug.localeCompare(right.slug));
  managedUnits.sort((left, right) => `${left.space}/${left.slug}`.localeCompare(`${right.space}/${right.slug}`));
  deployments.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  check(spaces.length === 53, `internal plan error: expected 53 Spaces, got ${spaces.length}`);
  check(new Set(spaces.map((item) => item.slug)).size === spaces.length, "internal plan has duplicate Spaces");
  check(new Set(managedUnits.map((item) => `${item.space}/${item.slug}`)).size === managedUnits.length, "internal plan has duplicate Units");
  check(new Set(links.map((item) => `${item.space}/${item.slug}`)).size === links.length, "internal plan has duplicate Links");
  return { spaces, managedUnits, deployments, links };
}

function buildLinks() {
  const links = [];
  const add = (space, slug, fromUnit, toSpace, toUnit, reason) => {
    links.push({ space, slug, fromUnit, toSpace, toUnit, updateType: "NeedsProvides", autoUpdate: false, reason });
  };
  for (const item of FLEET) {
    add(`hx-web-${item.suffix}`, "needs-platform-binding", "hx-web-deployment", `hx-web-platform-${item.suffix}`, "hx-web-platform", "workload uses its reviewed Certificate and Ingress binding");
    add(`hx-web-platform-${item.suffix}`, "needs-cert-manager", "hx-web-platform", `hx-cm-${item.suffix}`, "hx-cm", "Certificate requires cert-manager and ClusterIssuer");
    add(`hx-web-platform-${item.suffix}`, "needs-traefik", "hx-web-platform", `hx-traefik-${item.suffix}`, "hx-traefik", "Ingress selects the traefik ingress class");
    add(`hx-cubbychat-${item.suffix}`, "needs-cert-manager", "hx-cubbychat", `hx-cm-${item.suffix}`, "hx-cm", "Certificate requires cert-manager and ClusterIssuer");
    add(`hx-cubbychat-${item.suffix}`, "needs-traefik", "hx-cubbychat", `hx-traefik-${item.suffix}`, "hx-traefik", "Ingress selects the traefik ingress class");
  }
  add("hx-eso-store-dev", "needs-external-secrets", "hx-eso-store", "hx-eso-dev", "hx-eso", "ClusterSecretStore requires the ESO API and controller");
  add("hx-eso-grafana-es-dev", "needs-secret-store", "hx-eso-grafana-es", "hx-eso-store-dev", "hx-eso-store", "Grafana ExternalSecret reads from the cluster store");
  add("hx-eso-grafana-es-dev", "needs-external-secrets", "hx-eso-grafana-es", "hx-eso-dev", "hx-eso", "ExternalSecret requires the ESO API and controller");
  add("hx-kps-main-dev", "needs-monitoring-crds", "hx-kps-main", "hx-kps-crds-dev", "hx-kps-crds", "monitoring resources require their lifecycle CRDs first");
  add("hx-kps-main-dev", "needs-grafana-secret", "hx-kps-main", "hx-eso-grafana-es-dev", "hx-eso-grafana-es", "Grafana consumes the ESO-owned admin Secret");
  return links;
}

function verifyLocalContract(inputs, { requireLiveEvidence }) {
  const alwaysRequired = Object.values(paths).filter((item) => !requiredApplyEvidence.includes(item));
  const required = requireLiveEvidence ? Object.values(paths) : alwaysRequired;
  const missing = required.filter((item) => !existsSync(absolute(item)));
  check(missing.length === 0, `missing required Kubara mini-IDP inputs:\n- ${missing.join("\n- ")}`);

  const config = readYaml(absolute(paths.config));
  check(config.version === "v1alpha4", "current Kubara config must be v1alpha4");
  check(config.bootstrapCatalog === `oci://ghcr.io/kubara-io/catalogs/bootstrap:${CATALOG_VERSION}`, "bootstrap catalog reference drifted");
  check(config.clusters?.length === FLEET.length, `expected ${FLEET.length} clusters in current config`);
  for (const item of FLEET) {
    const cluster = config.clusters.find((entry) => entry.name === item.cluster);
    check(cluster, `${item.cluster} is missing from current Kubara config`);
    check(cluster.stage === item.suffix.replace(/-.*$/, "") || (item.environment === "Prod" && cluster.stage === "prod"), `${item.cluster} stage drifted`);
    check(cluster.catalogs?.includes(`oci://ghcr.io/kubara-io/catalogs/general:${CATALOG_VERSION}`), `${item.cluster} general catalog reference drifted`);
  }
  const hub = config.clusters.find((entry) => entry.type === "hub");
  check(hub?.name === DEV.cluster, "hx-app-dev must remain the Kubara hub");
  check(config.clusters.filter((entry) => entry.type === "spoke").length === 3, "current Kubara config must retain three spokes");

  const artifacts = readYaml(absolute(paths.componentArtifacts));
  check(artifacts.spec?.exactVersionPolicy === "fail-if-missing", "component artifact policy must fail if an exact version is missing");
  check(artifacts.spec?.retentionPolicy === "additive-only", "component artifact retention must remain additive-only");
  const actualVersions = new Map();
  for (const item of artifacts.spec?.artifacts ?? []) {
    const name = item.canonicalIdentity.endsWith("prometheus-blackbox-exporter")
      ? "prometheus-blackbox-exporter"
      : item.service;
    actualVersions.set(name, String(item.version));
    check(/^[0-9a-f]{64}$/.test(String(item.sha256 ?? "")), `${item.canonicalIdentity} exact SHA is missing`);
  }
  for (const item of artifacts.spec?.firstParty ?? []) actualVersions.set(item.service, String(item.wrapperVersion));
  for (const [name, version] of Object.entries(EXPECTED_VERSIONS)) {
    check(actualVersions.get(name) === version, `${name} must remain selected at ${version}`);
  }

  const generation = readYaml(absolute(paths.generationReceipt));
  check(
    generation.status?.result === "offline-generation-and-render-pass"
      && generation.status?.kubaraGeneration === "pass"
      && generation.status?.catalogParity === "pass",
    "current Kubara generation receipt is not an offline generation/parity pass",
  );
  check(generation.spec?.tools?.kubaraVersion === KUBARA_VERSION, "generation receipt Kubara version drifted");
  check(generation.spec?.platform?.renderCount === 13, "generation receipt must retain 13 effective renders");

  const adapter = readYaml(absolute(paths.adapterReceipt));
  check(
    adapter.kind === "KubaraCatalogAdapterReceipt"
      && adapter.spec?.invariants?.sourceMutation === false
      && adapter.spec?.invariants?.aiRequired === false
      && adapter.spec?.invariants?.currentCatalogExportsAreFullBootstrapAndGeneralTrees === true,
    "catalog adapter receipt invariants are not satisfied",
  );
  const desiredMatrix = JSON.parse(readFileSync(absolute(paths.desiredMatrix), "utf8"));
  check(
    desiredMatrix.kind === "KubaraPlatformMatrix"
      && desiredMatrix.metadata?.name === "kubara-v0.13.0-current-four-cluster-desired"
      && desiredMatrix.spec?.profile?.evidenceLayer === "desired-only"
      && desiredMatrix.spec?.evidence?.kubaraVersion === KUBARA_VERSION
      && desiredMatrix.spec?.evidence?.catalogVersion === CATALOG_VERSION
      && desiredMatrix.spec?.evidence?.parsedObservationCells === 0
      && desiredMatrix.spec?.components?.length === 9
      && desiredMatrix.spec?.clusters?.length === FLEET.length
      && desiredMatrix.spec?.rows?.length === FLEET.length * 9
      && desiredMatrix.spec.rows.every(
        (row) => row.syncState === "Unknown" && row.observedVersion === "Unknown",
      ),
    "desired platform matrix must remain the 9×4 Kubara v0.13.0 desired-only contract with zero live observations",
  );
  const wiring = JSON.parse(readFileSync(absolute(paths.wiring), "utf8"));
  check(wiring.spec?.evidence?.kubaraVersion === KUBARA_VERSION, "primary wiring ledger is not current Kubara v0.13.0 evidence");

  check(
    !existsSync(absolute(FAITHFUL_FAILURE_PATH)),
    `${FAITHFUL_FAILURE_PATH} records a newer failed proof attempt; refusing stale faithful pass evidence`,
  );
  check(
    !existsSync(absolute(FAITHFUL_ATTEMPT_PATH)),
    `${FAITHFUL_ATTEMPT_PATH} records an active proof attempt; refusing stale faithful pass evidence`,
  );
  if (existsSync(absolute(paths.faithfulReceipt))) verifyFaithfulProof();

  if (requireLiveEvidence) {
    const qualification = readYaml(absolute(paths.qualificationReceipt));
    check(qualification.kind === "KubaraLiveQualificationSetReceipt", "current qualification receipt kind drifted");
    check(qualification.spec?.laneCount === 13 && qualification.status?.result === "pass", "all 13 current qualification lanes must pass");
    const promotion = readYaml(absolute(paths.promotionReceipt));
    check(promotion.kind === "KubaraCatalogRootPromotionReceipt", "current promotion receipt kind drifted");
    check(promotion.status?.result === "pass" && promotion.status?.historicalRootsPreserved === true, "current promotion must pass and retain historical roots");
    const faithful = verifyFaithfulProof();
    check(faithful.kind === "KubaraFaithfulHubSpokeProofReceipt", "faithful lane receipt kind drifted");
    check(faithful.status?.result === "pass", "faithful hub-spoke lane must pass before adapted fleet apply");
  }

  const appDocs = APP_FAMILIES.flatMap((family) => family.units.flatMap((unit) => unit.source.flatMap((source) => parseDocs(readFileSync(absolute(source), "utf8")))));
  const images = appDocs.flatMap(imagesInDocument);
  check(images.length >= 4, "current app fixtures should expose four pinned workload images");
  for (const image of images) check(image.includes("@sha256:"), `app image is not digest pinned: ${image}`);

  verifyHxWebPayloadContract(inputs);
}

function verifyFaithfulProof() {
  check(
    !existsSync(absolute(FAITHFUL_FAILURE_PATH)),
    `${FAITHFUL_FAILURE_PATH} records a newer failed proof attempt; refusing stale faithful pass evidence`,
  );
  check(
    !existsSync(absolute(FAITHFUL_ATTEMPT_PATH)),
    `${FAITHFUL_ATTEMPT_PATH} records an active proof attempt; refusing stale faithful pass evidence`,
  );
  if (cachedFaithfulReceipt) return cachedFaithfulReceipt;
  const result = tryCommand(process.execPath, [absolute(FAITHFUL_PROOF_SCRIPT), "--verify"]);
  check(result.ok, `full faithful hub-spoke verifier failed:\n${result.output}`);
  const faithful = readYaml(absolute(paths.faithfulReceipt));
  check(faithful.kind === "KubaraFaithfulHubSpokeProofReceipt", "faithful lane receipt kind drifted");
  check(faithful.status?.result === "pass", "faithful hub-spoke lane must pass before adapted fleet apply");
  cachedFaithfulReceipt = faithful;
  return faithful;
}

function verifyHxWebPayloadContract(inputs) {
  const deployment = (key) => parseDocs(inputs.payloads.get(key)?.value ?? "")
    .find((doc) => doc.kind === "Deployment" && doc.metadata?.name === "hx-web");
  const containerEnv = (doc) => doc?.spec?.template?.spec?.containers?.[0]?.env ?? [];
  const hasSandbox = (doc) => containerEnv(doc).some(
    (entry) => entry.name === "SANDBOX_URL" && entry.value === "http://sandbox.hx-web.svc:8080",
  );

  const base = deployment("hx-web/base/hx-web-deployment/v2");
  const dev = deployment("hx-web/dev/hx-web-deployment/final");
  const staging = deployment("hx-web/staging/hx-web-deployment/final");
  const prodA = deployment("hx-web/prod-a/hx-web-deployment/final");
  const prodB = deployment("hx-web/prod-b/hx-web-deployment/final");
  check([base, dev, staging, prodA, prodB].every(Boolean), "hx-web rollout payload set is incomplete");
  check(base.spec?.replicas === 3 && base.metadata?.annotations?.["platform.confighub.com/promotion"] === "promotion-v2", "hx-web base must end at promotion-v2 with three replicas");
  check(dev.spec?.replicas === 3 && dev.metadata?.annotations?.["platform.confighub.com/promotion"] === "promotion-v2" && !hasSandbox(dev), "hx-web dev final payload drifted");
  check(staging.spec?.replicas === 3 && staging.metadata?.annotations?.["platform.confighub.com/promotion"] === "promotion-v2" && hasSandbox(staging), "hx-web staging must retain only its SANDBOX_URL departure through promotion-v2");
  check(prodA.spec?.replicas === 2 && !prodA.metadata?.annotations?.["platform.confighub.com/revision"] && !hasSandbox(prodA), "hx-web prod-a must retain the one-target rollback without staging's departure");
  check(prodB.spec?.replicas === 3 && prodB.metadata?.annotations?.["platform.confighub.com/revision"] === "promotion-v1" && !prodB.metadata?.annotations?.["platform.confighub.com/promotion"] && !hasSandbox(prodB), "hx-web prod-b must remain on promotion-v1 without staging's departure");
}

function imagesInDocument(doc) {
  const podSpec = doc.kind === "Deployment" || doc.kind === "StatefulSet"
    ? doc.spec?.template?.spec
    : null;
  return [...(podSpec?.initContainers ?? []), ...(podSpec?.containers ?? [])]
    .map((container) => container.image)
    .filter(Boolean);
}

const inputs = materializeInputs();
const plan = buildPlan(inputs);

if (mode === "--plan") {
  printPlan(inputs, plan);
} else if (mode === "--apply") {
  verifyLocalContract(inputs, { requireLiveEvidence: true });
  applyPlan(inputs, plan);
} else if (mode === "--verify") {
  verifyLocalContract(inputs, { requireLiveEvidence: true });
  const observation = verifyLive(inputs, plan);
  console.log(`verified Kubara mini-IDP: ${observation.spaces.length} Spaces, ${observation.units.length} managed Units, ${observation.links.length} NeedsProvides Links`);
} else {
  verifyReceipt(inputs, plan);
}

function printPlan(inputs, desired) {
  const missingApplyEvidence = requiredApplyEvidence.filter((item) => !existsSync(absolute(item)));
  const payloadRows = [...inputs.payloads.values()].map((item) => ({
    key: item.key,
    sha256: item.sha256,
    objectCount: item.objectCount,
    sourcePaths: item.sourcePaths,
    transform: item.transform,
  })).sort((left, right) => left.key.localeCompare(right.key));
  console.log(JSON.stringify({
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubaraMiniIDPReconcilePlan",
    metadata: { name: "kubara-v0-13-0-confighub-mini-idp" },
    spec: {
      organization: ORGANIZATION,
      execution: {
        deterministic: true,
        aiRequired: false,
        mutationGuardConsulted: false,
        destructiveOperations: [],
        persistentClustersPreserved: FLEET.map((item) => item.cluster),
        partialClusterStatePolicy: "fail",
        serialLiveParityLock: true,
        unexpectedSpacePolicy: "fail-outside-exact-53-space-allowlist",
        unexpectedManagedUnitOrLinkPolicy: "fail",
        preservedControlUnitPolicy: "exact-receipt-bound-faithful-proof-units",
        argoApplicationContract: "allowlisted ConfigHub OCI source -> cluster-local API",
        interruptedScenarioPolicy: "reset UpgradeUnit merge bases to the committed initial payloads, then replay",
        receiptRequiresZeroActionRerun: true,
        minimumCubVersion: `v${MIN_CUB_VERSION}`,
      },
      source: {
        kubaraVersion: KUBARA_VERSION,
        catalogVersion: CATALOG_VERSION,
        config: paths.config,
        componentArtifacts: paths.componentArtifacts,
        missingApplyEvidence,
      },
      counts: {
        spaces: desired.spaces.length,
        managedUnits: desired.managedUnits.length,
        preservedFaithfulControlUnits: PRESERVED_FAITHFUL_CONTROL_UNITS.length,
        deployments: desired.deployments.length,
        needsProvidesLinks: desired.links.length,
        payloads: payloadRows.length,
      },
      phases: [
        "preflight exact sources and live qualification receipts",
        "create or validate four persistent ConfigHub-owned Argo targets",
        "reconcile current contract, catalog, matrix, wiring, and lane evidence",
        "deliver lifecycle CRDs and platform prerequisites in dependency order",
        "deliver the complete current Kubara component selection",
        "exercise hx-web promotion, prod approval, rollback, and staging departure",
        "deliver cubbychat and hx-web across all four clusters",
        "create visible NeedsProvides wiring Links",
        "verify ConfigHub state, Argo sync, workloads, and write the receipt",
        "rerun to prove zero-drift idempotence",
      ],
      spaces: desired.spaces,
      units: desired.managedUnits,
      preservedControlUnits: PRESERVED_FAITHFUL_CONTROL_UNITS.map((item) => ({
        ref: `${CONTROL_SPACE}/${item.slug}`,
        owner: "faithful-hub-spoke-proof",
        policy: "preserve-and-verify-against-current-pass-receipt",
      })),
      deployments: desired.deployments,
      links: desired.links,
      payloads: payloadRows,
    },
    status: {
      readyForApply: missingApplyEvidence.length === 0,
      missingApplyEvidence,
    },
  }, null, 2));
}

function command(binary, args, options = {}) {
  return execFileSync(binary, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 200,
    timeout: options.timeout ?? 600_000,
    ...options,
  });
}

function tryCommand(binary, args, options = {}) {
  try {
    return { ok: true, output: command(binary, args, options), status: 0 };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
      status: Number.isInteger(error.status) ? error.status : 1,
    };
  }
}

function cub(args, options = {}) {
  return command("cub", [...contextArgs, ...args], options);
}

function cubTry(args, options = {}) {
  return tryCommand("cub", [...contextArgs, ...args], options);
}

function cubJson(args) {
  return JSON.parse(cub([...args, "-o", "json"]));
}

function unwrapEntity(value, key) {
  return value?.[key] ?? value;
}

function unwrapRows(value, key) {
  const list = value?.[`${key}s`] ?? value?.[key.toLowerCase() + "s"] ?? value;
  check(Array.isArray(list), `cub ${key} list returned an unexpected shape`);
  return list.map((row) => row?.[key] ?? row);
}

function assertKubaraOrganization() {
  assertCubVersion();
  const json = cubTry(["context", "get", "-o", "json"]);
  if (json.ok) {
    const value = JSON.parse(json.output);
    const name = value.metadata?.organizationName
      ?? value.OrganizationName
      ?? value.organizationName;
    check(name === ORGANIZATION, `refusing to run in organization ${name ?? "unknown"}; expected ${ORGANIZATION}`);
    return;
  }
  const text = cub(["context", "get"]);
  check(/^Organization Name\s+Kubara\s*$/m.test(text), `active cub context is not the ${ORGANIZATION} organization`);
}

function assertCubVersion() {
  if (cachedCubVersions) return cachedCubVersions;
  const output = cub(["version"]);
  const client = output.match(/Client Version:[\s\S]*?Version:\s+v([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ?? "";
  const server = output.match(/Server Version:[\s\S]*?Version:\s+v([0-9]+\.[0-9]+\.[0-9]+)/)?.[1] ?? "";
  check(client && versionAtLeast(client, MIN_CUB_VERSION), `cub client v${client || "unknown"} is older than required v${MIN_CUB_VERSION}`);
  check(server && versionAtLeast(server, MIN_CUB_VERSION), `ConfigHub server v${server || "unknown"} is older than required v${MIN_CUB_VERSION}`);
  cachedCubVersions = { client: `v${client}`, server: `v${server}`, minimum: `v${MIN_CUB_VERSION}` };
  return cachedCubVersions;
}

function versionAtLeast(actual, minimum) {
  if (!/^\d+\.\d+\.\d+$/.test(actual) || !/^\d+\.\d+\.\d+$/.test(minimum)) return false;
  const left = actual.split(".").map(Number);
  const right = minimum.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return true;
}

function assertSerialLiveLock() {
  for (const pattern of [
    "scripts/run-kubara-live-qualification.mjs",
    "tests/live-helm-confighub-parity-test",
    "scripts/run-kubara-faithful-hub-spoke-proof.mjs",
  ]) {
    const processes = tryCommand("pgrep", ["-fl", pattern]);
    check(!processes.ok || !processes.output.trim(), `refusing to overlap a live Kubara proof (${pattern}):\n${processes.output}`);
  }
  const leaked = kindClusters().filter((name) => name.startsWith("helm-expt-parity-"));
  check(leaked.length === 0, `refusing to start with live-parity clusters present: ${leaked.join(", ")}`);
}

function acquireSerialLiveLock() {
  const lockPath = process.env.HELM_EXPT_LIVE_PARITY_LOCK
    ? resolve(process.env.HELM_EXPT_LIVE_PARITY_LOCK)
    : join(homedir(), ".confighub", "locks", "helm-expt-live-parity.lock");
  while (true) {
    try {
      mkdirSync(dirname(lockPath), { recursive: true });
      mkdirSync(lockPath);
      writeFileSync(join(lockPath, "owner.json"), `${JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
        command: process.argv.join(" "),
      }, null, 2)}\n`);
      return lockPath;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner = {};
      try {
        owner = JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8"));
      } catch {
        // An incomplete owner file is treated as live; never remove a lock
        // whose ownership cannot be proved stale.
      }
      if (Number.isInteger(owner.pid) && !processAlive(owner.pid)) {
        rmSync(lockPath, { recursive: true, force: true });
        continue;
      }
      check(false, `live parity lane is locked at ${lockPath}${owner.pid ? ` by pid ${owner.pid}` : ""}`);
    }
  }
}

function releaseSerialLiveLock(lockPath) {
  if (!lockPath) return;
  try {
    const owner = JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8"));
    if (owner.pid === process.pid) rmSync(lockPath, { recursive: true, force: true });
  } catch {
    // Never remove a lock whose ownership cannot be proved.
  }
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function kindClusters() {
  const result = tryCommand("kind", ["get", "clusters"]);
  check(result.ok, `kind get clusters failed: ${result.output}`);
  return result.output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort();
}

function clusterKubeconfig(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.kubeconfig`);
}

function clusterEnv(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.env`);
}

function readSpaces() {
  return new Map(unwrapRows(cubJson(["space", "list", "--select", "Labels,Annotations,ReleaseTargetID,TriggerFilterID,TriggerIDs,WhereTrigger,DeleteGates"]), "Space")
    .map((space) => [space.Slug, space]));
}

function readUnitRows(space) {
  const value = cubJson([
    "unit", "list", "--space", space,
    "--select", "Labels,Annotations,TargetID,UpstreamUnitID,DeleteGates,DestroyGates,ToolchainType,ProviderType,DataHash,HeadRevisionNum,ApprovedBy,ApplyGates",
  ]);
  return unwrapRows(value, "Unit");
}

function readUnit(space, slug) {
  const result = cubTry([
    "unit", "get", "--space", space, slug,
    "--select", "Labels,Annotations,TargetID,UpstreamUnitID,DeleteGates,DestroyGates,ToolchainType,ProviderType,DataHash,HeadRevisionNum,ApprovedBy,ApplyGates",
    "-o", "json",
  ]);
  if (!result.ok) return null;
  return unwrapEntity(JSON.parse(result.output), "Unit");
}

function readTarget(space) {
  const result = cubTry(["target", "get", "--space", space, "target", "-o", "json"]);
  return result.ok ? unwrapEntity(JSON.parse(result.output), "Target") : null;
}

function readLinks(space) {
  const result = cubJson([
    "link", "list", "--space", space,
    "--select", "FromUnitID,ToUnitID,ToSpaceID,UpdateType,AutoUpdate,Labels,Annotations,UpstreamLastMergedRevisionNum,DownstreamLastMergedRevisionNum",
  ]);
  return unwrapRows(result, "Link");
}

function expectedArgoApplicationSlugs(desired, fleetItem) {
  return [
    "root",
    `argobot-${fleetItem.cluster}`,
    ...desired.deployments
      .filter((deployment) => deployment.cluster === fleetItem.cluster)
      .map((deployment) => deployment.appUnit),
  ].sort();
}

function assertDeliveryTopology(spaces, desired, { requireAllApplications = false, fleet = FLEET } = {}) {
  const argobotBaseRows = readUnitRows("argobot-base");
  check(
    stableJson(argobotBaseRows.map((unit) => unit.Slug).sort()) === stableJson(["argobot"]),
    `argobot-base: unsafe Unit inventory; expected only argobot, got ${argobotBaseRows.map((unit) => unit.Slug).sort().join(", ")}`,
  );
  const argobotBase = argobotBaseRows[0];
  check(argobotBase.ToolchainType === "Kubernetes/YAML", "argobot-base/argobot: toolchain drifted");
  check(!argobotBase.ProviderType, "argobot-base/argobot: provider must remain the default");
  check(!argobotBase.TargetID && !argobotBase.UpstreamUnitID, "argobot-base/argobot: base delivery Unit unexpectedly has a target or upstream");
  check(readLinks("argobot-base").length === 0, "argobot-base: unexpected Links present");

  for (const fleetItem of fleet) {
    const clusterSpace = spaces.get(fleetItem.cluster);
    const appsSpaceSlug = `${fleetItem.cluster}-argo-apps`;
    const appsSpace = spaces.get(appsSpaceSlug);
    const argobotSpaceSlug = `argobot-${fleetItem.cluster}`;
    const argobotSpace = spaces.get(argobotSpaceSlug);
    check(clusterSpace && appsSpace && argobotSpace, `${fleetItem.cluster}: cluster delivery Spaces are incomplete`);

    const targetEntity = readTarget(fleetItem.cluster);
    check(targetEntity?.TargetID, `${fleetItem.cluster}/target: target is missing`);
    check(targetEntity.SpaceID === clusterSpace.SpaceID, `${fleetItem.cluster}/target: target belongs to a different Space`);
    check(targetEntity.ProviderType === "OCI", `${fleetItem.cluster}/target: expected OCI provider, got ${targetEntity.ProviderType ?? "missing"}`);
    check(targetEntity.ToolchainType === "Any", `${fleetItem.cluster}/target: expected Any toolchain, got ${targetEntity.ToolchainType ?? "missing"}`);
    check(
      targetEntity.Annotations?.["confighub.com/argo-apps-space"] === appsSpaceSlug,
      `${fleetItem.cluster}/target: Argo apps annotation does not name ${appsSpaceSlug}`,
    );
    check(appsSpace.ReleaseTargetID === targetEntity.TargetID, `${appsSpaceSlug}: release target is not ${fleetItem.cluster}/target`);
    check(argobotSpace.ReleaseTargetID === targetEntity.TargetID, `${argobotSpaceSlug}: release target is not ${fleetItem.cluster}/target`);

    const clusterUnits = readUnitRows(fleetItem.cluster);
    check(clusterUnits.length === 0, `${fleetItem.cluster}: cluster target Space must remain a pure namespace with no Units`);
    check(readLinks(fleetItem.cluster).length === 0, `${fleetItem.cluster}: cluster target Space must remain a pure namespace with no Links`);

    const allowedApps = expectedArgoApplicationSlugs(desired, fleetItem);
    const requiredApps = requireAllApplications
      ? allowedApps
      : ["root", `argobot-${fleetItem.cluster}`].sort();
    const appRows = readUnitRows(appsSpaceSlug);
    const actualApps = appRows.map((unit) => unit.Slug).sort();
    const unexpectedApps = actualApps.filter((slug) => !allowedApps.includes(slug));
    const missingApps = requiredApps.filter((slug) => !actualApps.includes(slug));
    check(unexpectedApps.length === 0, `${appsSpaceSlug}: refusing to publish unexpected Application Units: ${unexpectedApps.join(", ")}`);
    check(missingApps.length === 0, `${appsSpaceSlug}: required Application Units are missing: ${missingApps.join(", ")}`);
    for (const unit of appRows) {
      check(unit.ToolchainType === "Kubernetes/YAML", `${appsSpaceSlug}/${unit.Slug}: expected Kubernetes/YAML`);
      check(!unit.ProviderType, `${appsSpaceSlug}/${unit.Slug}: provider must remain the default`);
      check(unit.TargetID === targetEntity.TargetID, `${appsSpaceSlug}/${unit.Slug}: target is not ${fleetItem.cluster}/target`);
    }
    assertBootstrapApplication(
      appsSpaceSlug,
      "root",
      appsSpaceSlug,
      appsSpaceSlug,
    );
    assertBootstrapApplication(
      appsSpaceSlug,
      `argobot-${fleetItem.cluster}`,
      `argobot-${fleetItem.cluster}`,
      argobotSpaceSlug,
    );
    check(readLinks(appsSpaceSlug).length === 0, `${appsSpaceSlug}: unexpected Links present`);

    const argobotRows = readUnitRows(argobotSpaceSlug);
    check(
      stableJson(argobotRows.map((unit) => unit.Slug).sort()) === stableJson(["argobot"]),
      `${argobotSpaceSlug}: unsafe Unit inventory; expected only argobot, got ${argobotRows.map((unit) => unit.Slug).sort().join(", ")}`,
    );
    const argobot = argobotRows[0];
    check(argobot.ToolchainType === "Kubernetes/YAML", `${argobotSpaceSlug}/argobot: toolchain drifted`);
    check(!argobot.ProviderType, `${argobotSpaceSlug}/argobot: provider must remain the default`);
    check(argobot.TargetID === targetEntity.TargetID, `${argobotSpaceSlug}/argobot: target is not ${fleetItem.cluster}/target`);
    check(argobot.UpstreamUnitID === argobotBase.UnitID, `${argobotSpaceSlug}/argobot: upstream is not argobot-base/argobot`);
    const argobotLinks = readLinks(argobotSpaceSlug);
    check(
      argobotLinks.length === 1
        && argobotLinks[0].Slug === "upgrade-argobot"
        && argobotLinks[0].UpdateType === "UpgradeUnit"
        && argobotLinks[0].FromUnitID === argobot.UnitID
        && argobotLinks[0].ToUnitID === argobotBase.UnitID
        && argobotLinks[0].ToSpaceID === spaces.get("argobot-base")?.SpaceID,
      `${argobotSpaceSlug}: argobot UpgradeUnit Link drifted`,
    );
  }
}

function assertBootstrapApplication(appSpace, unitSlug, applicationName, sourceSpace) {
  const docs = parseDocs(cub(["unit", "data", "--space", appSpace, unitSlug]));
  check(docs.length === 1 && docs[0].kind === "Application", `${appSpace}/${unitSlug}: expected one bootstrap Argo Application`);
  const app = docs[0];
  check(app.metadata?.name === applicationName, `${appSpace}/${unitSlug}: bootstrap Application metadata.name drifted`);
  check(app.metadata?.namespace === "argocd", `${appSpace}/${unitSlug}: bootstrap Application namespace is not argocd`);
  check(app.spec?.project === "default", `${appSpace}/${unitSlug}: bootstrap Application project is not default`);
  check(
    app.spec?.source?.repoURL === `${CONFIGHUB_OCI_SPACE_PREFIX}${sourceSpace}`
      && app.spec?.source?.targetRevision === "latest"
      && app.spec?.source?.path === ".",
    `${appSpace}/${unitSlug}: bootstrap Application source is not the allowlisted ConfigHub Space ${sourceSpace}`,
  );
  check(app.spec?.destination?.server === "https://kubernetes.default.svc", `${appSpace}/${unitSlug}: bootstrap Application destination is not cluster-local`);
  check(app.spec?.syncPolicy?.automated?.selfHeal === true, `${appSpace}/${unitSlug}: bootstrap Application is not self-healing`);
  check(app.spec?.syncPolicy?.automated?.prune !== true, `${appSpace}/${unitSlug}: bootstrap Application must not prune`);
  check(
    !(app.spec?.syncPolicy?.syncOptions ?? []).some((option) => String(option).startsWith("Replace=")),
    `${appSpace}/${unitSlug}: bootstrap Application must not use Replace`,
  );
}

function labelsArgs(labels) {
  return Object.entries(labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]);
}

function annotationsArgs(annotations) {
  return Object.entries(annotations).flatMap(([key, value]) => {
    assertCubAnnotationValue(key, value);
    return ["--annotation", `${key}=${value}`];
  });
}

function assertCubAnnotationValue(key, value) {
  check(
    !/[=,\r\n]/.test(String(value)),
    `annotation ${key} contains a cub CLI-ambiguous value`,
  );
}

function mapMatches(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual?.[key] === value);
}

function staleOwnedLabels(actual, expected) {
  return [...OWNED_SPACE_LABELS].filter((key) => actual?.[key] !== undefined && expected[key] === undefined);
}

function assertOwnedSpace(space, expected) {
  const cohort = space.Labels?.ExampleCohort;
  if (!cohort) {
    check(
      expected.type === "cluster-target" || expected.type === "delivery-instance" || expected.type === "delivery-definition",
      `refusing to adopt unowned Space ${space.Slug}`,
    );
    return;
  }
  check(
    [EXAMPLE_COHORT, PRIOR_COHORT].includes(cohort),
    `refusing to adopt ${space.Slug}: ExampleCohort=${cohort}`,
  );
}

function assertSpaceAllowlist(spaces, desired, { requireAll = false } = {}) {
  const allowed = new Set(desired.spaces.map((space) => space.slug));
  const unexpected = [...spaces.keys()].filter((slug) => !allowed.has(slug)).sort();
  check(unexpected.length === 0, `refusing unexpected ConfigHub Spaces outside the 53-Space mini-IDP allowlist: ${unexpected.join(", ")}`);
  if (requireAll) {
    const missing = [...allowed].filter((slug) => !spaces.has(slug)).sort();
    check(missing.length === 0, `expected ConfigHub Spaces are missing: ${missing.join(", ")}`);
  }
}

function materializePayloadFiles(inputs, root) {
  const files = new Map();
  for (const item of inputs.payloads.values()) {
    const filename = `${item.key.replaceAll(/[^a-zA-Z0-9._-]+/g, "-")}-${item.sha256.slice(0, 12)}.${item.toolchain === "AppConfig/JSON" ? "json" : "yaml"}`;
    const path = join(root, filename);
    writeFileSync(path, item.value, "utf8");
    files.set(item.key, path);
  }
  return files;
}

function applyPlan(inputs, desired) {
  assertKubaraOrganization();
  const lockPath = acquireSerialLiveLock();
  const state = {
    actions: [],
    changedSpaces: new Set(),
    published: new Map(),
    scenario: { mode: "retained-proven-history", steps: [] },
  };
  let workRoot = "";
  try {
    assertSerialLiveLock();
    workRoot = mkdtempSync(join(tmpdir(), "helm-expt-kubara-mini-idp-"));
    const payloadFiles = materializePayloadFiles(inputs, workRoot);
    let spaces = readSpaces();
    assertSpaceAllowlist(spaces, desired);
    reconcileClusters(spaces, desired, state);
    spaces = readSpaces();
    for (const expected of desired.spaces) {
      const live = spaces.get(expected.slug);
      if (live) assertOwnedSpace(live, expected);
    }
    ensureDefinitionSpaces(spaces, desired, state);
    spaces = readSpaces();
    reconcileSpaceLabels(spaces, desired, state, { requireAll: false });
    reconcileApprovalPolicy(state);
    reconcileControlUnits(inputs, payloadFiles, desired, state);

    for (const surfaceDefinition of SURFACES) {
      reconcileSurface(surfaceDefinition, inputs, payloadFiles, desired, state);
    }
    reconcileProdPolicies(desired, state, { requireAll: false });
    for (const deployment of desired.deployments.filter((item) => item.type === "platform")) {
      deployOne(deployment, state);
      waitForSpecialPrerequisite(deployment);
    }
    for (const family of APP_FAMILIES.filter((item) => !item.scenario)) {
      reconcileAppFamily(family, inputs, payloadFiles, desired, state);
    }
    reconcileHxWebScenario(inputs, payloadFiles, desired, state);

    reconcileSpaceLabels(readSpaces(), desired, state);
    reconcileProdPolicies(desired, state);
    // hx-web is published by its scenario state machine. The platform binding
    // and cubbychat follow once cert-manager, Traefik, and the workload service
    // they refer to exist.
    for (const deployment of desired.deployments.filter(
      (item) => item.type === "application" && !item.space.startsWith("hx-web-"),
    )) deployOne(deployment, state);
    for (const deployment of desired.deployments.filter(
      (item) => item.space.startsWith("hx-web-platform-"),
    )) deployOne(deployment, state);

    reconcileLinks(desired, state);
    assertManagedLinkInventory(desired, { requireNeedsProvides: true });
    const observation = verifyLive(inputs, desired, { state });
    const receipt = buildReceipt(inputs, desired, observation, state);
    writeYaml(RECEIPT_PATH, receipt);
    if (receipt.status.idempotentRerunProven) {
      verifyReceipt(inputs, desired);
      console.log(
        `reconciled Kubara mini-IDP idempotently: ${state.actions.length} action(s), ${observation.spaces.length} Spaces, ${observation.units.length} managed Units, ${observation.links.length} NeedsProvides Links`,
      );
    } else {
      console.log(
        `reconciled Kubara mini-IDP: ${state.actions.length} action(s); rerun --apply to record the required zero-action idempotence proof`,
      );
    }
  } finally {
    if (workRoot) rmSync(workRoot, { recursive: true, force: true });
    releaseSerialLiveLock(lockPath);
  }
}

function recordAction(state, type, ref, detail = "") {
  state.actions.push({ type, ref, ...(detail ? { detail } : {}) });
}

function reconcileClusters(spaces, desired, state) {
  const local = new Set(kindClusters());
  const allowedClusters = new Set(FLEET.map((item) => item.cluster));
  for (const name of local) {
    if (name.startsWith("hx-app-") && !allowedClusters.has(name)) {
      check(false, `unexpected hx-app cluster ${name}; the exact cluster allowlist is ${[...allowedClusters].join(", ")}`);
    }
  }

  const initialStates = [];
  for (const item of FLEET) {
    const signals = {
      kind: local.has(item.cluster),
      kubeconfig: existsSync(clusterKubeconfig(item.cluster)),
      env: existsSync(clusterEnv(item.cluster)),
      clusterSpace: spaces.has(item.cluster),
      appsSpace: spaces.has(`${item.cluster}-argo-apps`),
      argobotSpace: spaces.has(`argobot-${item.cluster}`),
      target: Boolean(readTarget(item.cluster)),
    };
    const present = Object.values(signals).filter(Boolean).length;
    check(
      present === 0 || present === Object.keys(signals).length,
      `${item.cluster}: unsafe partial persistent-cluster state; refusing repair or deletion: ${stableJson(signals)}`,
    );
    initialStates.push({ item, absent: present === 0 });
  }
  const existingCount = initialStates.filter((entry) => !entry.absent).length;
  if (existingCount === 0) {
    check(!spaces.has("argobot-base"), "argobot-base exists without any complete allowlisted cluster; refusing partial repair");
  } else {
    check(spaces.has("argobot-base"), "argobot-base is missing while persistent clusters exist; refusing partial repair");
    assertDeliveryTopology(spaces, desired, {
      fleet: initialStates.filter((entry) => !entry.absent).map((entry) => entry.item),
    });
  }

  for (const { item, absent } of initialStates) {
    if (!absent) continue;
    cub(["cluster", "up", "--name", item.cluster, "--space", item.cluster], { timeout: 1_200_000 });
    recordAction(state, "cluster-up", item.cluster, "created persistent kind + ConfigHub Argo target; no cleanup registered");
  }

  const refreshed = readSpaces();
  const refreshedClusters = new Set(kindClusters());
  for (const item of FLEET) {
    check(refreshedClusters.has(item.cluster), `${item.cluster}: kind cluster missing after cluster reconciliation`);
    check(existsSync(clusterKubeconfig(item.cluster)), `${item.cluster}: kubeconfig missing after cluster reconciliation`);
    check(existsSync(clusterEnv(item.cluster)), `${item.cluster}: env file missing after cluster reconciliation`);
    check(refreshed.has(item.cluster) && refreshed.has(`${item.cluster}-argo-apps`), `${item.cluster}: ConfigHub cluster Spaces missing after cluster reconciliation`);
    check(readTarget(item.cluster), `${item.cluster}: target missing after cluster reconciliation`);
  }
  for (const slug of ["argobot-base", ...FLEET.map((item) => `argobot-${item.cluster}`)]) {
    check(refreshed.has(slug), `${slug}: delivery Space missing after cluster reconciliation; refusing partial repair`);
  }
  assertDeliveryTopology(refreshed, desired);
  for (const item of FLEET) {
    const reachable = kubectlTry(item.cluster, ["get", "namespace", "kube-system", "-o", "name"]);
    check(reachable.ok && /namespace\/kube-system/.test(reachable.output), `${item.cluster}: kubeconfig/context does not reach the expected persistent kind cluster`);
  }
}

function ensureDefinitionSpaces(spaces, desired, state) {
  const creatable = new Set(["control", "component-definition", "app-definition"]);
  for (const item of desired.spaces) {
    if (spaces.has(item.slug)) continue;
    if (!creatable.has(item.type)) continue;
    cub(["space", "create", item.slug, ...labelsArgs(item.labels), "--quiet"]);
    recordAction(state, "space-create", item.slug);
  }
}

function reconcileSpaceLabels(spaces, desired, state, { requireAll = true } = {}) {
  for (const item of desired.spaces) {
    const live = spaces.get(item.slug);
    if (!live && !requireAll) continue;
    check(live, `${item.slug}: expected Space is missing`);
    const stale = staleOwnedLabels(live.Labels, item.labels);
    if (mapMatches(live.Labels, item.labels) && stale.length === 0) continue;
    cub([
      "space", "update", "--patch", item.slug,
      ...labelsArgs(item.labels),
      ...stale.flatMap((key) => ["--label", `${key}=-`]),
      "--quiet",
    ]);
    recordAction(state, "space-label", item.slug);
  }
}

function reconcileApprovalPolicy(state) {
  const triggerResult = cubTry(["trigger", "get", "--space", CONTROL_SPACE, APPROVAL_TRIGGER, "-o", "json"]);
  if (!triggerResult.ok) {
    cub([
      "trigger", "create", "--space", CONTROL_SPACE,
      APPROVAL_TRIGGER, "Mutation", "Kubernetes/YAML", "vet-approvedby", "1",
      "--description", "Production configuration requires one approval of the exact revision",
      "--quiet",
    ]);
    recordAction(state, "trigger-create", `${CONTROL_SPACE}/${APPROVAL_TRIGGER}`);
  } else {
    const trigger = unwrapEntity(JSON.parse(triggerResult.output), "Trigger");
    const argumentsMatch = stableJson(trigger.Arguments ?? []) === stableJson([
      { ParameterName: "num-approvers", Value: "1" },
    ]);
    if (
      trigger.Event !== "Mutation"
      || trigger.ToolchainType !== "Kubernetes/YAML"
      || trigger.FunctionName !== "vet-approvedby"
      || !argumentsMatch
      || trigger.Disabled === true
      || trigger.Validating !== true
      || Number(trigger.FailOpenAfter ?? 0) !== 0
    ) {
      cub([
        "trigger", "update", "--space", CONTROL_SPACE,
        APPROVAL_TRIGGER, "Mutation", "Kubernetes/YAML", "vet-approvedby", "1",
        "--description", "Production configuration requires one approval of the exact revision",
        "--quiet",
      ]);
      recordAction(state, "trigger-update", `${CONTROL_SPACE}/${APPROVAL_TRIGGER}`);
    }
  }

  const where = "Space.Slug = 'hx-platform' AND FunctionName = 'vet-approvedby'";
  const filterResult = cubTry(["filter", "get", "--space", CONTROL_SPACE, APPROVAL_FILTER, "-o", "json"]);
  if (!filterResult.ok) {
    cub([
      "filter", "create", "--space", CONTROL_SPACE,
      APPROVAL_FILTER, "Trigger", "--where-field", where, "--quiet",
    ]);
    recordAction(state, "filter-create", `${CONTROL_SPACE}/${APPROVAL_FILTER}`);
  } else {
    const filter = unwrapEntity(JSON.parse(filterResult.output), "Filter");
    if (filter.From !== "Trigger" || filter.Where !== where) {
      cub([
        "filter", "update", "--space", CONTROL_SPACE,
        APPROVAL_FILTER, "Trigger", "--where-field", where, "--quiet",
      ]);
      recordAction(state, "filter-update", `${CONTROL_SPACE}/${APPROVAL_FILTER}`);
    }
  }
}

function reconcileControlUnits(inputs, payloadFiles, desired, state) {
  const expectedUnits = desired.managedUnits.filter((item) => item.space === CONTROL_SPACE);
  const expectedSlugs = expectedUnits.map((item) => item.slug).sort();
  const preservedSlugs = PRESERVED_FAITHFUL_CONTROL_UNITS.map((item) => item.slug).sort();
  const unexpected = readUnitRows(CONTROL_SPACE)
    .map((item) => item.Slug)
    .filter((slug) => !expectedSlugs.includes(slug) && !preservedSlugs.includes(slug))
    .sort();
  check(unexpected.length === 0, `${CONTROL_SPACE}: refusing unexpected control Units: ${unexpected.join(", ")}`);
  assertPreservedFaithfulControlUnits();
  for (const expected of expectedUnits) {
    if (expected.requiredForApply) check(expected.payloadKey, `${CONTROL_SPACE}/${expected.slug}: required evidence is missing`);
    if (!expected.payloadKey) continue;
    upsertUnit(expected, inputs, payloadFiles, state);
  }
  assertUnitAllowlist(CONTROL_SPACE, [...expectedSlugs, ...preservedSlugs]);
}

function reconcileSurface(surfaceDefinition, inputs, payloadFiles, desired, state) {
  const baseSpace = `${surfaceDefinition.prefix}-base`;
  const baseUnit = desired.managedUnits.find((item) => item.space === baseSpace && item.slug === surfaceDefinition.prefix);
  upsertUnit(baseUnit, inputs, payloadFiles, state);
  assertUnitAllowlist(baseSpace, [surfaceDefinition.prefix]);
  for (const fleetItem of surfaceDefinition.targets) {
    const space = `${surfaceDefinition.prefix}-${fleetItem.suffix}`;
    ensureVariantSpace({
      space,
      upstreamSpace: baseSpace,
      variantName: fleetItem.suffix,
      fleetItem,
      prodProtected: fleetItem.environment === "Prod",
    }, state);
    const unit = desired.managedUnits.find((item) => item.space === space && item.slug === surfaceDefinition.prefix);
    upsertUnit(unit, inputs, payloadFiles, state);
    assertUnitAllowlist(space, [surfaceDefinition.prefix]);
    ensureArgoApplication(desired.deployments.find((item) => item.space === space), state);
  }
}

function reconcileAppFamily(family, inputs, payloadFiles, desired, state) {
  const baseSpace = `${family.prefix}-base`;
  for (const unit of desired.managedUnits.filter((item) => item.space === baseSpace)) {
    upsertUnit(unit, inputs, payloadFiles, state);
  }
  assertUnitAllowlist(baseSpace, family.units.map((item) => item.slug));
  for (let index = 0; index < family.targets.length; index += 1) {
    const fleetItem = family.targets[index];
    const upstreamSpace = index === 0
      ? baseSpace
      : index === 1
        ? `${family.prefix}-dev`
        : `${family.prefix}-staging`;
    const space = `${family.prefix}-${fleetItem.suffix}`;
    ensureVariantSpace({
      space,
      upstreamSpace,
      variantName: fleetItem.suffix,
      fleetItem,
      prodProtected: fleetItem.environment === "Prod",
    }, state);
    for (const unit of desired.managedUnits.filter((item) => item.space === space)) {
      upsertUnit(unit, inputs, payloadFiles, state);
    }
    assertUnitAllowlist(space, family.units.map((item) => item.slug));
    ensureArgoApplication(desired.deployments.find((item) => item.space === space), state);
  }
}

function ensureVariantSpace({ space, upstreamSpace, variantName, fleetItem, prodProtected }, state) {
  const existing = cubTry(["space", "get", space, "-o", "json"]);
  if (!existing.ok) {
    cub([
      "variant", "create", variantName, upstreamSpace,
      "--space-pattern", `template:${space}`,
      "--environment", fleetItem.environment,
      "--region", fleetItem.region,
      "--target", `${fleetItem.cluster}/target`,
      ...(prodProtected
        ? ["--unit-delete-gate", PROD_SAFETY_GATE, "--unit-destroy-gate", PROD_SAFETY_GATE]
        : []),
      "--wait", "--quiet",
    ], { timeout: 1_200_000 });
    recordAction(state, "variant-create", space, `upstream=${upstreamSpace} target=${fleetItem.cluster}/target`);
    state.changedSpaces.add(space);
    return;
  }
  const live = unwrapEntity(JSON.parse(existing.output), "Space");
  const cohort = live.Labels?.ExampleCohort;
  check(!cohort || [EXAMPLE_COHORT, PRIOR_COHORT].includes(cohort), `${space}: refuses foreign existing variant`);
  const target = readTarget(fleetItem.cluster);
  check(target?.TargetID, `${fleetItem.cluster}/target is missing`);
  if (live.ReleaseTargetID !== target.TargetID) {
    cub(["space", "update", "--patch", space, "--release-target", `${fleetItem.cluster}/target`, "--quiet"]);
    recordAction(state, "space-release-target", space, `${fleetItem.cluster}/target`);
    state.changedSpaces.add(space);
  }
}

function assertUnitAllowlist(space, expectedSlugs) {
  const actual = readUnitRows(space).map((item) => item.Slug).sort();
  const expected = [...expectedSlugs].sort();
  check(stableJson(actual) === stableJson(expected), `${space}: unsafe Unit inventory; expected ${expected.join(", ")}, got ${actual.join(", ")}`);
}

function assertPreservedFaithfulControlUnits() {
  const faithful = verifyFaithfulProof();
  const generatedSha256 = faithful.spec?.source?.currentExample?.generatedSha256;
  check(/^[a-f0-9]{64}$/.test(generatedSha256 ?? ""), "faithful proof generated SHA is missing");
  const rows = [];
  for (const expected of PRESERVED_FAITHFUL_CONTROL_UNITS) {
    const evidence = faithful.spec?.configHub?.[expected.receiptKey];
    const receiptUnit = evidence?.unit;
    const receiptApproval = evidence?.approval;
    const ref = `${CONTROL_SPACE}/${expected.slug}`;
    check(receiptUnit?.ref === ref, `${ref}: faithful receipt ownership reference drifted`);
    check(UUID_PATTERN.test(receiptUnit.id ?? ""), `${ref}: faithful receipt Unit ID is missing`);
    check(Number.isInteger(receiptUnit.headRevisionNum), `${ref}: faithful receipt head revision is missing`);
    check(/^[a-f0-9]{64}$/.test(receiptUnit.dataHash ?? ""), `${ref}: faithful receipt data hash is missing`);
    check(
      receiptApproval?.revision === receiptUnit.headRevisionNum
        && Number.isInteger(receiptApproval.recordedApprovals)
        && receiptApproval.recordedApprovals > 0,
      `${ref}: faithful receipt approval is not bound to its recorded head revision`,
    );

    const live = readUnit(CONTROL_SPACE, expected.slug);
    check(live, `${ref}: retained faithful proof Unit is missing`);
    check(live.UnitID === receiptUnit.id, `${ref}: Unit ID differs from the current faithful pass receipt`);
    check(live.HeadRevisionNum === receiptUnit.headRevisionNum, `${ref}: head revision differs from the current faithful pass receipt`);
    check(live.DataHash === receiptUnit.dataHash, `${ref}: data hash differs from the current faithful pass receipt`);
    check(live.ToolchainType === "AppConfig/YAML", `${ref}: toolchain must remain AppConfig/YAML`);
    check(live.ProviderType === "None", `${ref}: provider must remain None`);
    check(!live.TargetID && !live.UpstreamUnitID, `${ref}: faithful proof evidence must remain untargeted and without an upstream`);
    check(
      approvalCount(live.ApprovedBy) === receiptApproval.recordedApprovals,
      `${ref}: live head approvals differ from the current faithful pass receipt`,
    );
    check(mapMatches(live.Labels, {
      ExampleCohort: EXAMPLE_COHORT,
      KubaraVersion: KUBARA_VERSION,
      Role: expected.role,
      Topology: "HubSpoke",
      ProofPhase: expected.proofPhase,
    }), `${ref}: faithful proof ownership labels drifted`);
    check(mapMatches(live.Annotations, {
      "confighub.com/source-path": paths.config,
      "confighub.com/generated-sha256": `sha256:${generatedSha256}`,
    }), `${ref}: faithful proof provenance annotations drifted`);
    rows.push({
      ref,
      id: live.UnitID,
      headRevisionNum: live.HeadRevisionNum,
      dataHash: live.DataHash,
      approvalCount: approvalCount(live.ApprovedBy),
      owner: "faithful-hub-spoke-proof",
      policy: "preserved",
    });
  }
  return rows;
}

function assertManagedLinkInventory(desired, { requireNeedsProvides = false } = {}) {
  const spaces = readSpaces();
  const unitsBySpace = new Map();
  for (const unit of desired.managedUnits) {
    if (!unitsBySpace.has(unit.space)) unitsBySpace.set(unit.space, []);
    unitsBySpace.get(unit.space).push(unit);
  }
  for (const [space, units] of unitsBySpace) {
    const expectedUpgrade = new Map(units.filter((unit) => unit.upstream).map((unit) => [`upgrade-${unit.slug}`, unit]));
    const expectedNeedsProvides = new Map(desired.links.filter((link) => link.space === space).map((link) => [link.slug, link]));
    const allowedSlugs = new Set([...expectedUpgrade.keys(), ...expectedNeedsProvides.keys()]);
    const liveLinks = readLinks(space);
    const unexpected = liveLinks.filter((link) => !allowedSlugs.has(link.Slug)).map((link) => link.Slug).sort();
    check(unexpected.length === 0, `${space}: refusing unexpected Links: ${unexpected.join(", ")}`);

    for (const [slug, unit] of expectedUpgrade) {
      const link = liveLinks.find((item) => item.Slug === slug);
      check(link, `${space}/${slug}: required UpgradeUnit Link is missing`);
      const downstream = readUnit(space, unit.slug);
      const [upstreamSpace, upstreamSlug] = unit.upstream.split("/");
      const upstream = readUnit(upstreamSpace, upstreamSlug);
      check(downstream && upstream, `${space}/${slug}: UpgradeUnit endpoint is missing`);
      check(link.UpdateType === "UpgradeUnit", `${space}/${slug}: expected UpgradeUnit, got ${link.UpdateType ?? "missing"}`);
      check(link.AutoUpdate !== true, `${space}/${slug}: UpgradeUnit Link must not auto-update during the explicit promotion scenario`);
      check(link.FromUnitID === downstream.UnitID, `${space}/${slug}: downstream endpoint drifted`);
      check(link.ToUnitID === upstream.UnitID, `${space}/${slug}: upstream endpoint drifted`);
      check(link.ToSpaceID === spaces.get(upstreamSpace)?.SpaceID, `${space}/${slug}: upstream Space drifted`);
    }
    if (requireNeedsProvides) {
      for (const slug of expectedNeedsProvides.keys()) {
        check(liveLinks.some((link) => link.Slug === slug), `${space}/${slug}: required NeedsProvides Link is missing`);
      }
    }
  }
}

function upsertUnit(expected, inputs, payloadFiles, state, { payloadKey = expected.payloadKey } = {}) {
  check(expected, "internal error: missing expected Unit definition");
  const payload = inputs.payloads.get(payloadKey);
  check(payload, `${expected.space}/${expected.slug}: payload ${payloadKey} is missing`);
  const path = payloadFiles.get(payloadKey);
  const annotations = sourceAnnotation(payload.value, payload.sourcePaths, payload.transform);
  const existing = readUnit(expected.space, expected.slug);
  if (!existing) {
    check(!expected.upstream, `${expected.space}/${expected.slug}: variant Unit is missing; refusing partial clone repair`);
    cub([
      "unit", "create", "--space", expected.space,
      expected.slug, path,
      "--toolchain", expected.toolchain,
      ...(expected.provider ? ["--provider", expected.provider] : []),
      ...labelsArgs(expected.labels),
      ...annotationsArgs(annotations),
      "--change-desc", `Reconcile ${KUBARA_VERSION} mini-IDP source`,
      "--quiet",
    ], { timeout: 1_200_000 });
    recordAction(state, "unit-create", `${expected.space}/${expected.slug}`, payloadKey);
    state.changedSpaces.add(expected.space);
  } else {
    check(existing.ToolchainType === expected.toolchain, `${expected.space}/${expected.slug}: toolchain ${existing.ToolchainType} cannot be safely adopted`);
    const actualProvider = existing.ProviderType ?? null;
    const expectedProvider = expected.provider ?? null;
    check(actualProvider === expectedProvider, `${expected.space}/${expected.slug}: provider ${actualProvider ?? "default"} cannot be safely adopted; expected ${expectedProvider ?? "default"}`);
    if (expected.upstream) {
      const [upstreamSpace, upstreamSlug] = expected.upstream.split("/");
      const upstream = readUnit(upstreamSpace, upstreamSlug);
      check(upstream?.UnitID, `${expected.space}/${expected.slug}: expected upstream ${expected.upstream} is missing`);
      check(
        existing.UpstreamUnitID === upstream.UnitID,
        `${expected.space}/${expected.slug}: unsafe upstream mismatch; expected ${expected.upstream}, refusing partial variant repair`,
      );
    }
    if (!sameUnitData(expected.toolchain, cub(["unit", "data", "--space", expected.space, expected.slug]), payload.value)) {
      cub([
        "unit", "update", "--space", expected.space,
        expected.slug, path,
        ...(expected.provider ? ["--provider", expected.provider] : []),
        "--change-desc", `Reconcile ${KUBARA_VERSION} mini-IDP source`,
        "--quiet",
      ], { timeout: 1_200_000 });
      recordAction(state, "unit-data", `${expected.space}/${expected.slug}`, payloadKey);
      state.changedSpaces.add(expected.space);
    }
    const refreshed = readUnit(expected.space, expected.slug);
    if (!mapMatches(refreshed.Labels, expected.labels) || !mapMatches(refreshed.Annotations, annotations) || (expected.provider && refreshed.ProviderType !== expected.provider)) {
      cub([
        "unit", "update", "--patch", "--space", expected.space,
        expected.slug,
        ...(expected.provider ? ["--provider", expected.provider] : []),
        ...labelsArgs(expected.labels),
        ...annotationsArgs(annotations),
        "--change-desc", `Reconcile ${KUBARA_VERSION} mini-IDP provenance`,
        "--quiet",
      ]);
      recordAction(state, "unit-metadata", `${expected.space}/${expected.slug}`);
      state.changedSpaces.add(expected.space);
    }
  }

  const current = readUnit(expected.space, expected.slug);
  if (expected.target) {
    const targetEntity = readTarget(expected.target.split("/")[0]);
    check(targetEntity?.TargetID, `${expected.target}: target is missing`);
    if (current.TargetID !== targetEntity.TargetID) {
      cub(["unit", "set-target", "--space", expected.space, expected.slug, expected.target, "--quiet"]);
      recordAction(state, "unit-target", `${expected.space}/${expected.slug}`, expected.target);
      state.changedSpaces.add(expected.space);
    }
  } else if (current.TargetID) {
    cub(["unit", "set-target", "--space", expected.space, expected.slug, "-", "--quiet"]);
    recordAction(state, "unit-target-clear", `${expected.space}/${expected.slug}`);
    state.changedSpaces.add(expected.space);
  }

  if (expected.prodProtected) ensureUnitProtection(expected.space, expected.slug, state);
}

function sameUnitData(toolchain, actual, expected) {
  if (toolchain === "Kubernetes/YAML") return canonicalDocuments(actual) === canonicalDocuments(expected);
  if (toolchain === "AppConfig/JSON") return stableJson(JSON.parse(actual)) === stableJson(JSON.parse(expected));
  return stableJson(readYamlText(actual)) === stableJson(readYamlText(expected));
}

function canonicalDocuments(text) {
  return stableJson(parseDocs(text).sort((left, right) => identityFor(left).localeCompare(identityFor(right))));
}

function gateEnabled(value, name) {
  if (Array.isArray(value)) return value.includes(name);
  return value?.[name] === true;
}

function ensureUnitProtection(space, slug, state) {
  const unit = readUnit(space, slug);
  if (gateEnabled(unit.DeleteGates, PROD_SAFETY_GATE) && gateEnabled(unit.DestroyGates, PROD_SAFETY_GATE)) return;
  cub([
    "unit", "update", "--patch", "--space", space, slug,
    "--delete-gate", PROD_SAFETY_GATE,
    "--destroy-gate", PROD_SAFETY_GATE,
    "--change-desc", "Protect production mini-IDP configuration",
    "--quiet",
  ]);
  recordAction(state, "unit-protection", `${space}/${slug}`);
  state.changedSpaces.add(space);
}

function ensureArgoApplication(deployment, state) {
  check(deployment, "internal error: deployment definition missing");
  const existing = readUnit(deployment.appSpace, deployment.appUnit);
  check(existing, `${deployment.appSpace}/${deployment.appUnit}: Argo Application Unit missing; refusing partial variant repair`);
  const targetEntity = readTarget(deployment.cluster);
  check(targetEntity?.TargetID, `${deployment.cluster}/target: target is missing`);
  check(existing.TargetID === targetEntity.TargetID, `${deployment.appSpace}/${deployment.appUnit}: target is not ${deployment.cluster}/target`);
  const currentData = cub(["unit", "data", "--space", deployment.appSpace, deployment.appUnit]);
  const docs = parseDocs(currentData);
  check(docs.length === 1 && docs[0].kind === "Application", `${deployment.appSpace}/${deployment.appUnit}: expected one Argo Application`);
  const app = docs[0];
  assertArgoApplicationContract(app, deployment);
  app.spec ??= {};
  app.spec.destination = { server: "https://kubernetes.default.svc" };
  app.spec.syncPolicy = {
    automated: {
      selfHeal: true,
      allowEmpty: true,
    },
    ...(deployment.serverSideApply ? { syncOptions: ["ServerSideApply=true"] } : {}),
  };
  if (deployment.ignoreInjectedCertificateData) {
    app.spec.ignoreDifferences = certificateIgnoreDifferences();
  } else delete app.spec.ignoreDifferences;
  const expected = renderDocuments([app]);
  if (sameUnitData("Kubernetes/YAML", currentData, expected)) return;
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-kubara-argo-app-"));
  try {
    const path = join(temp, `${deployment.appUnit}.yaml`);
    writeFileSync(path, expected, "utf8");
    cub([
      "unit", "update", "--space", deployment.appSpace,
      deployment.appUnit, path,
      "--change-desc", deployment.serverSideApply
        ? "Use server-side apply for Kubara CRDs"
        : "Remove unsafe Argo sync options",
      "--quiet",
    ]);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  recordAction(state, "argo-application", `${deployment.appSpace}/${deployment.appUnit}`);
  state.changedSpaces.add(deployment.appSpace);
}

function certificateIgnoreDifferences() {
  return [
    {
      group: "admissionregistration.k8s.io",
      kind: "MutatingWebhookConfiguration",
      jqPathExpressions: [".webhooks[]?.clientConfig.caBundle"],
    },
    {
      group: "admissionregistration.k8s.io",
      kind: "ValidatingWebhookConfiguration",
      jqPathExpressions: [".webhooks[]?.clientConfig.caBundle"],
    },
  ];
}

function assertArgoApplicationContract(app, deployment) {
  check(app.metadata?.name === deployment.appUnit, `${deployment.appSpace}/${deployment.appUnit}: Application metadata.name drifted`);
  check(app.metadata?.namespace === "argocd", `${deployment.appSpace}/${deployment.appUnit}: Application namespace is not argocd`);
  check(app.spec?.project === "default", `${deployment.appSpace}/${deployment.appUnit}: Application project is not default`);
  check(
    app.spec?.source?.repoURL === `${CONFIGHUB_OCI_SPACE_PREFIX}${deployment.space}`,
    `${deployment.appSpace}/${deployment.appUnit}: Application source is not the allowlisted ConfigHub Space ${deployment.space}`,
  );
  check(app.spec?.source?.targetRevision === "latest", `${deployment.appSpace}/${deployment.appUnit}: Application targetRevision is not latest`);
  check(app.spec?.source?.path === ".", `${deployment.appSpace}/${deployment.appUnit}: Application source path is not .`);
  check(
    app.spec?.destination?.server === "https://kubernetes.default.svc",
    `${deployment.appSpace}/${deployment.appUnit}: Application destination is not the cluster-local API`,
  );
}

function reconcileProdPolicies(desired, state, { requireAll = true } = {}) {
  const filter = unwrapEntity(cubJson(["filter", "get", "--space", CONTROL_SPACE, APPROVAL_FILTER]), "Filter");
  check(filter?.FilterID, `${CONTROL_SPACE}/${APPROVAL_FILTER}: filter ID is missing`);
  const trigger = unwrapEntity(cubJson(["trigger", "get", "--space", CONTROL_SPACE, APPROVAL_TRIGGER]), "Trigger");
  check(trigger?.TriggerID, `${CONTROL_SPACE}/${APPROVAL_TRIGGER}: trigger ID is missing`);
  const control = unwrapEntity(cubJson(["space", "get", CONTROL_SPACE]), "Space");
  check(control?.SpaceID, `${CONTROL_SPACE}: Space ID is missing`);
  const legacyControlWhere = `SpaceID = '${control.SpaceID}'`;
  const prodSpaces = desired.spaces.filter((item) => item.prodProtected);
  const knownSpaces = readSpaces();
  for (const expected of prodSpaces) {
    if (!knownSpaces.has(expected.slug) && !requireAll) continue;
    check(knownSpaces.has(expected.slug), `${expected.slug}: production Space is missing`);
    const live = unwrapEntity(cubJson(["space", "get", expected.slug]), "Space");
    const whereTrigger = live.WhereTrigger ?? "";
    const triggerFilterID = live.TriggerFilterID ?? "";
    const selectedTriggers = [...(live.TriggerIDs ?? [])].sort();
    const ownedFilterAttached = triggerFilterID === filter.FilterID && !whereTrigger;
    const triggerSelectionExact = stableJson(selectedTriggers) === stableJson([trigger.TriggerID]);
    const alreadyExact = ownedFilterAttached && triggerSelectionExact;
    const unconfigured = !triggerFilterID && !whereTrigger && selectedTriggers.length === 0;
    const legacyUpstreamSpaceID = expected.upstreamSpace
      ? knownSpaces.get(expected.upstreamSpace)?.SpaceID
      : null;
    const recognizedLegacyWheres = new Set([
      legacyControlWhere,
      ...(legacyUpstreamSpaceID ? [`SpaceID = '${legacyUpstreamSpaceID}'`] : []),
    ]);
    const recognizedLegacy = !triggerFilterID
      && recognizedLegacyWheres.has(whereTrigger)
      && selectedTriggers.every((id) => id === trigger.TriggerID);
    check(
      ownedFilterAttached || unconfigured || recognizedLegacy,
      `${expected.slug}: refusing to replace an unowned Trigger policy (${stableJson({ triggerFilterID, whereTrigger, selectedTriggers })})`,
    );
    if (!alreadyExact) {
      if (!ownedFilterAttached) {
        cub([
          "space", "update", "--patch", expected.slug,
          "--trigger-filter", `${CONTROL_SPACE}/${APPROVAL_FILTER}`,
          "--where-trigger", "-",
          "--quiet",
        ]);
      }
      cub([
        "space", "update", "--patch", expected.slug,
        "--refresh-triggers", "--quiet",
      ]);
      recordAction(state, "approval-policy", expected.slug, `${CONTROL_SPACE}/${APPROVAL_FILTER}`);
    }
    const refreshed = unwrapEntity(cubJson(["space", "get", expected.slug]), "Space");
    check(refreshed.TriggerFilterID === filter.FilterID && !(refreshed.WhereTrigger ?? ""), `${expected.slug}: production approval Filter did not attach exactly`);
    check(stableJson([...(refreshed.TriggerIDs ?? [])].sort()) === stableJson([trigger.TriggerID]), `${expected.slug}: production Trigger selection is not exactly ${CONTROL_SPACE}/${APPROVAL_TRIGGER}`);
    for (const unit of readUnitRows(expected.slug)) ensureUnitProtection(expected.slug, unit.Slug, state);
  }
}

function scenarioSpacesMarked() {
  const spaces = readSpaces();
  return ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)]
    .every((slug) => spaces.get(slug)?.Labels?.ScenarioVersion === SCENARIO_VERSION);
}

function readPriorReceipt() {
  if (!existsSync(RECEIPT_PATH)) return null;
  try {
    return readYaml(RECEIPT_PATH);
  } catch {
    // A process interruption during the local receipt write must not make the
    // live reconciliation unrestartable. --receipt-verify still rejects a
    // malformed receipt; --apply safely reconstructs it from live reads.
    return null;
  }
}

function scenarioReceiptProvesHistory() {
  const receipt = readPriorReceipt();
  if (!receipt) return false;
  const scenario = receipt.kind === "ConfigHubKubaraMiniIDPReconcileReceipt"
    ? receipt.spec?.rolloutScenario
    : null;
  if (scenario?.version !== SCENARIO_VERSION) return false;
  if (!["pending-idempotence", "pass"].includes(receipt.status?.result)) return false;
  const runs = receipt.spec?.reconcileRuns ?? [];
  if (!runs.length || !runs.every((run) => run.result === "pass")) return false;
  if (!runs.some((run) => run.idempotentNoop === false && run.actionCount > 0)) return false;
  const spaces = readSpaces();
  if (receipt.spec?.organization?.entityID !== spaces.get(CONTROL_SPACE)?.OrganizationID) return false;
  const receiptSpaces = new Map((receipt.spec?.spaces ?? []).map((space) => [space.slug, space.id]));
  for (const slug of ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)]) {
    if (receiptSpaces.get(slug) !== spaces.get(slug)?.SpaceID) return false;
  }
  for (const [name, evidence] of Object.entries(sourceEvidence())) {
    const stored = receipt.spec?.source?.files?.[name];
    if (stored?.path !== evidence.path || stored?.sha256 !== evidence.sha256) return false;
  }
  const expectedSteps = ["initial-rollout", "base-promotion", "prod-approval", "prod-a-rollback", "staging-departure", "departure-survives-promotion"];
  return expectedSteps.every((id) => (scenario.steps ?? []).some((item) => item.id === id && item.result === "pass"))
    && ["hx-web-prod-a", "hx-web-prod-b"].every((space) => (scenario.operationEvidence ?? []).some(
      (item) => item.type === "expected-approval-block" && item.ref === space,
    ));
}

function reconcileHxWebScenario(inputs, payloadFiles, desired, state) {
  const family = APP_FAMILIES.find((item) => item.prefix === "hx-web");
  const baseSpace = "hx-web-base";
  const baseUnits = desired.managedUnits.filter((item) => item.space === baseSpace);
  const alreadyProven = scenarioSpacesMarked() && scenarioReceiptProvesHistory();

  for (const expected of baseUnits) {
    upsertUnit(expected, inputs, payloadFiles, state, {
      payloadKey: alreadyProven || !expected.initialPayloadKey
        ? expected.payloadKey
        : expected.initialPayloadKey,
    });
  }
  assertUnitAllowlist(baseSpace, family.units.map((item) => item.slug));

  for (let index = 0; index < family.targets.length; index += 1) {
    const fleetItem = family.targets[index];
    const upstreamSpace = index === 0
      ? baseSpace
      : index === 1
        ? "hx-web-dev"
        : "hx-web-staging";
    const space = `hx-web-${fleetItem.suffix}`;
    ensureVariantSpace({
      space,
      upstreamSpace,
      variantName: fleetItem.suffix,
      fleetItem,
      prodProtected: fleetItem.environment === "Prod",
    }, state);
    for (const expected of desired.managedUnits.filter((item) => item.space === space)) {
      upsertUnit(expected, inputs, payloadFiles, state, {
        payloadKey: alreadyProven || !expected.initialPayloadKey
          ? expected.payloadKey
          : expected.initialPayloadKey,
      });
    }
    assertUnitAllowlist(space, family.units.map((item) => item.slug));
    ensureArgoApplication(desired.deployments.find((item) => item.space === space), state);
  }

  assertManagedLinkInventory(desired);
  if (!alreadyProven) resetHxWebScenarioMergeBases(desired, state);
  reconcileProdPolicies(desired, state);
  if (alreadyProven) {
    state.scenario = {
      mode: "retained-proven-history",
      version: SCENARIO_VERSION,
      steps: verifyHxWebFinalState(inputs),
    };
    for (const deployment of desired.deployments.filter(
      (item) => item.type === "application" && /^hx-web-(dev|staging|prod-a|prod-b)$/.test(item.space),
    )) deployOne(deployment, state);
    return;
  }

  state.scenario = { mode: "executed", version: SCENARIO_VERSION, steps: [] };
  const scenarioStep = (id, operation) => {
    operation();
    state.scenario.steps.push({ id, result: "pass" });
  };

  scenarioStep("initial-rollout", () => {
    for (const deployment of desired.deployments.filter(
      (item) => item.type === "application" && /^hx-web-(dev|staging|prod-a|prod-b)$/.test(item.space),
    )) {
      state.changedSpaces.add(deployment.space);
      deployOne(deployment, state);
    }
  });

  scenarioStep("base-promotion", () => {
    const baseDeployment = baseUnits.find((item) => item.slug === "hx-web-deployment");
    upsertUnit(baseDeployment, inputs, payloadFiles, state, {
      payloadKey: "hx-web/base/hx-web-deployment/v1",
    });
    promoteAndPublish("hx-web-dev", state);
    promoteAndPublish("hx-web-staging", state);
    promoteAndPublish("hx-web-prod-a", state, { expectApprovalBlock: true });
    promoteAndPublish("hx-web-prod-b", state, { expectApprovalBlock: true });
  });

  scenarioStep("prod-approval", () => {
    for (const space of ["hx-web-prod-a", "hx-web-prod-b"]) {
      const before = readUnitRows(space);
      check(before.every((unit) => gateEnabled(unit.DeleteGates, PROD_SAFETY_GATE)), `${space}: delete protection is missing`);
      const deployment = before.find((unit) => unit.Slug === "hx-web-deployment");
      check(deployment && hasApprovalGate(deployment), `${space}: promoted deployment is not waiting at the approval gate`);
      check(state.actions.some((item) => item.type === "expected-approval-block" && item.ref === space), `${space}: release refusal was not observed before approval`);
      approveOutstanding(space, state);
      const approvedDeployment = readUnitRows(space).find((unit) => unit.Slug === "hx-web-deployment");
      check(approvalCount(approvedDeployment?.ApprovedBy) >= 1, `${space}: promoted deployment revision was not approved after the expected refusal`);
      publishRelease(space, state, { force: true });
      waitForApplication(FLEET.find((item) => space.endsWith(item.suffix)).cluster, space, ["Healthy"]);
    }
  });

  scenarioStep("prod-a-rollback", () => {
    cub([
      "unit", "update", "--space", "hx-web-prod-a", "hx-web-deployment",
      "--restore", "-1",
      "--change-desc", "Demonstrate one-production-target rollback",
      "--quiet",
    ]);
    recordAction(state, "rollback", "hx-web-prod-a/hx-web-deployment", "restore -1");
    state.changedSpaces.add("hx-web-prod-a");
    approveOutstanding("hx-web-prod-a", state);
    publishRelease("hx-web-prod-a", state, { force: true });
    waitForApplication("hx-app-prod-a", "hx-web-prod-a", ["Healthy"]);
    const docs = parseDocs(cub(["unit", "data", "--space", "hx-web-prod-a", "hx-web-deployment"]));
    check(docs.find((doc) => doc.kind === "Deployment")?.spec?.replicas === 2, "prod-a rollback did not restore two replicas");
  });

  scenarioStep("staging-departure", () => {
    const expected = desired.managedUnits.find((item) => item.space === "hx-web-staging" && item.slug === "hx-web-deployment");
    upsertUnit(expected, inputs, payloadFiles, state, {
      payloadKey: "hx-web/staging/hx-web-deployment/departure",
    });
    publishRelease("hx-web-staging", state, { force: true });
    waitForApplication("hx-app-staging", "hx-web-staging", ["Healthy"]);
  });

  scenarioStep("departure-survives-promotion", () => {
    const baseDeployment = baseUnits.find((item) => item.slug === "hx-web-deployment");
    upsertUnit(baseDeployment, inputs, payloadFiles, state, {
      payloadKey: "hx-web/base/hx-web-deployment/v2",
    });
    promoteAndPublish("hx-web-dev", state);
    promoteAndPublish("hx-web-staging", state);
    const finalSteps = verifyHxWebFinalState(inputs);
    check(finalSteps.every((item) => item.result === "pass"), "hx-web final scenario verification failed");
  });

  // Promotion deliberately tests the server-side merge before this metadata
  // normalization. Once the departures have survived, reconcile the exact
  // committed provenance annotations without changing the proven data.
  for (const expected of desired.managedUnits.filter(
    (item) => item.space === "hx-web-base" || /^hx-web-(dev|staging|prod-a|prod-b)$/.test(item.space),
  )) upsertUnit(expected, inputs, payloadFiles, state);
  for (const deployment of desired.deployments.filter(
    (item) => item.type === "application" && /^hx-web-(dev|staging|prod-a|prod-b)$/.test(item.space),
  )) deployOne(deployment, state);

  for (const slug of ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)]) {
    cub(["space", "update", "--patch", slug, "--label", `ScenarioVersion=${SCENARIO_VERSION}`, "--quiet"]);
    recordAction(state, "scenario-marker", slug, SCENARIO_VERSION);
  }
}

function resetHxWebScenarioMergeBases(desired, state) {
  for (const fleetItem of FLEET) {
    const space = `hx-web-${fleetItem.suffix}`;
    const units = desired.managedUnits.filter((unit) => unit.space === space && unit.upstream);
    for (const unit of units) {
      const slug = `upgrade-${unit.slug}`;
      cub([
        "link", "update", slug, "--space", space,
        "--patch", "--make-current", "--quiet",
      ]);
      recordAction(state, "scenario-merge-base-reset", `${space}/${slug}`, "baseline heads marked current before deterministic replay");
    }
  }
}

function promoteAndPublish(space, state, { expectApprovalBlock = false } = {}) {
  cub([
    "variant", "promote", space,
    "--change-desc", `Promote ${SCENARIO_VERSION} while preserving downstream departures`,
    "--quiet",
  ], { timeout: 1_200_000 });
  recordAction(state, "variant-promote", space);
  state.changedSpaces.add(space);
  if (space.includes("prod-")) {
    if (expectApprovalBlock) {
      assertReleaseBlockedByApproval(space, state);
      return;
    }
    approveOutstanding(space, state);
  }
  publishRelease(space, state, { force: true });
  const targetItem = FLEET.find((item) => space.endsWith(item.suffix));
  waitForApplication(targetItem.cluster, space, ["Healthy"]);
}

function assertReleaseBlockedByApproval(space, state) {
  const result = cubTry(["release", "publish", space, "-o", "json"], { timeout: 1_200_000 });
  check(!result.ok, `${space}: production release unexpectedly published before approval`);
  check(
    /approval|apply.?gate|vet-approvedby|422/i.test(result.output),
    `${space}: release failed before approval without naming an approval gate: ${result.output.slice(0, 800)}`,
  );
  recordAction(state, "expected-approval-block", space, result.output.slice(0, 500));
}

function verifyHxWebFinalState(inputs) {
  const checks = [];
  const expectedBase = inputs.payloads.get("hx-web/base/hx-web-deployment/v2").value;
  const baseData = cub(["unit", "data", "--space", "hx-web-base", "hx-web-deployment"]);
  checks.push({
    id: "base-at-promotion-v2",
    result: sameUnitData("Kubernetes/YAML", baseData, expectedBase) ? "pass" : "fail",
  });
  for (const item of FLEET) {
    const space = `hx-web-${item.suffix}`;
    const actual = cub(["unit", "data", "--space", space, "hx-web-deployment"]);
    const expected = inputs.payloads.get(`hx-web/${item.suffix}/hx-web-deployment/final`).value;
    checks.push({
      id: `${item.suffix}-final-state`,
      result: sameUnitData("Kubernetes/YAML", actual, expected) ? "pass" : "fail",
      departure: item.suffix === "staging"
        ? "SANDBOX_URL"
        : item.suffix === "prod-a"
          ? "replicas=2 rollback"
          : "none",
    });
  }
  check(checks.every((item) => item.result === "pass"), `hx-web final scenario drift:\n${stableJson(checks)}`);
  return checks;
}

function approveOutstanding(space, state) {
  const rows = readUnitRows(space);
  const outstanding = rows.filter(hasApprovalGate);
  if (outstanding.length === 0) return;
  cub([
    "unit", "approve", "--space", space,
    ...outstanding.flatMap((unit) => ["--unit", unit.Slug]),
    "--revision", "HeadRevisionNum",
    "--wait", "--quiet",
  ]);
  recordAction(state, "unit-approve", space, `${outstanding.length} Unit(s)`);
  const after = readUnitRows(space);
  const outstandingSlugs = new Set(outstanding.map((unit) => unit.Slug));
  check(after.filter((unit) => outstandingSlugs.has(unit.Slug)).every((unit) => !hasApprovalGate(unit)), `${space}: approval gate remained after approval`);
}

function hasApprovalGate(unit) {
  return Object.keys(unit?.ApplyGates ?? {}).some(
    (key) => key.includes("require-approval") || key === APPROVAL_GATE,
  );
}

function approvalCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value ? 1 : 0;
}

function deployOne(deployment, state) {
  ensureArgoApplication(deployment, state);
  if (state.changedSpaces.has(deployment.appSpace) || !hasRelease(deployment.appSpace)) {
    publishRelease(deployment.appSpace, state, { force: true });
  }
  if (deployment.space.includes("prod-")) approveOutstanding(deployment.space, state);
  if (state.changedSpaces.has(deployment.space) || !hasRelease(deployment.space)) {
    publishRelease(deployment.space, state, { force: true });
  }
  waitForApplication(deployment.cluster, deployment.space, deployment.acceptedHealth);
}

function hasRelease(space) {
  const result = cubTry(["release", "list", "--space", space, "--select", "Digest,CreatedAt", "-o", "json"]);
  if (!result.ok) return false;
  return unwrapRows(JSON.parse(result.output), "Release").length > 0;
}

function publishRelease(space, state, { force = false } = {}) {
  if (!force && !state.changedSpaces.has(space) && hasRelease(space)) return latestRelease(space);
  const output = cub(["release", "publish", space, "-o", "json"], { timeout: 1_200_000 });
  const value = JSON.parse(output);
  const release = unwrapEntity(value, "Release");
  const digest = release?.Digest ?? release?.Release?.Digest ?? latestRelease(space)?.Digest ?? "";
  recordAction(state, "release-publish", space, digest);
  state.published.set(space, digest);
  state.changedSpaces.delete(space);
  return release;
}

function latestRelease(space) {
  const rows = unwrapRows(cubJson(["release", "list", "--space", space, "--select", "Digest,CreatedAt"]), "Release");
  return rows.sort((left, right) => String(right.CreatedAt ?? "").localeCompare(String(left.CreatedAt ?? "")))[0] ?? null;
}

function kubectl(cluster, args, options = {}) {
  return command("kubectl", [
    "--kubeconfig", clusterKubeconfig(cluster),
    "--context", `kind-${cluster}`,
    ...args,
  ], options);
}

function kubectlTry(cluster, args, options = {}) {
  return tryCommand("kubectl", [
    "--kubeconfig", clusterKubeconfig(cluster),
    "--context", `kind-${cluster}`,
    ...args,
  ], options);
}

function waitForApplication(cluster, application, acceptedHealth) {
  let last = { sync: "Unknown", health: "Unknown", message: "not observed" };
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = kubectlTry(cluster, ["get", "application", application, "-n", "argocd", "-o", "json"]);
    if (result.ok) {
      const value = JSON.parse(result.output);
      last = {
        sync: value.status?.sync?.status ?? "Unknown",
        health: value.status?.health?.status ?? "Unknown",
        message: value.status?.conditions?.map((item) => item.message).join("; ") ?? "",
      };
      if (last.sync === "Synced" && acceptedHealth.includes(last.health)) return last;
    }
    command("sleep", ["5"]);
  }
  check(false, `${cluster}/${application}: expected Synced and health ${acceptedHealth.join("|")}, got ${stableJson(last)}`);
}

function waitForSpecialPrerequisite(deployment) {
  if (deployment.space === "hx-eso-store-dev") {
    kubectl(DEV.cluster, ["wait", "--for=condition=Ready", "clustersecretstore/hx-app-dev-dev", "--timeout=5m"]);
  }
  if (deployment.space === "hx-eso-grafana-es-dev") {
    kubectl(DEV.cluster, ["wait", "--for=condition=Ready", "externalsecret/grafana-admin-credentials-es", "-n", "kube-prometheus-stack", "--timeout=5m"]);
    const secret = JSON.parse(kubectl(DEV.cluster, ["get", "secret", "grafana-admin-credentials", "-n", "kube-prometheus-stack", "-o", "json"]));
    check(
      (secret.metadata?.ownerReferences ?? []).some(
        (owner) => owner.apiVersion === "external-secrets.io/v1"
          && owner.kind === "ExternalSecret"
          && owner.name === "grafana-admin-credentials-es"
          && owner.controller === true,
      ),
      "Grafana credentials Secret is not owned by the expected ExternalSecret",
    );
  }
}

function reconcileLinks(desired, state) {
  for (const expected of desired.links) {
    const existing = readLinks(expected.space).find((item) => item.Slug === expected.slug);
    if (!existing) {
      cub([
        "link", "create", "--space", expected.space,
        expected.slug, expected.fromUnit, expected.toUnit, expected.toSpace,
        "--update-type", "NeedsProvides",
        "--make-current",
        "--no-auto-update",
        "--annotation", `${LINK_REASON_ANNOTATION}=${expected.reason}`,
        "--label", `ExampleCohort=${EXAMPLE_COHORT}`,
        "--wait", "--quiet",
      ]);
      recordAction(state, "link-create", `${expected.space}/${expected.slug}`, `${expected.toSpace}/${expected.toUnit}`);
      continue;
    }
    const from = readUnit(expected.space, expected.fromUnit);
    const to = readUnit(expected.toSpace, expected.toUnit);
    const toSpace = unwrapEntity(cubJson(["space", "get", expected.toSpace]), "Space");
    check(from && to, `${expected.space}/${expected.slug}: endpoint Unit missing`);
    if (
      existing.FromUnitID !== from.UnitID
      || existing.ToUnitID !== to.UnitID
      || existing.ToSpaceID !== toSpace.SpaceID
      || existing.UpdateType !== "NeedsProvides"
      || existing.AutoUpdate === true
      || existing.Labels?.ExampleCohort !== EXAMPLE_COHORT
      || existing.Annotations?.[LINK_REASON_ANNOTATION] !== expected.reason
    ) {
      cub([
        "link", "update", "--space", expected.space,
        expected.slug, expected.fromUnit, expected.toUnit, expected.toSpace,
        "--update-type", "NeedsProvides",
        "--make-current",
        "--no-auto-update",
        "--annotation", `${LINK_REASON_ANNOTATION}=${expected.reason}`,
        "--label", `ExampleCohort=${EXAMPLE_COHORT}`,
        "--wait", "--quiet",
      ]);
      recordAction(state, "link-update", `${expected.space}/${expected.slug}`, `${expected.toSpace}/${expected.toUnit}`);
    }
  }
}

function verifyLive(inputs, desired, { state = null } = {}) {
  assertKubaraOrganization();
  const findings = [];
  const spaces = readSpaces();
  assertSpaceAllowlist(spaces, desired, { requireAll: true });
  assertDeliveryTopology(spaces, desired, { requireAllApplications: true });
  assertManagedLinkInventory(desired, { requireNeedsProvides: true });
  const preservedControlUnits = assertPreservedFaithfulControlUnits();
  const localClusters = new Set(kindClusters());
  const targets = new Map();
  for (const item of FLEET) {
    if (!localClusters.has(item.cluster)) findings.push(`${item.cluster}: kind cluster missing`);
    if (!existsSync(clusterKubeconfig(item.cluster))) findings.push(`${item.cluster}: kubeconfig missing`);
    if (!existsSync(clusterEnv(item.cluster))) findings.push(`${item.cluster}: env file missing`);
    const targetEntity = readTarget(item.cluster);
    if (!targetEntity) findings.push(`${item.cluster}/target: missing`);
    else targets.set(item.cluster, targetEntity);
  }

  const spaceRows = [];
  for (const expected of desired.spaces) {
    const live = spaces.get(expected.slug);
    if (!live) {
      findings.push(`${expected.slug}: Space missing`);
      continue;
    }
    for (const [key, value] of Object.entries(expected.labels)) {
      if (live.Labels?.[key] !== value) findings.push(`${expected.slug}: label ${key}=${JSON.stringify(live.Labels?.[key])}, expected ${JSON.stringify(value)}`);
    }
    for (const key of staleOwnedLabels(live.Labels, expected.labels)) findings.push(`${expected.slug}: stale owned label ${key}`);
    spaceRows.push({
      slug: expected.slug,
      id: live.SpaceID,
      type: expected.type,
      labels: expected.labels,
      releaseTargetID: live.ReleaseTargetID ?? null,
      triggerFilterID: live.TriggerFilterID ?? null,
    });
  }

  const unitRows = [];
  const expectedUnitsBySpace = new Map();
  for (const expected of desired.managedUnits) {
    if (!expected.payloadKey) {
      findings.push(`${expected.space}/${expected.slug}: planned payload missing`);
      continue;
    }
    if (!expectedUnitsBySpace.has(expected.space)) expectedUnitsBySpace.set(expected.space, []);
    expectedUnitsBySpace.get(expected.space).push(expected.slug);
    const live = readUnit(expected.space, expected.slug);
    if (!live) {
      findings.push(`${expected.space}/${expected.slug}: Unit missing`);
      continue;
    }
    const payload = inputs.payloads.get(expected.payloadKey);
    if (!payload) {
      findings.push(`${expected.space}/${expected.slug}: payload ${expected.payloadKey} missing`);
      continue;
    }
    if (live.ToolchainType !== expected.toolchain) findings.push(`${expected.space}/${expected.slug}: toolchain ${live.ToolchainType}, expected ${expected.toolchain}`);
    if ((live.ProviderType ?? null) !== (expected.provider ?? null)) findings.push(`${expected.space}/${expected.slug}: provider ${live.ProviderType ?? "default"}, expected ${expected.provider ?? "default"}`);
    if (!mapMatches(live.Labels, expected.labels)) findings.push(`${expected.space}/${expected.slug}: labels drifted`);
    const annotations = sourceAnnotation(payload.value, payload.sourcePaths, payload.transform);
    if (!mapMatches(live.Annotations, annotations)) findings.push(`${expected.space}/${expected.slug}: source annotations drifted`);
    const liveData = cub(["unit", "data", "--space", expected.space, expected.slug]);
    if (!sameUnitData(expected.toolchain, liveData, payload.value)) findings.push(`${expected.space}/${expected.slug}: data drifted from ${expected.payloadKey}`);
    if (expected.target) {
      const cluster = expected.target.split("/")[0];
      if (live.TargetID !== targets.get(cluster)?.TargetID) findings.push(`${expected.space}/${expected.slug}: target drifted`);
    } else if (live.TargetID) {
      findings.push(`${expected.space}/${expected.slug}: base/control Unit unexpectedly has a target`);
    }
    if (expected.upstream) {
      const [upstreamSpace, upstreamSlug] = expected.upstream.split("/");
      const upstream = readUnit(upstreamSpace, upstreamSlug);
      if (!upstream || live.UpstreamUnitID !== upstream.UnitID) findings.push(`${expected.space}/${expected.slug}: upstream link is not ${expected.upstream}`);
    }
    if (expected.prodProtected) {
      if (!gateEnabled(live.DeleteGates, PROD_SAFETY_GATE)) findings.push(`${expected.space}/${expected.slug}: delete gate missing`);
      if (!gateEnabled(live.DestroyGates, PROD_SAFETY_GATE)) findings.push(`${expected.space}/${expected.slug}: destroy gate missing`);
    }
    unitRows.push({
      ref: `${expected.space}/${expected.slug}`,
      id: live.UnitID,
      role: expected.role,
      toolchain: live.ToolchainType,
      provider: live.ProviderType ?? null,
      targetID: live.TargetID ?? null,
      upstreamUnitID: live.UpstreamUnitID ?? null,
      headRevisionNum: live.HeadRevisionNum,
      dataHash: live.DataHash,
      sourceSha256: `sha256:${payload.sha256}`,
    });
  }
  for (const [space, expectedSlugs] of expectedUnitsBySpace) {
    const actual = readUnitRows(space).map((item) => item.Slug).sort();
    const allowedSlugs = space === CONTROL_SPACE
      ? [...expectedSlugs, ...PRESERVED_FAITHFUL_CONTROL_UNITS.map((item) => item.slug)].sort()
      : expectedSlugs.sort();
    if (stableJson(actual) !== stableJson(allowedSlugs)) findings.push(`${space}: unexpected managed Unit inventory ${actual.join(", ")}`);
  }

  const policy = verifyPolicy(desired, findings);
  const linkRows = verifyLinks(desired, findings);
  const releases = [];
  const applications = [];
  for (const deployment of desired.deployments) {
    const release = latestRelease(deployment.space);
    if (!release || !/^sha256:[0-9a-f]{64}$/.test(release.Digest ?? "")) {
      findings.push(`${deployment.space}: published release digest missing`);
    } else {
      releases.push({ space: deployment.space, id: release.ReleaseID, digest: release.Digest, createdAt: release.CreatedAt });
    }
    const appUnit = readUnit(deployment.appSpace, deployment.appUnit);
    if (!appUnit) {
      findings.push(`${deployment.appSpace}/${deployment.appUnit}: Argo Application Unit missing`);
      continue;
    }
    if (appUnit.TargetID !== targets.get(deployment.cluster)?.TargetID) {
      findings.push(`${deployment.appSpace}/${deployment.appUnit}: target drifted`);
    }
    const appDocs = parseDocs(cub(["unit", "data", "--space", deployment.appSpace, deployment.appUnit]));
    const app = appDocs[0];
    try {
      assertArgoApplicationContract(app, deployment);
    } catch (error) {
      findings.push(error.message);
    }
    const options = app?.spec?.syncPolicy?.syncOptions ?? [];
    if (options.some((item) => String(item).startsWith("Replace="))) findings.push(`${deployment.appSpace}/${deployment.appUnit}: Replace sync option remains`);
    if (deployment.serverSideApply && stableJson(options) !== stableJson(["ServerSideApply=true"])) findings.push(`${deployment.appSpace}/${deployment.appUnit}: expected only ServerSideApply=true`);
    if (!deployment.serverSideApply && options.length !== 0) findings.push(`${deployment.appSpace}/${deployment.appUnit}: unexpected sync options ${stableJson(options)}`);
    const expectedSyncPolicy = {
      automated: { selfHeal: true, allowEmpty: true },
      ...(deployment.serverSideApply ? { syncOptions: ["ServerSideApply=true"] } : {}),
    };
    if (stableJson(app?.spec?.syncPolicy) !== stableJson(expectedSyncPolicy)) findings.push(`${deployment.appSpace}/${deployment.appUnit}: automated sync policy drifted`);
    if (stableJson(app?.spec?.destination) !== stableJson({ server: "https://kubernetes.default.svc" })) findings.push(`${deployment.appSpace}/${deployment.appUnit}: destination contract drifted`);
    const ignoreDifferences = app?.spec?.ignoreDifferences ?? [];
    if (deployment.ignoreInjectedCertificateData && stableJson(ignoreDifferences) !== stableJson(certificateIgnoreDifferences())) findings.push(`${deployment.appSpace}/${deployment.appUnit}: certificate ignoreDifferences drifted`);
    if (!deployment.ignoreInjectedCertificateData && ignoreDifferences.length !== 0) findings.push(`${deployment.appSpace}/${deployment.appUnit}: unexpected ignoreDifferences`);
    const observed = readApplication(deployment.cluster, deployment.space);
    if (!observed.exists) {
      findings.push(`${deployment.cluster}/${deployment.space}: Argo Application missing`);
    } else {
      if (observed.sync !== "Synced") findings.push(`${deployment.cluster}/${deployment.space}: sync=${observed.sync}`);
      if (!deployment.acceptedHealth.includes(observed.health)) findings.push(`${deployment.cluster}/${deployment.space}: health=${observed.health}, expected ${deployment.acceptedHealth.join("|")}`);
    }
    applications.push({
      cluster: deployment.cluster,
      name: deployment.space,
      syncState: observed.sync,
      healthState: observed.health,
      acceptedHealth: deployment.acceptedHealth,
      conditions: observed.conditions,
    });
  }

  let scenario = [];
  try {
    for (const slug of ["hx-web-base", ...FLEET.map((item) => `hx-web-${item.suffix}`)]) {
      if (spaces.get(slug)?.Labels?.ScenarioVersion !== SCENARIO_VERSION) findings.push(`${slug}: scenario marker ${SCENARIO_VERSION} missing`);
    }
    scenario = verifyHxWebFinalState(inputs);
  } catch (error) {
    findings.push(error.message);
  }
  const secretWiring = observeGrafanaSecretWiring(findings);
  const liveMatrix = observeLiveMatrix(inputs, desired, applications);
  for (const row of liveMatrix.rows.filter((item) => item.deliveryState === "delivered")) {
    if (row.syncState !== "Synced") findings.push(`matrix ${row.cluster}/${row.component}: sync=${row.syncState}`);
    if (row.readiness?.result === "fail") findings.push(`matrix ${row.cluster}/${row.component}: workloads not ready`);
  }

  check(findings.length === 0, `Kubara mini-IDP verification failed:\n- ${findings.join("\n- ")}`);
  return {
    organizationID: spaceRows[0]?.id ? spaces.get(CONTROL_SPACE).OrganizationID : "",
    spaces: spaceRows,
    units: unitRows,
    preservedControlUnits,
    links: linkRows,
    policy,
    releases,
    applications,
    scenario,
    secretWiring,
    liveMatrix,
    clusters: FLEET.map((item) => ({
      name: item.cluster,
      environment: item.environment,
      region: item.region,
      kind: localClusters.has(item.cluster),
      kubeconfig: existsSync(clusterKubeconfig(item.cluster)),
      targetID: targets.get(item.cluster)?.TargetID ?? null,
      spaceID: spaces.get(item.cluster)?.SpaceID ?? null,
      appsSpaceID: spaces.get(`${item.cluster}-argo-apps`)?.SpaceID ?? null,
    })),
    actionCount: state?.actions.length ?? 0,
  };
}

function observeGrafanaSecretWiring(findings) {
  const read = (args, ref) => {
    const result = kubectlTry(DEV.cluster, [...args, "-o", "json"]);
    if (!result.ok) {
      findings.push(`${ref}: missing (${result.output.slice(0, 300)})`);
      return null;
    }
    return JSON.parse(result.output);
  };
  const ready = (resource) => (resource?.status?.conditions ?? []).some(
    (condition) => condition.type === "Ready" && condition.status === "True",
  );
  const store = read(["get", "clustersecretstore", "hx-app-dev-dev"], "ClusterSecretStore/hx-app-dev-dev");
  const externalSecret = read(
    ["get", "externalsecret", "grafana-admin-credentials-es", "-n", "kube-prometheus-stack"],
    "ExternalSecret/kube-prometheus-stack/grafana-admin-credentials-es",
  );
  const secret = read(
    ["get", "secret", "grafana-admin-credentials", "-n", "kube-prometheus-stack"],
    "Secret/kube-prometheus-stack/grafana-admin-credentials",
  );
  const owner = (secret?.metadata?.ownerReferences ?? []).find(
    (item) => item.apiVersion === "external-secrets.io/v1"
      && item.kind === "ExternalSecret"
      && item.name === "grafana-admin-credentials-es"
      && item.controller === true,
  );
  if (store && !ready(store)) findings.push("ClusterSecretStore/hx-app-dev-dev: Ready is not True");
  if (externalSecret && !ready(externalSecret)) findings.push("ExternalSecret/kube-prometheus-stack/grafana-admin-credentials-es: Ready is not True");
  if (externalSecret?.spec?.secretStoreRef?.kind !== "ClusterSecretStore" || externalSecret?.spec?.secretStoreRef?.name !== "hx-app-dev-dev") {
    findings.push("ExternalSecret/kube-prometheus-stack/grafana-admin-credentials-es: store reference drifted");
  }
  if (externalSecret?.spec?.target?.name !== "grafana-admin-credentials" || externalSecret?.spec?.target?.creationPolicy !== "Owner") {
    findings.push("ExternalSecret/kube-prometheus-stack/grafana-admin-credentials-es: target contract drifted");
  }
  if (secret && !owner) findings.push("Secret/kube-prometheus-stack/grafana-admin-credentials: ESO owner reference missing");
  for (const key of ["admin-user", "admin-password"]) {
    if (secret && !secret.data?.[key]) findings.push(`Secret/kube-prometheus-stack/grafana-admin-credentials: ${key} data missing`);
  }
  return {
    cluster: DEV.cluster,
    store: { name: "hx-app-dev-dev", ready: ready(store) },
    externalSecret: {
      namespace: "kube-prometheus-stack",
      name: "grafana-admin-credentials-es",
      ready: ready(externalSecret),
      storeRef: externalSecret?.spec?.secretStoreRef ?? null,
      target: externalSecret?.spec?.target?.name ?? null,
    },
    secret: {
      namespace: "kube-prometheus-stack",
      name: "grafana-admin-credentials",
      ownerKind: owner?.kind ?? null,
      ownerName: owner?.name ?? null,
      keysPresent: ["admin-user", "admin-password"].filter((key) => Boolean(secret?.data?.[key])).sort(),
    },
  };
}

function verifyPolicy(desired, findings) {
  const triggerResult = cubTry(["trigger", "get", "--space", CONTROL_SPACE, APPROVAL_TRIGGER, "-o", "json"]);
  const filterResult = cubTry(["filter", "get", "--space", CONTROL_SPACE, APPROVAL_FILTER, "-o", "json"]);
  if (!triggerResult.ok) findings.push(`${CONTROL_SPACE}/${APPROVAL_TRIGGER}: Trigger missing`);
  if (!filterResult.ok) findings.push(`${CONTROL_SPACE}/${APPROVAL_FILTER}: Filter missing`);
  if (!triggerResult.ok || !filterResult.ok) return {};
  const trigger = unwrapEntity(JSON.parse(triggerResult.output), "Trigger");
  const filter = unwrapEntity(JSON.parse(filterResult.output), "Filter");
  const triggerArgumentsExact = stableJson(trigger.Arguments ?? []) === stableJson([
    { ParameterName: "num-approvers", Value: "1" },
  ]);
  if (
    trigger.FunctionName !== "vet-approvedby"
    || trigger.Event !== "Mutation"
    || trigger.ToolchainType !== "Kubernetes/YAML"
    || !triggerArgumentsExact
    || trigger.Disabled === true
    || trigger.Validating !== true
    || Number(trigger.FailOpenAfter ?? 0) !== 0
  ) findings.push(`${CONTROL_SPACE}/${APPROVAL_TRIGGER}: Trigger definition drifted`);
  if (filter.From !== "Trigger" || filter.Where !== "Space.Slug = 'hx-platform' AND FunctionName = 'vet-approvedby'") findings.push(`${CONTROL_SPACE}/${APPROVAL_FILTER}: Filter definition drifted`);
  const productionSpaces = desired.spaces.filter((item) => item.prodProtected).map((item) => item.slug).sort();
  for (const slug of productionSpaces) {
    const space = unwrapEntity(cubJson(["space", "get", slug]), "Space");
    if (space.TriggerFilterID !== filter.FilterID) findings.push(`${slug}: production approval Filter not attached`);
    if (stableJson([...(space.TriggerIDs ?? [])].sort()) !== stableJson([trigger.TriggerID])) findings.push(`${slug}: approval Trigger selection is not exact`);
  }
  return {
    trigger: {
      ref: `${CONTROL_SPACE}/${APPROVAL_TRIGGER}`,
      id: trigger.TriggerID,
      function: trigger.FunctionName,
      arguments: trigger.Arguments,
    },
    filter: {
      ref: `${CONTROL_SPACE}/${APPROVAL_FILTER}`,
      id: filter.FilterID,
      where: filter.Where,
    },
    productionSpaces,
    gate: APPROVAL_GATE,
    deleteDestroyGate: PROD_SAFETY_GATE,
  };
}

function verifyLinks(desired, findings) {
  const rows = [];
  const spacesForLinkVerification = readSpaces();
  for (const expected of desired.links) {
    const live = readLinks(expected.space).find((item) => item.Slug === expected.slug);
    if (!live) {
      findings.push(`${expected.space}/${expected.slug}: NeedsProvides Link missing`);
      continue;
    }
    const from = readUnit(expected.space, expected.fromUnit);
    const to = readUnit(expected.toSpace, expected.toUnit);
    const toSpace = spacesForLinkVerification.get(expected.toSpace);
    if (!from || !to || !toSpace || live.FromUnitID !== from.UnitID || live.ToUnitID !== to.UnitID || live.ToSpaceID !== toSpace.SpaceID) findings.push(`${expected.space}/${expected.slug}: Link endpoint drifted`);
    if (live.UpdateType !== "NeedsProvides") findings.push(`${expected.space}/${expected.slug}: UpdateType=${live.UpdateType}`);
    if (live.AutoUpdate === true) findings.push(`${expected.space}/${expected.slug}: AutoUpdate must be false`);
    if (live.Labels?.ExampleCohort !== EXAMPLE_COHORT) findings.push(`${expected.space}/${expected.slug}: ExampleCohort label drifted`);
    if (live.Annotations?.[LINK_REASON_ANNOTATION] !== expected.reason) findings.push(`${expected.space}/${expected.slug}: wiring reason drifted`);
    rows.push({
      ref: `${expected.space}/${expected.slug}`,
      id: live.LinkID,
      from: `${expected.space}/${expected.fromUnit}`,
      to: `${expected.toSpace}/${expected.toUnit}`,
      updateType: live.UpdateType,
      autoUpdate: live.AutoUpdate === true,
      reason: expected.reason,
    });
  }
  return rows;
}

function readApplication(cluster, name) {
  const result = kubectlTry(cluster, ["get", "application", name, "-n", "argocd", "-o", "json"]);
  if (!result.ok) return { exists: false, sync: "Unknown", health: "Unknown", conditions: [result.output.slice(0, 500)] };
  const value = JSON.parse(result.output);
  return {
    exists: true,
    sync: value.status?.sync?.status ?? "Unknown",
    health: value.status?.health?.status ?? "Unknown",
    conditions: (value.status?.conditions ?? []).map((item) => ({ type: item.type, message: item.message })),
  };
}

function observeLiveMatrix(inputs, desired, applicationRows) {
  const applicationsByRef = new Map(applicationRows.map((item) => [`${item.cluster}/${item.name}`, item]));
  const componentDefinitions = [
    matrixComponent("argo-cd", EXPECTED_VERSIONS["argo-cd"], FLEET, [], { departure: "configHub-owned-argo-substitutes-kubara-wrapper", appNames: () => ["root"] }),
    matrixComponent("cert-manager", EXPECTED_VERSIONS["cert-manager"], FLEET, ["hx-cm"], { releaseInstance: "cert-manager", departure: "kind-self-signed-cluster-issuer" }),
    matrixComponent("external-secrets", EXPECTED_VERSIONS["external-secrets"], [DEV], ["hx-eso", "hx-eso-store", "hx-eso-grafana-es"], { releaseInstance: "external-secrets", departure: "kind-fake-provider-target-fact" }),
    matrixComponent("homer-dashboard", EXPECTED_VERSIONS["homer-dashboard"], [DEV], ["hx-homer"], { releaseInstance: "homer-dashboard" }),
    matrixComponent("kube-prometheus-stack", `${EXPECTED_VERSIONS["kube-prometheus-stack"]} + blackbox ${EXPECTED_VERSIONS["prometheus-blackbox-exporter"]}`, [DEV], ["hx-kps-crds", "hx-eso-grafana-es", "hx-kps-main"], { releaseInstance: "kube-prometheus-stack", departure: "crds-and-eso-secret-wiring-are-explicit-spaces" }),
    matrixComponent("metrics-server", EXPECTED_VERSIONS["metrics-server"], [DEV], ["hx-metrics"], { releaseInstance: "metrics-server" }),
    matrixComponent("traefik", EXPECTED_VERSIONS.traefik, FLEET, ["hx-traefik"], { releaseInstance: "traefik", departure: "kind-loadbalancer-may-remain-progressing" }),
    matrixComponent("hx-web", "digest-pinned fixture", FLEET, ["hx-web"], { namespace: "hx-web", departureFor: (item) => item.suffix === "staging" ? "staging-sandbox-url" : item.suffix === "prod-a" ? "one-target-rollback-replicas-2" : "none" }),
    matrixComponent("cubbychat", readYaml(absolute(paths.appSourceLock)).spec?.cubbychat?.upstream?.commit ?? "digest-pinned fixture", FLEET, ["hx-cubbychat"], { namespace: "cubbychat" }),
  ];
  const rows = [];
  for (const fleetItem of FLEET) {
    const workloads = clusterWorkloads(fleetItem.cluster);
    for (const component of componentDefinitions) {
      const selected = component.targets.some((item) => item.cluster === fleetItem.cluster);
      if (!selected) {
        rows.push({
          cluster: fleetItem.cluster,
          environment: fleetItem.environment,
          region: fleetItem.region,
          component: component.name,
          desiredVersion: component.desiredVersion,
          observedVersion: null,
          deliveryState: "not-selected",
          syncState: "NotApplicable",
          healthState: "NotApplicable",
          readiness: { result: "not-applicable", ready: 0, desired: 0 },
          departure: { id: "kubara-config-disabled", reason: "service is disabled for this cluster in the committed Kubara contract" },
          unknownReason: null,
        });
        continue;
      }
      const appNames = component.appNames
        ? component.appNames(fleetItem)
        : component.spacePrefixes.map((prefix) => `${prefix}-${fleetItem.suffix}`);
      const appStates = appNames.map((name) => applicationsByRef.get(`${fleetItem.cluster}/${name}`) ?? (name === "root" ? readApplication(fleetItem.cluster, name) : null)).filter(Boolean);
      const syncState = appStates.length && appStates.every((item) => item.syncState === "Synced" || item.sync === "Synced")
        ? "Synced"
        : distinct(appStates.map((item) => item.syncState ?? item.sync ?? "Unknown")).join("+") || "Unknown";
      const healthValues = appStates.map((item) => item.healthState ?? item.health ?? "Unknown");
      const healthState = healthValues.length && healthValues.every((item) => item === "Healthy")
        ? "Healthy"
        : distinct(healthValues).join("+") || "Unknown";
      const selectedWorkloads = selectComponentWorkloads(workloads, component);
      const readiness = readinessSummary(selectedWorkloads);
      const versions = observedWorkloadVersions(selectedWorkloads);
      const observedVersion = versions.length ? versions.join(" + ") : null;
      const departureId = component.departureFor?.(fleetItem) ?? component.departure ?? "none";
      const unknownReasons = [];
      if (!observedVersion) unknownReasons.push("selected version is pinned in ConfigHub provenance but not exposed by live workload labels");
      if (readiness.result === "unknown") unknownReasons.push("no matching Deployment, StatefulSet, or DaemonSet exposed readiness for this component");
      rows.push({
        cluster: fleetItem.cluster,
        environment: fleetItem.environment,
        region: fleetItem.region,
        component: component.name,
        desiredVersion: component.desiredVersion,
        observedVersion,
        deliveryState: "delivered",
        syncState,
        healthState,
        readiness,
        departure: departureId === "none" ? null : { id: departureId, reason: departureReason(departureId) },
        unknownReason: unknownReasons.length ? unknownReasons.join("; ") : null,
        evidence: {
          applications: appNames,
          workloadRefs: selectedWorkloads.map(workloadRef),
        },
      });
    }
  }
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "KubaraMiniIDPLiveMatrixObservation",
    desiredSource: paths.componentArtifacts,
    observationMode: "kubectl-and-confighub-live-read",
    rowCount: rows.length,
    rows,
  };
}

function matrixComponent(name, desiredVersion, targets, spacePrefixes, extra = {}) {
  return { name, desiredVersion, targets, spacePrefixes, ...extra };
}

function clusterWorkloads(cluster) {
  const result = kubectlTry(cluster, ["get", "deployment,statefulset,daemonset", "-A", "-o", "json"]);
  check(result.ok, `${cluster}: unable to read workload readiness: ${result.output}`);
  return JSON.parse(result.output).items ?? [];
}

function selectComponentWorkloads(workloads, component) {
  if (component.namespace) return workloads.filter((item) => item.metadata?.namespace === component.namespace);
  if (component.name === "argo-cd") return workloads.filter((item) => item.metadata?.namespace === "argocd");
  const instance = component.releaseInstance;
  if (!instance) return [];
  return workloads.filter((item) => {
    const labels = {
      ...(item.spec?.template?.metadata?.labels ?? {}),
      ...(item.metadata?.labels ?? {}),
    };
    return labels["app.kubernetes.io/instance"] === instance
      || labels.release === instance
      || labels["app.kubernetes.io/name"] === instance;
  });
}

function readinessSummary(workloads) {
  const statuses = workloads.map((item) => {
    if (item.kind === "Deployment") {
      const desired = item.spec?.replicas ?? 1;
      const ready = item.status?.availableReplicas ?? 0;
      return { ref: workloadRef(item), desired, ready, result: ready >= desired ? "pass" : "fail" };
    }
    if (item.kind === "StatefulSet") {
      const desired = item.spec?.replicas ?? 1;
      const ready = item.status?.readyReplicas ?? 0;
      return { ref: workloadRef(item), desired, ready, result: ready >= desired ? "pass" : "fail" };
    }
    const desired = item.status?.desiredNumberScheduled ?? 0;
    const ready = item.status?.numberReady ?? 0;
    return { ref: workloadRef(item), desired, ready, result: desired > 0 && ready >= desired ? "pass" : "fail" };
  });
  return {
    result: statuses.length === 0 ? "unknown" : statuses.every((item) => item.result === "pass") ? "pass" : "fail",
    ready: statuses.reduce((sum, item) => sum + item.ready, 0),
    desired: statuses.reduce((sum, item) => sum + item.desired, 0),
    workloads: statuses,
  };
}

function workloadRef(item) {
  return `${item.kind}/${item.metadata?.namespace ?? ""}/${item.metadata?.name ?? ""}`;
}

function observedWorkloadVersions(workloads) {
  const labels = [];
  for (const item of workloads) {
    const workloadLabels = {
      ...(item.spec?.template?.metadata?.labels ?? {}),
      ...(item.metadata?.labels ?? {}),
    };
    if (workloadLabels["helm.sh/chart"]) labels.push(workloadLabels["helm.sh/chart"]);
    else if (workloadLabels["app.kubernetes.io/version"]) labels.push(workloadLabels["app.kubernetes.io/version"]);
  }
  if (labels.length) return distinct(labels).sort();
  return distinct(workloads.flatMap((item) => [
    ...(item.spec?.template?.spec?.initContainers ?? []),
    ...(item.spec?.template?.spec?.containers ?? []),
  ].map((container) => container.image))).sort();
}

function distinct(values) {
  return [...new Set(values.filter(Boolean))];
}

function departureReason(id) {
  return {
    "configHub-owned-argo-substitutes-kubara-wrapper": "ConfigHub takes the hub role; each cluster keeps its familiar local Argo reconciler.",
    "kind-self-signed-cluster-issuer": "The reproducible kind lane uses a self-signed ClusterIssuer instead of public ACME.",
    "kind-fake-provider-target-fact": "The demo uses ESO's fake provider; production must select a real backend without changing the wiring contract.",
    "crds-and-eso-secret-wiring-are-explicit-spaces": "CRD lifecycle and Grafana secret production are separately governed and visibly linked.",
    "kind-loadbalancer-may-remain-progressing": "The Traefik LoadBalancer has no cloud load balancer on kind; workload readiness is evaluated separately.",
    "staging-sandbox-url": "Staging keeps its SANDBOX_URL departure through the second upstream promotion.",
    "one-target-rollback-replicas-2": "prod-a is intentionally rolled back to two replicas while prod-b remains at three.",
  }[id] ?? id;
}

function sourceEvidence() {
  return Object.fromEntries(Object.entries(paths).map(([name, relative]) => [name, {
    path: relative,
    sha256: existsSync(absolute(relative)) ? `sha256:${sha256File(absolute(relative))}` : null,
  }]));
}

function buildReceipt(inputs, desired, observation, state) {
  const previous = readPriorReceipt();
  const previousRuns = previous?.kind === "ConfigHubKubaraMiniIDPReconcileReceipt"
    ? previous.spec?.reconcileRuns ?? []
    : [];
  const run = {
    observedAt: new Date().toISOString(),
    actionCount: state.actions.length,
    result: "pass",
    idempotentNoop: state.actions.length === 0,
  };
  const allRuns = [...previousRuns, run];
  const firstChangedRun = allRuns.find((item) => item.idempotentNoop === false && item.actionCount > 0) ?? null;
  const reconcileRuns = distinctRuns([
    ...(firstChangedRun ? [firstChangedRun] : []),
    ...allRuns.slice(-4),
  ]).slice(-5);
  const idempotentRerunProven = Boolean(firstChangedRun) && reconcileRuns.length >= 2 && run.idempotentNoop;
  const priorScenario = previous?.kind === "ConfigHubKubaraMiniIDPReconcileReceipt"
    && previous.spec?.rolloutScenario?.version === SCENARIO_VERSION
    ? previous.spec.rolloutScenario
    : null;
  const operationSteps = state.scenario.mode === "retained-proven-history" && priorScenario?.steps?.length
    ? priorScenario.steps
    : state.scenario.steps;
  const operationEvidence = state.scenario.mode === "retained-proven-history" && priorScenario?.operationEvidence?.length
    ? priorScenario.operationEvidence
    : state.actions.filter((item) => [
      "variant-promote",
      "expected-approval-block",
      "unit-approve",
      "rollback",
    ].includes(item.type));
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ConfigHubKubaraMiniIDPReconcileReceipt",
    metadata: { name: "kubara-v0-13-0-confighub-mini-idp" },
    spec: {
      organization: { name: ORGANIZATION, entityID: observation.organizationID },
      source: {
        kubaraVersion: KUBARA_VERSION,
        catalogVersion: CATALOG_VERSION,
        exactVersionPolicy: "fail-if-missing",
        retentionPolicy: "additive-only",
        files: sourceEvidence(),
      },
      execution: {
        deterministic: true,
        aiRequired: false,
        mutationGuardConsulted: false,
        destructiveOperations: [],
        persistentClustersPreserved: FLEET.map((item) => item.cluster),
        partialClusterStatePolicy: "fail",
        serialLiveParityLock: true,
        unexpectedSpacePolicy: "fail-outside-exact-53-space-allowlist",
        unexpectedManagedUnitOrLinkPolicy: "fail",
        preservedControlUnitPolicy: "exact-receipt-bound-faithful-proof-units",
        interruptedScenarioPolicy: "reset UpgradeUnit merge bases to the committed initial payloads, then replay",
        receiptRequiresZeroActionRerun: true,
        cub: cachedCubVersions,
        delivery: "ConfigHub variant/OCI -> ConfigHub-owned Argo CD/argobot",
        topologyClaim: "ConfigHub takes the hub role; every cluster keeps a local reconciler",
      },
      counts: {
        spaces: observation.spaces.length,
        managedUnits: observation.units.length,
        preservedFaithfulControlUnits: observation.preservedControlUnits.length,
        deployments: desired.deployments.length,
        releases: observation.releases.length,
        needsProvidesLinks: observation.links.length,
        liveMatrixRows: observation.liveMatrix.rowCount,
      },
      clusters: observation.clusters,
      controls: observation.units.filter((item) => item.ref.startsWith(`${CONTROL_SPACE}/`)),
      preservedControlUnits: observation.preservedControlUnits,
      spaces: observation.spaces,
      units: observation.units,
      releases: observation.releases,
      applications: observation.applications,
      wiring: {
        sourceLedger: paths.wiring,
        updateType: "NeedsProvides",
        autoUpdate: false,
        links: observation.links,
        grafanaSecret: observation.secretWiring,
      },
      policy: observation.policy,
      rolloutScenario: {
        version: SCENARIO_VERSION,
        mode: state.scenario.mode,
        steps: operationSteps,
        operationEvidence,
        finalChecks: observation.scenario,
        claims: {
          basePromotion: "pass",
          productionApproval: "pass",
          oneProductionRollback: "pass",
          stagingDepartureSurvivedPromotion: "pass",
        },
      },
      liveMatrix: observation.liveMatrix,
      reconcileRuns,
      lastActions: state.actions,
    },
    status: {
      result: idempotentRerunProven ? "pass" : "pending-idempotence",
      observedAt: run.observedAt,
      cleanRoomReproducible: idempotentRerunProven,
      idempotentRerunProven,
      fullCurrentSelectionDelivered: true,
      applicationsDelivered: ["hx-web", "cubbychat"],
      historicalCatalogRootsPreserved: true,
      limits: [
        "This is the adapted ConfigHub lane. The separate faithful-lane receipt proves Kubara's one-hub Argo topology against a spoke.",
        "ConfigHub-owned Argo CD and argobot replace Kubara's selected Argo wrapper in the adapted lane; the cluster-local reconciliation shape remains.",
        "The kind proof uses a self-signed issuer and ESO's fake provider with demo credentials. Production adoption must select public/private PKI and a real secret backend.",
        "Traefik's LoadBalancer may remain Argo Progressing on kind without a cloud load balancer; workload readiness and sync are recorded separately.",
        "The reconciler replays promotion/rollback/departure history only for a clean or unmarked hx-web tree; marked reruns verify and reconcile the deterministic final state.",
      ],
    },
  };
}

function distinctRuns(runs) {
  const seen = new Set();
  return runs.filter((run) => {
    const key = `${run.observedAt ?? ""}/${run.actionCount ?? ""}/${run.idempotentNoop ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function verifyReceipt(inputs, desired) {
  check(existsSync(RECEIPT_PATH), `${relativeRepo(RECEIPT_PATH)} is missing; run --apply after all live prerequisites pass`);
  const receipt = readYaml(RECEIPT_PATH);
  check(receipt.kind === "ConfigHubKubaraMiniIDPReconcileReceipt", "mini-IDP receipt kind drifted");
  check(receipt.spec?.organization?.name === ORGANIZATION, "mini-IDP receipt organization drifted");
  check(UUID_PATTERN.test(receipt.spec?.organization?.entityID ?? ""), "mini-IDP receipt organization ID is missing");
  check(receipt.spec?.source?.kubaraVersion === KUBARA_VERSION, "mini-IDP receipt Kubara version drifted");
  check(receipt.spec?.source?.catalogVersion === CATALOG_VERSION, "mini-IDP receipt catalog version drifted");
  check(receipt.spec?.source?.exactVersionPolicy === "fail-if-missing", "mini-IDP exact-version policy drifted");
  check(receipt.spec?.source?.retentionPolicy === "additive-only", "mini-IDP retention policy drifted");
  for (const [name, evidence] of Object.entries(sourceEvidence())) {
    const stored = receipt.spec?.source?.files?.[name];
    check(stored?.path === evidence.path, `mini-IDP receipt source path ${name} drifted`);
    check(stored?.sha256 === evidence.sha256, `mini-IDP receipt source digest ${name} is stale`);
  }
  check(
    !Object.values(receipt.spec?.source?.files ?? {}).some((item) => item?.path === MATRIX_PUBLICATION_PATH),
    `mini-IDP receipt must not source-digest receipt-derived publication ${MATRIX_PUBLICATION_PATH}`,
  );
  check(receipt.spec?.execution?.deterministic === true, "mini-IDP receipt must declare deterministic execution");
  check(receipt.spec?.execution?.aiRequired === false, "AI must not be required for mini-IDP reconciliation");
  check(receipt.spec?.execution?.mutationGuardConsulted === false, "mutation guard should remain outside this explicitly authorized reconciler");
  check((receipt.spec?.execution?.destructiveOperations ?? []).length === 0, "mini-IDP receipt records a destructive operation");
  check(stableJson(receipt.spec?.execution?.persistentClustersPreserved) === stableJson(FLEET.map((item) => item.cluster)), "persistent cluster allowlist drifted");
  check(receipt.spec?.execution?.partialClusterStatePolicy === "fail", "mini-IDP receipt no longer fails on partial persistent-cluster state");
  check(receipt.spec?.execution?.serialLiveParityLock === true, "mini-IDP receipt no longer records the shared serial live-parity lock");
  check(receipt.spec?.execution?.unexpectedSpacePolicy === "fail-outside-exact-53-space-allowlist", "mini-IDP receipt no longer enforces the exact Space allowlist");
  check(receipt.spec?.execution?.unexpectedManagedUnitOrLinkPolicy === "fail", "mini-IDP receipt no longer rejects unexpected managed Units or Links");
  check(
    receipt.spec?.execution?.preservedControlUnitPolicy === "exact-receipt-bound-faithful-proof-units",
    "mini-IDP receipt no longer binds its preserved faithful proof Units exactly",
  );
  check(receipt.spec?.execution?.receiptRequiresZeroActionRerun === true, "mini-IDP receipt no longer requires a zero-action rerun");
  check(receipt.spec?.execution?.cub?.minimum === `v${MIN_CUB_VERSION}`, "mini-IDP receipt cub minimum-version contract drifted");
  check(versionAtLeast(String(receipt.spec?.execution?.cub?.client ?? "").replace(/^v/, ""), MIN_CUB_VERSION), "mini-IDP receipt cub client is too old");
  check(versionAtLeast(String(receipt.spec?.execution?.cub?.server ?? "").replace(/^v/, ""), MIN_CUB_VERSION), "mini-IDP receipt ConfigHub server is too old");

  const counts = receipt.spec?.counts ?? {};
  check(counts.spaces === desired.spaces.length, `receipt has ${counts.spaces} Spaces, expected ${desired.spaces.length}`);
  check(counts.managedUnits === desired.managedUnits.length, `receipt has ${counts.managedUnits} Units, expected ${desired.managedUnits.length}`);
  check(
    counts.preservedFaithfulControlUnits === PRESERVED_FAITHFUL_CONTROL_UNITS.length,
    `receipt has ${counts.preservedFaithfulControlUnits} preserved faithful Units, expected ${PRESERVED_FAITHFUL_CONTROL_UNITS.length}`,
  );
  check(counts.deployments === desired.deployments.length, `receipt has ${counts.deployments} deployments, expected ${desired.deployments.length}`);
  check(counts.releases === desired.deployments.length, `receipt has ${counts.releases} releases, expected ${desired.deployments.length}`);
  check(counts.needsProvidesLinks === desired.links.length, `receipt has ${counts.needsProvidesLinks} Links, expected ${desired.links.length}`);
  check(counts.liveMatrixRows === FLEET.length * 9, `receipt live matrix has ${counts.liveMatrixRows} rows, expected ${FLEET.length * 9}`);

  const spaceRows = receipt.spec?.spaces ?? [];
  check(spaceRows.length === desired.spaces.length, "receipt Space rows are incomplete");
  const spacesBySlug = new Map(spaceRows.map((item) => [item.slug, item]));
  for (const expected of desired.spaces) {
    const row = spacesBySlug.get(expected.slug);
    check(row, `receipt is missing Space ${expected.slug}`);
    check(UUID_PATTERN.test(row.id ?? ""), `${expected.slug}: receipt Space ID missing`);
    check(stableJson(row.labels) === stableJson(expected.labels), `${expected.slug}: receipt labels drifted`);
  }

  const unitRows = receipt.spec?.units ?? [];
  check(unitRows.length === desired.managedUnits.length, "receipt Unit rows are incomplete");
  const unitsByRef = new Map(unitRows.map((item) => [item.ref, item]));
  for (const expected of desired.managedUnits) {
    const ref = `${expected.space}/${expected.slug}`;
    const row = unitsByRef.get(ref);
    check(row, `receipt is missing Unit ${ref}`);
    check(UUID_PATTERN.test(row.id ?? ""), `${ref}: receipt Unit ID missing`);
    check(Number(row.headRevisionNum) > 0, `${ref}: receipt head revision missing`);
    const payload = inputs.payloads.get(expected.payloadKey);
    check(row.sourceSha256 === `sha256:${payload.sha256}`, `${ref}: receipt source digest drifted`);
  }

  const faithful = verifyFaithfulProof();
  const preservedRows = receipt.spec?.preservedControlUnits ?? [];
  check(
    preservedRows.length === PRESERVED_FAITHFUL_CONTROL_UNITS.length,
    "receipt preserved faithful control Unit rows are incomplete",
  );
  const preservedByRef = new Map(preservedRows.map((item) => [item.ref, item]));
  for (const expected of PRESERVED_FAITHFUL_CONTROL_UNITS) {
    const ref = `${CONTROL_SPACE}/${expected.slug}`;
    const evidence = faithful.spec?.configHub?.[expected.receiptKey];
    const row = preservedByRef.get(ref);
    check(row, `receipt is missing preserved faithful Unit ${ref}`);
    check(row.id === evidence?.unit?.id, `${ref}: preserved Unit ID is stale`);
    check(row.headRevisionNum === evidence?.unit?.headRevisionNum, `${ref}: preserved head revision is stale`);
    check(row.dataHash === evidence?.unit?.dataHash, `${ref}: preserved data hash is stale`);
    check(row.approvalCount === evidence?.approval?.recordedApprovals, `${ref}: preserved approval evidence is stale`);
    check(row.owner === "faithful-hub-spoke-proof" && row.policy === "preserved", `${ref}: preserved ownership policy drifted`);
  }

  const releaseRows = receipt.spec?.releases ?? [];
  check(releaseRows.length === desired.deployments.length, "receipt release rows are incomplete");
  for (const row of releaseRows) check(/^sha256:[0-9a-f]{64}$/.test(row.digest ?? ""), `${row.space}: release digest missing`);
  const appRows = receipt.spec?.applications ?? [];
  check(appRows.length === desired.deployments.length, "receipt Application rows are incomplete");
  for (const row of appRows) {
    check(row.syncState === "Synced", `${row.cluster}/${row.name}: receipt sync is ${row.syncState}`);
    check((row.acceptedHealth ?? []).includes(row.healthState), `${row.cluster}/${row.name}: receipt health ${row.healthState} is outside accepted set`);
  }

  const links = receipt.spec?.wiring?.links ?? [];
  check(links.length === desired.links.length, "receipt Link rows are incomplete");
  for (const row of links) {
    check(UUID_PATTERN.test(row.id ?? ""), `${row.ref}: receipt Link ID missing`);
    check(row.updateType === "NeedsProvides" && row.autoUpdate === false, `${row.ref}: receipt Link semantics drifted`);
  }
  const grafanaSecret = receipt.spec?.wiring?.grafanaSecret;
  check(grafanaSecret?.store?.name === "hx-app-dev-dev" && grafanaSecret.store.ready === true, "receipt does not prove the Grafana ClusterSecretStore ready");
  check(
    grafanaSecret?.externalSecret?.name === "grafana-admin-credentials-es"
      && grafanaSecret.externalSecret.ready === true
      && grafanaSecret.externalSecret.storeRef?.kind === "ClusterSecretStore"
      && grafanaSecret.externalSecret.storeRef?.name === "hx-app-dev-dev"
      && grafanaSecret.externalSecret.target === "grafana-admin-credentials",
    "receipt does not prove the Grafana ExternalSecret wiring ready",
  );
  check(
    grafanaSecret?.secret?.ownerKind === "ExternalSecret"
      && grafanaSecret.secret.ownerName === "grafana-admin-credentials-es"
      && stableJson(grafanaSecret.secret.keysPresent) === stableJson(["admin-password", "admin-user"]),
    "receipt does not prove the Grafana Secret is ESO-owned with both credential keys",
  );

  const scenario = receipt.spec?.rolloutScenario ?? {};
  check(scenario.version === SCENARIO_VERSION, "receipt rollout scenario version drifted");
  for (const id of ["initial-rollout", "base-promotion", "prod-approval", "prod-a-rollback", "staging-departure", "departure-survives-promotion"]) {
    check((scenario.steps ?? []).some((item) => item.id === id && item.result === "pass"), `receipt rollout step ${id} is missing`);
  }
  for (const space of ["hx-web-prod-a", "hx-web-prod-b"]) {
    check((scenario.operationEvidence ?? []).some((item) => item.type === "expected-approval-block" && item.ref === space), `receipt lacks the expected pre-approval refusal for ${space}`);
  }
  for (const [name, value] of Object.entries(scenario.claims ?? {})) check(value === "pass", `rollout claim ${name} is not pass`);
  check((scenario.finalChecks ?? []).length === 5 && scenario.finalChecks.every((item) => item.result === "pass"), "receipt final rollout checks are incomplete");

  const liveMatrix = receipt.spec?.liveMatrix;
  check(liveMatrix?.kind === "KubaraMiniIDPLiveMatrixObservation", "receipt live matrix kind drifted");
  check(liveMatrix?.observationMode === "kubectl-and-confighub-live-read", "receipt live matrix is not live evidence");
  check(liveMatrix?.rows?.length === FLEET.length * 9, "receipt live matrix row count drifted");
  for (const row of liveMatrix.rows) {
    check(FLEET.some((item) => item.cluster === row.cluster), `matrix row has unknown cluster ${row.cluster}`);
    check(typeof row.desiredVersion === "string" && row.desiredVersion, `${row.cluster}/${row.component}: desired version missing`);
    check(["delivered", "not-selected"].includes(row.deliveryState), `${row.cluster}/${row.component}: delivery state invalid`);
    if (row.deliveryState === "delivered") {
      check(row.syncState === "Synced", `${row.cluster}/${row.component}: matrix sync is ${row.syncState}`);
      check(row.readiness?.result !== "fail", `${row.cluster}/${row.component}: matrix readiness failed`);
      check(row.observedVersion !== undefined, `${row.cluster}/${row.component}: observedVersion field missing`);
      check(row.unknownReason !== undefined, `${row.cluster}/${row.component}: unknownReason field missing`);
    }
  }

  const runs = receipt.spec?.reconcileRuns ?? [];
  check(runs.length >= 2 && runs.every((item) => item.result === "pass"), "receipt must contain the initial reconciliation and a zero-action rerun");
  check(runs.some((item) => item.idempotentNoop === false && item.actionCount > 0), "receipt does not retain the state-changing reconciliation run");
  check(runs.at(-1)?.idempotentNoop === true && runs.at(-1)?.actionCount === 0, "receipt latest reconcile run is not an idempotent no-op");
  check(receipt.status?.result === "pass", "mini-IDP receipt status is not pass");
  check(receipt.status?.cleanRoomReproducible === true, "mini-IDP receipt clean-room claim is missing");
  check(receipt.status?.idempotentRerunProven === true, "mini-IDP receipt does not prove a zero-action rerun");
  check(receipt.status?.fullCurrentSelectionDelivered === true, "mini-IDP receipt does not claim the full current selection");
  check((receipt.status?.limits ?? []).length >= 5, "mini-IDP receipt limits are incomplete");
  console.log(`verified ${relativeRepo(RECEIPT_PATH)}: ${counts.spaces} Spaces, ${counts.managedUnits} Units, ${counts.releases} releases, ${counts.liveMatrixRows} live matrix rows`);
}
