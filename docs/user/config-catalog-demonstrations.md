# Config catalog demonstrations

Generated from [config-catalog/program.yaml](../../config-catalog/program.yaml). Edit the programme file, then run `npm run config-catalog`.

The catalog begins with Helm and adds other configuration formats without making teams rewrite them. Each path ends with the exact Kubernetes objects stored in ConfigHub. A linked source record says how those objects were made, which inputs remain, what setup is needed, and what has been tested. Derived variants then carry reviewed changes through test, development, staging, production, regions, customers, and cluster groups.

## Ways to start

### Helm chart to managed configuration

**Status: available.**

A Helm chart can hide the final Kubernetes objects, risky defaults, prerequisites, and upgrade changes behind its templates.

Pick a reviewed chart configuration, inspect the literal objects and the Helm record, upload them as a ConfigHub base variant, then make reviewed environment variants.

1. Choose a chart and preset configuration in the Helm Ops Catalog.
2. Pull the cub installer package and render it without a ConfigHub account.
3. Inspect the objects, render intent, routes, prerequisites, and receipts.
4. Upload the rendered files or a literal configuration OCI bundle as a base variant.
5. Create test, development, staging, and production variants from that base.

Start with [site/charts/index.html](../../site/charts/index.html) or [site/try.html](../../site/try.html) or [docs/user/helm-presets-and-values.md](../../docs/user/helm-presets-and-values.md) or [docs/user/variants-after-upload.md](../../docs/user/variants-after-upload.md).

Evidence: [data/helm-render-intents/summary.md](../../data/helm-render-intents/summary.md), [data/installer-oci-packages/summary.md](../../data/installer-oci-packages/summary.md), [data/outcome-coverage/summary.md](../../data/outcome-coverage/summary.md).

Current limit: A passing render does not prove that every target prerequisite or live delivery lane passes.

### AICR bundle to managed configuration

**Status: partial.**

AICR can produce a versioned AI infrastructure recipe and deployment bundle, but teams still need to record which bundle and remaining inputs each cluster should run.

Keep the AICR recipe, remaining inputs, generated files, and OCI digest together. Upload that package as a ConfigHub base variant, then use the same policy and promotion process as other configuration sources.

1. Generate and review an AICR recipe for a named target.
2. Build a Flux, Argo CD, or Helm bundle and record every remaining install-time input.
3. Keep the recipe, bundle checksums, and generation receipt together.
4. When the generated OCI is still a source package, render it once more and put the literal Kubernetes or controller objects in a separate OCI for ConfigHub upload.
5. For Flux OCI output, record the required OCIRepository, source-watcher controller, and ExternalArtifact feature gate.
6. Upload the literal bundle as a ConfigHub base variant.
7. Promote derived variants only after the rendered diff and target checks pass.

Start with [docs/demo/aicr/eks-h100-training-kubeflow.md](../../docs/demo/aicr/eks-h100-training-kubeflow.md) or [examples/aicr/eks-h100-training-kubeflow/aicr.yaml](../../examples/aicr/eks-h100-training-kubeflow/aicr.yaml).

Evidence: [examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/recipe.yaml](../../examples/aicr/eks-h100-training-kubeflow/recipe.yaml), [examples/aicr/eks-h100-training-kubeflow/flux-oci-bundle](../../examples/aicr/eks-h100-training-kubeflow/flux-oci-bundle), [examples/aicr/eks-h100-training-kubeflow/local-oci-manifest.json](../../examples/aicr/eks-h100-training-kubeflow/local-oci-manifest.json), [examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/argocd-rendered](../../examples/aicr/eks-h100-training-kubeflow/argocd-rendered).

Current limit: The original Git-oriented Flux bundle retains AICR's generated YOUR_ORG/YOUR_REPO placeholder and is not deployable. The OCI-oriented Flux bundle is generated and checksum-verified, but it has only been pushed to a temporary local registry. The Argo CD source package and 17 rendered Application objects have both passed local OCI push and pull checks. Public registry publication, ConfigHub upload, controller delivery, and live GPU-cluster reconciliation have not run.

### cub installer package to managed configuration

**Status: available.**

A team may need several chart-specific preset configurations and repeatable local rendering without introducing a server into the first test.

cub installer carries the chart, preset configurations, values, and supporting files in one OCI package, then renders the selected preset locally or uploads it to ConfigHub.

1. Pull a public installer package with no registry login.
2. Select one preset configuration.
3. Render and inspect the package locally.
4. Upload the chosen result when the team wants shared records and variants.

Start with [docs/user/installer-oci-packages.md](../../docs/user/installer-oci-packages.md) or [docs/user/try-now.md](../../docs/user/try-now.md).

Evidence: [data/installer-oci-packages/summary.md](../../data/installer-oci-packages/summary.md).

Current limit: An installer package OCI can contain several preset configurations. It is not the same artifact as a single literal configuration OCI used by cub variant upload.

### Test, development, staging, and production promotions

**Status: partial.**

Copying values files between environments makes it hard to tell what changed and whether production still matches the reviewed configuration.

Upload one base variant, keep environment changes as derived variants, preview the exact mutations, and promote them in order with production approval.

1. Create environment variants from one base.
2. Make or import a reviewed change.
3. Preview the mutations before promotion.
4. Promote through test, development, staging, and production.
5. Check delivery and live observations after each rollout.

Start with [docs/user/variants-after-upload.md](../../docs/user/variants-after-upload.md) or [docs/user/app-to-live-walkthrough.md](../../docs/user/app-to-live-walkthrough.md).

Evidence: [data/variant-promotion/summary.md](../../data/variant-promotion/summary.md), [runs/redis-default-confighub-proof/latest/variant-promotion-receipt.yaml](../../runs/redis-default-confighub-proof/latest/variant-promotion-receipt.yaml), [data/fleet-promotion/live-nginx-registry-migration.yaml](../../data/fleet-promotion/live-nginx-registry-migration.yaml).

Current limit: The Nginx fleet receipt proves stored configuration, promotion history, policy assignment, and one pending environment. It does not prove delivery or workload health on a Kubernetes cluster.

### Kubara platform configuration to a cluster fleet

**Status: partial.**

A platform stack can span Terraform, Helm, policies, and cluster-specific choices that should be managed as one declared fleet record.

Treat Kubara as a platform configuration producer, record its generated configuration as base variants, and assign reviewed variants to cluster groups.

1. Generate a Kubara platform configuration for a declared cluster class.
2. Separate infrastructure creation from Kubernetes configuration.
3. Render the generated Argo CD bootstrap and record CRDs, hooks, Secrets, and target prerequisites beside it.
4. Upload the Kubernetes configuration as a base variant with its source record.
5. Assign derived variants to cluster groups and rollout waves.

Start with [docs/demo/kubara/local-platform.md](../../docs/demo/kubara/local-platform.md) or [examples/kubara/local-platform/README.md](../../examples/kubara/local-platform/README.md) or [docs/corpus/kubara-customized-overlays.md](../../docs/corpus/kubara-customized-overlays.md).

Evidence: [examples/kubara/local-platform/generation-receipt.yaml](../../examples/kubara/local-platform/generation-receipt.yaml), [examples/kubara/local-platform/confighub-upload-receipt.yaml](../../examples/kubara/local-platform/confighub-upload-receipt.yaml), [examples/kubara/local-platform/route-intent.yaml](../../examples/kubara/local-platform/route-intent.yaml), [examples/kubara/local-platform/rendered/object-inventory.json](../../examples/kubara/local-platform/rendered/object-inventory.json), [examples/kubara/local-platform/local-config-oci-manifest.json](../../examples/kubara/local-platform/local-config-oci-manifest.json), [docs/corpus/kubara-customized-overlays.md](../../docs/corpus/kubara-customized-overlays.md).

Current limit: The repo now has a reproducible Kubara v0.12.0 generation, Argo CD render, route record, and local OCI layout. ConfigHub pulled the local OCI and recorded the 75 non-Secret objects in one policy-covered Unit. Public OCI publication, route execution, Argo CD reconciliation, and downstream platform health have not run.

### ConfigHub desired state delivered through Sveltos

**Status: partial.**

Fleet operators need a declarative way to assign platform components to matching clusters and keep placement separate from package creation.

ConfigHub manages the reviewed ClusterProfile and related configuration; Sveltos selects clusters and reconciles the declared add-ons.

1. Review the ClusterProfile and the chart versions it assigns.
2. Upload it to ConfigHub and attach the standard catalog checks.
3. Deliver the reviewed object to a Sveltos management cluster.
4. Let Sveltos select matching workload clusters and install the add-on.
5. Change a managed field and check that Sveltos restores the reviewed value.

Start with [docs/demo/sveltos/kyverno-fleet.md](../../docs/demo/sveltos/kyverno-fleet.md) or [examples/sveltos/kyverno-fleet/README.md](../../examples/sveltos/kyverno-fleet/README.md) or [examples/sveltos/kyverno-fleet/clusterprofile.yaml](../../examples/sveltos/kyverno-fleet/clusterprofile.yaml).

Evidence: [examples/sveltos/kyverno-fleet/clusterprofile.yaml](../../examples/sveltos/kyverno-fleet/clusterprofile.yaml), [examples/sveltos/kyverno-fleet/source-lock.yaml](../../examples/sveltos/kyverno-fleet/source-lock.yaml), [examples/sveltos/kyverno-fleet/live-receipt.yaml](../../examples/sveltos/kyverno-fleet/live-receipt.yaml).

Current limit: ConfigHub stored the exact ClusterProfile, but this run exported it and applied it to the management cluster with kubectl. The live test used one staging workload cluster. Automated ConfigHub delivery and a multi-cluster promotion wave have not run.

## Apps built from the same records

### Upgrade App

**Status: partial.**

A chart or package upgrade can change many clusters at once, and a green source diff does not show which workloads will be affected.

Show fleet impact, test the candidate configuration, promote it in waves, and check the rollout.

1. Compare the current and candidate base variants.
2. Find every derived variant and target that inherits the change.
3. Run configuration checks and selected live tests.
4. Approve and promote in waves.
5. Compare desired and observed state after rollout.

Start with [docs/user/day2-upgrade-rollback.md](../../docs/user/day2-upgrade-rollback.md) or [data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md).

Evidence: [data/blast-radius-accuracy/summary.md](../../data/blast-radius-accuracy/summary.md), [data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md).

Current limit: The repo proves parts of the workflow. It does not yet contain one complete Upgrade App product receipt.

### Hooks and CRDs App

**Status: partial.**

A complex chart may need CRDs, certificate setup, jobs, and checks in a particular order. A rendered YAML bundle alone does not explain or perform that work.

Keep the chart, record its install and upgrade sequence beside the rendered objects, block incomplete routes from apply, and keep receipts for the delivery paths that have actually run.

1. Start from the Kube Prometheus Stack 85.3.3 default preset and its recorded Helm inputs.
2. Apply the ten CRDs and wait for them before applying dependent custom resources.
3. Prepare the webhook certificate, apply the ordinary objects, and check readiness in the recorded order.
4. Choose the recorded Argo CD, Flux, or direct-apply implementation for each step.
5. Store every route as a checked LifecycleRoute and keep the execution receipts beside it.

Start with [docs/demo/hooks-crds/kube-prometheus-stack.md](../../docs/demo/hooks-crds/kube-prometheus-stack.md) or [docs/user/chart-hooks-what-happens.md](../../docs/user/chart-hooks-what-happens.md) or [docs/user/target-prerequisites.md](../../docs/user/target-prerequisites.md).

Evidence: [data/hooks-crds-app/summary.md](../../data/hooks-crds-app/summary.md), [data/hooks-crds-app/live-receipt.yaml](../../data/hooks-crds-app/live-receipt.yaml), [data/lifecycle-routes/summary.md](../../data/lifecycle-routes/summary.md), [runs/crd-ordering-gap/receipt.yaml](../../runs/crd-ordering-gap/receipt.yaml), [runs/hook-execution-proof/receipt.yaml](../../runs/hook-execution-proof/receipt.yaml), [runs/oci-hook-delivery-proof/receipt.yaml](../../runs/oci-hook-delivery-proof/receipt.yaml), [data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml](../../data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml).

Current limit: The Kube Prometheus Stack routes are stored and checked, but they remain automatic false until their individual execution paths are proved. The smaller hook fixture is automatic only because the same packaged Job ran through Argo CD, Flux, and direct apply. The route policy rejects incomplete or unsupported automatic claims; it does not decide which routes a chart needs.

### RBAC Review App

**Status: partial.**

Risky permissions are hard to find when application configuration is split across charts, repositories, and clusters.

Query the imported Kubernetes objects, find broad access, and propose exact corrections for review.

1. Read Role, ClusterRole, and binding Units across selected Spaces.
2. Report broad verbs, resources, and subjects.
3. Propose a concrete object diff.
4. Apply the change only after policy and approval.

Start with [data/app-readiness/summary.md](../../data/app-readiness/summary.md).

Evidence: [data/app-readiness/summary.md](../../data/app-readiness/summary.md).

Current limit: The committed lane is read-only analysis. It does not yet prove a reviewed correction delivered to a live cluster.

### Fleet Platform App

**Status: partial.**

Platform teams need to assign different system configurations to cluster groups without losing a central source of record.

Assign Helm, AICR, Kubara, or Sveltos-based platform configurations to clusters and manage rollout waves from ConfigHub.

1. Classify configuration as a user workload, system service, or system configuration.
2. Select the base variant and small install-time input set for each cluster class.
3. Preview the affected clusters.
4. Promote in waves and observe each target.

Start with [docs/reference/config-catalog-doctrine.md](../../docs/reference/config-catalog-doctrine.md) or [data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md).

Evidence: [data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md), [data/environment-matrix/summary.md](../../data/environment-matrix/summary.md), [data/fleet-promotion/live-nginx-registry-migration.yaml](../../data/fleet-promotion/live-nginx-registry-migration.yaml).

Current limit: The live Nginx fleet proves a Helm-derived base and four managed environments. Sveltos proves one selected workload cluster and drift recovery. Kubara delivery and a multi-cluster Sveltos promotion wave are not yet complete.

### AI Change Review App

**Status: partial.**

An agent can change values or Kubernetes fields faster than a person can check the resulting objects and fleet impact.

Turn the suggestion into exact objects and diffs, run checks, require the right approval, and keep the decision record.

1. Let the agent propose values or object edits.
2. Render or apply the proposal to a derived variant.
3. Show the exact object and fleet diff.
4. Run schema, placeholder, security, and target checks.
5. Approve, promote, observe, or unwind the change.

Start with [docs/demo/apps/ai-change-review.md](../../docs/demo/apps/ai-change-review.md) or [docs/user/ai-assisted-helm-changes.md](../../docs/user/ai-assisted-helm-changes.md) or [config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml).

Evidence: [data/ai-change-review/receipt.yaml](../../data/ai-change-review/receipt.yaml), [data/ai-change-review/summary.md](../../data/ai-change-review/summary.md), [data/app-readiness/summary.md](../../data/app-readiness/summary.md), [data/claims-register/summary.md](../../data/claims-register/summary.md).

Current limit: The committed training-runtime example proves exact local objects, diffs, and deterministic checks. ConfigHub Functions, approval, apply, and live observation have not run for that candidate.

## The common policy

Every pathway uses [the catalog-standard apply policy](../../config-catalog/policies/catalog-standard.yaml) after upload. Schema and placeholder checks block bad configuration. Digest pinning and workload probes produce warnings. Production keeps those four checks and adds one required approval.

The two filters name their allowed Triggers explicitly. On 26 July 2026 the live `helm-catalog` org had 26 Spaces on the four-check baseline and four production Spaces on the five-check policy. Read the [live receipt](../../data/apply-policy-profiles/live-helm-catalog.yaml), or rerun `npm run helm-org:policy:verify` while logged into that org.
