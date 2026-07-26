# Config catalog demonstrations

Generated from [config-catalog/program.yaml](../../config-catalog/program.yaml).

This is the status index for the source pathways and ConfigHub App demonstrations. `available` means the committed evidence supports the described path. `partial`, `example-only`, and `planned` keep the missing work visible.

## Source pathways

| Demonstration | Status | Problem | Result |
| --- | --- | --- | --- |
| Helm chart to managed configuration | available | A Helm chart can hide the final Kubernetes objects, risky defaults, prerequisites, and upgrade changes behind its templates. | Pick a reviewed chart configuration, inspect the literal objects and the Helm record, upload them as a ConfigHub base variant, then make reviewed environment variants. |
| AICR bundle to managed configuration | partial | AICR can produce a versioned AI infrastructure recipe and deployment bundle, but teams still need to record which bundle and remaining inputs each cluster should run. | Keep the AICR recipe, remaining inputs, generated files, and OCI digest together. Upload the literal configuration OCI as a ConfigHub base variant, then use the same policy and promotion process as other configuration sources. |
| cub installer package to managed configuration | available | A team may need several chart-specific preset configurations and repeatable local rendering without introducing a server into the first test. | cub installer carries the chart, preset configurations, values, and supporting files in one OCI package, then renders the selected preset locally or uploads it to ConfigHub. |
| Test, development, staging, and production promotions | partial | Copying values files between environments makes it hard to tell what changed and whether production still matches the reviewed configuration. | Upload one base variant, keep environment changes as derived variants, preview the exact mutations, and promote them in order with production approval. |
| Kubara platform configuration to a cluster fleet | partial | A platform stack can span Terraform, Helm, policies, and cluster-specific choices that should be managed as one declared fleet record. | Treat Kubara as a platform configuration producer, record its generated configuration as base variants, and assign reviewed variants to cluster groups. |
| ConfigHub desired state delivered through Sveltos | partial | Fleet operators need a declarative way to assign platform components to matching clusters and keep placement separate from package creation. | ConfigHub manages the reviewed ClusterProfile and related configuration; Sveltos selects clusters and reconciles the declared add-ons. |

## ConfigHub Apps

| Demonstration | Status | Problem | Result |
| --- | --- | --- | --- |
| Upgrade App | partial | A chart or package upgrade can change many clusters at once, and a green source diff does not show which workloads will be affected. | Show fleet impact, test the candidate configuration, promote it in waves, and check the rollout. |
| Hooks and CRDs App | partial | A complex chart may need CRDs, certificate setup, jobs, and checks in a particular order. A rendered YAML bundle alone does not explain or perform that work. | Keep the chart, record its install and upgrade sequence beside the rendered objects, block incomplete routes from apply, and keep receipts for the delivery paths that have actually run. |
| RBAC Review App | partial | Risky permissions are hard to find when application configuration is split across charts, repositories, and clusters. | Query the imported Kubernetes objects, find broad access, and propose exact corrections for review. |
| Fleet Platform App | partial | Platform teams need to assign different system configurations to cluster groups without losing a central source of record. | Assign Helm, AICR, Kubara, or Sveltos-based platform configurations to clusters and manage rollout waves from ConfigHub. |
| AI Change Review App | partial | An agent can change values or Kubernetes fields faster than a person can check the resulting objects and fleet impact. | Turn the suggestion into exact objects and diffs, run checks, require the right approval, and keep the decision record. |

Read [docs/user/config-catalog-demonstrations.md](../../docs/user/config-catalog-demonstrations.md) for the plain-English walkthrough and [docs/reference/config-catalog-doctrine.md](../../docs/reference/config-catalog-doctrine.md) for the shared model.
