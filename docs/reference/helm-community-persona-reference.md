# Helm Community Persona Reference

**Status:** experimental reference document.

This reference keeps the persona, tier, and decision vocabulary consistent
across product docs, catalog docs, and planning docs.

## Terms

| Term | Meaning |
| --- | --- |
| Public base variant | A reviewed `cub installer` package base created from Helm render inputs. It changes or selects the Kubernetes object set. |
| Derived ConfigHub variant | A post-render ConfigHub variant cloned or refined from an uploaded base. It can change target, labels, facts, links, gates, observation policy, and approved fields without rerendering Helm. |
| Managed import | A supported path for private charts, wrapper charts, customer overlay values, private repositories, or commercial catalog maintenance. |
| Fanout | Applying a change across many variants, spaces, targets, clusters, or customers. |
| Blast radius | The set of Units, variants, spaces, targets, clusters, and policies affected by a proposed change. |
| Promotion wave | A controlled rollout from one reviewed variant or revision to a selected group of derived variants or targets. |
| Observation receipt | Evidence from Kubernetes, GitOps, ConfigHub, or another observer that says what was seen, when it was seen, and how fresh that observation is. |
| Pain report | Per-chart record of Helm pain points, mitigation, evidence, and remaining risk. |
| Teaching chart | A small chart used to explain the model quickly. Redis is the first teaching chart. |
| Main proof chart | A harder chart used to prove the model under high object count, CRDs, webhooks, dependencies, and blast radius. kube-prometheus-stack is the first main proof chart. |

## Decision Matrix

| User wants to change | Route |
| --- | --- |
| Helm values that change object count, object shape, CRDs, hooks, storage mode, ingress mode, generated Secret mode, or component selection | Create or update a public base variant or managed recipe/package base. |
| Environment, region, target, labels, approvals, observation policy, links, target facts, or approved post-render fields | Create a derived ConfigHub variant. |
| Private values, wrapper chart, umbrella chart, customer overlay, or private repository | Use managed import. |
| The same approved change across many variants or targets | Use bulk operation or promotion wave with blast-radius preview. |
| Hook, CRD, webhook, storage, or upgrade behavior that depends on cluster state | Require lifecycle policy, target facts, live proof, and production disposition. |
| Audit or compliance evidence | Use scans, gates, receipts, digests, approvals, and observation freshness. |

## Persona Route Matrix

| Persona | First question | First route | Main value |
| --- | --- | --- | --- |
| Helm user trying a chart | What should I install? | Catalog entry and recommended base variants | faster safe start with exact objects |
| Application team | How do I make dev, staging, and prod? | Base variant plus derived ConfigHub variants | deliberate environment changes |
| Platform SRE | What changes across the fleet? | Inventory, bulk scan/patch, promotion waves | scoped fanout and blast-radius control |
| Security reviewer | What exactly was checked? | Pain report, scan receipt, gate receipt, observation receipt | auditable proof |
| GitOps operator | Can Argo or Flux still own delivery? | OCI/GitOps handoff and runtime proof | reviewed desired state for existing controllers |
| Catalog maintainer | How do I support chart variants over time? | Managed import, pain reports, maintenance SLA | durable catalog instead of values sprawl |

## Free And Paid Capability Reference

| Capability | Public/free | Authenticated/free or low-friction | Managed/paid |
| --- | --- | --- | --- |
| Browse public chart catalog | yes | yes | yes |
| Inspect variants, pain reports, and public receipts | yes | yes | yes |
| Pull public artifact | maybe, if unauthenticated public pull is allowed | yes, with scoped token or rate limit | yes |
| Verify digest or signature locally | yes | yes | yes |
| Try a chart on user's cluster | yes, if the artifact is public | yes | yes |
| Store private values or overlays | no | limited only if product supports it | yes |
| Create derived ConfigHub variants | no, not without server state | yes, if account/org exists | yes |
| Team approvals, gates, and audit retention | no | limited | yes |
| Fleet scan, patch, and promotion waves | no | limited demos | yes |
| Old-version patch SLA | no | no | yes |
| Custom hook/CRD lifecycle migration | no | no | yes |
| Private OCI artifacts | no | limited trial if offered | yes |

## Day 0, Day 1, Day 2 Mapping

| Stage | User question | ConfigHub value |
| --- | --- | --- |
| Day 0 install | What will this chart install? | reviewed base variant, exact objects, Helm equivalence, scans, local/live proof |
| Day 1 configure | How do I adapt this safely? | derived variants, target facts, labels, links, gates, preview, receipts |
| Day 2 operate | How do I patch, promote, observe, and upgrade? | promotion waves, bulk scan/patch, blast-radius preview, observation freshness, upgrade/rollback receipts |

## Demonstration Chart Roles

| Chart | Role | Use it for |
| --- | --- | --- |
| Redis | Teaching chart | five-minute UX, generated Secret versus existing Secret, target facts, small object inventory |
| Prometheus / kube-prometheus-stack | Main proof chart | high fanout, CRDs, webhooks, RBAC, dependencies, and blast-radius visibility |
| NGINX | Simple web chart | easy local/live path and bulk patch examples |
| cert-manager / External Secrets | Lifecycle charts | CRDs, webhooks, hook-like behavior, controller-owned fields, target readiness |

## Variant Rules

Use a base variant when the choice affects Helm render inputs or Kubernetes
object shape.

Examples:

- enable or disable CRDs;
- generated Secret versus existing Secret;
- HA versus standalone;
- ingress/TLS shape;
- storage mode;
- optional controller or component;
- wrapper chart and customer values.

Use a derived ConfigHub variant when the choice refines an already-rendered
base.

Examples:

- environment;
- region;
- target;
- labels;
- approval policy;
- observation policy;
- target fact binding;
- approved field fill that does not change object shape.

Use a bulk operation or promotion wave when the same change applies to many
derived variants and the user needs to see blast radius before mutation.

## What The Public Site Should Surface

The first public page should answer:

| Question | Content |
| --- | --- |
| Why this exists | Helm output becomes reviewable, variant-aware, scannable, promotable, and observable. |
| What can I install | Catalog with recommended base variants. |
| What is live-tested | Per-chart live status, including pass, watch, blocked, and not-started. |
| What can I change | Base variant versus derived ConfigHub variant decision guide. |
| What is free | Public browsing, public artifacts, local verification, public receipts. |
| What needs ConfigHub or paid support | Private charts, private overlays, variants, approvals, fleet operations, old-version patches, production receipts. |
| How do I trust it | Digests, signatures where available, scans, gates, receipts, observation freshness. |

## Risks To Avoid

- Presenting rendering as the whole value.
- Treating fanout as a feature without blast-radius preview.
- Making users read proof internals before they can pick a variant.
- Calling a chart production-supported before lifecycle, scan, upgrade, and
  observation risks have a disposition.
- Blurring public anonymous exploration with authenticated production control.
- Treating private overlays and old-version patches as public catalog promises.
