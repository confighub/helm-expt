import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
} from "./lib/proof-common.mjs";

const candidatesPath = join(repoRoot, "data", "catalog-promotion-wave2", "candidates.yaml");
const workOrdersPath = join(repoRoot, "data", "catalog-promotion-wave2", "variant-work-orders.yaml");
const summaryPath = join(repoRoot, "data", "catalog-promotion-wave2", "variant-work-orders.md");
const mode = process.argv[2] ?? "--generate";

const variantDetails = {
  "traefik/traefik": {
    "external-crds": {
      intent: "Use Traefik while CRD ownership is handled outside the package.",
      values: ["providers.kubernetesCRD.enabled=false or CRD install disabled after source review", "ingressClass.enabled=true"],
      facts: ["CRDs already present if CRD provider remains enabled"],
      blockers: ["confirm exact Traefik chart value for CRD creation versus CRD provider enablement"],
    },
    "internal-clusterip-dashboard-off": {
      intent: "Safe local/internal install with no public LoadBalancer and dashboard disabled.",
      values: ["service.type=ClusterIP", "ingressRoute.dashboard.enabled=false", "ports.traefik.expose.default=false"],
      facts: [],
      blockers: [],
    },
    "cloud-loadbalancer": {
      intent: "Normal cloud ingress-controller shape with explicit load balancer ownership.",
      values: ["service.type=LoadBalancer", "ingressClass.isDefaultClass reviewed", "providers.kubernetesIngress.enabled=true"],
      facts: ["cloud load balancer controller available", "ingress class ownership accepted"],
      blockers: ["cloud-specific annotations must be target/variant-owned"],
    },
  },
  "external-dns/external-dns": {
    "route53-irsa": {
      intent: "AWS Route53 install using IAM role for service account rather than static credentials.",
      values: ["provider.name=aws", "serviceAccount.annotations includes eks.amazonaws.com/role-arn", "registry=txt", "txtOwnerId set"],
      facts: ["IAM role exists", "hosted zone scope known"],
      blockers: [],
    },
    "cloudflare-existing-secret": {
      intent: "Cloudflare install with API token supplied by an existing Secret.",
      values: ["provider.name=cloudflare", "env uses valueFrom secretKeyRef", "registry=txt", "txtOwnerId set"],
      facts: ["Cloudflare token Secret exists"],
      blockers: ["confirm chart-supported secret/env shape"],
    },
    "dry-run-txt-registry": {
      intent: "No-change proof/demo mode for understanding DNS changes safely.",
      values: ["dryRun=true", "registry=txt", "txtOwnerId set"],
      facts: [],
      blockers: [],
    },
  },
  "vmware-tanzu/velero": {
    "aws-s3-existing-secret": {
      intent: "AWS S3 backup location with cloud credentials supplied externally.",
      values: ["configuration.backupStorageLocation provider=aws", "configuration.backupStorageLocation bucket set", "credentials existing Secret"],
      facts: ["S3 bucket exists", "credential Secret exists"],
      blockers: ["proof recipe uses velero/velero source; source alias must stay clear in catalog"],
    },
    "azure-blob-existing-secret": {
      intent: "Azure Blob backup location with credentials supplied externally.",
      values: ["configuration.backupStorageLocation provider=azure", "bucket/resource group set", "credentials existing Secret"],
      facts: ["Azure storage account/container exists", "credential Secret exists"],
      blockers: [],
    },
    "filesystem-backup-node-agent": {
      intent: "Enable node-agent path for filesystem backup coverage.",
      values: ["deployNodeAgent=true", "configuration.features reviewed"],
      facts: ["node-agent privileges accepted"],
      blockers: ["daemonset privileges need production disposition"],
    },
  },
  "istio-official/istiod": {
    "revisioned-control-plane": {
      intent: "Install a revisioned Istio control plane for safe canary/promotion.",
      values: ["revision set", "pilot autoscale reviewed"],
      facts: ["namespace injection labels owned by operator"],
      blockers: [],
    },
    "external-ca": {
      intent: "Use externally managed CA material rather than implicit control-plane defaults.",
      values: ["external CA / certificate provider values set after source review"],
      facts: ["CA Secret or provider exists"],
      blockers: ["confirm exact chart values and secret shape"],
    },
    "minimal-profile": {
      intent: "Smallest reasonable control plane for proof/test clusters.",
      values: ["pilot resource profile lowered", "telemetry/addons left out"],
      facts: [],
      blockers: [],
    },
  },
  "kyverno/kyverno": {
    "default-admission": {
      intent: "Normal Kyverno admission controller path with explicit webhook disposition.",
      values: ["admissionController replicas/resources reviewed", "webhooks failure policy reviewed"],
      facts: ["admission webhook risk accepted"],
      blockers: [],
    },
    "external-crds": {
      intent: "Install controller assuming CRDs are managed by platform lifecycle.",
      values: ["CRD install disabled after source review"],
      facts: ["Kyverno CRDs already present"],
      blockers: ["confirm exact chart CRD ownership values"],
    },
    "ha-admission-reports": {
      intent: "Production-shaped HA admission and reports controller split.",
      values: ["replica counts >1", "reports/background controller settings reviewed"],
      facts: ["cluster has capacity for HA controllers"],
      blockers: ["webhook rollout and disruption policy must be dispositioned"],
    },
  },
};

if (mode === "--generate") {
  const report = buildReport();
  write(workOrdersPath, report.yaml);
  write(summaryPath, report.markdown);
  console.log(`wrote ${relativeRepo(workOrdersPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(workOrdersPath), "missing wave-2 variant work orders; run npm run catalog:wave2:work-orders");
  check(existsSync(summaryPath), "missing wave-2 variant work-order summary; run npm run catalog:wave2:work-orders");
  check(readFileSync(workOrdersPath, "utf8") === report.yaml, "wave-2 variant work orders are stale");
  check(readFileSync(summaryPath, "utf8") === report.markdown, "wave-2 variant work-order summary is stale");
  console.log("verified wave-2 variant work orders");
} else {
  console.log(`Usage:
  node scripts/generate-wave2-variant-work-orders.mjs --generate
  node scripts/generate-wave2-variant-work-orders.mjs --verify`);
}

function buildReport() {
  const candidates = readYaml(candidatesPath);
  const workOrders = candidates.spec.candidates.map((candidate) => {
    const details = variantDetails[candidate.chart];
    check(details, `missing variant details for ${candidate.chart}`);
    return {
      chart: candidate.chart,
      version: candidate.currentVersion,
      recipePath: candidate.recipePath,
      packagePath: candidate.packagePath,
      state: "not-yet-rendered",
      requiredBeforeCatalogSupport: [
        "render each variant with pinned Helm inputs",
        "add matching recipe variant and package base",
        "write rendered object inventory and immutable revision",
        "run Helm-equivalence, external scan, local scan, and install gate",
        "run local/e2e where feasible",
      ],
      variants: candidate.proposedRealVariants.map((variant) => {
        const detail = details[variant] ?? defaultVariantDetail(candidate.chart, variant);
        check(detail, `missing details for ${candidate.chart} variant ${variant}`);
        return { name: variant, ...detail };
      }),
    };
  });
  const doc = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "CatalogPromotionVariantWorkOrders",
    metadata: {
      name: "wave-2-real-variant-work-orders",
      generatedBy: "scripts/generate-wave2-variant-work-orders.mjs",
    },
    spec: {
      source: relativeRepo(candidatesPath),
      workOrders,
    },
  };
  return {
    yaml: `${toYaml(doc)}\n`,
    markdown: toMarkdown(workOrders),
  };
}

function defaultVariantDetail(chart, variant) {
  if (variant !== "default") return null;
  return {
    intent: `Keep the current ${chart} default proof as the baseline comparison variant.`,
    values: ["current default effective-values.yaml"],
    facts: [],
    blockers: ["catalog support still requires comparing default against the new user-shaped variants"],
  };
}

function toMarkdown(workOrders) {
  return `# Wave-2 Real Variant Work Orders

These are the concrete variant jobs that turn proof-grade/default charts into
catalog-promotion candidates. They are not catalog support claims yet.

| Chart | Variants | Current state |
| --- | --- | --- |
${workOrders.map((order) => `| \`${order.chart}@${order.version}\` | ${order.variants.map((variant) => variant.name).join(", ")} | ${order.state} |`).join("\n")}

## Rule

A row becomes promotable only after every listed variant is represented as a
real recipe variant, package base, rendered revision, scan/gate receipt, and
Helm-equivalence receipt.
`;
}
