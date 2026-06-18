# cub-scout Diff: dry-run + drift, GitOps-agnostic

Day-1 **dry-run** and day-2 **drift** are the same operation — *desired vs live* — so they are one engine. cub-scout already does the boolean form (`object-set-matches`, `drift`); this is the field-level form. It diffs the **held render-once desired data** (deterministic) against the live cluster via **server-side dry-run** (the accurate technique Argo and Flux use), is **GitOps-tool-agnostic** (works under Argo, Flux, or cub-direct), and adds value-provenance, fleet blast-radius, authority, and honest residue. See [the design](../../docs/user/cub-scout-diff-design.md).

## Better than ArgoCD and Flux

| Dimension | cub-scout diff | ArgoCD diff | Flux diff | Why it matters |
| --- | --- | --- | --- | --- |
| desired side | held render-once data (deterministic; no re-render) | helm template re-render (lookup + generated-value nondeterminism) | helm/kustomize re-render (same nondeterminism) | a re-rendered desired side drifts from what actually deploys -> OutOfSync noise |
| live side | server-side --dry-run apply | server-side diff | server-side apply + drift detection | all three are accurate against the live object; cub-scout adopts this |
| value provenance | yes (links value-source-map: which value caused the delta) | no (field diff only) | no (field diff only) | a dry-run that names the causing value is reviewable; a raw field diff is not |
| fleet / cross-environment | yes (fleet blast-radius + override-protection) | per-Application | per-HelmRelease/Kustomization | a fleet change must show its blast radius across environments, not one app |
| authority gate on the diff | yes (reverse-reconcile policy family) | no | no | a governed change should be checked for who-may-change-what before apply |
| runtime residue | named + witnessed (cub-scout predicates) | buried in ignoreDifferences | buried in ignore rules | honest about what cannot be pre-rendered, instead of suppressing it as noise |
| gitops tool coupling | agnostic (argo | flux | cub-direct) | argo-only | flux-only | one differ across all delivery paths, not a per-tool diff |
| day-1 + day-2 | unified (dry-run pre-apply = drift post-apply |  one engine) | sync status + diff | drift detection |

## Worked examples (machine-checked, grounded in the value-source-map)

| Receipt | Chart | Operation | Change | Objects | Tool-agnostic across | Status |
| --- | --- | --- | --- | ---: | --- | --- |
| `redis-image-digest-dryrun` | bitnami/redis@25.5.3 | dry-run | `image.digest` | 2 | argo + flux + cub-direct | design-example |

Each receipt's `diff.changedObjects` is checked to equal the chart's `value-source-map` prediction (proven 13/13 in `blast-radius-accuracy`), so the provenance is real, not asserted.

## Honest scope

The schema, the capability matrix, the tool-agnostic invariance, and the value-provenance check are real. The cub-scout **field-level diff command** that runs the server-side dry-run end-to-end is the product piece (frontier); examples are `design-example` until it lands and a live dry-run + drift run agree under Argo, Flux, and cub-direct.

## Regenerate

~~~sh
npm run cub-scout-diff:generate
npm run cub-scout-diff:verify
~~~
