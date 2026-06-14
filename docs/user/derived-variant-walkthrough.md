EXPERIMENTAL

# Derived-variant walkthrough — a real `cub variant create`, captured

This is the day-1 operation "create a derived variant" run for real and
read back from its committed receipt
([`runs/derived-variant-execution/nginx-prod-us-east/variant-create-receipt.yaml`](../../runs/derived-variant-execution/nginx-prod-us-east/variant-create-receipt.yaml)).
It is the tested-UX companion to [creating-variants.md](./creating-variants.md)
(the concept) and the first operation on the day-1 operations page (the
catalogue of what you do after sign-up).

A derived ConfigHub variant refines an already-uploaded base for a target,
environment, region, or customer — **without running Helm again**. This run
derives a `prod-us-east` variant of the NGINX `http-clusterip` base.

## The command

```sh
cub variant create prod-us-east helm-nginx-confighub-proof \
  --environment Prod --region us-east \
  --space-name-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --unit-delete-gate production-review \
  --unit-destroy-gate production-review \
  --allow-exists --wait --timeout 10m -o json
```

Result: `pass`. The derived variant landed in a new space,
`NGINX-prod-us-east`, cloned from the proof space `helm-nginx-confighub-proof`.

## What actually changed (from the receipt)

| Fact | Value | Why it matters |
| --- | --- | --- |
| Units cloned | 7 | The whole rendered set carried over |
| Linked to upstream | 7 / 7 | Every unit keeps a link back to its base |
| Data-hash set vs source | **identical** | The clone is byte-faithful — no silent drift |
| Helm re-rendered | **no** | A derived variant is a ConfigHub refinement, not a new render |
| Changed scope | Space `Variant`/`Environment`/`Region` labels, Unit delete/destroy gates | Only governance and placement metadata changed |
| Gates applied | `production-review` delete + destroy gate on all 7 units | Destructive ops on this variant now require review |

So the variant is the same install shape as its base, with environment,
region, and **review gates** layered on — exactly the day-1 customization a
team needs before a change reaches production, and nothing more.

## Honest scope

```text
liveApply: not-attempted
  reason: No target was attached; this is a ConfigHub intended-state proof,
          not a live cluster deployment.
```

This receipt proves the clone, the upstream links, the gate placement, and
the metadata change. It does **not** prove a live rollout — that is the live
lanes on the [status matrix](../../site/matrix.html). Read it as "the
intended state is correct and governed," not "it is running in prod."

## When to go back to the installer instead

The receipt records the changes that a derived variant **cannot** make —
they belong back in the `cub installer` base because they change the
rendered shape:

- add TLS ingress, or switch to the `existing-tls-ingress` base;
- change the Service type, or the rendered NetworkPolicy / PodDisruptionBudget shape.

The rule of thumb: if a change needs a new Helm render, it is an installer
base; if it is target, environment, region, customer, or governance, it is a
derived variant.

## Next

This is day-1 operation 1. The others — scan and gate, staging and
promotion, OCI/GitOps delivery, adopting an existing app, and bringing a
custom app — are on the day-1 operations page; day-2 (observe, upgrade,
roll back, fleet) follows on the [journey](../../site/journey.html).
