# Config catalog demonstrations

Generated from [config-catalog/program.yaml](../../config-catalog/program.yaml). Edit the programme file, then run `npm run config-catalog`.

The catalog begins with Helm and adds other configuration formats without making teams rewrite them.

## OCI in, managed configuration, OCI out

**Public catalog and tools:** Starting examples can prepare source before OCI, inspect an existing OCI, or produce a new OCI after checking or changing its contents, without requiring ConfigHub Server or an account. The result is a literal configuration OCI, an inspection result, or both, plus a source record that names the inputs, prerequisites, lifecycle work, and evidence.

### Work without an account

**Serverless:** The work does not depend on ConfigHub Server. It can run as a local command or in CI. The public Check my config page can also inspect and compare rendered YAML inside the browser without uploading it.

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

After a configuration is claimed or uploaded, variants, promotions, releases, Apps, apply gates, and fleet examples use ConfigHub Server and require an account.

**Inside ConfigHub:** ConfigHub stores the exact objects as Units and keeps their source, variants, diffs, checks, approvals, promotions, and observations together.

ConfigHub can join an existing delivery flow without replacing it:

- Existing: `Git -> CI -> OCI -> Argo CD or Flux -> Kubernetes`
- With ConfigHub: `Git -> CI -> OCI -> ConfigHub -> OCI -> Argo CD or Flux -> Kubernetes`
- First: ConfigHub can publish the same specs and user-supplied metadata unchanged. The release adds only the confighub.com/origin provenance annotation.
- Later: A team can create named variants, apply policy, promote reviewed changes, and roll them out to selected clusters.
- Fan-out: One recorded configuration can produce specific outputs for environments, customers, regions, or cluster groups.

**After ConfigHub:** cub release publish creates an immutable Space release OCI from the reviewed ConfigHub Units. The same reviewed objects can also be packaged as a portable OCI for anonymous or external consumers. Argo CD, Flux, and direct apply can consume that artifact without rendering the source package again.

These public paths can run before ConfigHub, after a ConfigHub output, or without ConfigHub. A person or team brings a configuration into ConfigHub when they want saved records and managed operations. A release OCI is one handoff from ConfigHub to delivery.

## Find your path

Start with two questions:

1. **What do you already have?** Helm chart and values, AICR recipe or bundle, cub installer package, Existing OCI package, Kubernetes YAML.
2. **What do you want to do next?** Inspect and verify, Install, Upload and save, Customize, Promote, Deliver, Operate, Build an App.

Every catalog entry should then use the same reading order:

1. Ready-made configurations
2. Package and artifact choices
3. Inputs, prerequisites, CRDs, hooks, and other work before install
4. ConfigHub upload
5. Variants, upgrades, and promotions
6. Delivery evidence
7. Current limits

Keep the detailed evidence pages. Use this order on catalog entry pages so a person can choose a starting point and a next action before reading the proof details.

## Questions every example must answer

Every example and catalog entry must answer these questions in plain English and link to the exact files or receipts that support the answer.

| Question | A useful answer must |
| --- | --- |
| What can a new user do first? | Give one short path from a named input to one inspected, deployable result before introducing ConfigHub accounts, fleets, policy, or Apps. |
| Is testing and understanding this configuration easier than using Helm normally? | Show the rendered objects, the recorded inputs, the relevant comparison or parity result, and the command that repeats the check. |
| Can I find the hooks, CRDs, prerequisites, and other chart quirks? | List them beside the package, explain what each one does, name who performs it, and distinguish a proved route from a proposed route. |
| Can I use the rendered-manifest pattern without giving up my Helm chart? | Keep the chart as source, make the literal Kubernetes objects easy to inspect and save, and explain how later edits and upgrades are handled. |
| Can source-to-OCI be automated? | Name the repeatable command or workflow, record the source and output digests, and state which steps still require a person or target-specific input. |
| Can I bring the chart and values my team or AI produced? | Render them without applying, compare them with known configurations, point out risky or unusual changes, and let the user deploy or save the reviewed result. |
| What happens after the first deployment? | Show how the same reviewed result can become a saved base, a development or production variant, a promotion, and an OCI delivered through Argo CD or Flux. Keep direct local apply as a separate portability test. |
| What has not been proved? | Keep missing controller paths, upgrades, target checks, and product work visible. Do not turn one passing path into a general claim. |

## Examples from first deployment to Apps

Every example starts with one person getting one deployable result. Saved configuration, environments, rollout, and Apps come afterward.

### 1. Pull, inspect, and verify a ready-made package

**Status: available.**

You want to deploy a public package, but you need to know what it contains and why this configuration was chosen.

Pull one public installer OCI without an account, inspect the exact Kubernetes objects and recorded Helm inputs, then check the parity, prerequisite, route, and verification evidence before deployment.

1. Choose a ready-made configuration from the catalog.
2. Pull the recorded package digest and render it locally.
3. Read the objects, Helm render intent, prerequisites, CRD and hook routes, and known limitations.
4. Run the named verification command or inspect the committed receipt.
5. Deploy only after the result matches the target you intend to use.

Evidence: [data/installer-oci-packages/summary.md](../../data/installer-oci-packages/summary.md), [data/helm-render-intents/summary.md](../../data/helm-render-intents/summary.md), [data/outcome-coverage/summary.md](../../data/outcome-coverage/summary.md), [docs/user/verify-it-yourself.md](../../docs/user/verify-it-yourself.md).

Current limit: Evidence is scoped to the named chart, version, preset configuration, render inputs, and proof lane.

### 2. Bring your own chart and values

**Status: available.**

You have a chart and values written by your team or an AI, and you do not want to apply plausible configuration without seeing what it creates.

Render the chart into exact Kubernetes objects, compare it with chart defaults and known catalog configurations, identify prerequisites and risky changes, then deploy it or save the reviewed result.

1. Supply the chart, version, values, namespace, release name, and target capabilities.
2. Render the exact objects without applying them.
3. Compare the result with the chart defaults and relevant catalog configurations.
4. Review the object diff, placeholders, Secrets, CRDs, hooks, dependencies, and checks.
5. Deploy the reviewed files or claim them in ConfigHub.

Evidence: [examples/byo-helm-values/ai-values.yaml](../../examples/byo-helm-values/ai-values.yaml), [examples/byo-helm-values/reviewed-values.yaml](../../examples/byo-helm-values/reviewed-values.yaml), [data/byo-helm-values-review/summary.md](../../data/byo-helm-values-review/summary.md), [data/byo-helm-values-review/review.yaml](../../data/byo-helm-values-review/review.yaml), [data/byo-helm-values-review/public-and-confighub.md](../../data/byo-helm-values-review/public-and-confighub.md), [runs/byo-helm-values-proof/receipt.yaml](../../runs/byo-helm-values-proof/receipt.yaml), [runs/byo-helm-values-proof/public-oci-receipt.yaml](../../runs/byo-helm-values-proof/public-oci-receipt.yaml), [runs/byo-helm-values-proof/confighub-upload-receipt.yaml](../../runs/byo-helm-values-proof/confighub-upload-receipt.yaml), [data/byo-helm-values-deploy-proof/summary.md](../../data/byo-helm-values-deploy-proof/summary.md), [runs/byo-helm-values-deploy-proof/receipt.yaml](../../runs/byo-helm-values-deploy-proof/receipt.yaml), [data/byo-helm-values-promotion-proof/summary.md](../../data/byo-helm-values-promotion-proof/summary.md), [runs/byo-helm-values-promotion-proof/receipt.yaml](../../runs/byo-helm-values-promotion-proof/receipt.yaml), [data/byo-helm-values-staging-deploy-proof/summary.md](../../data/byo-helm-values-staging-deploy-proof/summary.md), [runs/byo-helm-values-staging-deploy-proof/receipt.yaml](../../runs/byo-helm-values-staging-deploy-proof/receipt.yaml), [docs/user/choosing-commands.md](../../docs/user/choosing-commands.md), [docs/reference/direct-cub-helm-model.md](../../docs/reference/direct-cub-helm-model.md), [docs/user/ai-assisted-helm-changes.md](../../docs/user/ai-assisted-helm-changes.md), [data/ai-change-review/summary.md](../../data/ai-change-review/summary.md).

Current limit: The worked NGINX example checks one deterministic values proposal. It does not claim that every private chart or generated values file can be judged automatically. The required Secret was supplied separately and its value was not recorded. The exact example has passed Argo CD delivery at three replicas, a development-to-staging promotion to four replicas, and a second Argo CD delivery at four ready replicas. Flux delivery, rollback, chart upgrade, and fleet rollout have not run for this configuration.

### 3. Save the reviewed result and change it

**Status: available.**

Local files are useful for one deployment, but a team needs shared history and changes that remain visible.

Upload the reviewed objects as a ConfigHub base variant, then change exact Kubernetes fields in named derived variants.

1. Upload the literal configuration OCI or rendered files.
2. Check the imported Units against the reviewed object inventory.
3. Create a named development or customer variant.
4. Make one exact field change and review the diff.
5. Publish a new OCI only after the revision is accepted.

Evidence: [docs/user/variants-after-upload.md](../../docs/user/variants-after-upload.md), [data/base-variant-records/summary.md](../../data/base-variant-records/summary.md), [data/catalog-oci-delivery-proof/summary.md](../../data/catalog-oci-delivery-proof/summary.md), [data/byo-helm-values-promotion-proof/summary.md](../../data/byo-helm-values-promotion-proof/summary.md), [runs/byo-helm-values-promotion-proof/receipt.yaml](../../runs/byo-helm-values-promotion-proof/receipt.yaml).

Current limit: A field that changes the Helm render belongs in a new rendered base; post-render fields belong in derived variants.

### 4. Upgrade and promote through environments

**Status: available.**

Copying values or manifests between environments hides the exact change and makes upgrades hard to repeat.

Reconcile a candidate base, keep the intended post-render changes, preview the affected variants, and promote the accepted revision in sequence.

1. Compare the current and candidate source versions.
2. Reapply the recorded derived changes to the candidate objects.
3. Run checks and inspect the exact mutations.
4. Promote through development and staging in order.
5. Require approval before the production revision is delivered.

Evidence: [runs/redis-upgrade-app-proof/receipt.yaml](../../runs/redis-upgrade-app-proof/receipt.yaml), [data/redis-upgrade-app-proof/summary.md](../../data/redis-upgrade-app-proof/summary.md), [data/byo-helm-values-promotion-proof/summary.md](../../data/byo-helm-values-promotion-proof/summary.md), [runs/byo-helm-values-promotion-proof/receipt.yaml](../../runs/byo-helm-values-promotion-proof/receipt.yaml), [docs/user/day2-upgrade-rollback.md](../../docs/user/day2-upgrade-rollback.md).

Current limit: The current CLI dry-run does not yet print a useful human mutation preview.

### 5. Deliver one reviewed OCI and roll it out

**Status: available.**

A reviewed configuration is not useful until the intended controller applies the same objects and the workload becomes healthy.

Publish one immutable OCI, reconcile its digest through Argo CD or Flux, and record controller and workload results for each target.

1. Publish the approved Units as one release OCI.
2. Pin the exact digest in the delivery controller.
3. Reconcile one development target.
4. Advance the same accepted revision to a sibling environment.
5. Roll it out to a small target set and record every result.

Evidence: [data/byo-helm-values-deploy-proof/summary.md](../../data/byo-helm-values-deploy-proof/summary.md), [runs/byo-helm-values-deploy-proof/receipt.yaml](../../runs/byo-helm-values-deploy-proof/receipt.yaml), [data/byo-helm-values-staging-deploy-proof/summary.md](../../data/byo-helm-values-staging-deploy-proof/summary.md), [runs/byo-helm-values-staging-deploy-proof/receipt.yaml](../../runs/byo-helm-values-staging-deploy-proof/receipt.yaml), [runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml), [data/oci-deploy-stage-rollout-proof/summary.md](../../data/oci-deploy-stage-rollout-proof/summary.md), [docs/user/app-to-live-walkthrough.md](../../docs/user/app-to-live-walkthrough.md).

Current limit: The current flagship receipts use small local target sets, not a large production fleet.

### 6. Manage the CRDs, hooks, and setup work around a package

**Status: available.**

Some packages need CRDs, certificates, jobs, or checks in a specific order that a flat manifest bundle does not perform by itself.

Keep that work beside the package, name who runs each step, execute only the supported path, and retain a receipt.

1. Read the chart-specific lifecycle routes.
2. Apply CRDs and wait before dependent custom resources.
3. Run or replace the chart-specific setup work.
4. Deliver the ordinary objects.
5. Check readiness and record what actually ran.

Evidence: [docs/demo/hooks-crds/kube-prometheus-stack.md](../../docs/demo/hooks-crds/kube-prometheus-stack.md), [data/hooks-crds-app/summary.md](../../data/hooks-crds-app/summary.md), [data/kps-lifecycle-route-proof/summary.md](../../data/kps-lifecycle-route-proof/summary.md), [runs/kps-lifecycle-route-proof/receipt.yaml](../../runs/kps-lifecycle-route-proof/receipt.yaml), [data/kps-gitops-lifecycle-proof/summary.md](../../data/kps-gitops-lifecycle-proof/summary.md), [runs/kps-gitops-lifecycle-proof/receipt.yaml](../../runs/kps-gitops-lifecycle-proof/receipt.yaml), [data/lifecycle-routes/summary.md](../../data/lifecycle-routes/summary.md).

Current limit: Seven fresh-install steps passed in the direct script. The no-crds 85.3.3 to 86.1.0 path also passed through Argo CD and Flux, including setup-Job replacement and post-upgrade checks. A route is automatic only for the chart, version, delivery path, and execution receipt that proves it.

### 7. Use an App for a repeated operational job

**Status: example-only.**

Upgrade review, RBAC review, fleet assignment, and AI change review require several configuration operations to work together.

Use saved configuration, checks, approvals, delivery, and observations as one repeatable operational workflow.

1. Choose the operational question the App answers.
2. Select the saved configurations and targets in scope.
3. Produce exact proposed changes and affected-target results.
4. Run policy and approval before delivery.
5. Observe the rollout and keep the decision record.

Evidence: [data/app-readiness/summary.md](../../data/app-readiness/summary.md), [docs/demo/apps/ai-change-review.md](../../docs/demo/apps/ai-change-review.md), [docs/demo/apps/rbac-review.md](../../docs/demo/apps/rbac-review.md).

Current limit: The current Apps are reproducible demonstrations, not finished ConfigHub App interfaces.

## Ways to start

### Helm chart to managed configuration

**Worked example: working.** The Redis example pulls a public package, shows the exact Helm inputs and Kubernetes objects, checks Helm parity, and can continue into ConfigHub.

**Broader status: available.** The result applies to the named Redis versions and preset configurations, not every Helm chart.

A Helm chart can hide the final Kubernetes objects, risky defaults, prerequisites, and upgrade changes behind its templates.

Pick a reviewed chart configuration, inspect the literal objects and the Helm record, upload them as a ConfigHub base variant, then make reviewed environment variants.

1. Choose a chart and preset configuration in the Configuration Catalog.
2. Pull the cub installer package and render it without a ConfigHub account.
3. Inspect the objects, render intent, routes, prerequisites, and receipts.
4. Upload the rendered files or a literal configuration OCI bundle as a base variant.
5. Create test, development, staging, and production variants from that base.

Start with [site/charts/index.html](../../site/charts/index.html) or [site/try.html](../../site/try.html) or [docs/user/helm-presets-and-values.md](../../docs/user/helm-presets-and-values.md) or [docs/user/variants-after-upload.md](../../docs/user/variants-after-upload.md).

Evidence: [data/helm-render-intents/summary.md](../../data/helm-render-intents/summary.md), [data/installer-oci-packages/summary.md](../../data/installer-oci-packages/summary.md), [data/outcome-coverage/summary.md](../../data/outcome-coverage/summary.md).

Current limit: A passing render does not prove that every target prerequisite or live delivery lane passes.

### AICR bundle to managed configuration

**Worked example: working.** The AICR example publishes a source OCI and a 17-Application literal OCI, imports the literal objects into ConfigHub, and promotes one reviewed change from development to staging.

**Broader status: partial.** Argo CD delivery and a live GPU workload have not run.

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

Evidence: [examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/recipe.yaml](../../examples/aicr/eks-h100-training-kubeflow/recipe.yaml), [examples/aicr/eks-h100-training-kubeflow/flux-oci-bundle](../../examples/aicr/eks-h100-training-kubeflow/flux-oci-bundle), [examples/aicr/eks-h100-training-kubeflow/local-oci-manifest.json](../../examples/aicr/eks-h100-training-kubeflow/local-oci-manifest.json), [examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/apply-policy-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/apply-policy-receipt.yaml), [examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml](../../examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml), [runs/aicr-variant-promotion-proof/receipt.yaml](../../runs/aicr-variant-promotion-proof/receipt.yaml), [data/aicr-variant-promotion-proof/summary.md](../../data/aicr-variant-promotion-proof/summary.md), [runs/aicr-oci-roundtrip-proof/receipt.yaml](../../runs/aicr-oci-roundtrip-proof/receipt.yaml), [data/aicr-oci-roundtrip-proof/summary.md](../../data/aicr-oci-roundtrip-proof/summary.md), [examples/aicr/eks-h100-training-kubeflow/argocd-rendered](../../examples/aicr/eks-h100-training-kubeflow/argocd-rendered).

Current limit: The original Git-oriented Flux bundle retains AICR's generated YOUR_ORG/YOUR_REPO placeholder and is not deployable. The OCI-oriented Flux bundle is generated and checksum-verified, but it has only been pushed to a temporary local registry. The Argo CD source package and the 17-object literal configuration OCI are public in Google Artifact Registry and passed anonymous pull checks at their recorded digests. ConfigHub imported the 17 exact Application objects from the public literal configuration OCI as one policy-covered base variant. The persistent helm-catalog organization has a base, development, and staging chain. Development changes only the kube-prometheus-stack Application to use a target-owned Grafana Secret; staging received that exact reviewed change. A dry-run left development unchanged, a second dry-run left staging unchanged, and required approval remains attached to all three Spaces. A separate live round trip proved that ConfigHub can publish those 17 Applications as a release OCI and that the pulled release keeps every Kubernetes field, with only the ConfigHub origin annotation added. A separate scratch run remains as supplementary evidence for the same base-to-development-to-staging behavior. Argo CD delivery and live GPU-cluster reconciliation have not run.

### cub installer package to managed configuration

**Worked example: working.** Public catalog packages pull without a registry login, render locally, write one selected configuration as OCI, and verify the output by reading it back.

**Broader status: available.** The lifecycle route for hooks, CRDs, setup jobs, and target prerequisites remains specific to each preset configuration.

A team may need several chart-specific preset configurations and repeatable local rendering without introducing a server into the first test.

cub installer carries the chart, preset configurations, values, and supporting files in one OCI package, then renders the selected preset locally or uploads it to ConfigHub.

1. Pull a public installer package with no registry login.
2. Select one preset configuration.
3. Render and inspect the package locally.
4. Keep the result as files, or write the selected non-secret objects as OCI with cub installer setup --output-oci.
5. Upload the chosen result when the team wants shared records and variants.

Start with [docs/user/installer-oci-packages.md](../../docs/user/installer-oci-packages.md) or [docs/user/try-now.md](../../docs/user/try-now.md).

Evidence: [data/installer-oci-packages/summary.md](../../data/installer-oci-packages/summary.md).

Current limit: An installer package OCI can contain several preset configurations. The rendered OCI contains one selected preset. --output-oci excludes separated secret files, records the source package and selected base, and checks the output object set by reading it back. A chart with hooks, CRDs, setup jobs, or target prerequisites still needs the route recorded for that preset.

### Plain Kubernetes YAML to managed configuration

**Worked example: working.** Four committed YAML files become four ConfigHub Units, one per object. A receipt reads the Units back and proves that the stored object set matches the supplied files.

**Broader status: available.** The focused receipt proves import only. It does not claim Kubernetes apply, controller delivery, promotion, rollback, or workload health.

A team may already have reviewed Kubernetes YAML and should not need to wrap it in a chart or run another renderer before ConfigHub can record it.

Upload the files as exact Kubernetes objects, keep their source identity, and use the saved base for later variants, promotions, releases, and Apps.

1. Start with reviewed Kubernetes YAML.
2. Upload it without a Helm or AICR render step.
3. Read the stored Units back and compare their object-set hash with the files.
4. Keep one README Unit beside the configuration so a new user can understand the example.
5. Continue with the official ConfigHub tutorial when the base needs changes, promotion, or delivery.

Start with [examples/plain-yaml/acme-web/README.md](../../examples/plain-yaml/acme-web/README.md) or [docs/user/adopting-existing-apps.md](../../docs/user/adopting-existing-apps.md) or [docs/user/app-to-live-walkthrough.md](../../docs/user/app-to-live-walkthrough.md).

Evidence: [runs/literal-yaml-upload-proof/receipt.yaml](../../runs/literal-yaml-upload-proof/receipt.yaml), [data/literal-config-examples/summary.md](../../data/literal-config-examples/summary.md).

Current limit: The plain YAML example has no Helm parity question because there is no chart or render step. The current focused receipt stops after exact ConfigHub import and policy attachment.

### Public OCI inspection and packaging

**Worked example: working.** Local and CI proofs pull public packages without ConfigHub credentials, inspect or change exact objects, build OCI, and compare the output after pulling it back. The reviewed NGINX change is also published as a permanent public OCI and imported into a ConfigHub Space at its recorded digest.

**Broader status: partial.** The hosted browser check handles rendered YAML only. Hosted chart rendering, OCI pulls, cluster checks, and live tests are not available. Some delivery proofs still use workflow artifacts or temporary registries and are labeled that way.

A team may want to inspect, test, or repackage public configuration without creating an account or handing ownership to another service.

Pull an OCI package, work with the exact objects, and produce a deployable OCI package. Claim it in ConfigHub only when the team wants saved history, variants, approvals, promotions, or fleet rollout.

1. Start with source files or an existing public OCI package.
2. Inspect and test the exact configuration objects.
3. Keep the result as working files, package it as OCI, or do both.
4. Pull the resulting package again and compare its objects with the reviewed files.
5. Claim the configuration in ConfigHub when it needs stored operations.

Start with [docs/user/serverless-mode.md](../../docs/user/serverless-mode.md) or [docs/reference/config-catalog-doctrine.md](../../docs/reference/config-catalog-doctrine.md) or [docs/planning/config-catalog-demo-program.md](../../docs/planning/config-catalog-demo-program.md).

Evidence: [runs/serverless-oci-gitops-proof/receipt.yaml](../../runs/serverless-oci-gitops-proof/receipt.yaml), [data/serverless-oci-gitops-proof/summary.md](../../data/serverless-oci-gitops-proof/summary.md), [runs/anonymous-oci-ci-proof/receipt.yaml](../../runs/anonymous-oci-ci-proof/receipt.yaml), [data/anonymous-oci-ci-proof/summary.md](../../data/anonymous-oci-ci-proof/summary.md), [runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml), [data/oci-deploy-stage-rollout-proof/summary.md](../../data/oci-deploy-stage-rollout-proof/summary.md), [runs/anonymous-oci-transform-proof/public-oci-receipt.yaml](../../runs/anonymous-oci-transform-proof/public-oci-receipt.yaml), [runs/existing-oci-upload-proof/receipt.yaml](../../runs/existing-oci-upload-proof/receipt.yaml), [data/literal-config-examples/summary.md](../../data/literal-config-examples/summary.md).

Current limit: The NGINX receipt proves anonymous public installer OCI pull, local rendering with no ConfigHub token, output OCI pull-back, and Flux reconciliation at the recorded output digest. The CI receipt proves the same public input can be rendered, checked, packaged as OCI, and pulled back in GitHub Actions without ConfigHub credentials. The CI output is a workflow artifact containing an OCI image layout, not a public registry package. The Flux proof used a temporary local registry. The reviewed NGINX replica change has a separate permanent public-registry receipt and exact ConfigHub import receipt. Direct import of an OCI with companion JSON records is supported in cub v0.2.6 and later. Run cub upgrade before using this path with an older client. A hosted public workbench remains separate work.

### One reviewed bundle through GitOps, with a direct portability check

**Worked example: working.** NGINX and the hook fixture have passed recorded OCI delivery through Argo CD and Flux without rerendering the reviewed objects. Separate direct local tests consumed the same artifacts.

**Broader status: partial.** These receipts do not cover every catalog configuration.

Teams want to keep their delivery controller and know that it is applying the Kubernetes objects they reviewed, rather than rendering another result from Helm values.

ConfigHub can publish one reviewed object set as a release OCI. Argo CD or Flux can consume the same files without rendering the chart again. A separate direct local test can check the same artifact.

1. Start with the exact Kubernetes objects held as ConfigHub Units.
2. Run the checks and approval required for that configuration.
3. Publish the approved revision once as a ConfigHub release OCI.
4. Point Argo CD or Flux at that artifact. Use the direct path separately when you need a local portability test.
5. Record controller status and workload observations for this configuration.

Start with [docs/user/gitops-adopter-guide.md](../../docs/user/gitops-adopter-guide.md) or [docs/user/cub-deployment-path.md](../../docs/user/cub-deployment-path.md).

Evidence: [runs/oci-hook-delivery-proof/receipt.yaml](../../runs/oci-hook-delivery-proof/receipt.yaml), [data/oci-hook-delivery-proof/summary.md](../../data/oci-hook-delivery-proof/summary.md), [runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml](../../runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml), [data/catalog-oci-delivery-proof/summary.md](../../data/catalog-oci-delivery-proof/summary.md), [runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml), [data/oci-deploy-stage-rollout-proof/summary.md](../../data/oci-deploy-stage-rollout-proof/summary.md).

Current limit: The routed-hook receipt proves Argo CD and Flux delivery with one small fixture; a separate direct local path consumed the same release OCI. The NGINX receipt proves the first exact catalog base through Argo CD and Flux from one ConfigHub Space release OCI; a separate direct local test records the same digest. The combined NGINX receipt proves one OCI import, one congruent ConfigHub output with only the confighub.com/origin annotation added, sequential development and staging promotions, a portable anonymous OCI output, and Argo CD reconciliation at one digest on two clusters. These receipts do not prove that every catalog base has been delivered through either controller. A catalog entry earns a controller-delivery claim only when that exact configuration has its own receipt.

### Test, development, staging, and production promotions

**Worked example: working.** Redis and NGINX examples record derived changes, promote them in order, publish reviewed OCI artifacts, and check the resulting workloads.

**Broader status: partial.** The current CLI still lacks a useful human mutation preview for one promotion dry-run.

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

**Worked example: working.** The primary Kubara v0.13.0 fixture proves byte-identical generation from upstream and ConfigHub-aligned catalogs for one hub and three spokes, 13 effective component renders, two applications, a generated matrix and wiring graph, and a deterministic ConfigHub mini-IDP contract.

**Broader status: partial.** Current live organization state, platform delivery Applications, Argo convergence, and application health are claimed only by their exact accepted receipts; the generic importer and controller-convergence proof remain distinct boundaries.

A platform stack can span Terraform, Helm, policies, and cluster-specific choices that should be managed as one declared fleet record.

Keep Kubara as the platform composer, import one exact generated Git revision into component-first ConfigHub records and OCI, and let Argo reconcile only reviewed platform and application releases.

1. Select components and wiring through Kubara catalogs, config.yaml, and ordinary values overlays.
2. Generate the complete Kubara tree and commit one exact Git revision with dependency locks, checksums, effective renders, and wiring facts.
3. Compile and verify that revision as component-first OCI packages plus a digest-bound platform index, while keeping target facts and Secret values external.
4. Reconcile the explicitly selected ConfigHub organization into visible component definitions, target instances, lineage, wiring, and platform delivery Application surfaces.
5. Require a repeated zero-action organization receipt, then prove Argo convergence separately at the exact reviewed release digests.
6. Add, promote, approve, roll back, and observe applications only after the platform boundary they require has converged.

Start with [docs/demo/kubara/single-platform.md](../../docs/demo/kubara/single-platform.md) or [examples/kubara/git-import/README.md](../../examples/kubara/git-import/README.md) or [examples/kubara/current-platform/README.md](../../examples/kubara/current-platform/README.md) or [docs/demo/kubara/local-platform.md](../../docs/demo/kubara/local-platform.md) or [docs/corpus/kubara-customized-overlays.md](../../docs/corpus/kubara-customized-overlays.md).

Evidence: [examples/kubara/current-platform/generation-receipt.yaml](../../examples/kubara/current-platform/generation-receipt.yaml), [examples/kubara/current-platform/catalog-parity-receipt.yaml](../../examples/kubara/current-platform/catalog-parity-receipt.yaml), [data/kubara-platform-matrix/matrix.html](../../data/kubara-platform-matrix/matrix.html), [data/kubara-wiring/graph.html](../../data/kubara-wiring/graph.html), [data/kubara-release-acceptance/contract.yaml](../../data/kubara-release-acceptance/contract.yaml), [examples/kubara/local-platform/generation-receipt.yaml](../../examples/kubara/local-platform/generation-receipt.yaml), [examples/kubara/local-platform/confighub-upload-receipt.yaml](../../examples/kubara/local-platform/confighub-upload-receipt.yaml), [examples/kubara/local-platform/route-intent.yaml](../../examples/kubara/local-platform/route-intent.yaml), [examples/kubara/local-platform/rendered/object-inventory.json](../../examples/kubara/local-platform/rendered/object-inventory.json), [examples/kubara/local-platform/local-config-oci-manifest.json](../../examples/kubara/local-platform/local-config-oci-manifest.json), [runs/kubara-oci-delivery-proof/receipt.yaml](../../runs/kubara-oci-delivery-proof/receipt.yaml), [data/kubara-oci-delivery-proof/summary.md](../../data/kubara-oci-delivery-proof/summary.md), [docs/corpus/kubara-customized-overlays.md](../../docs/corpus/kubara-customized-overlays.md).

Current limit: The v0.13.0 source, dual-catalog parity, exact component locks, effective renders, desired matrix, and complete extracted wiring graph are deterministic committed evidence. A current live four-cluster claim requires the mini-IDP receipt and its immediate zero-action rerun; a missing observation remains unknown. Importer reconciliation and controller convergence are separate claims. Materialized ConfigHub platform Application state does not by itself prove Argo sync or workload health. The v0.12.0 one-cluster generation, OCI route, Argo bootstrap, and healthy Metrics Server receipt remain dated read-only compatibility evidence, not the current adoption starting point.

### ConfigHub desired state delivered through Sveltos

**Worked example: working.** A reviewed ClusterProfile moved from one pilot cluster to two staging clusters at a second OCI digest, and Sveltos restored a deliberately drifted value.

**Broader status: partial.** The proof uses two local clusters and does not test a failed rollout wave.

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

**Worked example: working.** Redis upgrades from chart 25.5.3 to 27.0.0 without losing a post-render replica change, moves through development and staging, reaches two Argo CD clusters, and rolls back.

**Broader status: partial.** This is a guarded demonstration and receipt, not a finished ConfigHub App interface.

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

**Worked example: working.** Kube Prometheus Stack passes the recorded CRD, certificate, workload, webhook, and runtime sequence on fresh installs and on an 85.3.3 to 86.1.0 upgrade through Argo CD and Flux.

**Broader status: partial.** ConfigHub does not yet select and execute the chart-specific route automatically.

A complex chart may need CRDs, certificate setup, jobs, and checks in a particular order. A rendered YAML bundle alone does not explain or perform that work.

Keep the chart, record its install and upgrade sequence beside the rendered objects, block incomplete routes from apply, and keep receipts for the delivery paths that have actually run.

1. Start from the Kube Prometheus Stack 85.3.3 no-crds preset and its recorded Helm inputs.
2. Apply the ten CRDs and wait for them before applying dependent custom resources.
3. Prepare the webhook certificate, apply the ordinary objects, and check readiness in the recorded order.
4. Choose the recorded Argo CD, Flux, or direct-apply implementation for each step.
5. Store every route as a checked LifecycleRoute and keep the execution receipts beside it.

Start with [docs/demo/hooks-crds/kube-prometheus-stack.md](../../docs/demo/hooks-crds/kube-prometheus-stack.md) or [docs/user/chart-hooks-what-happens.md](../../docs/user/chart-hooks-what-happens.md) or [docs/user/target-prerequisites.md](../../docs/user/target-prerequisites.md).

Evidence: [data/hooks-crds-app/summary.md](../../data/hooks-crds-app/summary.md), [data/hooks-crds-app/live-receipt.yaml](../../data/hooks-crds-app/live-receipt.yaml), [data/kps-lifecycle-route-proof/summary.md](../../data/kps-lifecycle-route-proof/summary.md), [runs/kps-lifecycle-route-proof/receipt.yaml](../../runs/kps-lifecycle-route-proof/receipt.yaml), [data/kps-gitops-lifecycle-proof/summary.md](../../data/kps-gitops-lifecycle-proof/summary.md), [runs/kps-gitops-lifecycle-proof/receipt.yaml](../../runs/kps-gitops-lifecycle-proof/receipt.yaml), [data/lifecycle-routes/summary.md](../../data/lifecycle-routes/summary.md), [runs/crd-ordering-gap/receipt.yaml](../../runs/crd-ordering-gap/receipt.yaml), [runs/hook-execution-proof/receipt.yaml](../../runs/hook-execution-proof/receipt.yaml), [runs/oci-hook-delivery-proof/receipt.yaml](../../runs/oci-hook-delivery-proof/receipt.yaml), [data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml](../../data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml).

Current limit: Seven Kube Prometheus Stack fresh-install steps passed in the direct script. The no-crds 85.3.3 to 86.1.0 upgrade passed through Argo CD and Flux. The top-level Kube Prometheus Stack routes remain automatic false because ConfigHub does not yet choose and execute them across every delivery path. The controller proof does not cover rollback, long soak, or automatic post-success removal of every temporary hook resource. The smaller hook fixture is automatic only because Argo CD and Flux ran the same packaged Job and a separate direct local test did the same. The route policy rejects incomplete or unsupported automatic claims; it does not decide which routes a chart needs.

### RBAC Review App

**Worked example: working.** One review removes unnecessary Secret access, keeps ConfigMap access, requires approval, publishes OCI, and reaches Kubernetes through Argo CD.

**Broader status: partial.** The example does not yet build a complete RBAC binding graph across a live fleet.

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

**Worked example: working.** Kubara proves one platform target, while Sveltos proves a pilot and two-cluster expansion with separate reviewed OCI digests and drift recovery.

**Broader status: partial.** A large mixed-source fleet rollout with failure-based pausing remains open.

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

**Worked example: working.** The example finds an unpinned image and inline API key, clears the reviewed replacement, and proves that approval controls the ConfigHub apply dry-run.

**Broader status: partial.** Kubernetes delivery, promotion, rollback, GPU workload health, and live observation have not run for this candidate.

An agent can change values or Kubernetes fields faster than a person can check the resulting objects and fleet impact.

Turn the suggestion into exact objects and diffs, run checks, require the right approval, and keep the decision record.

1. Let the agent propose values or object edits.
2. Render or apply the proposal to a derived variant.
3. Show the exact object and fleet diff.
4. Run schema, placeholder, security, and target checks.
5. Approve, promote, observe, or unwind the change.

Start with [docs/demo/apps/ai-change-review.md](../../docs/demo/apps/ai-change-review.md) or [docs/user/ai-assisted-helm-changes.md](../../docs/user/ai-assisted-helm-changes.md) or [config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml).

Evidence: [data/ai-change-review/receipt.yaml](../../data/ai-change-review/receipt.yaml), [data/ai-change-review/summary.md](../../data/ai-change-review/summary.md), [runs/ai-change-review-live-proof/receipt.yaml](../../runs/ai-change-review-live-proof/receipt.yaml), [data/ai-change-review-live-proof/summary.md](../../data/ai-change-review-live-proof/summary.md), [data/app-readiness/summary.md](../../data/app-readiness/summary.md), [data/claims-register/summary.md](../../data/claims-register/summary.md).

Current limit: The committed training-runtime example proves exact local objects, diffs, and deterministic checks. A live ConfigHub run reported the unsafe nested AICR image, blocked the inline API key, and left the reviewed candidate clear. It stored the reviewed object without changing its Kubernetes fields, blocked an OCI-target dry run until the exact head revision was approved, and allowed the same dry run after approval. The four-node capacity rule remains a repository check rather than a ConfigHub Function. The ordinary Deployment image and probe checks are limited to Kubernetes workload kinds they understand, so they do not report findings for this AICR custom resource. Kubernetes apply, promotion, rollback, GPU workload health, and live observation have not run for this candidate.

## What every maintained example receives

Each maintained example has one human-readable README, the exact configuration objects, identifying labels, and a **source and intent record**. The source and intent record explains where the objects came from, which choices produced them, what remains to be supplied, and which checks support the result.

This is one document role, not one forced schema. Helm uses `HelmRenderIntent`. AICR uses its recipe and generation or bundle receipts. Existing OCI and plain YAML use records that name their source digest or checksums, object inventory, remaining inputs, prerequisites, and transformations. A non-Helm source is never given a fake Helm record.

Hooks, CRDs, Secrets, setup jobs, and target facts are recorded when they apply to that exact configuration. A simple YAML example should remain simple. A chart with lifecycle work must name who performs it and link the evidence or state the gap.

New maintained examples follow this rule. Today, the source and intent role may use a source Unit, Space metadata plus a committed receipt, or a generated base-variant record. ConfigHub does not yet have one first-class source object for every format.

An arbitrary upload does not gain source history or chart-specific facts that ConfigHub cannot know. Generic checks can attach automatically. The source adapter or a reviewed catalog addition must supply the source-and-intent record and any required lifecycle records. Missing information remains a gap. Temporary experiments and legacy Spaces are not counted as conforming until their common and applicable helper records pass the same checks.

## The common policy

Every pathway uses [the catalog-standard apply policy](../../config-catalog/policies/catalog-standard.yaml) after upload. Schema, placeholder, and lifecycle-route checks block incomplete configuration. Ordinary Kubernetes workloads and AICR training runtimes have checks for the fields they actually use. Production releases and system configuration keep the 7 common checks and add one required approval.

This choice is based on what the configuration controls, not whether it started as Helm, AICR, `cub installer`, Kubara, Sveltos, or YAML. On 2026-07-30, the live `helm-catalog` org had 33 Spaces on the 7 common checks and 9 Spaces on those checks plus approval (4 production and 5 system configuration). The receipt includes every maintained starting format: helm 3, aicr 3, cub-installer 30, kubara 1, sveltos 1, rendered-config 4.

The [live topology receipt](../../data/apply-policy-profiles/live-helm-catalog.yaml) records which checks are connected to which Spaces. The [functional proof](../../data/apply-policy-functional-proof/summary.md) tests the behavior with temporary records: placeholders, invalid Kubernetes data, and missing approval are blocked; the same system configuration is allowed after its exact head revision is approved; and an unpinned image and missing probes are reported without blocking a dry run. No fixture configuration was applied to Kubernetes. Rerun `npm run helm-org:policy:verify` while logged into the org to compare the current topology with its receipt.
