# Choose Your Path

**UNOFFICIAL/EXPERIMENTAL**

Use the
[official ConfigHub tutorial](https://docs.confighub.com/get-started/tutorial/)
to learn ConfigHub. It covers one component, a release, a change, production,
and promotion.

This catalog helps you prepare and inspect configuration before that journey.
Choose the row that matches what you already have.

| What you have | First step |
| --- | --- |
| A public Helm chart | Choose a reviewed catalog configuration or render your chart and values. |
| An AICR package | Inspect its selected components, allowed inputs, and generated applications. |
| Existing OCI or Kubernetes YAML | Inspect the exact objects and record their source. |

Then choose where the work runs.

| Choice | ConfigHub Server | Account |
| --- | --- | --- |
| Local tools or CI | No | No |
| Hosted public test service | Yes; planned | No |
| Stored ConfigHub workflow | Yes | Yes |

No server and no account are separate promises. Public registry pulls already
work without sign-in. The hosted public test service is planned and is not
released.

| Path | Use it when | Primary command or surface | Account boundary |
| --- | --- | --- | --- |
| Quick render | You only want to see the Kubernetes objects a chart produces. | `helm template` | No ConfigHub state. |
| Arbitrary Helm import | You want to import a chart and values as a ConfigHub base. | `cub helm` plugin | Needs a ConfigHub account. |
| One-shot upload | You want rendered files or a literal configuration OCI loaded as ConfigHub Units now. | `cub variant upload <files-or-oci-ref>` | Needs a ConfigHub account. |
| Public catalog package | You want a maintained public base with render parity, receipts, scans, and proof. | `cub installer setup --pull <installer OCI ref> --base <base>` | Public packages can be browsed, pulled, rendered, inspected, and verified without private ConfigHub state. |
| Reviewed ConfigHub base | You want the catalog render stored as Units before creating variants or approvals. | `cub installer upload` | Needs a ConfigHub account. |
| Derived operations | You want dev/prod/customer/target variants, gates, links, policies, scans, promotions, observations, or bulk work. | `cub variant create`, `cub unit diff`, `cub function vet`, changesets | ConfigHub-managed workflow. |
| Existing app adoption | You already have Argo, Flux, KRM, rendered manifests, or live resources. | See [Adopting Existing Apps](./adopting-existing-apps.md). | Usually managed import; private state belongs in ConfigHub. |

## Free Public Lane

The public lane is useful before a team commits to a platform workflow:

- browse the [catalog dashboard](../../site/index.html), chart pages, proof
  status, and known gaps;
- render and inspect public charts with `helm template`;
- render and inspect public catalog packages with `cub installer`;
- pull public installer package OCI refs where available;
- verify available signatures, digests, rendered objects, and local receipts;
- run repo verifiers such as `npm run site:verify`, `npm run docs:verify`, and
  chart-specific package or render checks;
- inspect receipts, rendered objects, pain reports, and top-100 chart guidance.

This lane is for public charts and public package artifacts. Use
[Installer Package OCI Refs](./installer-oci-packages.md) when you need the
exact package address for a chart. The public lane does not make private values,
private overlays, team approvals, fleet operations, or production support free.

## ConfigHub-Managed Lane

Use ConfigHub-managed workflows when the work becomes team or production state:

- private charts, private values, custom catalogs, customer overlays, or wrapper
  charts;
- environment, region, customer, target, or promotion variants;
- teams, approvals, target facts, links, policies, gates, scans, and receipts;
- GitOps/OCI operations, observations, audits, and rollback evidence;
- bulk scan, patch, review, approve, promote, observe, and audit work;
- full stacks, production support decisions, old-version support, patch and
  upgrade services, SLAs, and enterprise workflows.

The dividing line is simple: public packages help you inspect and verify public
chart bases; ConfigHub manages private inputs, teams, approvals, operational
state, and production workflows.

## Tutorial Routing

| If you want to see... | Start here | What it teaches |
| --- | --- | --- |
| The ConfigHub product journey | [Official ConfigHub tutorial](https://docs.confighub.com/get-started/tutorial/) | One component, release, change, production deployment, and promotion. |
| The shortest public package render | [Try one catalog package](../../site/try.html) | Redis package pull, local render, local OCI, and inspection. |
| The complete Redis evidence path | [Detailed Redis walkthrough](../../site/redis-walkthrough.html) | Helm parity, Kubernetes, OCI, upgrade, promotion, two-cluster delivery, and rollback. |
| Why a values choice becomes a base | [Prometheus Base Variant](./tutorial-sequence.md#tutorial-3-prometheus-base-variant) | Helm render choices belong in the `cub installer` base path. |
| Why a prod/customer change can avoid rerendering Helm | [Prometheus Promotion Variant](./tutorial-sequence.md#tutorial-4-prometheus-promotion-variant) | Derived ConfigHub variants clone reviewed Units and add operational metadata. |
| How wrapper charts and customer overlays are routed | [Custom Overlays](./custom-overlays.md) | Private overlays and managed imports belong in ConfigHub workflows. |
| How to verify live/runtime claims | [Chain Of Proof](./chain-of-proof.md) and [Live Parity](./live-parity.md) | Render proof, ConfigHub desired state, GitOps handoff, and live observation are separate claims. |
| How bulk operations create value after upload | [Tutorial Sequence](./tutorial-sequence.md#tutorial-7-bulk-scan-and-bulk-patch) | Once objects are Units, teams can scan, patch, review, approve, and audit many objects together. |

## Rule Of Thumb

If the change alters Helm inputs, object count, object shape, topology, CRDs,
RBAC, lifecycle behavior, or chart branches, route it through a `cub installer`
base.

If the change refines an already-reviewed object set with environment, target,
labels, gates, links, approved post-render fields, observation policy, or
promotion metadata, route it through a derived ConfigHub variant.

If the change involves private inputs, team approvals, fleet operations,
policies, GitOps operations, or production support, treat it as a
ConfigHub-managed workflow.

## Where The Extra Value Starts

Plain Helm is enough when the only job is to render or install once. The
catalog adds value before install by making the selected base explicit and
reviewable. ConfigHub adds value after upload because every object is a Unit
that can be diffed, scanned, gated, linked, approved, promoted, observed, and
audited.

The day-0 path is choosing a public base and verifying what it renders. The
day-1 path is creating a derived variant for an environment, customer, region,
or target without rerendering Helm. The day-2 path is operating many reviewed
variants through bulk scans, patches, approvals, promotions, GitOps/OCI
handoffs, observations, upgrades, rollbacks, and receipts.

## Next

- [Official ConfigHub tutorial](https://docs.confighub.com/get-started/tutorial/)
- [Try one catalog package](../../site/try.html)
- [Detailed Redis walkthrough](../../site/redis-walkthrough.html)
- [Choosing Commands](./choosing-commands.md)
- [Product Support Tiers](./product-support-tiers.md)
- [What We Refuse To Claim](./what-we-refuse-to-claim.md)
