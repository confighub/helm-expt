// cert-manager proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged. Supports the multi-version
// harness env overrides (HELM_EXPT_CHART_VERSION / HELM_EXPT_PROOF_OUTPUT_ROOT) via
// the kit.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor, parseDocs, readYaml, repoRoot, sha256 } from "./lib/proof-common.mjs";

const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "v1.20.2";
const chart = {
  repository: "jetstack",
  repositoryURL: "https://charts.jetstack.io",
  name: "cert-manager",
  version: chartVersion,
  releaseName: "cert-manager",
  namespace: "cert-manager",
  kubeVersion: "1.30.0",
};

const versionExpectations = {
  "v1.20.2": { defaultObjects: 42, crdsObjects: 48 },
  "v1.21.0": { defaultObjects: 40, crdsObjects: 46 },
};
const expected = versionExpectations[chart.version];
if (!expected) throw new Error(`cert-manager ${chart.version} needs reviewed version-specific assertions`);

const certManagerCRDs = [
  "challenges.acme.cert-manager.io",
  "orders.acme.cert-manager.io",
  "certificaterequests.cert-manager.io",
  "certificates.cert-manager.io",
  "clusterissuers.cert-manager.io",
  "issuers.cert-manager.io",
];

const v121PassingAttempt = "runs/lifecycle-observations/cert-manager-v121-default/attempts/companion-contract";

// The canonical lifecycle contract remains byte-bound to its declared source
// material. The completed observation is a retained attempt beside it, so it
// is verified here without rewriting the contract after the live run.
function verifyV121PassingAttempt() {
  if (!process.argv.some((argument) => argument === "--verify-proof" || argument === "--verify-proof-self-test")) return;
  execFileSync(
    process.execPath,
    ["scripts/run-cert-manager-v121-default-lifecycle.mjs", "--verify", "--output", v121PassingAttempt],
    { cwd: repoRoot, encoding: "utf8", stdio: "pipe" },
  );
}

// The flattened default v1.21.0 base excludes Helm hooks. Its route therefore
// must bind the exact source payload to the exact external CRD posture rather
// than silently inheriting v1.20.2's live observation or the CRD-owning base's
// routes. This is deliberately a declared, not observed, contract.
function verifyV121DefaultLifecycleContract() {
  if (chart.version !== "v1.21.0" || !process.argv.includes("--verify-proof")) return;

  const recipe = "recipes/jetstack/cert-manager/v1.21.0";
  const contractPath = "examples/cert-manager-v121-default-lifecycle/contract.yaml";
  const contract = readYaml(join(repoRoot, contractPath));
  const spec = contract?.spec ?? {};
  const fail = (message) => {
    throw new Error(`${contractPath}: ${message}`);
  };
  if (contract?.kind !== "LifecycleCompanionContract") fail("kind mismatch");
  if (spec.chart !== "jetstack/cert-manager" || spec.version !== "v1.21.0" || spec.base !== "default")
    fail("must bind the exact chart, version, and default base");
  if (spec.status !== "declared-not-observed") fail("must remain declared-not-observed until a v1.21.0 runtime receipt exists");

  const defaultRender = `${recipe}/revisions/default/r001/rendered/release-objects.yaml`;
  if (spec.renderedObjectSet?.path !== defaultRender) fail("must bind the default rendered object set");
  if (sha256(readFileSync(join(repoRoot, defaultRender), "utf8")) !== spec.renderedObjectSet?.sha256)
    fail("default rendered object-set digest mismatch");

  const external = spec.externalCRDs ?? {};
  if (external.ownership !== "external-to-default-base") fail("must declare CRDs external to the default base");
  if (external.source?.path !== `${recipe}/revisions/crds-enabled/r001/rendered/release-objects.yaml`)
    fail("must source external CRDs from the same-version crds-enabled render");
  if (sha256(readFileSync(join(repoRoot, external.source.path), "utf8")) !== external.source?.sha256)
    fail("external CRD source digest mismatch");
  if (external.apply?.mode !== "server-side" || external.apply?.before !== "default-base-apply")
    fail("must require server-side external CRD application before the default base");
  if (external.apply?.waitFor !== "every named definition reports the Established condition")
    fail("must wait for external CRD establishment");
  const required = [...certManagerCRDs].sort();
  if (JSON.stringify([...(external.names ?? [])].sort()) !== JSON.stringify(required)) fail("external CRD names mismatch");
  const variant = readYaml(join(repoRoot, `${recipe}/variants/default/variant.yaml`));
  if (JSON.stringify([...(variant.spec?.targetFacts?.requiredCRDs ?? []).map((crd) => crd.name).sort()]) !== JSON.stringify(required))
    fail("variant target facts no longer declare the contracted CRDs");

  const startup = spec.startupApiCheck ?? {};
  if (startup.source?.artifactSHA256 !== "9c2c6fabf3cf8fe14dacb016f37c819b66bc2c79e8b7acde4573d45ec141fb97")
    fail("startup payload must bind the locked v1.21.0 chart artifact");
  const sourceLock = readYaml(join(repoRoot, `${recipe}/source-lock.yaml`));
  if (sourceLock.spec?.packageSHA256 !== startup.source?.artifactSHA256)
    fail("startup payload artifact must match the source lock");
  const payload = startup.source?.payload;
  if (!payload || sha256(readFileSync(join(repoRoot, payload), "utf8")) !== startup.source?.payloadSHA256)
    fail("startup payload digest mismatch");
  const identities = parseDocs(readFileSync(join(repoRoot, payload), "utf8"))
    .map((doc) => identityFor(doc))
    .sort();
  const expectedHooks = [
    "batch/v1|Job|cert-manager|cert-manager-startupapicheck",
    "rbac.authorization.k8s.io/v1|Role|cert-manager|cert-manager-startupapicheck:create-cert",
    "rbac.authorization.k8s.io/v1|RoleBinding|cert-manager|cert-manager-startupapicheck:create-cert",
    "v1|ServiceAccount|cert-manager|cert-manager-startupapicheck",
  ].sort();
  if (JSON.stringify(identities) !== JSON.stringify(expectedHooks)) fail("startup payload identities mismatch");
  const payloadDocs = parseDocs(readFileSync(join(repoRoot, payload), "utf8"));
  if (!payloadDocs.every((doc) => doc.metadata?.annotations?.["helm.sh/hook"] === "post-install"))
    fail("every startup payload object must retain its post-install source annotation");
  const job = payloadDocs.find((doc) => doc.kind === "Job");
  if (JSON.stringify(job?.spec?.template?.spec?.containers?.[0]?.args) !== JSON.stringify(["check", "api", "--wait=1m", "-v"]))
    fail("startup Job command no longer matches the reviewed source payload");
  if (startup.execution?.mode !== "manual-until-runtime-observed") fail("must not claim automatic or observed startup API check execution");
  if (!startup.execution?.after?.includes("external-crds-established") || !startup.execution?.after?.includes("default-base-applied"))
    fail("startup API check must follow CRD establishment and default-base application");
}

verifyV121DefaultLifecycleContract();
verifyV121PassingAttempt();

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default",
    valuesFile: "effective-values.yaml",
    valuesText: "",
    valuesSummary: "chart defaults",
    expectedObjectCount: expected.defaultObjects,
    expectedCRDCount: 0,
    targetFacts: {
      requiredCRDs: certManagerCRDs.map((name) => ({
        name,
        sourceVariant: "crds-enabled",
        purpose: "cert-manager CRD staged before the default chart and its startup API check",
        deliveryLanes: ["regularHelm", "cubInstallerApply", "configHubKubectlApply", "configHubOciArgo"],
        applyMode: "server-side",
      })),
    },
    targetFactNote: "requires the six cert-manager CRDs from the reviewed crds-enabled base before applying webhook objects; excludes the Helm startup API check hook Job from the rendered revision",
  },
  {
    name: "crds-enabled",
    base: "crds-enabled",
    displayName: "CRDs enabled",
    valuesFile: "effective-values-crds-enabled.yaml",
    valuesText: `crds:
  enabled: true
`,
    valuesSummary: "cert-manager CRDs included",
    expectedObjectCount: expected.crdsObjects,
    expectedCRDCount: 6,
    targetFactNote: "adds the six cert-manager CRDs to the rendered revision",
  },
];

const scanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    {
      id: "mutable-image-tag",
      severity: "high",
      description: "Container image must use an immutable or non-latest tag.",
    },
    {
      id: "service-selector-has-workload-match",
      severity: "high",
      description: "Service selector must match a rendered workload pod template.",
    },
    {
      id: "workload-service-account-exists",
      severity: "high",
      description: "Workload serviceAccountName must reference a rendered ServiceAccount.",
    },
    {
      id: "admission-webhook-requires-observation",
      severity: "medium",
      description: "Admission webhook availability must be observed after apply.",
    },
    {
      id: "helm-hook-lifecycle-policy",
      severity: "medium",
      description: "Helm hook jobs need an explicit lifecycle policy.",
    },
    {
      id: "crd-upgrade-policy",
      severity: "medium",
      description: "CRDs need explicit readiness, ordering, schema, and upgrade policy.",
    },
    {
      id: "cluster-rbac-review",
      severity: "medium",
      description: "Cluster-scoped RBAC needs explicit review before production.",
    },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  // single cub-only support object (the created Namespace)
  supportObjects: ["v1|Namespace||cert-manager"],
  expectedDependencyCount: 0,
  valueModel: {
    checkedValues: [
      {
        path: "crds.enabled",
        variant: "default",
        disposition: "crds-excluded",
        reason: "chart defaults do not render cert-manager CRDs",
      },
      {
        path: "crds.enabled",
        variant: "crds-enabled",
        disposition: "crds-included",
        reason: "renders the six cert-manager CRDs as part of the approved revision",
      },
      {
        path: "installCRDs",
        variant: "all",
        disposition: "deprecated-crd-switch-not-used",
        reason: "uses crds.enabled rather than the deprecated installCRDs switch",
      },
      {
        path: "startupapicheck.enabled",
        variant: "all",
        disposition: "hook-excluded-by-render-policy",
        reason: "startup API check is a Helm post-install hook and is excluded from the rendered revision by --no-hooks",
      },
      {
        path: "extraObjects",
        variant: "all",
        disposition: "empty-extension-slot",
        reason: "chart exposes a tpl-powered extension slot; promoted variants keep it empty",
      },
      {
        path: "image.digest",
        variant: "all",
        disposition: "not-set",
        reason: "default image references use chart appVersion tags, not digests",
      },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart has no subchart dependencies" },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note: "render is bound to the named Kubernetes capability profile even though this chart version does not branch on .Capabilities.",
    },
    {
      category: "crd-policy",
      status: "variant-controlled",
      variants: { default: 0, "crds-enabled": 6 },
      note: "CRDs are ordinary rendered objects only in the crds-enabled variant and still need lifecycle/upgrade policy.",
    },
    {
      category: "hook-policy",
      status: "handled-for-render",
      policy: "no-hooks",
      note: "startup API check Job is a Helm post-install hook and is excluded from the render proof; lifecycle policy must handle it before production.",
    },
    {
      category: "admission-webhook",
      status: "scan-and-observe",
      objects: [
        "admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||cert-manager-webhook",
        "admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||cert-manager-webhook",
      ],
    },
    { category: "cluster-rbac", status: "scan-and-review", evidence: "scan receipts" },
    { category: "tpl", status: "controlled-by-empty-defaults", note: "extraObjects uses tpl; promoted variants do not set that value." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||cert-manager" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart does not render CRDs because crds.enabled defaults to false.",
      "crds-enabled variant renders six cert-manager CRDs as ordinary rendered objects.",
      "startup API check is a Helm post-install hook and is excluded from the rendered revision by --no-hooks.",
      "Mutating and validating webhook readiness must be observed after apply because rendered objects alone do not prove webhook health.",
      "extraObjects is a tpl-powered extension slot; promoted variants keep it empty.",
    ],
    knownControlPoints: [
      "capability-profile",
      "crd-lifecycle-policy",
      "hook-lifecycle-policy",
      "admission-webhook-observation",
      "cluster-rbac-scan",
      "tpl-extension-slot",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after CRD lifecycle/upgrade policy, webhook observation policy, hook policy, and cluster RBAC review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the cert-manager public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart render is deterministic under the pinned Kubernetes capability profile;",
      "the crds-enabled variant deliberately adds the six cert-manager CRDs;",
      "CRD lifecycle, admission webhook, Helm hook lifecycle, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "CRD install/upgrade behavior needs explicit lifecycle policy before production",
      "Admission webhook availability needs a fresh observation receipt after apply",
      "Helm startup API check hook Job needs explicit lifecycle policy before production",
      "Cluster-scoped RBAC needs production review",
      variant.targetFactNote,
    ],
  }),
  // Chart-specific scan rules: admission webhooks, CRDs, and the excluded
  // startup API check Helm hook. (mutable-image-tag, service-selector,
  // workload-service-account, and cluster-rbac-review come from the kit.)
  scanExtra(docs) {
    const findings = [];
    for (const doc of docs.filter((item) => item.kind === "ValidatingWebhookConfiguration")) {
      findings.push({
        id: `admission-webhook-requires-observation:${identityFor(doc)}`,
        rule: "admission-webhook-requires-observation",
        severity: "medium",
        object: identityFor(doc),
        message: "Admission webhook availability must be observed after apply",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "MutatingWebhookConfiguration")) {
      findings.push({
        id: `admission-webhook-requires-observation:${identityFor(doc)}`,
        rule: "admission-webhook-requires-observation",
        severity: "medium",
        object: identityFor(doc),
        message: "Admission webhook availability must be observed after apply",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
      findings.push({
        id: `crd-upgrade-policy:${identityFor(doc)}`,
        rule: "crd-upgrade-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "CRD readiness, ordering, schema validation, and upgrade compatibility require explicit policy",
      });
    }
    findings.push({
      id: "helm-hook-lifecycle-policy:cert-manager-startupapicheck",
      rule: "helm-hook-lifecycle-policy",
      severity: "medium",
      object: "helm-hook|Job|cert-manager|cert-manager-startupapicheck",
      message: "cert-manager startup API check is a Helm post-install hook excluded by --no-hooks and needs lifecycle policy",
    });
    return findings;
  },
  // Chart-specific verify assertions the generic kit cannot infer.
  verifyExtra({ controlPoints, perVariant, check }) {
    check(controlPoints.spec.points?.some((point) => point.category === "capability-profile"), "capability-profile control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "hook-policy"), "hook-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(identities.includes("apps/v1|Deployment|cert-manager|cert-manager"), `${variant.name} controller Deployment missing`);
      check(identities.includes("apps/v1|Deployment|cert-manager|cert-manager-cainjector"), `${variant.name} cainjector Deployment missing`);
      check(identities.includes("apps/v1|Deployment|cert-manager|cert-manager-webhook"), `${variant.name} webhook Deployment missing`);
      check(identities.includes("v1|Service|cert-manager|cert-manager-webhook"), `${variant.name} webhook Service missing`);
      check(
        identities.includes("admissionregistration.k8s.io/v1|MutatingWebhookConfiguration||cert-manager-webhook"),
        `${variant.name} MutatingWebhookConfiguration missing`,
      );
      check(
        identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration||cert-manager-webhook"),
        `${variant.name} ValidatingWebhookConfiguration missing`,
      );
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag CRD/admission/hook/RBAC review`);
      if (variant.name === "default") {
        check(!crdIdentities.length, "default must not render CRDs");
      }
      if (variant.name === "crds-enabled") {
        const requiredCRDs = [
          "apiextensions.k8s.io/v1|CustomResourceDefinition||certificaterequests.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||certificates.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||challenges.acme.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||clusterissuers.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||issuers.cert-manager.io",
          "apiextensions.k8s.io/v1|CustomResourceDefinition||orders.acme.cert-manager.io",
        ];
        for (const identity of requiredCRDs) check(identities.includes(identity), `missing CRD ${identity}`);
      }
    }
  },
});
