# Config catalog demonstrations

Generated from [config-catalog/program.yaml](../../config-catalog/program.yaml).

This is the status index for the source pathways and ConfigHub App demonstrations. **Worked example** says whether one bounded example has run. **Broader status** says how much of the general path or product capability is supported. A working example does not turn its stated limits into a general claim.

## OCI in, managed configuration, OCI out

**Public catalog and tools:** Starting examples can prepare source before OCI, inspect an existing OCI, or produce a new OCI after checking or changing its contents, without requiring ConfigHub Server or an account. The result is a literal configuration OCI, an inspection result, or both, plus a source record that names the inputs, prerequisites, lifecycle work, and evidence.

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
| What happens after the first deployment? | Show how the same reviewed result can become a saved base, a development or production variant, a promotion, and an OCI delivered through Argo CD, Flux, or direct apply. |
| What has not been proved? | Keep missing controller paths, upgrades, target checks, and product work visible. Do not turn one passing path into a general claim. |

## Example journey

Every example starts with one person getting one deployable result. Saved configuration, environments, rollout, and Apps come afterward.

| Level | Example | Status | Result |
| --- | --- | --- | --- |
| basics | Pull, inspect, and verify a ready-made package | available | Pull one public installer OCI without an account, inspect the exact Kubernetes objects and recorded Helm inputs, then check the parity, prerequisite, route, and verification evidence before deployment. |
| basics | Bring your own chart and values | available | Render the chart into exact Kubernetes objects, compare it with chart defaults and known catalog configurations, identify prerequisites and risky changes, then deploy it or save the reviewed result. |
| managed | Save the reviewed result and change it | available | Upload the reviewed objects as a ConfigHub base variant, then change exact Kubernetes fields in named derived variants. |
| managed | Upgrade and promote through environments | available | Reconcile a candidate base, keep the intended post-render changes, preview the affected variants, and promote the accepted revision in sequence. |
| delivery | Deliver one reviewed OCI and roll it out | available | Publish one immutable OCI, reconcile its digest through Argo CD or Flux, and record controller and workload results for each target. |
| advanced | Manage the CRDs, hooks, and setup work around a package | available | Keep that work beside the package, name who runs each step, execute only the supported path, and retain a receipt. |
| apps | Use an App for a repeated operational job | example-only | Use saved configuration, checks, approvals, delivery, and observations as one repeatable operational workflow. |

## Source pathways

| Demonstration | Worked example | Broader status | Problem | Result |
| --- | --- | --- | --- | --- |
| Helm chart to managed configuration | working | available | A Helm chart can hide the final Kubernetes objects, risky defaults, prerequisites, and upgrade changes behind its templates. | Pick a reviewed chart configuration, inspect the literal objects and the Helm record, upload them as a ConfigHub base variant, then make reviewed environment variants. |
| AICR bundle to managed configuration | working | partial | AICR can produce a versioned AI infrastructure recipe and deployment bundle, but teams still need to record which bundle and remaining inputs each cluster should run. | Keep the AICR recipe, remaining inputs, generated files, and OCI digest together. Upload the literal configuration OCI as a ConfigHub base variant, then use the same policy and promotion process as other configuration sources. |
| cub installer package to managed configuration | working | available | A team may need several chart-specific preset configurations and repeatable local rendering without introducing a server into the first test. | cub installer carries the chart, preset configurations, values, and supporting files in one OCI package, then renders the selected preset locally or uploads it to ConfigHub. |
| Plain Kubernetes YAML to managed configuration | working | available | A team may already have reviewed Kubernetes YAML and should not need to wrap it in a chart or run another renderer before ConfigHub can record it. | Upload the files as exact Kubernetes objects, keep their source identity, and use the saved base for later variants, promotions, releases, and Apps. |
| Public OCI inspection and packaging | working | partial | A team may want to inspect, test, or repackage public configuration without creating an account or handing ownership to another service. | Pull an OCI package, work with the exact objects, and produce a deployable OCI package. Claim it in ConfigHub only when the team wants saved history, variants, approvals, promotions, or fleet rollout. |
| One reviewed bundle through Argo CD, Flux, or direct apply | working | partial | Teams want to keep their delivery controller and know that it is applying the Kubernetes objects they reviewed, rather than rendering another result from Helm values. | ConfigHub can publish one reviewed object set as a release OCI. Argo CD, Flux, or a recorded direct-apply path can consume the same files without rendering the chart again. |
| Test, development, staging, and production promotions | working | partial | Copying values files between environments makes it hard to tell what changed and whether production still matches the reviewed configuration. | Upload one base variant, keep environment changes as derived variants, preview the exact mutations, and promote them in order with production approval. |
| Kubara platform configuration to a cluster fleet | working | partial | A platform stack can span Terraform, Helm, policies, and cluster-specific choices that should be managed as one declared fleet record. | Treat Kubara as a platform configuration producer, record its generated configuration as base variants, and assign reviewed variants to cluster groups. |
| ConfigHub desired state delivered through Sveltos | working | partial | Fleet operators need a declarative way to assign platform components to matching clusters and keep placement separate from package creation. | ConfigHub manages the reviewed ClusterProfile and related configuration; Sveltos selects clusters and reconciles the declared add-ons. |

## ConfigHub Apps

| Demonstration | Worked example | Broader status | Problem | Result |
| --- | --- | --- | --- | --- |
| Upgrade App | working | partial | A chart or package upgrade can change many clusters at once, and a green source diff does not show which workloads will be affected. | Show fleet impact, test the candidate configuration, promote it in waves, and check the rollout. |
| Hooks and CRDs App | working | partial | A complex chart may need CRDs, certificate setup, jobs, and checks in a particular order. A rendered YAML bundle alone does not explain or perform that work. | Keep the chart, record its install and upgrade sequence beside the rendered objects, block incomplete routes from apply, and keep receipts for the delivery paths that have actually run. |
| RBAC Review App | working | partial | Risky permissions are hard to find when application configuration is split across charts, repositories, and clusters. | Query the imported Kubernetes objects, find broad access, and propose exact corrections for review. |
| Fleet Platform App | working | partial | Platform teams need to assign different system configurations to cluster groups without losing a central source of record. | Assign Helm, AICR, Kubara, or Sveltos-based platform configurations to clusters and manage rollout waves from ConfigHub. |
| AI Change Review App | working | partial | An agent can change values or Kubernetes fields faster than a person can check the resulting objects and fleet impact. | Turn the suggestion into exact objects and diffs, run checks, require the right approval, and keep the decision record. |

Read [docs/user/config-catalog-demonstrations.md](../../docs/user/config-catalog-demonstrations.md) for the plain-English walkthrough and [docs/reference/config-catalog-doctrine.md](../../docs/reference/config-catalog-doctrine.md) for the shared model.
