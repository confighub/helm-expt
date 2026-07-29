#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "helm-catalog-readmes");
const spacesRoot = join(root, "spaces");
const unitsRoot = join(root, "units");
const wave1Path = join(repoRoot, "data", "helm-org", "wave1.csv");
const guideCsvPath = join(repoRoot, "data", "confighub-example-guides", "guides.csv");
const outputPaths = {
  summary: join(root, "summary.md"),
  csv: join(root, "readmes.csv"),
};

const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const GITHUB_BASE_URL = "https://github.com/confighub/helm-expt/blob/main/";
const GITHUB_TREE_URL = "https://github.com/confighub/helm-expt/tree/main/";

const DEMO_SPACES = [
  {
    space: "default",
    title: "helm-catalog default space",
    kind: "org",
    summary: "A landing space for the demo org. Start with the chart and demo spaces instead of treating this as a chart example.",
    shows: [
      "ConfigHub always has a default Space, so the demo org has one too.",
      "It is not the main Helm Catalog demo. Use it as orientation, then open one of the named chart, fleet, route, or environment spaces.",
    ],
    open: ["This README first.", "`platform` for the shared checks used by the demo org.", "Any chart preset Space whose name starts with a chart name."],
    why: [
      "The demo org is easier to understand when every Space explains what it is for.",
      "This README prevents a first-time user from landing in an empty or administrative place and thinking the demo is thin.",
    ],
    evidence: [
      ["Org sync summary", "data/helm-org/summary.md"],
      ["Helm Ops Catalog", "site/charts/index.html"],
    ],
    limits: ["This is not a chart recipe, a rendered app, or a production example."],
  },
  {
    space: "platform",
    title: "Shared checks and gates for the demo org",
    kind: "org",
    summary: "Shared platform plumbing used by the demo Spaces: checks, gates, and filters that keep the examples honest.",
    shows: [
      "Production releases require approval. Cluster-wide system configuration also requires approval in development and staging because one change can affect every workload.",
      "The demo uses checks such as placeholder detection and vetting to keep unsafe examples out of the happy path.",
    ],
    open: ["This README.", "The checks and filters used by the demo org.", "Production Spaces such as `bitnami-redis-prod` and `hashicorp-vault-env-prod` to see where gates matter."],
    why: [
      "A catalog is not only rendered YAML. It also needs the rules that say when a change is safe to move.",
      "The platform Space shows those rules separately so chart examples do not hide policy decisions inside prose.",
    ],
    evidence: [
      ["Gate-scope fix in org summary", "data/helm-org/summary.md"],
      ["Verification landing page", "site/verification.html"],
    ],
    limits: ["This example explains shared demo mechanics. It is not a replacement for a company policy model."],
  },
  {
    space: "bitnami-redis-base",
    title: "Redis base application",
    kind: "environment",
    summary: "The Redis starting point for the environment promotion demo.",
    shows: [
      "A chart render can become an application base instead of a one-off install.",
      "The base receives upstream chart refreshes. Environment Spaces can then take those refreshes without losing their local edits.",
      "This is the beginning of the 25.5.3 to 27.0.0 Redis upgrade story.",
    ],
    open: ["This README.", "The Redis workload YAML to see the captured render.", "`bitnami-redis-staging` and `bitnami-redis-prod` to see environment versions."],
    why: [
      "Helm can install Redis. The harder operations problem is what happens after install, when teams create staging and production versions and later upgrade the chart.",
      "This example keeps the base chart output and the later environment changes separate enough to audit.",
    ],
    evidence: [
      ["Redis chart page", "site/charts/bitnami-redis-25-5-3.html"],
      ["Benchmark: upgrade keeps edit", "data/pilot-benchmark/task1-upgrade-keeps-edit.md"],
      ["Org summary", "data/helm-org/summary.md"],
    ],
    settingSources: {
      startingPoint: "The base started as the recorded `bitnami/redis` default Helm render at 25.5.3, and was later refreshed from the recorded 27.0.0 render.",
      configHub: "The base carries the shared chart output. Environment-only decisions belong in staging or production revisions, not in this base.",
      installWork: "Use the Redis chart page for the selected base's Secret requirement and other prerequisites.",
      liveCluster: "The upgrade proof compares the reviewed desired objects with a throwaway cluster; cluster state does not rewrite this base.",
    },
    limits: ["The Redis demo is a worked example, not a claim that every Redis values combination has been proven."],
  },
  {
    space: "bitnami-redis-staging",
    title: "Redis staging application",
    kind: "environment",
    summary: "A staging variant that keeps a local replica choice while the Redis base moves forward.",
    shows: [
      "Staging can carry its own change, such as a different replica count, while still receiving a base upgrade.",
      "The local change is a recorded revision, not a remembered Helm flag or a local values file that can be lost.",
    ],
    open: ["This README.", "The Redis StatefulSet YAML and its revision history.", "`bitnami-redis-base` for the upstream base."],
    why: [
      "This is the everyday Helm problem: a team needs one environment to differ from the base, then needs the next chart upgrade not to wipe that difference.",
      "ConfigHub makes the local decision visible and keeps it during upgrade.",
    ],
    evidence: [
      ["Benchmark: upgrade keeps edit", "data/pilot-benchmark/task1-upgrade-keeps-edit.md"],
      ["Promote proof notes", "runs/promote-silent-skip-proof/README.md"],
    ],
    settingSources: {
      startingPoint: "The upstream link points to `bitnami-redis-base`, which holds the Helm-rendered Redis objects.",
      configHub: "This Space sets namespace `redis-staging` and records `spec.replicas: 2` on the Redis replica StatefulSet. The replica revision remains after the base is upgraded.",
      installWork: "Prerequisites come from the selected Redis base. The staging replica choice is not a Helm hook or prerequisite.",
      liveCluster: "The benchmark observed two replicas after the 27.0.0 upgrade. That observation checks the recorded setting; it is not another source of it.",
    },
    limits: ["One map-shaped conflict in the promotion proof is still silent and is documented as a product issue."],
  },
  {
    space: "bitnami-redis-prod",
    title: "Redis production application",
    kind: "environment",
    summary: "The production Redis variant, with gates and promotion history separated from staging.",
    shows: [
      "Production can receive reviewed changes after staging proves them.",
      "Production gates live in the platform model instead of being buried in a Helm command.",
    ],
    open: ["This README.", "Redis workload YAML and revision history.", "The `platform` Space for shared gates."],
    why: [
      "Teams need a way to explain why production differs, what was promoted, and which gates applied.",
      "This is the production side of the Redis environment demo.",
    ],
    evidence: [
      ["Benchmark: upgrade keeps edit", "data/pilot-benchmark/task1-upgrade-keeps-edit.md"],
      ["Gate-scope fix in org summary", "data/helm-org/summary.md"],
    ],
    settingSources: {
      startingPoint: "The upstream link points to `bitnami-redis-base`, which holds the Helm-rendered Redis objects.",
      configHub: "This Space sets namespace `redis-prod`, records its promotion history, and carries the production approval and deletion gates. Workload fields otherwise come from the base unless a revision says differently.",
      installWork: "Prerequisites come from the selected Redis base. Approval is a ConfigHub delivery rule, not a Helm value.",
      liveCluster: "Open delivery evidence when you need runtime status. This demo Space is the desired record, not a claim about a customer production cluster.",
    },
    limits: ["This is a demo production Space, not a live customer production environment."],
  },
  ...["default"].map((lane) => ({
    space: `bitnami-redis-27-0-0-${lane}-pilot-live-20260705`,
    title: `Redis 27.0.0 ${lane} pilot run`,
    kind: "pilot",
    summary: `A live pilot snapshot from the Redis 25.5.3 to 27.0.0 upgrade test for the ${lane} lane.`,
    shows: [
      "The chart upgrade was tested against a real throwaway cluster.",
      "The important question was whether a local operations edit survived the chart upgrade.",
      "The result was recorded so someone can inspect the run later instead of trusting a demo claim.",
    ],
    open: ["This README.", "Redis workload YAML.", "Revision history for the changed YAML."],
    why: [
      "This example makes the pilot concrete. It is easier to trust the story when the actual run has a place in the org.",
      "The lesson is practical: keep the Helm chart, but record the change so an upgrade does not depend on remembering the right flag.",
    ],
    evidence: [["Benchmark: upgrade keeps edit", "data/pilot-benchmark/task1-upgrade-keeps-edit.md"]],
    limits: ["This is a dated pilot snapshot from 2026-07-05."],
  })),
  ...["dev", "staging", "prod-us", "prod-eu"].map((lane) => ({
    space: `bitnami-nginx-fleet-${lane}`,
    title: `Nginx fleet ${lane}`,
    kind: "fleet",
    summary: `One lane in the Nginx fleet demo, showing how a chart-based app can vary by environment or region.`,
    shows: [
      "A chart can become several named application versions without forking the chart.",
      "Different lanes can receive base changes at different times.",
      lane === "prod-eu"
        ? "This lane deliberately lags so the demo has an obvious upgrade to inspect."
        : "This lane shows the normal path for carrying a reviewed base change forward.",
    ],
    open: ["This README.", "Nginx Deployment and Service YAML.", "Sibling fleet Spaces to compare the lanes."],
    why: [
      "The fleet demo is about scale. Once one chart becomes dev, staging, production, regions, or customers, values files and manual notes become hard to trust.",
      "ConfigHub keeps each lane named and inspectable while preserving the shared base.",
    ],
    evidence: [
      ["Nginx chart page", "site/charts/bitnami-nginx-24-0-2.html"],
      ["Org exhibit summary", "data/helm-org/exhibits.csv"],
    ],
    limits: ["The demo proves the shape of a fleet workflow. It is not a full production rollout policy."],
  })),
  {
    space: "hashicorp-vault-demo-base",
    title: "Vault base application",
    kind: "environment",
    summary: "The Vault base used to show environment variants, placeholders, promotion, and recorded render context.",
    shows: [
      "A rendered chart can carry a render record next to the workload YAML.",
      "Environment variants can inherit from the base and add their own settings, policies, and release choices.",
      "Placeholder checks prevent a known placeholder value from reaching a cluster by accident.",
    ],
    open: ["This README.", "The render-record YAML.", "`hashicorp-vault-env-dev`, `hashicorp-vault-env-staging`, and `hashicorp-vault-env-prod`."],
    why: [
      "Vault is useful because it is sensitive and operationally specific. It forces the demo to show how config records, variants, and gates fit together.",
      "The base is where the chart output and the recorded render context meet.",
    ],
    evidence: [
      ["Vault chart page", "site/charts/hashicorp-vault-0-32-0.html"],
      ["Org summary", "data/helm-org/summary.md"],
    ],
    settingSources: {
      startingPoint: "The recipe and render-record Units identify the Vault chart inputs that produced the starting objects.",
      configHub: "Later base revisions add the shared telemetry and release-track annotations. Those edits are separate from the original Helm values.",
      installWork: "The Vault chart page records prerequisites, placeholder policy, and any chart-specific setup work.",
      liveCluster: "Live results are evidence against these Units. They do not become new desired settings automatically.",
    },
    limits: ["The render-record pattern is shown as an example in this org, not yet one record per rendered object."],
  },
  ...["dev", "staging", "prod"].map((lane) => ({
    space: `hashicorp-vault-env-${lane}`,
    title: `Vault ${lane} environment`,
    kind: "environment",
    summary: `The ${lane} Vault environment variant in the promotion and placeholder demo.`,
    shows: [
      "The environment starts from the Vault base and can carry local choices.",
      lane === "prod"
        ? "Production is wired with approval gates."
        : "This lane can accept or test changes before production.",
      "The placeholder example shows how a local real value can stay local while new safe base fields move forward.",
    ],
    open: ["This README.", "Vault StatefulSet and Service YAML.", "`hashicorp-vault-demo-base` for the upstream base."],
    why: [
      "This is a careful example of custom application delivery, not just chart installation.",
      "The important thing to inspect is how the environment records what changed and why.",
    ],
    evidence: [
      ["Org summary", "data/helm-org/summary.md"],
      ["Promote proof notes", "runs/promote-silent-skip-proof/README.md"],
    ],
    settingSources: {
      startingPoint: "The upstream link points to `hashicorp-vault-demo-base`, whose recipe and render record identify the Helm source.",
      configHub: lane === "dev"
        ? "Dev records its cost annotation and real identity-provider value as local revisions, then records the shared annotations it had to reconcile explicitly."
        : lane === "staging"
          ? "Staging records `spec.replicas: 2` and its real identity-provider value as local revisions. Unconflicted base changes arrive through promotion."
          : "Production records `spec.replicas: 3`, keeps its environment settings, and requires approval before apply.",
      installWork: "The base owns the chart prerequisites. Environment values, revisions, and approval gates remain separate from that setup work.",
      liveCluster: "Use the linked receipts to check promotion behavior. A live-only change would still be drift, not an environment setting.",
    },
    limits: lane === "dev"
      ? ["The dev lane includes a same-map departure that needed explicit reconciliation; that is part of the lesson."]
      : ["The environment is a demo lane, not a production recommendation for Vault."],
  })),
  {
    space: "byo-nginx-ai-values-24-0-2-reviewed",
    title: "Bring your own Helm values",
    kind: "source",
    summary: "A supplied NGINX values file is rendered and reviewed before it becomes a ConfigHub base variant.",
    shows: [
      "The proposed values asked for three replicas but also embedded an old API key, exposed a LoadBalancer, removed the image digest, and weakened three container security settings.",
      "The reviewed values keep the three replicas, restore the checked defaults, and refer to an existing Secret instead of storing the key in the Deployment.",
      "The five reviewed Kubernetes objects are published as one literal configuration OCI and imported into this Space without rerendering the chart.",
      "The Space uses the five catalog checks: schema, placeholder, and lifecycle-route checks can block an apply; image-digest and workload-probe checks report warnings.",
      "A live test supplied the required Secret separately, published the configuration from ConfigHub, and brought all three NGINX replicas up through Argo CD.",
    ],
    open: [
      "This README.",
      "The configuration Unit to see all five reviewed Kubernetes objects together.",
      "The Space annotations to see the public OCI source and digest.",
    ],
    why: [
      "A values file from a person or coding agent can look reasonable while producing changes that are hard to spot in templates.",
      "This example renders first, compares the result with the checked catalog configuration, fixes the concrete problems, and keeps the requested change.",
    ],
    evidence: [
      ["Bring-your-own review", "data/byo-helm-values-review/summary.md"],
      ["Proposed values", "examples/byo-helm-values/ai-values.yaml"],
      ["Reviewed values", "examples/byo-helm-values/reviewed-values.yaml"],
      ["Reviewed Kubernetes objects", "data/byo-helm-values-review/reviewed-render.yaml"],
      ["Local OCI round-trip receipt", "runs/byo-helm-values-proof/receipt.yaml"],
      ["Public OCI receipt", "runs/byo-helm-values-proof/public-oci-receipt.yaml"],
      ["ConfigHub import receipt", "runs/byo-helm-values-proof/confighub-upload-receipt.yaml"],
      ["First deployment result", "data/byo-helm-values-deploy-proof/summary.md"],
      ["Development-to-staging promotion", "data/byo-helm-values-promotion-proof/summary.md"],
      ["Promoted staging deployment", "data/byo-helm-values-staging-deploy-proof/summary.md"],
      ["NGINX chart page", "site/charts/bitnami-nginx-24-0-2.html"],
    ],
    settingSources: {
      startingPoint: "The reviewed Helm values request three replicas and safe object settings. The linked proposed and reviewed values files show exactly what changed before import.",
      configHub: "This base contains the five reviewed objects imported from OCI. It has no later environment edit; development and staging changes live in their own Spaces.",
      installWork: "The `nginx/ai-provider-credentials` Secret must be supplied separately. Its value is not stored in the public package or this Space.",
      liveCluster: "A throwaway Argo CD run observed three ready replicas. That observation checks the reviewed base; it does not set the replica count.",
    },
    limits: [
      "The API key in the proposed values is deliberately fake.",
      "The reviewed Deployment requires the `nginx/ai-provider-credentials` Secret. The Secret was supplied separately for the live test and its value was not recorded.",
      "The reviewed and promoted staging configurations each ran on one throwaway kind cluster with Argo CD. Flux, rollback, chart upgrade, and a fleet rollout have not run for this configuration.",
    ],
  },
  {
    space: "byo-nginx-ai-values-24-0-2-development",
    title: "Change the reviewed NGINX configuration",
    kind: "environment",
    summary: "A development variant that changes the reviewed NGINX result from three replicas to four without changing the saved base.",
    shows: [
      "The reviewed base remains the exact three-replica result imported from the public OCI package.",
      "Development has its own namespace and changes the Deployment directly to four replicas.",
      "The container image stays pinned, the existing-Secret reference stays in place, and the reviewed security settings stay unchanged.",
      "The catalog checks are inherited from the base.",
    ],
    open: [
      "This README.",
      "The configuration Unit and its revision history to see the replica change.",
      "`byo-nginx-ai-values-24-0-2-reviewed` for the unchanged upstream base.",
      "`byo-nginx-ai-values-24-0-2-staging` for the promoted result.",
    ],
    why: [
      "A useful reviewed configuration soon needs a development version. The important part is that the team can change the real Kubernetes object without editing or forking the Helm chart.",
      "This Space records that change and keeps the checked base available for comparison.",
    ],
    evidence: [
      ["Original values review", "data/byo-helm-values-review/summary.md"],
      ["First deployment result", "data/byo-helm-values-deploy-proof/summary.md"],
      ["Development-to-staging promotion", "data/byo-helm-values-promotion-proof/summary.md"],
      ["Promoted staging deployment", "data/byo-helm-values-staging-deploy-proof/summary.md"],
      ["NGINX chart page", "site/charts/bitnami-nginx-24-0-2.html"],
    ],
    settingSources: {
      startingPoint: "The upstream link points to the reviewed three-replica NGINX base imported from OCI.",
      configHub: "Development changes the Deployment directly to `spec.replicas: 4` and records that edit in Unit revision history. The Helm values file is not changed or rerun.",
      installWork: "The existing Secret requirement stays inherited from the reviewed base.",
      liveCluster: "This development Space has not been used as a long-lived target. Its four-replica value is desired configuration, not a runtime observation.",
    },
    limits: [
      "Four replicas are a demonstration choice, not a sizing recommendation.",
      "This development Space has not been deployed to a long-lived cluster.",
    ],
  },
  {
    space: "byo-nginx-ai-values-24-0-2-staging",
    title: "Promote the NGINX change to staging",
    kind: "environment",
    summary: "A staging variant that received the reviewed four-replica change from development.",
    shows: [
      "Staging started as a three-replica copy of development in its own namespace.",
      "Development changed to four replicas while staging stayed at three.",
      "The promotion updated staging to four replicas without changing the saved base or losing the staging namespace.",
      "The staging Unit records its upstream link and the exact promoted revision.",
    ],
    open: [
      "This README.",
      "The configuration Unit to see the four-replica staging result.",
      "Revision history to see the `UpgradeUnit` promotion record.",
      "`byo-nginx-ai-values-24-0-2-development` for the upstream change.",
    ],
    why: [
      "Copying values files between environments makes it hard to prove what moved and what stayed local.",
      "This Space shows one concrete promotion: a tested field change moves from development to staging, while ConfigHub keeps the relationship and revision history.",
    ],
    evidence: [
      ["Original values review", "data/byo-helm-values-review/summary.md"],
      ["First deployment result", "data/byo-helm-values-deploy-proof/summary.md"],
      ["Development-to-staging promotion", "data/byo-helm-values-promotion-proof/summary.md"],
      ["Promoted staging deployment", "data/byo-helm-values-staging-deploy-proof/summary.md"],
      ["NGINX chart page", "site/charts/bitnami-nginx-24-0-2.html"],
    ],
    settingSources: {
      startingPoint: "Staging began from the reviewed three-replica NGINX configuration and keeps its own namespace.",
      configHub: "The promotion records the development change to `spec.replicas: 4` while retaining the staging namespace. Revision history identifies both sources.",
      installWork: "The existing Secret requirement remains inherited from the reviewed base.",
      liveCluster: "A throwaway Argo CD run observed four ready replicas after promotion. That observation checks the promoted setting; it does not create it.",
    },
    limits: [
      "The promotion dry-run did not print a useful mutation preview. The command left stored data unchanged, but the empty output remains a product limitation.",
      "The promoted staging result reached four ready replicas through Argo CD on one throwaway kind cluster. It has not been tested on a long-lived or production target.",
    ],
  },
  {
    space: "aicr-eks-h100-training-kubeflow-v0-14-0-argocd",
    title: "AICR GPU platform configuration",
    kind: "source",
    summary: "AICR selected and ordered a GPU training platform. ConfigHub stores the 17 exact Argo CD Applications produced from that recipe as one base variant.",
    shows: [
      "The AICR v0.14.0 recipe selected 15 versioned components for EKS, H100 accelerators, Ubuntu, Kubeflow, and training.",
      "The generated Argo CD configuration contains one parent Application and 16 component Applications, ordered with sync waves 0 through 15.",
      "ConfigHub imported those 17 Applications from one OCI configuration artifact without running AICR or rendering the source chart again.",
      "This Space requires approval before apply because it changes cluster-wide GPU, monitoring, and training-platform configuration.",
    ],
    open: [
      "This README.",
      "The `aicr-eks-h100-training-kubeflow` Unit to inspect the 17 Applications and their sync waves.",
      "The Space annotations to see the OCI source reference and resolved digest.",
    ],
    why: [
      "AICR can choose and package the parts of an AI platform, but a platform team still needs a record of which recipe, package, and generated configuration each cluster should run.",
      "This example keeps the AICR recipe and OCI digest connected to the exact Argo CD objects in ConfigHub. Teams can review the objects, create environment or cluster-class variants, and promote changes without rebuilding the package from memory.",
    ],
    evidence: [
      ["AICR example guide", "docs/demo/aicr/eks-h100-training-kubeflow.md"],
      ["AICR source and OCI receipt", "examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml"],
      ["Public OCI receipt", "examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml"],
      ["ConfigHub upload receipt", "examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml"],
      ["Development and staging promotion", "examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml"],
      ["Apply policy and live assignments", "data/apply-policy-profiles/summary.md"],
      ["Rendered Argo CD Applications", "examples/aicr/eks-h100-training-kubeflow/argocd-rendered"],
    ],
    limits: [
      "This proves the package-to-base-variant path. It does not claim that Argo CD reconciled the Applications or that the workloads ran on an EKS GPU cluster.",
      "The source Helm chart OCI and the 17-object literal configuration OCI are public and anonymously pullable. The ConfigHub Space records the public literal OCI and its digest.",
      "The development and staging Spaces prove one reviewed Application change and promotion. They do not prove an AICR package upgrade.",
      "The target must already provide the `argocd` Namespace, the default Argo CD AppProject, Argo CD itself, EKS, and the required GPU capacity.",
    ],
  },
  {
    space: "aicr-eks-h100-training-kubeflow-v0-14-0-argocd-development",
    title: "Review an AICR platform change in development",
    kind: "environment",
    summary: "This development variant starts with the 17 Applications produced by AICR and changes only the Grafana administrator setting in the kube-prometheus-stack Application.",
    shows: [
      "The saved AICR base remains unchanged and records the public literal-configuration OCI digest.",
      "Development replaces the literal Grafana admin password with a reference to the `aicr-grafana-admin` Secret.",
      "The dry-run named one changed Application and left the stored configuration unchanged.",
      "The same six catalog checks remain attached, including required approval for system configuration.",
    ],
    open: [
      "This README.",
      "The `aicr-eks-h100-training-kubeflow` Unit to inspect all 17 Applications.",
      "The Unit revision history to see the one-Application development change.",
      "`aicr-eks-h100-training-kubeflow-v0-14-0-argocd` for the unchanged public-OCI base.",
    ],
    why: [
      "A generated platform bundle still needs target-specific choices. A password for Grafana should come from a Secret owned by the target, not remain as a literal value in the generated Application.",
      "This Space makes that choice explicit without editing the AICR package or changing the other 16 Applications.",
    ],
    evidence: [
      ["AICR example guide", "docs/demo/aicr/eks-h100-training-kubeflow.md"],
      ["Public OCI receipt", "examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml"],
      ["Development and staging promotion", "examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml"],
      ["Required-approval check", "examples/aicr/eks-h100-training-kubeflow/apply-policy-receipt.yaml"],
    ],
    limits: [
      "The target must provide `monitoring/aicr-grafana-admin` with the expected user and password keys.",
      "This development configuration has not been reconciled by Argo CD on an EKS GPU cluster.",
    ],
  },
  {
    space: "aicr-eks-h100-training-kubeflow-v0-14-0-argocd-staging",
    title: "Promote the AICR change to staging",
    kind: "environment",
    summary: "This staging variant received the reviewed Grafana existing-Secret change from development while keeping the other 16 AICR Applications unchanged.",
    shows: [
      "Staging started from the same 17-Application baseline as development.",
      "The promotion preview reported one changed Unit and left staging unchanged.",
      "The completed promotion made staging match the reviewed development configuration.",
      "Required approval and the other catalog checks remain attached before any apply.",
    ],
    open: [
      "This README.",
      "The `aicr-eks-h100-training-kubeflow` Unit to inspect the promoted result.",
      "The Unit revision history to see the ConfigHub promotion.",
      "`aicr-eks-h100-training-kubeflow-v0-14-0-argocd-development` for the upstream review.",
    ],
    why: [
      "Copying a large generated platform bundle into staging would hide the one intended difference.",
      "This Space records the upstream relationship and proves that the promotion changed only the reviewed kube-prometheus-stack Application.",
    ],
    evidence: [
      ["AICR example guide", "docs/demo/aicr/eks-h100-training-kubeflow.md"],
      ["Public OCI receipt", "examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml"],
      ["Development and staging promotion", "examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml"],
      ["Required-approval check", "examples/aicr/eks-h100-training-kubeflow/apply-policy-receipt.yaml"],
    ],
    limits: [
      "The target must provide `monitoring/aicr-grafana-admin` before delivery.",
      "The promotion proves stored configuration and policy behavior. It does not prove Argo CD reconciliation or GPU workload health.",
    ],
  },
  {
    space: "kubara-local-platform-v0-12-0",
    title: "Kubara platform configuration",
    kind: "source",
    summary: "Kubara generated the Helm source and cluster values for a small Kubernetes platform. ConfigHub stores the exact rendered objects as one reviewed base variant.",
    shows: [
      "Kubara v0.12.0 selected and configured Argo CD, cert-manager, External Secrets, Prometheus, Metrics Server, Traefik, and a small portal.",
      "The recorded render contains 77 Kubernetes objects. ConfigHub stores the 75 non-Secret objects; the two Secrets remain named requirements instead of being hidden.",
      "The route record lists three CRDs, four Helm-hook resources, the two Secrets, and the External Secrets prerequisite.",
      "This Space requires approval before apply because it changes cluster-wide platform configuration.",
      "A live test ran the required CRD, Secret, and Redis setup work, delivered a portable OCI through Argo CD, and brought up one selected Metrics Server Application.",
    ],
    open: [
      "This README.",
      "The `release-objects` Unit to inspect the Kubernetes objects Kubara produced.",
      "The route record in the evidence links to see what must happen around normal apply.",
    ],
    why: [
      "Kubara can choose a platform stack and generate its source configuration. The operations problem starts after that: teams need to review the exact result, compare cluster versions, and move a tested change through a fleet.",
      "Kubara still generates the platform. ConfigHub gives the team one place to review the result, compare cluster versions, approve changes, and see what each cluster should run.",
    ],
    evidence: [
      ["Kubara example guide", "docs/demo/kubara/local-platform.md"],
      ["Generation receipt", "examples/kubara/local-platform/generation-receipt.yaml"],
      ["ConfigHub upload receipt", "examples/kubara/local-platform/confighub-upload-receipt.yaml"],
      ["CRD, hook, Secret, and prerequisite record", "examples/kubara/local-platform/route-intent.yaml"],
      ["OCI delivery and live result", "data/kubara-oci-delivery-proof/summary.md"],
      ["Apply policy and live assignments", "data/apply-policy-profiles/summary.md"],
    ],
    limits: [
      "The portable OCI used a temporary registry; no permanent public Kubara package is claimed.",
      "The live test selected Metrics Server only. It deferred the ClusterExternalSecret and gRPC Ingress because their target prerequisites were absent.",
      "The full seven-service profile and a multi-cluster promotion wave have not run.",
    ],
  },
  {
    space: "sveltos-kyverno-fleet-3-8-1-staging",
    title: "Sveltos Kyverno fleet",
    kind: "fleet",
    summary: "ConfigHub approves a pilot Sveltos ClusterProfile and one selector expansion. Argo CD reconciles the two OCI revisions, then Sveltos installs Kyverno on one staging cluster and later on both.",
    shows: [
      "The `ClusterProfile` selects clusters labeled `environment=staging` and installs Kyverno chart 3.8.1 with three admission-controller replicas.",
      "ConfigHub stores the exact reviewed profile and its revision history.",
      "The pilot profile adds `rollout=pilot`, so only one of the two staging clusters is selected at first.",
      "A live runner proved that both the pilot and expanded revisions were blocked before approval, packaged from approved ConfigHub data, and reconciled by Argo CD at different OCI digests.",
      "Sveltos installed Kyverno on the pilot first, then on both clusters, and restored the replica count after it was changed by hand on each target.",
      "This Space requires approval before apply because it changes cluster-wide admission policy.",
    ],
    open: [
      "This README.",
      "The `clusterprofile` Unit to inspect the source Sveltos will reconcile.",
      "The OCI delivery receipt to see approval, package comparison, Argo CD, Sveltos, the workload, and cleanup.",
    ],
    why: [
      "A fleet tool can place and reconcile configuration, but teams still need a shared record of what each cluster group should run and how that record changed.",
      "This example separates the reviewed configuration in ConfigHub from the controller that enforces it on selected clusters.",
    ],
    evidence: [
      ["Sveltos example guide", "docs/demo/sveltos/kyverno-fleet.md"],
      ["ClusterProfile source", "examples/sveltos/kyverno-fleet/clusterprofile.yaml"],
      ["Pilot ClusterProfile source", "examples/sveltos/kyverno-fleet/clusterprofile-pilot.yaml"],
      ["First live receipt", "examples/sveltos/kyverno-fleet/live-receipt.yaml"],
      ["OCI delivery summary", "data/sveltos-oci-delivery-proof/summary.md"],
      ["OCI delivery receipt", "runs/sveltos-oci-delivery-proof/receipt.yaml"],
      ["Pinned source versions", "examples/sveltos/kyverno-fleet/source-lock.yaml"],
      ["Apply policy and live assignments", "data/apply-policy-profiles/summary.md"],
    ],
    limits: [
      "The portable OCI used a temporary registry, and Sveltos was installed directly as a pinned prerequisite.",
      "The test used two local kind clusters; it did not test a large fleet or a failed-target pause.",
      "The receipt proves this Kyverno profile and drift test, not every Sveltos feature.",
    ],
  },
  {
    space: "hook-probe-base",
    title: "A setup job delivered three ways",
    kind: "route",
    summary: "This small example shows the same setup job running from one OCI package through Argo CD, Flux, and direct apply.",
    shows: [
      "The workload and setup Job are stored as ordinary, reviewable Kubernetes objects.",
      "Argo CD, Flux, and the direct script each ran the Job and recorded its completion.",
      "The route is marked automatic only for this tested fixture and these three delivery paths.",
    ],
    open: ["This README.", "The workload and setup Job Units.", "The LifecycleRoute Unit that links the delivery receipts."],
    why: [
      "Some charts need a setup or migration Job as well as the main workload. Running that work inside one Helm command makes it difficult to see, repeat, or audit.",
      "This example moves the Job into the delivery plan. It proves the mechanism on a small fixture before we apply the same pattern to a complex chart.",
    ],
    evidence: [
      ["Hooks and CRDs guide", "docs/demo/hooks-crds/kube-prometheus-stack.md"],
      ["Hook execution proof", "runs/hook-execution-proof/receipt.yaml"],
      ["Hook OCI delivery proof", "runs/oci-hook-delivery-proof/receipt.yaml"],
    ],
    limits: ["This result does not make every Helm hook automatic. Each real chart still needs a recorded, chart-specific decision."],
  },
  {
    space: "route-sketch-kube-prometheus-stack",
    title: "Kube Prometheus Stack: hooks and CRDs",
    kind: "route",
    summary: "This example records the Kube Prometheus Stack install order and the tested 85.3.3 to 86.1.0 no-crds upgrade through Argo CD and Flux.",
    shows: [
      "The package carries ten checked CRDs, so they can be applied and established before the chart's custom resources.",
      "Eight route Units record the CRD order, webhook setup, upgrade jobs, checks, target facts, and cleanup behavior.",
      "Seven fresh-install steps passed in the direct script, using the chart's own certificate and webhook patch Jobs.",
      "Argo CD and Flux installed 85.3.3, upgraded to 86.1.0, replaced both completed setup Jobs, and passed the runtime checks.",
      "The top-level routes stay `automatic: false` because ConfigHub does not yet select this chart-specific plan for the user.",
    ],
    open: ["This README.", "The eight LifecycleRoute Units.", "The Kube Prometheus Stack chart page and render intent."],
    why: [
      "A successful Helm render is not a complete install plan for this chart. Kubernetes must see the CRDs first, and the admission webhook needs certificate setup and readiness checks.",
      "We keep the upstream chart, make each step visible beside the rendered objects, and retain a receipt for the path that ran.",
    ],
    evidence: [
      ["Hooks and CRDs guide", "docs/demo/hooks-crds/kube-prometheus-stack.md"],
      ["Kube Prometheus Stack chart page", "site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html"],
      ["Direct lifecycle proof", "runs/kps-lifecycle-route-proof/receipt.yaml"],
      ["Argo CD and Flux upgrade proof", "runs/kps-gitops-lifecycle-proof/receipt.yaml"],
      ["CRD ordering proof", "runs/crd-ordering-gap/receipt.yaml"],
      ["Lifecycle receipt", "data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml"],
      ["Render intent", "data/helm-render-intents/intents/prometheus-community-kube-prometheus-stack-85-3-3-default.yaml"],
    ],
    limits: [
      "The direct receipt covers a fresh install; the controller receipt covers the exact no-crds 85.3.3 to 86.1.0 version pair.",
      "Rollback, long-running soak, and automatic post-success removal of every temporary hook resource have not run.",
      "ConfigHub stores and checks the route records but does not yet choose and execute all eight routes automatically.",
    ],
  },
];

if (mode === "--generate") {
  const report = buildReport();
  rmSync(root, { recursive: true, force: true });
  for (const readme of report.readmes) {
    write(readme.markdownPath, readme.markdown);
    write(readme.unitPath, readme.unitYaml);
  }
  write(outputPaths.summary, report.summary);
  write(outputPaths.csv, report.csv);
  console.log(`wrote Helm Catalog README files -> ${relativeRepo(root)} (${report.readmes.length} space(s))`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputPaths.summary), `${relativeRepo(outputPaths.summary)} is missing; run npm run helm-catalog-readmes`);
  check(existsSync(outputPaths.csv), `${relativeRepo(outputPaths.csv)} is missing; run npm run helm-catalog-readmes`);
  check(readFileSync(outputPaths.summary, "utf8") === report.summary, `${relativeRepo(outputPaths.summary)} is stale; run npm run helm-catalog-readmes`);
  check(readFileSync(outputPaths.csv, "utf8") === report.csv, `${relativeRepo(outputPaths.csv)} is stale; run npm run helm-catalog-readmes`);
  for (const readme of report.readmes) {
    check(existsSync(readme.markdownPath), `${relativeRepo(readme.markdownPath)} is missing; run npm run helm-catalog-readmes`);
    check(existsSync(readme.unitPath), `${relativeRepo(readme.unitPath)} is missing; run npm run helm-catalog-readmes`);
    check(readFileSync(readme.markdownPath, "utf8") === readme.markdown, `${relativeRepo(readme.markdownPath)} is stale; run npm run helm-catalog-readmes`);
    check(readFileSync(readme.unitPath, "utf8") === readme.unitYaml, `${relativeRepo(readme.unitPath)} is stale; run npm run helm-catalog-readmes`);
    verifyLocalScriptLinks(readme.markdown, readme.markdownPath);
  }
  console.log(`verified ${report.readmes.length} Helm Catalog README file(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-helm-catalog-readmes.mjs --generate
  node scripts/generate-helm-catalog-readmes.mjs --verify`);
}

function buildReport() {
  check(existsSync(wave1Path), "data/helm-org/wave1.csv is missing; run npm run helm-org:sync");
  check(existsSync(guideCsvPath), "data/confighub-example-guides/guides.csv is missing; run npm run confighub-example-guides");
  const waveRows = parseCsv(readFileSync(wave1Path, "utf8"));
  const guideRows = parseCsv(readFileSync(guideCsvPath, "utf8"));
  const guideBySpace = new Map(guideRows.map((row) => [row.space_slug, row]));
  const readmes = [];

  for (const row of waveRows) {
    const guide = guideBySpace.get(row.space);
    check(guide, `missing generated guide metadata for ${row.space}`);
    readmes.push(buildPresetReadme(row, guide));
  }

  for (const model of DEMO_SPACES) readmes.push(buildDemoReadme(model));

  const spaces = readmes.map((item) => item.space);
  const unique = new Set(spaces);
  check(unique.size === spaces.length, "duplicate helm-catalog README space names");
  check(readmes.length === 45, `expected 45 helm-catalog README files, got ${readmes.length}`);
  readmes.sort((a, b) => sortKind(a.kind).localeCompare(sortKind(b.kind)) || a.space.localeCompare(b.space));

  return {
    readmes,
    summary: summaryMd(readmes),
    csv: csvMd(readmes),
  };
}

function buildPresetReadme(row, guide) {
  const space = row.space;
  const chart = row.chart;
  const version = row.version;
  const base = row.variant;
  const guidePath = guide.guide_path;
  const guideText = readFileSync(join(repoRoot, guidePath), "utf8");
  const chartPage = guide.chart_page || chartPageForSpace(space);
  const intentPath = `data/helm-render-intents/intents/${space}.yaml`;
  const intent = existsSync(join(repoRoot, intentPath)) ? readYaml(join(repoRoot, intentPath)) : {};
  const valuesProfile = intent.spec?.settingSources?.helmValues?.valuesProfile
    || intent.spec?.renderInputs?.valuesProfile
    || "";
  const renderedObjects = intent.spec?.renderOutput?.renderedObjects ?? "";
  const renderIntentUrl = githubBlob(intentPath);
  const renderedUrl = renderedObjects ? githubBlob(renderedObjects) : "";
  const scriptBase = presetScriptBase(chartPage, base);
  const routeCount = Number(guide.route_count || intent.spec?.lifecycle?.routeCount || 0);
  const prereqSummary = guide.prerequisite_summary && guide.prerequisite_summary !== "none"
    ? guide.prerequisite_summary
    : "no chart-specific prerequisites recorded";
  const title = `${chart} ${version} - ${base}`;
  const summary = `A ready-to-use preset for ${chart}@${version}. It solves one operating problem for this chart, while keeping the upstream Helm chart and recording the settings, rendered YAML, and evidence.`;
  const presetReason = guide.preset_reason || presetReasonFor(base);
  const markdown = `<!-- Generated by npm run helm-catalog-readmes. Do not edit by hand. -->

# ${title}

This Space exists to answer one practical question: what is a safe, repeatable way to run \`${chart}@${version}\` for this operating choice?

For this Space, the answer is the \`${base}\` preset. ${presetReason}

The preset keeps the upstream Helm chart. The catalog records the chart version, values, namespace, release name, Kubernetes capabilities, source lock, rendered YAML, and evidence, so the team can repeat this choice later.

## Why this preset exists

With plain Helm, a values file and a successful install do not explain enough later. It can be hard to tell which values, Secrets, CRDs, hooks, target assumptions, and local edits mattered. A future upgrade can also wipe changes made after install.

This preset gives the team a named starting point instead of a private guess. You can test it without a ConfigHub account, upload it when you want Hub records and variants, and reuse it as a base for dev, staging, production, regions, or customers.

## What this preset contains

- Preset: \`${base}\`.
- Kubernetes YAML: ${guide.object_count || "recorded"} object(s)${guide.main_kinds ? `, mainly ${guide.main_kinds}` : ""}.
- Needs before install: ${prereqSummary}.
- Extra Helm work: ${routeCount ? `${routeCount} recorded route(s) for hooks or surrounding setup work.` : "no hook route is recorded for this preset."}

This is not a new chart language. It is a checked way to use this Helm chart, with the chosen inputs and output kept together.

## Where each setting comes from

There are four places to look. The public preset itself contains no ConfigHub edits: it is the recorded Helm render that later ConfigHub variants start from.

| Place | What this Space records | Where to change it |
| --- | --- | --- |
| Helm values | ${valuesProfile ? `[The values profile](${githubBlob(valuesProfile)})` : "No values profile is recorded"} defines the \`${base}\` base together with release \`${intent.spec?.renderInputs?.releaseName || "chart default"}\` and namespace \`${intent.spec?.renderInputs?.namespace || "chart default"}\`. | Change the values and create or update a base preset when Helm needs to produce different objects. |
| ConfigHub changes | None in this catalog base. After upload, an edit appears in Unit revision history or in a derived environment variant. | Edit the rendered object in ConfigHub when the base shape is right but a field needs to differ for an environment, region, customer, or policy. |
| Install work | ${prereqSummary}; ${routeCount ? `${routeCount} hook or setup route(s) are recorded.` : "no separate hook or setup route is recorded."} | Follow the prerequisite and route records. Secrets, CRDs, and setup jobs are not hidden as values or ConfigHub edits. |
| Live cluster | Live state is checked against the reviewed configuration; it does not become the desired setting by itself. | Record an intended fix in ConfigHub, or remove an unintended live change as drift. |

If a later Helm render and a ConfigHub revision both change the same field, review that overlap before promotion. Do not let two layers silently own one setting.

## What to inspect in Hub

1. Read this page first.
2. Open the \`recipe\` Unit for the chart version and setting-source record, then follow its values-profile path to see what Helm was given.
3. Open the Kubernetes YAML to see what Helm produced.
4. Open Unit revision history to see any later ConfigHub change.
5. Open routes or prerequisites when the chart needs CRDs, hooks, Secrets, setup jobs, or target facts.

## Try it

Run without a ConfigHub account:

\`\`\`sh
bash <(curl -fsSL ${scriptBase}/try.sh)
\`\`\`

Upload to ConfigHub:

\`\`\`sh
bash <(curl -fsSL ${scriptBase}/confighub.sh)
\`\`\`

## Evidence and source

| Item | Link |
| --- | --- |
| Catalog chart page | [${chart}@${version}](${chartPage}) |
| Helm values profile | ${valuesProfile ? `[${valuesProfile}](${githubBlob(valuesProfile)})` : "Not recorded"} |
| Render intent | [${intentPath}](${renderIntentUrl}) |
| Rendered YAML | ${renderedObjects ? `[${renderedObjects}](${renderedUrl})` : "Recorded in the generated guide"} |
| Detailed guide | [${guidePath}](${githubBlob(guidePath)}) |
| No-account script | [try.sh](${scriptBase}/try.sh) |
| ConfigHub upload script | [confighub.sh](${scriptBase}/confighub.sh) |

## What is proven

- Render parity: \`${guide.render_parity || "not recorded"}\`.
- Local kind run: \`${guide.local_kind || "not recorded"}\`.
- GitOps OCI live run: \`${guide.gitops_oci_live || "not recorded"}\`.
- Live Helm versus ConfigHub comparison: \`${guide.live_dual_parity || "not recorded"}\`.

These claims apply to this preset. They do not mean every possible values combination for the chart has been tested.

## Limits

${presetLimits(base, routeCount).map((item) => `- ${item}`).join("\n")}
`;

  return readmeModel({
    space,
    title,
    kind: "preset",
    summary,
    markdown,
    links: [
      ["Catalog chart page", chartPage],
      ...(valuesProfile ? [["Helm values profile", githubBlob(valuesProfile)]] : []),
      ["Render intent", renderIntentUrl],
      ["Generated guide", githubBlob(guidePath)],
    ],
  });
}

function presetScriptBase(chartPage, base) {
  const pageName = String(chartPage ?? "").split("/").at(-1) || "";
  const chartSlug = pageName.replace(/\.html$/, "");
  const baseSlug = String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${SITE_BASE_URL}sh/${chartSlug}/${baseSlug}`;
}

function verifyLocalScriptLinks(markdown, sourcePath) {
  for (const match of markdown.matchAll(/https:\/\/confighub\.github\.io\/helm-expt\/site\/(sh\/[^)\s]+\.sh)/g)) {
    const localPath = join(repoRoot, "site", match[1]);
    check(existsSync(localPath), `${relativeRepo(sourcePath)} links to missing ${relativeRepo(localPath)}`);
  }
}

function buildDemoReadme(model) {
  const links = model.evidence.map(([label, path]) => [label, linkFor(path)]);
  const markdown = `<!-- Generated by npm run helm-catalog-readmes. Do not edit by hand. -->

# ${model.title}

${model.summary}

Start here when you open this Space in Hub. This page explains the problem this example is meant to show, what to inspect, why it matters, and where the evidence lives.

## Why this example exists

${model.why.join("\n\n")}

## What this example shows

${model.shows.map((item) => `- ${item}`).join("\n")}

## Where each setting comes from

${demoSettingSources(model)}

## What to inspect in Hub

${model.open.map((item) => `- ${item}`).join("\n")}

## Evidence and source

${links.map(([label, url]) => `- [${label}](${url})`).join("\n")}

## Limits

${model.limits.map((item) => `- ${item}`).join("\n")}
`;

  return readmeModel({
    space: model.space,
    title: model.title,
    kind: model.kind,
    summary: model.summary,
    markdown,
    links,
  });
}

function demoSettingSources(model) {
  const sources = {
    startingPoint:
      "Open the upstream Space or source link named on this page. That is the configuration this Space started from.",
    configHub:
      "Open Unit revision history. It records changes made after the starting configuration was saved.",
    installWork:
      "Use the linked chart or route evidence for required Secrets, CRDs, hooks, setup jobs, and target facts.",
    liveCluster:
      "Use target observations to compare the cluster with the reviewed Units. A live-only edit is drift until it is recorded or removed.",
    overlap:
      "If an upstream change and a local ConfigHub revision touch the same field, review the overlap before promotion.",
    ...(model.settingSources ?? {}),
  };
  return `| Place | What this Space records |
| --- | --- |
| Starting configuration | ${sources.startingPoint} |
| ConfigHub changes | ${sources.configHub} |
| Install work | ${sources.installWork} |
| Live cluster | ${sources.liveCluster} |

${sources.overlap}`;
}

function readmeModel({ space, title, kind, summary, markdown, links }) {
  const markdownPath = join(spacesRoot, space, "README.md");
  const unitPath = join(unitsRoot, space, "readme.yaml");
  const unitYaml = unitYamlFor({ space, title, kind, summary, markdown, links });
  return {
    space,
    title,
    kind,
    summary,
    markdown,
    markdownPath,
    unitPath,
    unitYaml,
    sourcePath: relativeRepo(markdownPath),
    unitSourcePath: relativeRepo(unitPath),
  };
}

function unitYamlFor({ space, title, kind, summary, markdown, links }) {
  return `apiVersion: helm-expt.confighub.com/v1alpha1
kind: HelmCatalogDemoReadme
metadata:
  name: readme
  labels:
    app.kubernetes.io/part-of: helm-catalog
    helm-expt.confighub.com/space: ${yamlString(space)}
    helm-expt.confighub.com/readme-kind: ${yamlString(kind)}
spec:
  space: ${yamlString(space)}
  title: ${yamlString(title)}
  summary: ${yamlString(summary)}
  sourcePath: ${yamlString(`data/helm-catalog-readmes/spaces/${space}/README.md`)}
  links:
${links.length ? links.map(([label, url]) => `    - label: ${yamlString(label)}
      url: ${yamlString(url)}`).join("\n") : "    []"}
  markdown: |-
${indent(markdown.trimEnd(), 4)}
`;
}

function summaryMd(readmes) {
  const byKind = countBy(readmes, "kind");
  return `# Helm Catalog Demo READMEs

Generated by \`scripts/generate-helm-catalog-readmes.mjs\`.

These are the README pages for the \`helm-catalog\` ConfigHub demo org. The rule is simple: one demo Space, one README. If the Space already has a README, the upload updates it. If it is missing a README, the upload creates one. It must not create duplicates such as \`readme-2\`.

The README is for someone who starts inside [hub.confighub.com](https://hub.confighub.com), opens the demo org, and wants to understand the example without reading this repository first.

Every README separates the starting Helm values or imported base, later ConfigHub changes, install work, and live observations. A user can see which layer set a field without treating cluster drift as desired configuration.

## Counts

| Kind | Spaces |
| --- | ---: |
${[...byKind.entries()].sort((a, b) => sortKind(a[0]).localeCompare(sortKind(b[0]))).map(([kind, count]) => `| ${kind} | ${count} |`).join("\n")}
| total | ${readmes.length} |

## Files

- README text: \`data/helm-catalog-readmes/spaces/<space>/README.md\`
- Upload YAML: \`data/helm-catalog-readmes/units/<space>/readme.yaml\`
- Inventory: [readmes.csv](./readmes.csv)

## Spaces

| Space | Kind | README text | Upload YAML |
| --- | --- | --- | --- |
${readmes.map((item) => `| \`${item.space}\` | ${item.kind} | [README](${relativeLink(root, item.markdownPath)}) | [readme.yaml](${relativeLink(root, item.unitPath)}) |`).join("\n")}
`;
}

function csvMd(readmes) {
  const headers = ["space", "kind", "title", "summary", "source_path", "unit_source_path"];
  const rows = readmes.map((item) => ({
    space: item.space,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    source_path: item.sourcePath,
    unit_source_path: item.unitSourcePath,
  }));
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function presetReasonFor(base) {
  const lower = base.toLowerCase();
  if (lower.includes("existing-secret") || lower.includes("reuse-existing-secret")) return "Use this when secret values should come from a Secret you control.";
  if (lower.includes("static-password")) return "Use this for comparison only; it keeps a fixed credential visible so it is not mistaken for generated secret material.";
  if (lower.includes("no-crds")) return "Use this when the platform owns the CRDs.";
  if (lower.includes("internal") || lower.includes("clusterip")) return "Use this when the service should stay inside the cluster network.";
  if (lower.includes("default")) return "Use this when you want the chart author's normal path with the inputs recorded.";
  return "Use this as one named, repeatable chart starting point.";
}

function presetLimits(base, routeCount) {
  const limits = ["This README covers this recorded preset, not every possible values file."];
  if (base.includes("static-password")) limits.push("Do not use a static password preset as a production credential strategy.");
  if (!routeCount) limits.push("No hook route is recorded for this preset.");
  return limits;
}

function chartPageForSpace(space) {
  const parts = space.split("-");
  return `${SITE_BASE_URL}charts/${parts.slice(0, -1).join("-")}.html`;
}

function linkFor(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("site/")) return `${SITE_BASE_URL}${path.slice("site/".length)}`;
  return githubBlob(path);
}

function githubBlob(path) {
  return `${GITHUB_BASE_URL}${path}`;
}

function sortKind(kind) {
  return {
    org: "0-org",
    preset: "1-preset",
    environment: "2-environment",
    source: "3-source",
    fleet: "4-fleet",
    pilot: "5-pilot",
    route: "6-route",
  }[kind] ?? kind;
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
  return counts;
}

function relativeLink(from, to) {
  const rel = relativeRepo(to).replace(`${relativeRepo(from)}/`, "");
  return rel;
}

function indent(text, spaces) {
  const prefix = " ".repeat(spaces);
  return text.split("\n").map((line) => (line ? `${prefix}${line}` : "")).join("\n");
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function parseCsv(text) {
  const rows = text.split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  const header = rows[0] ?? [];
  return rows.slice(1).map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
