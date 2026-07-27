# Config catalog demonstrations

Generated from [config-catalog/program.yaml](../../config-catalog/program.yaml). Edit the programme file, then run `npm run config-catalog`.

The catalog begins with Helm and adds other configuration formats without making teams rewrite them.

## OCI in, managed configuration, OCI out

**Public catalog and tools:** The public catalog and tools can prepare source before OCI, inspect an existing OCI, or produce a new OCI after checking or changing its contents, without requiring ConfigHub Server or an account. The result is a literal configuration OCI, an inspection result, or both, plus a source record that names the inputs, prerequisites, lifecycle work, and evidence.

### Work without an account

**Serverless:** The work does not depend on ConfigHub Server. It can run as a local command, in CI, or eventually as a hosted public service.

**Anonymous:** The work uses no ConfigHub account. Public OCI packages remain useful before anyone claims and saves a configuration.

**Composable:** The work can sit before OCI, after OCI, or between an input OCI and an output OCI. A user can choose one shape or combine several; ConfigHub is not required until they want saved records and managed operations.

| Path | What it does | Where it can fit |
| --- | --- | --- |
| `work -> OCI` | Start with a Helm chart, AICR recipe, installer package, or Kubernetes files; inspect and test the result; then build a deployable OCI package. | `source -> anonymous work -> OCI -> delivery` |
| `OCI -> work` | Pull an existing public OCI package to inspect its objects, explain its requirements, run checks, or compare it with another version. | `OCI -> anonymous inspection or testing` |
| `OCI -> work -> OCI` | Pull an OCI package, check or change its exact objects, and serve the resulting OCI package without taking ownership of it in ConfigHub. | `OCI -> anonymous work -> OCI -> delivery` |

Here, `work` means rendering, inspecting, explaining, testing, scanning, comparing, or editing configuration. These paths can be used on their own or inserted into a larger delivery flow.

| Where the work runs | Status | What that means |
| --- | --- | --- |
| Local command | available | Run the public tools without a ConfigHub account. The current receipt proves this path and keeps the files and OCI references under the user's control. |
| CI job | available | Run the same non-interactive commands in CI. The current GitHub Actions receipt proves anonymous public OCI pull, rendering, OCI creation, and pull-back comparison without ConfigHub credentials. |
| Public hosted service | planned | Inspect, test, and serve public configuration without signing in, then claim it later. Anonymous use does not create private history, saved edits, variants, or approvals. |

Anonymous users can build, inspect, test, pull, and serve public OCI packages. The boundary is **Claim this configuration in ConfigHub.** ConfigHub saves the objects and their history so a team can transform, approve, promote, and roll them out. A team can claim at whichever OCI boundary needs managed records; claiming is not a required first step.

**Inside ConfigHub:** ConfigHub stores the exact objects as Units and keeps their source, variants, diffs, checks, approvals, promotions, and observations together.

ConfigHub can join an existing delivery flow without replacing it:

- Existing: `Git -> CI -> OCI -> Argo CD or Flux -> Kubernetes`
- With ConfigHub: `Git -> CI -> OCI -> ConfigHub -> OCI -> Argo CD or Flux -> Kubernetes`
- First: ConfigHub can publish the same specs and user-supplied metadata unchanged. The release adds only the confighub.com/origin provenance annotation.
- Later: A team can create named variants, apply policy, promote reviewed changes, and roll them out to selected clusters.
- Fan-out: One recorded configuration can produce specific outputs for environments, customers, regions, or cluster groups.

**After ConfigHub:** cub release publish creates an immutable Space release OCI from the reviewed ConfigHub Units. The same reviewed objects can also be packaged as a portable OCI for anonymous or external consumers. Argo CD, Flux, and direct apply can consume that artifact without rendering the source package again.

These public paths can run before ConfigHub, after a ConfigHub output, or without ConfigHub. A person or team brings a configuration into ConfigHub when they want saved records and managed operations. A release OCI is one handoff from ConfigHub to delivery.

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

Keep the AICR recipe, remaining inputs, generated files, and OCI digest together. Upload the literal configuration OCI as a ConfigHub base variant, then use the same policy and promotion process as other configuration sources.

1. Generate and review an AICR recipe for a named target.
2. Build a Flux, Argo CD, or Helm bundle and record every remaining install-time input.
3. Keep the recipe, bundle checksums, and generation receipt together.
4. When the generated OCI is still a source package, render it once more and put the literal Kubernetes or controller objects in a separate OCI for ConfigHub upload.
5. For Flux OCI output, record the required OCIRepository, source-watcher controller, and ExternalArtifact feature gate.
6. Upload the literal bundle as a ConfigHub base variant.
7. Confirm that the system-configuration policy stops an unapproved dry-run before any target is used.
8. Promote derived variants only after the rendered diff and target checks pass.

Start with [docs/demo/aicr/eks-h100-training-kubeflow.md](../../docs/demo/aicr/eks-h100-training-kubeflow.md) or [examples/aicr/eks-h100-training-kubeflow/aicr.yaml](../../examples/aicr/eks-h100-training-kubeflow/aicr.yaml).

Evidence: [examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/recipe.yaml](../../examples/aicr/eks-h100-training-kubeflow/recipe.yaml), [examples/aicr/eks-h100-training-kubeflow/flux-oci-bundle](../../examples/aicr/eks-h100-training-kubeflow/flux-oci-bundle), [examples/aicr/eks-h100-training-kubeflow/local-oci-manifest.json](../../examples/aicr/eks-h100-training-kubeflow/local-oci-manifest.json), [examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/apply-policy-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/apply-policy-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml), [runs/aicr-variant-promotion-proof/receipt.yaml](../../runs/aicr-variant-promotion-proof/receipt.yaml), [data/aicr-variant-promotion-proof/summary.md](../../data/aicr-variant-promotion-proof/summary.md), [runs/aicr-oci-roundtrip-proof/receipt.yaml](../../runs/aicr-oci-roundtrip-proof/receipt.yaml), [data/aicr-oci-roundtrip-proof/summary.md](../../data/aicr-oci-roundtrip-proof/summary.md), [examples/aicr/eks-h100-training-kubeflow/argocd-rendered](../../examples/aicr/eks-h100-training-kubeflow/argocd-rendered).

Current limit: The original Git-oriented Flux bundle retains AICR's generated YOUR_ORG/YOUR_REPO placeholder and is not deployable. The OCI-oriented Flux bundle is generated and checksum-verified, but it has only been pushed to a temporary local registry. The Argo CD source package and 17 rendered Application objects have both passed local OCI push and pull checks. ConfigHub imported the 17 exact Application objects from the local OCI artifact as one policy-covered base variant. A separate live round trip proved that ConfigHub can publish those 17 Applications as a release OCI and that the pulled release keeps every Kubernetes field, with only the ConfigHub origin annotation added. The persistent helm-catalog organization still cannot add this staging clone because it is at its 1,000-Link quota; the empty partial Space was removed and no existing catalog links were deleted. A separate scratch run proved the exact base-to-dev-to-staging variant chain, one Grafana existing-Secret change, a dry-run that left staging unchanged, and the completed promotion. It then deleted all three temporary Spaces. Public registry publication, controller delivery, and live GPU-cluster reconciliation have not run.

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

### Public OCI inspection and packaging

**Status: partial.**

A team may want to inspect, test, or repackage public configuration without creating an account or handing ownership to another service.

Pull an OCI package, work with the exact objects, and produce a deployable OCI package. Claim it in ConfigHub only when the team wants saved history, variants, approvals, promotions, or fleet rollout.

1. Start with source files or an existing public OCI package.
2. Inspect and test the exact configuration objects.
3. Keep the result as working files, package it as OCI, or do both.
4. Pull the resulting package again and compare its objects with the reviewed files.
5. Claim the configuration in ConfigHub when it needs stored operations.

Start with [docs/user/serverless-mode.md](../../docs/user/serverless-mode.md) or [docs/reference/config-catalog-doctrine.md](../../docs/reference/config-catalog-doctrine.md) or [docs/planning/config-catalog-demo-program.md](../../docs/planning/config-catalog-demo-program.md).

Evidence: [runs/serverless-oci-gitops-proof/receipt.yaml](../../runs/serverless-oci-gitops-proof/receipt.yaml), [data/serverless-oci-gitops-proof/summary.md](../../data/serverless-oci-gitops-proof/summary.md), [runs/anonymous-oci-ci-proof/receipt.yaml](../../runs/anonymous-oci-ci-proof/receipt.yaml), [data/anonymous-oci-ci-proof/summary.md](../../data/anonymous-oci-ci-proof/summary.md), [runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml), [data/oci-deploy-stage-rollout-proof/summary.md](../../data/oci-deploy-stage-rollout-proof/summary.md).

Current limit: The NGINX receipt proves anonymous public installer OCI pull, local rendering with no ConfigHub token, output OCI pull-back, and Flux reconciliation at the recorded output digest. The CI receipt proves the same public input can be rendered, checked, packaged as OCI, and pulled back in GitHub Actions without ConfigHub credentials. The CI output is a workflow artifact containing an OCI image layout, not a public registry package. The output OCI used a temporary local registry. A hosted public workbench and public-registry receipt remain separate work.

### One reviewed bundle through Argo CD, Flux, or direct apply

**Status: partial.**

Teams want to keep their delivery controller and know that it is applying the Kubernetes objects they reviewed, rather than rendering another result from Helm values.

ConfigHub can publish one reviewed object set as a release OCI. Argo CD, Flux, or a recorded direct-apply path can consume the same files without rendering the chart again.

1. Start with the exact Kubernetes objects held as ConfigHub Units.
2. Run the checks and approval required for that configuration.
3. Publish the approved revision once as a ConfigHub release OCI.
4. Point Argo CD, Flux, or the recorded direct-apply path at that artifact.
5. Record controller status and workload observations for this configuration.

Start with [docs/user/gitops-adopter-guide.md](../../docs/user/gitops-adopter-guide.md) or [docs/user/cub-deployment-path.md](../../docs/user/cub-deployment-path.md).

Evidence: [runs/oci-hook-delivery-proof/receipt.yaml](../../runs/oci-hook-delivery-proof/receipt.yaml), [data/oci-hook-delivery-proof/summary.md](../../data/oci-hook-delivery-proof/summary.md), [runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml](../../runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml), [data/catalog-oci-delivery-proof/summary.md](../../data/catalog-oci-delivery-proof/summary.md), [runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml), [data/oci-deploy-stage-rollout-proof/summary.md](../../data/oci-deploy-stage-rollout-proof/summary.md).

Current limit: The live three-consumer receipt proves this delivery mechanism with one small routed-hook fixture. The NGINX receipt proves the first exact catalog base through Argo CD, Flux, and direct apply from one ConfigHub Space release OCI. The combined NGINX receipt proves one OCI import, one congruent ConfigHub output with only the confighub.com/origin annotation added, sequential development and staging promotions, a portable anonymous OCI output, and Argo CD reconciliation at one digest on two clusters. These receipts do not prove that every catalog base has been delivered through all three paths. A catalog entry earns a controller-delivery claim only when that exact configuration has its own receipt.

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

Evidence: [data/variant-promotion/summary.md](../../data/variant-promotion/summary.md), [runs/redis-default-confighub-proof/latest/variant-promotion-receipt.yaml](../../runs/redis-default-confighub-proof/latest/variant-promotion-receipt.yaml), [data/fleet-promotion/live-nginx-registry-migration.yaml](../../data/fleet-promotion/live-nginx-registry-migration.yaml), [runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml), [data/oci-deploy-stage-rollout-proof/summary.md](../../data/oci-deploy-stage-rollout-proof/summary.md), [runs/redis-upgrade-app-proof/receipt.yaml](../../runs/redis-upgrade-app-proof/receipt.yaml), [data/redis-upgrade-app-proof/summary.md](../../data/redis-upgrade-app-proof/summary.md).

Current limit: The older NGINX fleet receipt proves four stored environment records and policy assignment but not cluster delivery. The combined NGINX receipt proves base-to-development-to-staging promotion, a two-cluster Argo rollout, exact live-object agreement, and workload convergence. The observation receipts were recorded locally and were not submitted to ConfigHub observation storage. The Redis receipt proves a chart-version upgrade that keeps a post-render replica change, promotes in two waves, and reaches two Argo CD clusters. The current mutation-preview command returned no text, so the human preview remains a product gap.

### Kubara platform configuration to a cluster fleet

**Status: partial.**

A platform stack can span Terraform, Helm, policies, and cluster-specific choices that should be managed as one declared fleet record.

Treat Kubara as a platform configuration producer, record its generated configuration as base variants, and assign reviewed variants to cluster groups.

1. Generate a Kubara platform configuration for a declared cluster class.
2. Separate infrastructure creation from Kubernetes configuration.
3. Render the generated Argo CD bootstrap and record CRDs, hooks, Secrets, and target prerequisites beside it.
4. Upload the Kubernetes configuration as a base variant with its source record.
5. Run the required CRDs, target Secrets, and hook work before delivering the prepared configuration OCI.
6. Let the delivered Kubara Argo CD assign the selected platform services.
7. Assign derived variants to cluster groups and rollout waves.

Start with [docs/demo/kubara/local-platform.md](../../docs/demo/kubara/local-platform.md) or [examples/kubara/local-platform/README.md](../../examples/kubara/local-platform/README.md) or [docs/corpus/kubara-customized-overlays.md](../../docs/corpus/kubara-customized-overlays.md).

Evidence: [examples/kubara/local-platform/generation-receipt.yaml](../../examples/kubara/local-platform/generation-receipt.yaml), [examples/kubara/local-platform/confighub-upload-receipt.yaml](../../examples/kubara/local-platform/confighub-upload-receipt.yaml), [examples/kubara/local-platform/route-intent.yaml](../../examples/kubara/local-platform/route-intent.yaml), [examples/kubara/local-platform/rendered/object-inventory.json](../../examples/kubara/local-platform/rendered/object-inventory.json), [examples/kubara/local-platform/local-config-oci-manifest.json](../../examples/kubara/local-platform/local-config-oci-manifest.json), [runs/kubara-oci-delivery-proof/receipt.yaml](../../runs/kubara-oci-delivery-proof/receipt.yaml), [data/kubara-oci-delivery-proof/summary.md](../../data/kubara-oci-delivery-proof/summary.md), [docs/corpus/kubara-customized-overlays.md](../../docs/corpus/kubara-customized-overlays.md).

Current limit: The repo now has a reproducible Kubara v0.12.0 generation, Argo CD render, route record, and local OCI layout. ConfigHub pulled the local OCI, recorded the 75 non-Secret objects in one policy-covered Unit, required approval, and published a private release. A live route handled the three Argo CD CRDs, two target-owned Secrets, and Redis initializer before delivery. It deferred the ClusterExternalSecret and gRPC Ingress because their target prerequisites were absent. A temporary portable OCI delivered 69 prepared objects through bootstrap Argo CD. Kubara Argo CD became ready and its one selected Metrics Server Application became Synced and Healthy. The live receipt covers one kind cluster and one downstream service. It does not prove permanent public publication, the full seven-service profile, or a multi-cluster promotion wave.

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

Evidence: [examples/sveltos/kyverno-fleet/clusterprofile.yaml](../../examples/sveltos/kyverno-fleet/clusterprofile.yaml), [examples/sveltos/kyverno-fleet/source-lock.yaml](../../examples/sveltos/kyverno-fleet/source-lock.yaml), [examples/sveltos/kyverno-fleet/live-receipt.yaml](../../examples/sveltos/kyverno-fleet/live-receipt.yaml), [runs/sveltos-oci-delivery-proof/receipt.yaml](../../runs/sveltos-oci-delivery-proof/receipt.yaml), [data/sveltos-oci-delivery-proof/summary.md](../../data/sveltos-oci-delivery-proof/summary.md).

Current limit: The original live receipt records a manual export and kubectl apply. A newer receipt proves approval, private ConfigHub release, local portable OCI packaging, anonymous pull, and Argo CD delivery without copying the ClusterProfile with kubectl. Sveltos itself was installed directly as a pinned management-cluster prerequisite, and the portable OCI used a temporary registry. The current OCI receipt starts with one pilot cluster, then removes one reviewed selector label and records healthy Kyverno results on two staging clusters at a second OCI digest. The current wave used two local kind clusters. It does not prove a large production fleet or a rollout that pauses after a failed target.

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

Start with [docs/user/day2-upgrade-rollback.md](../../docs/user/day2-upgrade-rollback.md) or [data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md) or [data/redis-upgrade-app-proof/summary.md](../../data/redis-upgrade-app-proof/summary.md).

Evidence: [data/blast-radius-accuracy/summary.md](../../data/blast-radius-accuracy/summary.md), [data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md), [runs/redis-upgrade-app-proof/receipt.yaml](../../runs/redis-upgrade-app-proof/receipt.yaml), [data/redis-upgrade-app-proof/summary.md](../../data/redis-upgrade-app-proof/summary.md).

Current limit: One continuous Redis proof now imports chart 25.5.3, records a post-render replica change, reconciles chart 27.0.0 without losing that change, promotes through development and staging, and checks the same OCI digest on two Argo CD clusters. The proof is a guarded script and receipt, not a finished ConfigHub App interface. cub variant promote --dry-run -o mutations returned no text. The dry runs changed no stored data, but the current CLI does not yet give a useful human mutation preview. The portable OCI used a temporary local registry, and the live observations were recorded locally rather than submitted to ConfigHub observation storage.

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
4. Publish the approved objects as OCI and let Argo CD deliver the correction.

Start with [docs/demo/apps/rbac-review.md](../../docs/demo/apps/rbac-review.md) or [data/app-readiness/summary.md](../../data/app-readiness/summary.md).

Evidence: [data/app-readiness/summary.md](../../data/app-readiness/summary.md), [data/rbac-review-live-proof/summary.md](../../data/rbac-review-live-proof/summary.md), [runs/rbac-review-live-proof/receipt.yaml](../../runs/rbac-review-live-proof/receipt.yaml).

Current limit: The catalog-wide scan reads committed default renders; it does not yet query binding graphs across a live fleet. The live example proves one exact namespaced correction, approval, private ConfigHub release, portable OCI output, Argo CD reconciliation, and Kubernetes permission change. The portable OCI used a temporary anonymous registry. A permanent public package, Flux delivery, and fleet rollout remain separate work.

### Fleet Platform App

**Status: partial.**

Platform teams need to assign different system configurations to cluster groups without losing a central source of record.

Assign Helm, AICR, Kubara, or Sveltos-based platform configurations to clusters and manage rollout waves from ConfigHub.

1. Classify configuration as a user workload, system service, or system configuration.
2. Select the base variant and small install-time input set for each cluster class.
3. Preview the affected clusters.
4. Promote in waves and observe each target.

Start with [docs/reference/config-catalog-doctrine.md](../../docs/reference/config-catalog-doctrine.md) or [data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md).

Evidence: [data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md), [data/environment-matrix/summary.md](../../data/environment-matrix/summary.md), [data/fleet-promotion/live-nginx-registry-migration.yaml](../../data/fleet-promotion/live-nginx-registry-migration.yaml), [runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml), [data/oci-deploy-stage-rollout-proof/summary.md](../../data/oci-deploy-stage-rollout-proof/summary.md), [runs/redis-upgrade-app-proof/receipt.yaml](../../runs/redis-upgrade-app-proof/receipt.yaml), [data/redis-upgrade-app-proof/summary.md](../../data/redis-upgrade-app-proof/summary.md), [runs/sveltos-oci-delivery-proof/receipt.yaml](../../runs/sveltos-oci-delivery-proof/receipt.yaml), [data/sveltos-oci-delivery-proof/summary.md](../../data/sveltos-oci-delivery-proof/summary.md).

Current limit: The live NGINX fleet proves a Helm-derived base and four managed environments. The combined OCI receipt separately proves sequential promotion and one reviewed output on two Argo CD clusters, with exact-object and convergence receipts from cub-scout. Sveltos proves a reviewed pilot selector, a second approved revision, two OCI digests, target-by-target Kyverno results on two clusters, and drift recovery on each target. Kubara proves one approved platform configuration through route work, OCI, Argo CD, Kubara Argo CD readiness, and one healthy downstream Metrics Server Application. A large mixed-source fleet wave remains open.

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

Evidence: [data/ai-change-review/receipt.yaml](../../data/ai-change-review/receipt.yaml), [data/ai-change-review/summary.md](../../data/ai-change-review/summary.md), [runs/ai-change-review-live-proof/receipt.yaml](../../runs/ai-change-review-live-proof/receipt.yaml), [data/ai-change-review-live-proof/summary.md](../../data/ai-change-review-live-proof/summary.md), [data/app-readiness/summary.md](../../data/app-readiness/summary.md), [data/claims-register/summary.md](../../data/claims-register/summary.md).

Current limit: The committed training-runtime example proves exact local objects, diffs, and deterministic checks. A live ConfigHub run stored the reviewed object without changing its Kubernetes fields, blocked an OCI-target dry run until the exact head revision was approved, and allowed the same dry run after approval. The four-node capacity rule remains a repository check rather than a ConfigHub Function. The generic image and probe checks reported advisories because this AICR custom resource uses a deeper container path. Those warnings do not tell us whether this object is safe; the policy needs AICR-aware checks or narrower generic checks. Kubernetes apply, promotion, rollback, GPU workload health, and live observation have not run for this candidate.

## The common policy

Every pathway uses [the catalog-standard apply policy](../../config-catalog/policies/catalog-standard.yaml) after upload. Schema, placeholder, and lifecycle-route checks block incomplete configuration. Digest pinning and workload probes produce warnings. Production releases and system configuration keep those five checks and add one required approval.

This choice is based on what the configuration controls, not whether it started as Helm, AICR, `cub installer`, Kubara, Sveltos, or YAML. On 2026-07-26, the live `helm-catalog` org had 28 Spaces on the five common checks and 7 Spaces on those checks plus approval (4 production and 3 system configuration).

The [live topology receipt](../../data/apply-policy-profiles/live-helm-catalog.yaml) records which checks are connected to which Spaces. The [functional proof](../../data/apply-policy-functional-proof/summary.md) tests the behavior with temporary records: placeholders, invalid Kubernetes data, and missing approval are blocked; the same system configuration is allowed after its exact head revision is approved; and an unpinned image and missing probes are reported without blocking a dry run. No fixture configuration was applied to Kubernetes. Rerun `npm run helm-org:policy:verify` while logged into the org to compare the current topology with its receipt.
