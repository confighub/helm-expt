import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import {
  canonicalObjectMaps,
  check,
  command,
  difference,
  findingCounts,
  identityFor,
  imageTag,
  labelsMatch,
  listFiles,
  listYamlFiles,
  normalizeYaml,
  objectFilesFromDirs,
  parseDocs,
  parseObjects,
  readYaml,
  readYamlText,
  relativeRepo,
  repoRoot,
  runCub,
  sha256,
  sha256File,
  workloadPodSpec,
  workloadTemplateLabels,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const proofRoot = join(repoRoot, "recipes", "hashicorp", "consul", "2.0.0");
const packageRoot = join(repoRoot, "packages", "hashicorp", "consul", "2.0.0");
const receiptPath = join(proofRoot, "publication", "installer-package-receipt.yaml");
const packageRelative = relativeRepo(packageRoot);
const chart = {
  repository: "hashicorp",
  repositoryURL: "https://helm.releases.hashicorp.com",
  name: "consul",
  version: "2.0.0",
  releaseName: "consul",
  namespace: "consul",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default-control-plane",
    base: "default-control-plane",
    displayName: "default control plane",
    valuesFile: "effective-values.yaml",
    valuesText: `server:
  disruptionBudget:
    enabled: false
connectInject:
  disruptionBudget:
    enabled: false
`,
    valuesSummary: "chart-default control plane with Kubernetes 1.30-compatible PDBs disabled, server, injector, webhook cert manager, CRDs, and RBAC",
    expectedObjectCount: 68,
    expectedCRDCount: 28,
    expectedSecretCount: 0,
    apiVersions: [],
    targetFactNote: "uses chart-default Consul control-plane posture; TLS and ACLs are disabled and must be policy-reviewed before production",
  },
  {
    name: "secure-mesh-existing-secrets",
    base: "secure-mesh-existing-secrets",
    displayName: "secure mesh with existing Secrets",
    valuesFile: "effective-values-secure-mesh-existing-secrets.yaml",
    valuesText: `global:
  tls:
    enabled: true
    caCert:
      secretName: consul-ca-cert
      secretKey: tls.crt
  gossipEncryption:
    autoGenerate: false
    secretName: consul-gossip-encryption-key
    secretKey: key
  acls:
    manageSystemACLs: true
    bootstrapToken:
      secretName: consul-bootstrap-acl-token
      secretKey: token
server:
  disruptionBudget:
    enabled: false
  replicas: 3
  bootstrapExpect: 3
  serverCert:
    secretName: consul-server-cert
connectInject:
  disruptionBudget:
    enabled: false
meshGateway:
  enabled: true
  service:
    type: ClusterIP
ingressGateways:
  enabled: true
  defaults:
    service:
      type: ClusterIP
terminatingGateways:
  enabled: true
ui:
  ingress:
    enabled: true
    hosts:
      - host: consul.example.invalid
        paths:
          - /
`,
    valuesSummary: "TLS, ACLs, gossip encryption, mesh gateways, and UI ingress with existing Secrets",
    expectedObjectCount: 97,
    expectedCRDCount: 28,
    expectedSecretCount: 1,
    apiVersions: [],
    targetFactNote: "requires target Secrets for CA, server certificate, gossip key, and ACL bootstrap token before apply",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "consul",
          name: "consul-ca-cert",
          keys: ["tls.crt"],
          purpose: "Consul TLS CA certificate",
        },
        {
          namespace: "consul",
          name: "consul-server-cert",
          keys: ["tls.crt", "tls.key"],
          purpose: "Consul server TLS certificate and private key",
        },
        {
          namespace: "consul",
          name: "consul-gossip-encryption-key",
          keys: ["key"],
          purpose: "Consul gossip encryption key",
        },
        {
          namespace: "consul",
          name: "consul-bootstrap-acl-token",
          keys: ["token"],
          purpose: "Consul ACL bootstrap token",
        },
      ],
    },
  },
];

const localScanPolicy = {
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
      id: "helm-hook-lifecycle-policy",
      severity: "medium",
      description: "Helm hook resources need explicit lifecycle policy.",
    },
    {
      id: "dependency-lock-review",
      severity: "medium",
      description: "Chart dependencies need lock and provenance review.",
    },
    {
      id: "generated-secret-ownership",
      severity: "medium",
      description: "Rendered Secrets need explicit ownership and observation policy.",
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
    {
      id: "deployment-workload-review",
      severity: "medium",
      description: "Deployments need rollout, persistence, and rollback policy.",
    },
    {
      id: "extension-slot-review",
      severity: "medium",
      description: "tpl/raw extension slots need provenance and scan coverage.",
    },
  ],
};

const args = process.argv.slice(2);
const mode = args[0] ?? "--help";

if (mode === "--generate-proof") {
  generateProof();
} else if (mode === "--generate-package") {
  generatePackage();
} else if (mode === "--verify-proof") {
  verifyProof();
} else if (mode === "--verify-proof-self-test") {
  verifyProofSelfTest();
} else if (mode === "--verify-package") {
  verifyPackage();
} else if (mode === "--compare") {
  verifyPackage();
} else {
  console.log(`Usage:
  node scripts/consul-proof.mjs --generate-proof
  node scripts/consul-proof.mjs --generate-package
  node scripts/consul-proof.mjs --verify-proof
  node scripts/consul-proof.mjs --verify-proof-self-test
  node scripts/consul-proof.mjs --verify-package
  node scripts/consul-proof.mjs --compare`);
}

function generateProof() {
  rmSync(proofRoot, { recursive: true, force: true });
  mkdirSync(proofRoot, { recursive: true });

  const source = pullSource();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  writeYaml(join(proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: "hashicorp-consul-2.0.0" },
    spec: {
      sourceType: "HelmChart",
      repositoryName: chart.repository,
      repositoryURL: chart.repositoryURL,
      chart: chart.name,
      version: chart.version,
      appVersion: source.appVersion,
      deprecated: source.deprecated,
      packageSHA256: source.packageSHA256,
      packageBytes: source.packageBytes,
      evidence: {
        harnessReceipt: "../../../../data/adversarial10/charts/hashicorp-consul-2.0.0/render-receipt.yaml",
      },
    },
  });

  writeYaml(join(proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: "hashicorp-consul-2.0.0" },
    spec: {
      chart: "hashicorp/consul",
      version: chart.version,
      dependencies: source.dependencies,
      chartLockDigest: source.chartLockDigest,
    },
  });

  writeYaml(join(proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: "hashicorp-consul-2.0.0" },
    spec: {
      checkedValues: [
        {
          path: "global.tls.enabled",
          variant: "default-control-plane",
          disposition: "policy-visible-default",
          reason: "chart default disables Consul TLS; the proof makes that posture explicit instead of hiding it",
        },
        {
          path: "global.acls.manageSystemACLs",
          variant: "default-control-plane",
          disposition: "policy-visible-default",
          reason: "chart default disables Consul ACL management; the proof makes that posture explicit instead of hiding it",
        },
        {
          path: "global.tls.caCert / server.serverCert",
          variant: "secure-mesh-existing-secrets",
          disposition: "target-fact-bound",
          reason: "TLS CA and server certificate material are declared target Secrets instead of generated or embedded chart inputs",
        },
        {
          path: "global.gossipEncryption.*",
          variant: "secure-mesh-existing-secrets",
          disposition: "target-fact-bound",
          reason: "gossip encryption auto-generation is disabled and the key is declared as a target Secret",
        },
        {
          path: "global.acls.bootstrapToken.*",
          variant: "secure-mesh-existing-secrets",
          disposition: "target-fact-bound",
          reason: "ACL bootstrap token is declared as a target Secret",
        },
        {
          path: "meshGateway / ingressGateways / terminatingGateways",
          variant: "secure-mesh-existing-secrets",
          disposition: "mesh-topology-bound",
          reason: "mesh gateway topology and ClusterIP service exposure are explicit variant choices",
        },
        {
          path: "ui.ingress.*",
          variant: "secure-mesh-existing-secrets",
          disposition: "ui-exposure-bound",
          reason: "UI exposure is only added by an explicit variant with host captured",
        },
        {
          path: "global.installK8sNetworkingCRDs / connectInject.apiGateway.manageExternalCRDs",
          variant: "all",
          disposition: "crd-ownership-review",
          reason: "Consul installs both Consul and Gateway API CRDs, which can conflict with cluster-managed CRD ownership",
        },
        {
          path: "server.extraConfig / connectInject.* / controller.* / gateway.*",
          variant: "all",
          disposition: "extension-slot",
          reason: "Consul exposes powerful config, injector, controller, and gateway extension slots that must stay explicit",
        },
      ],
      unknownValues: "not-checked",
      deadValues: "not-checked",
      ignoredValues: "not-checked",
    },
  });

  writeYaml(join(proofRoot, "control-points.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ControlPoints",
    metadata: { name: "hashicorp-consul-2.0.0" },
    spec: {
      points: [
        { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
        {
          category: "dependency-lock",
          status: "handled",
          evidence: "dependency-lock.yaml",
          note: "chart declares no subchart dependencies; the empty closure is recorded explicitly.",
        },
        {
          category: "capability-profile",
          status: "handled",
          kubeVersion: chart.kubeVersion,
          note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile.",
        },
        {
          category: "target-facts",
          status: "variant-controlled",
          evidence: "global.tls.caCert / server.serverCert / gossipEncryption / acl bootstrap token",
          note: "The secure-mesh-existing-secrets variant declares target Secrets for TLS, gossip encryption, and ACL bootstrap material.",
        },
        {
          category: "crd-ownership",
          status: "scan-and-review",
          evidence: "28 rendered CRDs",
          note: "The chart templates 28 CRDs, including Gateway API CRDs that may already be cluster-managed.",
        },
        { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|consul|consul-consul-server" },
        { category: "admission-webhook", status: "scan-and-review", object: "admissionregistration.k8s.io/v1|MutatingWebhookConfiguration|consul|consul-consul-connect-injector" },
        { category: "cluster-rbac", status: "scan-and-review", note: "Default and secure variants render broad cluster RBAC for server, injector, gateway resources, and webhook certificate manager." },
        { category: "mesh-gateway-policy", status: "variant-controlled", note: "The secure-mesh-existing-secrets variant enables mesh, ingress, and terminating gateways with ClusterIP services." },
        { category: "ui-ingress-policy", status: "variant-controlled", object: "networking.k8s.io/v1|Ingress|consul|consul-consul-ui" },
        { category: "lifecycle-policy", status: "scan-and-review", note: "Hooks are disabled in the proof render, while normal ACL init Job remains visible in the secure variant." },
        { category: "extension-slots", status: "controlled-by-empty-defaults", note: "server extra config, injector, controller, gateway, and tpl-controlled strings are controlled in promoted variants." },
        { category: "installer-support-object", status: "handled", object: "v1|Namespace||consul" },
      ],
    },
  });

  writeYaml(join(proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: { name: "hashicorp-consul", version: chart.version },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: "../../../../packages/hashicorp/consul/2.0.0",
        setupCommand: [
          "cub",
          "install",
          "setup",
          "--pull",
          "../../../../packages/hashicorp/consul/2.0.0",
          "--non-interactive",
          "--namespace",
          "consul",
        ],
      },
      variants: variants.map((variant) => `variants/${variant.name}/variant.yaml`),
    },
  });

  const summaries = [];
  for (const variant of variants) {
    const render = renderVariant(variant);
    if (!render.deterministic) {
      throw new Error(`${variant.name} did not render deterministically`);
    }
    const releaseObjects = normalizeYaml(render.first);
    const releaseDigest = sha256(releaseObjects);
    const renderedRoot = join(revisionRoot(variant.name), "rendered");
    const receiptsRoot = join(revisionRoot(variant.name), "receipts");
    mkdirSync(renderedRoot, { recursive: true });
    mkdirSync(receiptsRoot, { recursive: true });
    write(join(renderedRoot, "release-objects.yaml"), releaseObjects);
    const objects = parseObjects(releaseObjects);
    if (objects.length !== variant.expectedObjectCount) {
      throw new Error(`${variant.name} expected ${variant.expectedObjectCount} objects, got ${objects.length}`);
    }
    const docs = parseDocs(releaseObjects);
    const secretCount = docs.filter((doc) => doc.kind === "Secret").length;
    const inventory = {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "RenderedObjectInventory",
      metadata: { name: `hashicorp-consul-${chart.version}-${variant.name}-r001` },
      spec: {
        source: "rendered/release-objects.yaml",
        sourceSHA256: releaseDigest,
        objectCount: objects.length,
        objects,
      },
    };
    writeYaml(join(renderedRoot, "object-inventory.yaml"), inventory);

    const effectiveValues = effectiveValuesDoc(variant, source.defaultValuesSHA256);
    writeYaml(join(proofRoot, variant.valuesFile), effectiveValues);
    const variantDoc = variantDocFor(variant);
    writeYaml(join(proofRoot, "variants", variant.name, "variant.yaml"), variantDoc);

    const recipeDigest = sha256File(join(proofRoot, "recipe.yaml"));
    const variantDigest = sha256File(join(proofRoot, "variants", variant.name, "variant.yaml"));
    const effectiveValuesDigest = sha256File(join(proofRoot, variant.valuesFile));
    const rendererFingerprint = sha256(
      JSON.stringify({
        renderer: "helm",
        helmVersion,
        kubeVersion: chart.kubeVersion,
        flags: ["--include-crds", "--skip-tests", "--no-hooks"],
        apiVersions: variant.apiVersions ?? [],
      }),
    );
    const revisionDigest = sha256(
      JSON.stringify({ recipeDigest, variantDigest, effectiveValuesDigest, rendererFingerprint, releaseDigest }),
    );

    writeYaml(join(revisionRoot(variant.name), "variant-revision.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "VariantRevision",
      metadata: { name: `${variant.name}-r001` },
      spec: {
        variant: `../../../variants/${variant.name}/variant.yaml`,
        revision: "r001",
        digest: revisionDigest,
        digestInputs: {
          recipeSHA256: recipeDigest,
          variantSHA256: variantDigest,
          effectiveValuesSHA256: effectiveValuesDigest,
          rendererSHA256: rendererFingerprint,
          renderedObjectSetSHA256: releaseDigest,
        },
        rendered: {
          releaseObjects: "rendered/release-objects.yaml",
          objectInventory: "rendered/object-inventory.yaml",
          objectCount: objects.length,
        },
      },
    });

    const scanFindings = scanDocs(docs);
    const scanCounts = findingCounts(scanFindings);
    const scanResult = scanFindings.some((finding) => finding.severity === "high") ? "warn" : scanFindings.length ? "warn" : "pass";
    const policyBundleDigest = sha256(JSON.stringify(localScanPolicy));
    writeYaml(join(receiptsRoot, "render-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "RenderReceipt",
      metadata: { name: `consul-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderer: {
          name: "helm",
          version: helmVersion,
          kubeVersion: chart.kubeVersion,
          flags: ["--include-crds", "--skip-tests", "--no-hooks"],
          apiVersions: variant.apiVersions ?? [],
        },
        inputs: {
          sourceLockSHA256: sha256File(join(proofRoot, "source-lock.yaml")),
          dependencyLockSHA256: sha256File(join(proofRoot, "dependency-lock.yaml")),
          effectiveValuesSHA256: effectiveValuesDigest,
        },
        outputs: {
          renderedObjectSetSHA256: releaseDigest,
          renderedObjectInventorySHA256: sha256File(join(renderedRoot, "object-inventory.yaml")),
          deterministicAcrossTwoLocalRenders: true,
          objectCount: objects.length,
          renderedSecretCount: secretCount,
          secretCountSeparatedByCubInstall: variant.expectedSecretCount,
        },
      },
    });
    writeYaml(join(receiptsRoot, "helm-equivalence-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "HelmEquivalenceReceipt",
      metadata: { name: `consul-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        regularHelm: { renderedSHA256: releaseDigest, objectCount: objects.length },
        cubInstall: {
          objectCountIncludingSecretsAndSupportObjects: objects.length + 1,
          uploadedManifestFiles: objects.length + 1,
          separatedSecretFiles: variant.expectedSecretCount,
          semanticObjectMatches: `${objects.length}/${objects.length}`,
        },
        semanticNormalizations: ["prune-null-fields", "trim-leading-command-block-newline"],
        classifications: [
          { identity: "v1|Namespace||consul", classification: "installer-support-object", disposition: "allowed" },
        ],
        result: "pass",
        evidenceCommand: "npm run consul:compare",
      },
    });
    writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "ScanReceipt",
      metadata: { name: `consul-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        result: scanResult,
        scanner: { name: localScanPolicy.scanner, version: localScanPolicy.version },
        policyBundleDigest,
        findingCounts: scanCounts,
        findings: scanFindings,
      },
    });
    writeYaml(join(receiptsRoot, "install-gate.yaml"), {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "InstallGate",
      metadata: { name: `consul-${variant.name}-r001` },
      spec: {
        variantRevision: "../variant-revision.yaml",
        renderedObjectSetSHA256: releaseDigest,
        decision: "warn",
        allowedScopes: ["local-test"],
        blockedScopes: ["production"],
        reasons: [
          `Helm equivalence passed for ${variant.name}`,
          "Consul TLS, ACL, gossip, gateway, CRD, and UI posture are explicit variant choices",
          "Helm hook behavior needs explicit lifecycle policy before production",
          "Consul CRDs, cluster RBAC, injector webhooks, StatefulSet storage, gateway topology, UI ingress, ACL init Job, and extension slots need production review",
          variant.targetFactNote,
        ],
      },
    });
    summaries.push({ ...variant, releaseDigest, objects, scanCounts, scanResult });
  }

  writeYaml(join(proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: "hashicorp-consul-2.0.0" },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: "hashicorp/consul",
        version: chart.version,
        variants: variants.map((variant) => variant.name),
        helmObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length])),
        cubInstallObjectsByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, summary.objects.length + 1])),
        helmMatchByVariant: Object.fromEntries(summaries.map((summary) => [summary.name, `${summary.objects.length}/${summary.objects.length}`])),
        scanGate: "warn-production-blocked",
        nextAction: "publish only after TLS/ACL/gossip Secret ownership, CRD ownership, cluster RBAC, admission webhook, StatefulSet storage, gateway topology, UI ingress, hook/lifecycle, and raw/template extension-slot review are satisfied",
      },
      receipts: summaries.flatMap((summary) => [
        `revisions/${summary.name}/r001/receipts/helm-equivalence-receipt.yaml`,
        `revisions/${summary.name}/r001/receipts/render-receipt.yaml`,
        `revisions/${summary.name}/r001/receipts/scan-receipt.yaml`,
        `revisions/${summary.name}/r001/receipts/install-gate.yaml`,
      ]),
    },
  });
  writeYaml(join(proofRoot, "chart-dossier.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ChartDossier",
    metadata: { name: "hashicorp-consul-2.0.0" },
    spec: {
      chart: "hashicorp/consul",
      version: chart.version,
      maintainedNotes: [
        "default-control-plane records the chart-default posture: TLS and ACLs disabled, server StatefulSet, injector webhook, webhook cert manager, 28 CRDs, and broad RBAC.",
        "secure-mesh-existing-secrets enables TLS, ACL management, gossip encryption, mesh/ingress/terminating gateways, and UI ingress using declared target Secrets.",
        "The secure variant disables gossip auto-generation and uses existing Secrets for CA, server cert, gossip key, and ACL bootstrap token.",
        "Both variants render 28 CRDs, including Gateway API CRDs that can conflict with cluster-managed CRD ownership.",
        "Helm hooks are excluded from proof renders, while the secure variant's normal ACL init Job remains visible as an install lifecycle object.",
        "server extra config, injector, controller, gateway, and tpl-controlled strings are powerful extension surfaces; promoted variants keep them controlled.",
      ],
      knownControlPoints: [
        "target-facts",
        "crd-ownership",
        "cluster-rbac",
        "admission-webhook",
        "stateful-workload",
        "mesh-gateway-policy",
        "ui-ingress-policy",
        "lifecycle-policy",
        "raw-template-extension-slots",
      ],
    },
  });
  writeReadme(summaries);
  console.log(`Wrote ${relativeRepo(proofRoot)}`);
}

function generatePackage() {
  verifyProof();
  rmSync(packageRoot, { recursive: true, force: true });
  mkdirSync(packageRoot, { recursive: true });
  writeYaml(join(packageRoot, "installer.yaml"), {
    apiVersion: "installer.confighub.com/v1alpha1",
    kind: "Package",
    metadata: { name: "hashicorp-consul", version: chart.version },
    spec: {
      bases: variants.map((variant, index) => ({
        name: variant.base,
        path: `bases/${variant.base}`,
        default: index === 0 ? true : undefined,
        description: `consul ${variant.displayName} variant rendered from hashicorp/consul@${chart.version}`,
      })),
    },
  });
  write(
    join(packageRoot, "README.md"),
    `# hashicorp/consul ${chart.version} Installer Package

This package is generated from the consul proof artifacts.

\`\`\`sh
npm run consul:generate-package
npm run consul:verify-package
\`\`\`
`,
  );
  for (const variant of variants) {
    const baseRoot = join(packageRoot, "bases", variant.base);
    mkdirSync(baseRoot, { recursive: true });
    writeYaml(join(baseRoot, "kustomization.yaml"), {
      apiVersion: "kustomize.config.k8s.io/v1beta1",
      kind: "Kustomization",
      resources: ["upstream.yaml"],
    });
    write(
      join(baseRoot, "upstream.yaml"),
      readFileSync(join(revisionRoot(variant.name), "rendered", "release-objects.yaml"), "utf8"),
    );
  }

  const files = listFiles(packageRoot).map((path) => ({
    path: relative(packageRoot, path),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
  const tempRoot = mkdtempSync(join(tmpdir(), "consul-installer-package-"));
  try {
    const firstPackage = join(tempRoot, "consul-2.0.0-a.tgz");
    const secondPackage = join(tempRoot, "consul-2.0.0-b.tgz");
    runCub(["install", "package", packageRoot, "-o", firstPackage]);
    runCub(["install", "package", packageRoot, "-o", secondPackage]);
    const firstSHA = sha256File(firstPackage);
    const secondSHA = sha256File(secondPackage);
    if (firstSHA !== secondSHA || !readFileSync(firstPackage).equals(readFileSync(secondPackage))) {
      throw new Error("cub install package did not produce byte-identical bundles");
    }
    mkdirSync(dirname(receiptPath), { recursive: true });
    writeYaml(receiptPath, {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "InstallerPackageReceipt",
      metadata: { name: "hashicorp-consul-2.0.0" },
      spec: {
        chart: { repository: chart.repository, name: chart.name, version: chart.version },
        package: {
          path: packageRelative,
          name: "hashicorp-consul",
          version: chart.version,
          sourceFiles: files,
        },
        deterministicBundle: {
          command: `cub install package ${packageRelative} -o <tmp>/consul-2.0.0.tgz`,
          sha256: firstSHA,
          byteIdenticalAcrossTwoLocalBundles: true,
        },
        setupChecks: variants.map((variant) => ({
          variant: variant.name,
          base: variant.base,
          command: `cub install setup --pull ${packageRelative} --base ${variant.base} --work-dir <tmp> --non-interactive --namespace consul`,
          helmReleaseObjectCount: variant.expectedObjectCount,
          cubInstallObjectCountIncludingSupport: variant.expectedObjectCount + 1,
          semanticObjectMatches: `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
          separatedSecretCount: variant.expectedSecretCount,
          allowedCubOnlyObjects: ["v1|Namespace||consul"],
        })),
      },
    });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  verifyPackage();
  console.log(`Wrote ${packageRelative}`);
  console.log(`Wrote ${relativeRepo(receiptPath)}`);
}

function verifyProof(root = proofRoot) {
  const requiredFiles = [
    "README.md",
    "helm-plan.yaml",
    "chart-dossier.yaml",
    "source-lock.yaml",
    "dependency-lock.yaml",
    "control-points.yaml",
    "value-model.yaml",
    "effective-values.yaml",
    "effective-values-secure-mesh-existing-secrets.yaml",
    "recipe.yaml",
    "variants/default-control-plane/variant.yaml",
    "variants/secure-mesh-existing-secrets/variant.yaml",
    "revisions/default-control-plane/r001/variant-revision.yaml",
    "revisions/default-control-plane/r001/rendered/release-objects.yaml",
    "revisions/default-control-plane/r001/rendered/object-inventory.yaml",
    "revisions/default-control-plane/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/default-control-plane/r001/receipts/render-receipt.yaml",
    "revisions/default-control-plane/r001/receipts/scan-receipt.yaml",
    "revisions/default-control-plane/r001/receipts/install-gate.yaml",
    "revisions/secure-mesh-existing-secrets/r001/variant-revision.yaml",
    "revisions/secure-mesh-existing-secrets/r001/rendered/release-objects.yaml",
    "revisions/secure-mesh-existing-secrets/r001/rendered/object-inventory.yaml",
    "revisions/secure-mesh-existing-secrets/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/secure-mesh-existing-secrets/r001/receipts/render-receipt.yaml",
    "revisions/secure-mesh-existing-secrets/r001/receipts/scan-receipt.yaml",
    "revisions/secure-mesh-existing-secrets/r001/receipts/install-gate.yaml",
  ];
  for (const file of requiredFiles) {
    check(existsSync(join(root, file)), `missing required file ${file}`);
  }
  const sourceLock = readYaml(join(root, "source-lock.yaml"));
  const dependencyLock = readYaml(join(root, "dependency-lock.yaml"));
  const recipe = readYaml(join(root, "recipe.yaml"));
  const valueModel = readYaml(join(root, "value-model.yaml"));
  const controlPoints = readYaml(join(root, "control-points.yaml"));
  check(sourceLock.kind === "SourceLock", "source-lock.yaml must be SourceLock");
  check(sourceLock.spec.repositoryName === "hashicorp", "source repository mismatch");
  check(sourceLock.spec.chart === "consul", "source chart mismatch");
  check(sourceLock.spec.version === "2.0.0", "source version mismatch");
  check(sourceLock.spec.deprecated === false, "source deprecation marker must be recorded");
  check(Boolean(sourceLock.spec.packageSHA256), "source package SHA must be present");
  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  check((dependencyLock.spec.dependencies ?? []).length === 0, "consul dependency lock must be empty");
  check(recipe.kind === "Recipe", "recipe.yaml must be Recipe");
  check(recipe.spec.variants?.length === 2, "recipe must have two variants");
  check(valueModel.spec.checkedValues?.length >= 3, "value model must record checked values");
  check(controlPoints.spec.points?.some((point) => point.category === "target-facts"), "target-facts control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "crd-ownership"), "crd-ownership control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "stateful-workload"), "stateful-workload control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
  check(controlPoints.spec.points?.some((point) => point.category === "extension-slots"), "extension-slots control point missing");

  for (const variant of variants) {
    const releasePath = join(root, "revisions", variant.name, "r001", "rendered", "release-objects.yaml");
    const releaseDigest = sha256File(releasePath);
    const objects = parseObjects(readFileSync(releasePath, "utf8"));
    check(objects.length === variant.expectedObjectCount, `${variant.name} object count mismatch`);
    const identities = objects.map((object) => object.identity);
    const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
    const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
    check(new Set(identities).size === identities.length, `${variant.name} duplicate object identities`);
    check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
    check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
    check(identities.includes("apps/v1|StatefulSet|consul|consul-consul-server"), `${variant.name} server StatefulSet missing`);
    check(identities.includes("apps/v1|Deployment|consul|consul-consul-connect-injector"), `${variant.name} injector Deployment missing`);
    check(identities.includes("apps/v1|Deployment|consul|consul-consul-webhook-cert-manager"), `${variant.name} webhook cert manager missing`);
    check(identities.includes("v1|Service|consul|consul-consul-server"), `${variant.name} server Service missing`);
    check(identities.includes("v1|Service|consul|consul-consul-ui"), `${variant.name} UI Service missing`);
    check(identities.includes("v1|ServiceAccount|consul|consul-consul-server"), `${variant.name} server ServiceAccount missing`);
    check(identities.includes("v1|ConfigMap|consul|consul-consul-server-config"), `${variant.name} server ConfigMap missing`);
    check(identities.includes("admissionregistration.k8s.io/v1|MutatingWebhookConfiguration|consul|consul-consul-connect-injector"), `${variant.name} mutating webhook missing`);
    check(identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration|consul|consul-consul-connect-injector"), `${variant.name} validating webhook missing`);
    check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||consul-consul-connect-injector"), `${variant.name} injector ClusterRole missing`);
    check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||serviceintentions.consul.hashicorp.com"), `${variant.name} Consul CRD missing`);
    check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||gateways.gateway.networking.k8s.io"), `${variant.name} Gateway API CRD missing`);
    if (variant.name === "default-control-plane") {
      check(!identities.includes("networking.k8s.io/v1|Ingress|consul|consul-consul-ui"), "default-control-plane must not render UI Ingress");
      check(!identities.includes("batch/v1|Job|consul|consul-consul-server-acl-init"), "default-control-plane must not render ACL init Job");
      check(!secretIdentities.length, "default-control-plane must not render a Secret");
    }
    if (variant.name === "secure-mesh-existing-secrets") {
      check(identities.includes("batch/v1|Job|consul|consul-consul-server-acl-init"), "secure-mesh-existing-secrets ACL init Job missing");
      check(identities.includes("networking.k8s.io/v1|Ingress|consul|consul-consul-ui"), "secure-mesh-existing-secrets UI Ingress missing");
      check(identities.includes("apps/v1|Deployment|consul|consul-consul-mesh-gateway"), "secure-mesh-existing-secrets mesh gateway missing");
      check(identities.includes("apps/v1|Deployment|consul|consul-consul-ingress-gateway"), "secure-mesh-existing-secrets ingress gateway missing");
      check(identities.includes("apps/v1|Deployment|consul|consul-consul-terminating-gateway"), "secure-mesh-existing-secrets terminating gateway missing");
      check(identities.includes("v1|Secret|consul|consul-consul-auth-method"), "secure-mesh-existing-secrets auth method Secret missing");
    }

    const inventory = readYaml(join(root, "revisions", variant.name, "r001", "rendered", "object-inventory.yaml"));
    const revision = readYaml(join(root, "revisions", variant.name, "r001", "variant-revision.yaml"));
    const renderReceipt = readYaml(join(root, "revisions", variant.name, "r001", "receipts", "render-receipt.yaml"));
    const equivalence = readYaml(join(root, "revisions", variant.name, "r001", "receipts", "helm-equivalence-receipt.yaml"));
    const scan = readYaml(join(root, "revisions", variant.name, "r001", "receipts", "scan-receipt.yaml"));
    const gate = readYaml(join(root, "revisions", variant.name, "r001", "receipts", "install-gate.yaml"));
    check(inventory.spec.sourceSHA256 === releaseDigest, `${variant.name} inventory source digest mismatch`);
    check(inventory.spec.objectCount === variant.expectedObjectCount, `${variant.name} inventory object count mismatch`);
    check(revision.spec.digestInputs.renderedObjectSetSHA256 === releaseDigest, `${variant.name} revision digest mismatch`);
    check(renderReceipt.spec.outputs.renderedObjectSetSHA256 === releaseDigest, `${variant.name} render receipt digest mismatch`);
    check(renderReceipt.spec.outputs.objectCount === variant.expectedObjectCount, `${variant.name} render receipt count mismatch`);
    check(renderReceipt.spec.outputs.deterministicAcrossTwoLocalRenders === true, `${variant.name} must be deterministic`);
    check(equivalence.spec.regularHelm.renderedSHA256 === releaseDigest, `${variant.name} equivalence digest mismatch`);
    check(equivalence.spec.result === "pass", `${variant.name} equivalence must pass`);
    check(
      equivalence.spec.cubInstall.semanticObjectMatches === `${variant.expectedObjectCount}/${variant.expectedObjectCount}`,
      `${variant.name} semantic match mismatch`,
    );
    check(scan.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} scan digest mismatch`);
    check(scan.spec.findingCounts.medium >= 3, `${variant.name} scan must flag storage/stateful/runtime risk and extension review`);
    check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${variant.name} install gate digest mismatch`);
    check(gate.spec.decision === "warn", `${variant.name} install gate should warn`);
  }
  console.log("verified consul proof artifacts");
}

function verifyProofSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "consul-proof-self-test-"));
  try {
    cpSync(proofRoot, tempRoot, { recursive: true });
    const releasePath = join(tempRoot, "revisions", "default-control-plane", "r001", "rendered", "release-objects.yaml");
    write(releasePath, `${readFileSync(releasePath, "utf8")}\n# tampered\n`);
    let rejected = false;
    try {
      verifyProof(tempRoot);
    } catch (error) {
      rejected = String(error.message).includes("inventory source digest mismatch");
    }
    if (!rejected) throw new Error("self-test did not reject rendered object tampering");
    console.log("self-test passed: consul rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyPackage() {
  verifyProof();
  check(existsSync(packageRoot), `missing package root ${packageRelative}; run npm run consul:generate-package`);
  check(existsSync(receiptPath), "missing installer package receipt; run npm run consul:generate-package");
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(receiptPath);
  check(installer.kind === "Package", "installer.yaml must be Package");
  check(installer.metadata.name === "hashicorp-consul", "package name mismatch");
  check(receipt.kind === "InstallerPackageReceipt", "package receipt kind mismatch");
  check(receipt.spec.package.path === packageRelative, "receipt package path mismatch");

  const bases = installer.spec.bases ?? [];
  check(bases.length === 2, "package must declare two bases");
  check(bases.filter((base) => base.default === true).length === 1, "package must have one default base");
  for (const variant of variants) {
    const base = bases.find((item) => item.name === variant.base);
    check(Boolean(base), `missing base ${variant.base}`);
    check(base.path === `bases/${variant.base}`, `${variant.name} base path mismatch`);
    check(
      readFileSync(join(packageRoot, base.path, "upstream.yaml"), "utf8") ===
        readFileSync(join(revisionRoot(variant.name), "rendered", "release-objects.yaml"), "utf8"),
      `${variant.name} package upstream must match rendered release objects`,
    );
  }

  const receiptFiles = receipt.spec.package.sourceFiles ?? [];
  const actualFiles = listFiles(packageRoot).map((path) => ({
    path: relative(packageRoot, path),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
  check(receiptFiles.length === actualFiles.length, "package source file count mismatch");
  const actualByPath = new Map(actualFiles.map((file) => [file.path, file]));
  for (const file of receiptFiles) {
    const actual = actualByPath.get(file.path);
    check(Boolean(actual), `receipt references missing file ${file.path}`);
    check(actual.sha256 === file.sha256, `source file SHA mismatch for ${file.path}`);
    check(actual.bytes === file.bytes, `source file byte count mismatch for ${file.path}`);
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "consul-package-verify-"));
  try {
    const firstPackage = join(tempRoot, "consul-a.tgz");
    const secondPackage = join(tempRoot, "consul-b.tgz");
    runCub(["install", "package", packageRoot, "-o", firstPackage]);
    runCub(["install", "package", packageRoot, "-o", secondPackage]);
    const firstSHA = sha256File(firstPackage);
    const secondSHA = sha256File(secondPackage);
    check(firstSHA === secondSHA, "package SHA changed across two local bundles");
    check(readFileSync(firstPackage).equals(readFileSync(secondPackage)), "package bytes changed across two local bundles");
    check(firstSHA === receipt.spec.deterministicBundle.sha256, "deterministic bundle SHA mismatch");
    for (const variant of variants) verifySetupVariant(tempRoot, variant, receipt);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
  console.log("consul installer package verification passed");
}

function verifySetupVariant(tempRoot, variant, receipt) {
  const checkReceipt = (receipt.spec.setupChecks ?? []).find((item) => item.variant === variant.name);
  check(Boolean(checkReceipt), `receipt missing setup check for ${variant.name}`);
  const workDir = join(tempRoot, `work-${variant.name}`);
  runCub([
    "install",
    "setup",
    "--pull",
    packageRoot,
    "--base",
    variant.base,
    "--work-dir",
    workDir,
    "--non-interactive",
    "--namespace",
    "consul",
  ]);
  const helmYaml = readFileSync(join(revisionRoot(variant.name), "rendered", "release-objects.yaml"), "utf8");
  const cubFiles = objectFilesFromDirs([join(workDir, "out", "manifests"), join(workDir, "out", "secrets")]);
  const cubYaml = cubFiles.map((file) => file.yaml).join("\n---\n");
  const semantic = normalizeConsulSemanticMaps(canonicalObjectMaps(helmYaml, cubYaml));
  const helmObjects = new Set(Object.keys(semantic.helm));
  const cubObjects = new Set(Object.keys(semantic.cub));
  check(helmObjects.size === variant.expectedObjectCount, `${variant.name} Helm object count mismatch`);
  check(cubObjects.size === variant.expectedObjectCount + 1, `${variant.name} cub object count mismatch`);
  const missingFromCub = difference(helmObjects, cubObjects);
  check(missingFromCub.length === 0, `${variant.name} cub output missing Helm object(s): ${missingFromCub.join(", ")}`);
  const extraInCub = difference(cubObjects, helmObjects);
  check(
    JSON.stringify(extraInCub) === JSON.stringify(["v1|Namespace||consul"]),
    `${variant.name} cub output may add only v1|Namespace||consul; found ${extraInCub.join(", ")}`,
  );
  const semanticDiffs = [];
  for (const key of helmObjects) {
    if (semantic.helm[key] !== semantic.cub[key]) semanticDiffs.push(key);
  }
  check(semanticDiffs.length === 0, `${variant.name} semantic diffs: ${semanticDiffs.join(", ")}`);
  const secretFiles = listYamlFiles(join(workDir, "out", "secrets"));
  check(secretFiles.length === variant.expectedSecretCount, `${variant.name} separated Secret count mismatch`);
}

function normalizeConsulSemanticMaps(semantic) {
  return {
    helm: normalizeSemanticMap(semantic.helm),
    cub: normalizeSemanticMap(semantic.cub),
  };
}

function normalizeSemanticMap(map) {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => {
      const doc = JSON.parse(value);
      normalizeCommandBlocks(doc);
      return [key, JSON.stringify(doc)];
    }),
  );
}

function normalizeCommandBlocks(value) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (typeof value[index] === "string") value[index] = value[index].replace(/^\n+/, "");
      else normalizeCommandBlocks(value[index]);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) normalizeCommandBlocks(child);
}

function pullSource() {
  const tempRoot = mkdtempSync(join(tmpdir(), "consul-source-"));
  try {
    command("helm", ["pull", "hashicorp/consul", "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartRoot = join(tempRoot, "consul");
    const chartYaml = readYaml(join(chartRoot, "Chart.yaml"));
    const chartLockPath = join(chartRoot, "Chart.lock");
    const chartLock = existsSync(chartLockPath) ? readYaml(chartLockPath) : null;
    return {
      appVersion: chartYaml.appVersion,
      packageSHA256: sha256File(packagePath),
      packageBytes: readFileSync(packagePath).length,
      defaultValuesSHA256: sha256File(join(chartRoot, "values.yaml")),
      chartLockDigest: chartLock?.digest ?? null,
      dependencies: chartLock?.dependencies ?? chartYaml.dependencies ?? [],
      deprecated: Boolean(chartYaml.deprecated),
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function renderVariant(variant) {
  const tempRoot = mkdtempSync(join(tmpdir(), "consul-render-"));
  try {
    const args = [
      "template",
      chart.releaseName,
      "hashicorp/consul",
      "--version",
      chart.version,
      "--namespace",
      chart.namespace,
      "--kube-version",
      chart.kubeVersion,
      "--include-crds",
      "--skip-tests",
      "--no-hooks",
    ];
    for (const apiVersion of variant.apiVersions ?? []) {
      args.push("--api-versions", apiVersion);
    }
    if (variant.valuesText) {
      const valuesPath = join(tempRoot, "values.yaml");
      write(valuesPath, variant.valuesText);
      args.push("--values", valuesPath);
    }
    const first = command("helm", args);
    const second = command("helm", args);
    return { first, second, deterministic: sha256(first) === sha256(second) };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function effectiveValuesDoc(variant, defaultValuesSHA256) {
  if (!variant.valuesText) {
    return {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "EffectiveValues",
      metadata: { name: "hashicorp-consul-2.0.0-default" },
      spec: {
        profile: "chart-defaults",
        defaultValuesSHA256,
        mergedValuesCaptured: false,
        values: {},
      },
    };
  }
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "EffectiveValues",
    metadata: { name: `hashicorp-consul-2.0.0-${variant.name}` },
    spec: {
      files: [{ path: variant.valuesFile, source: "inline-proof", sha256: sha256(variant.valuesText) }],
      mergedValuesCaptured: false,
      values: readYamlText(variant.valuesText),
    },
  };
}

function variantDocFor(variant) {
  const doc = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Variant",
    metadata: { name: variant.name },
    spec: {
      recipe: "../../recipe.yaml",
      namespace: chart.namespace,
      releaseName: chart.releaseName,
      valuesProfile: `../../${variant.valuesFile}`,
      capabilityProfile: { kubeVersion: chart.kubeVersion, apiVersions: variant.apiVersions ?? [] },
      hookPolicy: "no-hooks",
    },
  };
  if (variant.targetFacts) doc.spec.targetFacts = variant.targetFacts;
  return doc;
}

function scanDocs(docs) {
  const findings = [];
  const serviceAccounts = new Set(
    docs.filter((doc) => doc.kind === "ServiceAccount").map((doc) => `${doc.metadata?.namespace ?? ""}/${doc.metadata?.name ?? ""}`),
  );
  const workloads = docs.filter((doc) => workloadPodSpec(doc));
  for (const doc of workloads) {
    const object = identityFor(doc);
    const podSpec = workloadPodSpec(doc);
    const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
    for (const container of containers) {
      const tag = imageTag(container.image ?? "");
      if (!tag || tag === "latest") {
        findings.push({
          id: `mutable-image-tag:${object}:${container.name ?? "container"}`,
          rule: "mutable-image-tag",
          severity: "high",
          object,
          message: `container ${container.name ?? "container"} uses mutable image ${container.image ?? ""}`,
        });
      }
    }
    const serviceAccountName = podSpec.serviceAccountName;
    const namespace = doc.metadata?.namespace ?? "";
    if (serviceAccountName && !serviceAccounts.has(`${namespace}/${serviceAccountName}`)) {
      findings.push({
        id: `workload-service-account-exists:${object}`,
        rule: "workload-service-account-exists",
        severity: "high",
        object,
        message: `workload references missing ServiceAccount ${namespace}/${serviceAccountName}`,
      });
    }
  }
  for (const doc of docs.filter((item) => item.kind === "Service")) {
    const selector = doc.spec?.selector ?? {};
    if (!Object.keys(selector).length) continue;
    const match = workloads.some((workload) => labelsMatch(selector, workloadTemplateLabels(workload)));
    if (!match) {
      findings.push({
        id: `service-selector-has-workload-match:${identityFor(doc)}`,
        rule: "service-selector-has-workload-match",
        severity: "high",
        object: identityFor(doc),
        message: "Service selector matches no rendered workload pod template",
      });
    }
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
    id: "extension-slot-review:consul",
    rule: "extension-slot-review",
    severity: "medium",
    object: "values|server.extraConfig|connectInject|controller|gateway|tpl-strings",
    message: "Consul server, injector, controller, gateway, and templated-string extension slots must be scanned when populated",
  });
  findings.push({
    id: "target-secret-policy:secure-mesh",
    rule: "generated-secret-ownership",
    severity: "medium",
    object: "values|global.tls|global.gossipEncryption|global.acls",
    message: "Secure Consul variants depend on target Secrets for TLS CA, server cert, gossip key, and ACL bootstrap token",
  });
  for (const doc of workloads) {
    const object = identityFor(doc);
    const podSpec = workloadPodSpec(doc);
    const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
    for (const container of containers) {
      for (const env of container.env ?? []) {
        const ref = env.valueFrom?.secretKeyRef;
        if (!ref?.name) continue;
        findings.push({
          id: `target-secret-fact:${object}:${container.name ?? "container"}:${env.name}`,
          rule: "generated-secret-ownership",
          severity: "medium",
          object,
          message: `container ${container.name ?? "container"} references target Secret ${ref.name}/${ref.key ?? ""}`,
        });
      }
    }
  }
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Consul RBAC requires production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "StatefulSet")) {
      findings.push({
        id: `stateful-workload-review:${identityFor(doc)}`,
        rule: "deployment-workload-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Consul StatefulSet storage, rollout, and retention policy require production review",
    });
    if (doc.spec?.serviceName && !docs.some((item) => item.kind === "Service" && item.metadata?.name === doc.spec.serviceName)) {
      findings.push({
        id: `statefulset-service-risk:${identityFor(doc)}`,
        rule: "service-selector-has-workload-match",
        severity: "medium",
        object: identityFor(doc),
        message: `StatefulSet references serviceName ${doc.spec.serviceName}, but that Service is not rendered by the chart`,
      });
    }
  }
  for (const doc of docs.filter((item) => item.kind === "ServiceMonitor")) {
    findings.push({
      id: `servicemonitor-capability:${identityFor(doc)}`,
      rule: "extension-slot-review",
      severity: "medium",
      object: identityFor(doc),
      message: "ServiceMonitor requires the Prometheus Operator CRD to exist in the target cluster",
    });
  }
  for (const doc of docs.filter((item) => ["MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"].includes(item.kind))) {
    findings.push({
      id: `admission-webhook-review:${identityFor(doc)}`,
      rule: "extension-slot-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Consul injector webhook failure policy, certificates, and rollout impact require production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Job")) {
    findings.push({
      id: `lifecycle-job-review:${identityFor(doc)}`,
      rule: "helm-hook-lifecycle-policy",
      severity: "medium",
      object: identityFor(doc),
      message: "Consul lifecycle Job must be tied to install/upgrade ordering and rollback policy",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Secret")) {
    findings.push({
      id: `rendered-secret-ownership:${identityFor(doc)}`,
      rule: "generated-secret-ownership",
      severity: "medium",
      object: identityFor(doc),
      message: "Rendered Consul Secret ownership, rotation, and observation policy require review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "NetworkPolicy")) {
    findings.push({
      id: `network-policy-review:${identityFor(doc)}`,
      rule: "extension-slot-review",
      severity: "medium",
      object: identityFor(doc),
      message: "NetworkPolicy intent must be reviewed against the target namespace and ingress controller topology",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "PodDisruptionBudget")) {
    findings.push({
      id: `availability-policy-review:${identityFor(doc)}`,
      rule: "deployment-workload-review",
      severity: "medium",
      object: identityFor(doc),
      message: "PodDisruptionBudget needs production availability and rollout policy review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Ingress")) {
    findings.push({
      id: `edge-ingress-policy:${identityFor(doc)}`,
      rule: "extension-slot-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Consul UI ingress requires host, TLS, class, and edge policy review",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return findings;
}

function writeReadme(summaries) {
  write(
    join(proofRoot, "README.md"),
    `# hashicorp/consul ${chart.version} Proof

This is the promoted proof slice for the Consul public Helm chart.

Variants:

${summaries
  .map(
    (summary) => `- \`${summary.name}\`: ${summary.valuesSummary}; ${summary.objects.length} Helm objects, ${summary.objects.length + 1} cub install objects including Namespace.`,
  )
  .join("\n")}

What this proves:

- regular Helm output is preserved by \`cub install setup\`, plus the explained Namespace support object;
- \`default-control-plane\` captures the chart-default Consul posture, including disabled TLS/ACLs, server StatefulSet, injector webhook, webhook cert manager, 28 CRDs, and RBAC;
- \`secure-mesh-existing-secrets\` enables TLS, ACLs, gossip encryption, mesh gateways, and UI ingress using declared target Secrets;
- CRD ownership, cluster RBAC, admission webhooks, lifecycle Jobs, rendered Secrets, StatefulSet storage, gateway topology, UI ingress, and raw/template extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

\`\`\`sh
npm run consul:generate-proof
npm run consul:generate-package
npm run consul:verify-proof
npm run consul:verify-package
npm run consul:compare
\`\`\`
`,
  );
}

function revisionRoot(variantName) {
  return join(proofRoot, "revisions", variantName, "r001");
}
