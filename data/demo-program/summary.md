# Config catalog demonstrations

Generated from [config-catalog/program.yaml](../../config-catalog/program.yaml).

This is the status index for the source pathways and ConfigHub App demonstrations. `available` means the committed evidence supports the described path. `partial`, `example-only`, and `planned` keep the missing work visible.

## OCI in, managed configuration, OCI out

**Before ConfigHub:** The catalog helps people inspect, render, test, and package the exact configuration they want to manage without requiring a ConfigHub account. The result is a literal configuration OCI, an inspection result, or both, plus a source record that names the inputs, prerequisites, lifecycle work, and evidence.

### Work without an account

| Path | What it does | Where it can fit |
| --- | --- | --- |
| `work -> OCI` | Start with a Helm chart, AICR recipe, installer package, or Kubernetes files; inspect and test the result; then build a deployable OCI package. | `source -> anonymous work -> OCI -> delivery` |
| `OCI -> work` | Pull an existing public OCI package to inspect its objects, explain its requirements, run checks, or compare it with another version. | `OCI -> anonymous inspection or testing` |
| `OCI -> work -> OCI` | Pull an OCI package, check or change its exact objects, and serve the resulting OCI package without taking ownership of it in ConfigHub. | `OCI -> anonymous work -> OCI -> delivery` |

Here, `work` means rendering, inspecting, explaining, testing, scanning, comparing, or editing configuration. These paths can be used on their own or inserted into a larger delivery flow.

| Where the work runs | Status | What that means |
| --- | --- | --- |
| Local command | available | Run the public tools without a ConfigHub account. The current receipt proves this path and keeps the files and OCI references under the user's control. |
| CI job | partial | Run the same non-interactive commands in CI. The design supports this use, but a separate CI receipt has not been recorded. |
| Public hosted service | planned | Inspect, test, and serve public configuration without signing in, then claim it later. Anonymous use does not create private history, saved edits, variants, or approvals. |

Anonymous users can build, inspect, test, pull, and serve public OCI packages. The boundary is **Claim this configuration in ConfigHub.** ConfigHub saves the objects and their history so a team can transform, approve, promote, and roll them out.

**Inside ConfigHub:** ConfigHub stores the exact objects as Units and keeps their source, variants, diffs, checks, approvals, promotions, and observations together.

ConfigHub can join an existing delivery flow without replacing it:

- Existing: `Git -> CI -> OCI -> Argo CD or Flux -> Kubernetes`
- With ConfigHub: `Git -> CI -> OCI -> ConfigHub -> OCI -> Argo CD or Flux -> Kubernetes`
- First: ConfigHub can publish the same specs and user-supplied metadata unchanged. The release adds only the confighub.com/origin provenance annotation.
- Later: A team can create named variants, apply policy, promote reviewed changes, and roll them out to selected clusters.
- Fan-out: One recorded configuration can produce specific outputs for environments, customers, regions, or cluster groups.

**After ConfigHub:** cub release publish creates an immutable Space release OCI from the reviewed ConfigHub Units. The same reviewed objects can also be packaged as a portable OCI for anonymous or external consumers. Argo CD, Flux, and direct apply can consume that artifact without rendering the source package again.

The website and catalog cover the work that happens before ConfigHub, including anonymous OCI inspection and packaging. ConfigHub begins when a person or team chooses to save the configuration and operate it over time. The release OCI is the handoff to delivery.

## Source pathways

| Demonstration | Status | Problem | Result |
| --- | --- | --- | --- |
| Helm chart to managed configuration | available | A Helm chart can hide the final Kubernetes objects, risky defaults, prerequisites, and upgrade changes behind its templates. | Pick a reviewed chart configuration, inspect the literal objects and the Helm record, upload them as a ConfigHub base variant, then make reviewed environment variants. |
| AICR bundle to managed configuration | partial | AICR can produce a versioned AI infrastructure recipe and deployment bundle, but teams still need to record which bundle and remaining inputs each cluster should run. | Keep the AICR recipe, remaining inputs, generated files, and OCI digest together. Upload the literal configuration OCI as a ConfigHub base variant, then use the same policy and promotion process as other configuration sources. |
| cub installer package to managed configuration | available | A team may need several chart-specific preset configurations and repeatable local rendering without introducing a server into the first test. | cub installer carries the chart, preset configurations, values, and supporting files in one OCI package, then renders the selected preset locally or uploads it to ConfigHub. |
| Public OCI inspection and packaging | partial | A team may want to inspect, test, or repackage public configuration without creating an account or handing ownership to another service. | Pull an OCI package, work with the exact objects, and produce a deployable OCI package. Claim it in ConfigHub only when the team wants saved history, variants, approvals, promotions, or fleet rollout. |
| One reviewed bundle through Argo CD, Flux, or direct apply | partial | Teams want to keep their delivery controller and know that it is applying the Kubernetes objects they reviewed, rather than rendering another result from Helm values. | ConfigHub can publish one reviewed object set as a release OCI. Argo CD, Flux, or a recorded direct-apply path can consume the same files without rendering the chart again. |
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
