# If My Chart Has Hooks, What Happens?

**UNOFFICIAL/EXPERIMENTAL.**

Short answer: the catalog renders your chart's objects **without running its
Helm hooks**. Then, for each chart, it records what still has to happen.

That may be a setup step, a CRD ownership choice, a GitOps action where evidence
exists, a target-specific decision, a blocker, or a refusal. The answer is
chart-specific because Helm hooks are chart-specific.

A recorded route is not the same as automatic execution. The Kube Prometheus
Stack direct example now runs seven fresh-install steps in the recorded order,
including its certificate Jobs and CRDs. A separate `no-crds` example has also
run through Argo CD and Flux from 85.3.3 to 86.1.0. ConfigHub does not yet
choose or run this chart-specific route automatically, so the chart's
top-level routes remain `automatic: false`.

## The Practical Choices

For a supported chart preset, the catalog should say which of these choices
applies:

| Choice | Meaning |
| --- | --- |
| Keep it in the preset | The rendered objects and checks are enough for this supported path. |
| Split the preset | For example, provide both `default` and `no-crds` so users can choose who owns CRDs. |
| Run a setup step | The chart needs work before or after apply, and the step has evidence for this chart. |
| Use a GitOps action | Argo, Flux, or another delivery tool can run the work where we have tested that path. |
| Require a target fact | The user must provide a Secret, StorageClass, hosted zone, CRD owner, cloud account, or similar input. |
| Block or refuse | The catalog does not claim the path works until the missing evidence or unsafe behavior is resolved. |

These choices are how the catalog handles most real cases. It does not need one
generic hook mechanism that treats every chart the same way. It needs accurate
chart-specific answers, recorded inputs, generated output, and receipts where
support is claimed.

## What a route tells you

- **Where it goes** - a lifecycle phase: `pre-render`, `preflight`, `pre-apply`,
  `post-apply`, `observe`, or `refuse`.
- **Who runs it** - you, your cluster/controller, or (not yet) the product.
- **Whether it's automatic** - the route record says which exact implementation
  ran. A direct script result does not prove the Argo CD or Flux version of the
  same step. Top-level `automatic` stays `false` until every delivery path named
  by the claim has its own receipt.
- **What's needed next** - the target facts to supply, and the evidence required
  before the route can be called supported.

Each behavior carries a disposition: `observed` (route plus a live receipt),
`routed` (route known, not run), `per-target` (a target decision is required),
`blocked` (a prerequisite or evidence is missing), or `refused` (deliberately
not run).

The machine-readable form is
[data/lifecycle-route-actions/](../../data/lifecycle-route-actions/summary.md):
an agent reads `actions.json` and turns a row into a preflight/action/observe
plan. The route contract behind it is
[data/lifecycle-routes/](../../data/lifecycle-routes/summary.md). The **per-chart** view —
each chart's routes, disposition, `automatic: false`, and whether a skill applies — is
[data/per-chart-hooks/](../../data/per-chart-hooks/summary.md) (colored cards in
`by-chart.html`).

## What You Actually Do

1. **Choose the chart preset.** Start from the chart page, not a generated
   package folder.
2. **Read the chart extras.** Look for hooks, CRDs, setup jobs, webhooks,
   generated Secrets, and target facts.
3. **Check the disposition.** `observed` has a receipt for the supported scope.
   `routed`, `blocked`, or `per-target` means the work is named but still needs
   setup, target input, or more evidence.
4. **Supply the required target facts** such as Secrets, CRDs, storage, hosted
   zones, or cloud accounts.
5. **Run only the actions that are supported for that chart and target.** A
   placeholder command is not a support claim.
6. The behavior becomes `observed` for your scope once there is a receipt.

## Worked examples

### Kube Prometheus Stack - direct install and controller upgrade

Kube Prometheus Stack 85.3.3 renders 124 ordinary objects, ten CRDs, and seven
Helm hook objects. The direct example applies the CRDs first, runs the chart's
certificate creation Job, checks the resulting Secret, applies the ordinary
objects, runs the webhook patch Job, checks the webhook and six workloads, and
removes the temporary hook objects.

Run the guarded example with:

```bash
HELM_EXPT_ALLOW_LIVE_KPS_LIFECYCLE_PROOF=1 npm run kps:lifecycle-route:run
```

The [human guide](../demo/hooks-crds/kube-prometheus-stack.md), [summary](../../data/kps-lifecycle-route-proof/summary.md),
and [receipt](../../runs/kps-lifecycle-route-proof/receipt.yaml) show the order,
objects, checks, and limits. This proves one fresh direct install on kind.

The `no-crds` preset also has a separate
[controller receipt](../../runs/kps-gitops-lifecycle-proof/receipt.yaml). Argo
CD and Flux installed 85.3.3, upgraded to 86.1.0, replaced both completed setup
Jobs, and passed the runtime checks. ConfigHub does not yet select that route
automatically, and the receipt does not prove rollback or long-running soak.

### cert-manager / External Secrets — `observed`

cert-manager's `startupapicheck` post-install hook becomes a **post-apply API
dry-run / readiness check**, and CRD ownership is a **per-target** decision (a
base ships the CRDs, or the cluster owns them). External Secrets has no Helm
hook, but its controller populates Secret data and a webhook CA bundle after
apply — a post-apply observation. Both are **observed**, with receipts, in the
[cert-manager / ESO lifecycle result](../../data/lifecycle-observations/cert-manager-eso/summary.md).
(These are not in the hook-disposition source yet, so they do not have action
packets — they are shown here until that source is folded in.)

### Consul UI Ingress — `per-target`

Exposing the Consul UI is a **per-target** decision, not an automatic step:
whether and how to route ingress depends on your platform, and Consul's
controller health is still a `watch` item. The catalog **names the decision**
rather than guessing or claiming it is done.

### A hook that stays `routed`, not automatic

`bitnami/kafka`'s provisioning Job is a `post-install` / `post-upgrade` hook
routed as a managed action — but its live status is **blocked** (pinned image
tags no longer resolve upstream), so its action packet is `blocked`,
`automatic: false`. The route is known; it is not run for you. The packet says
exactly that, with the blocker and the evidence required to advance.

## The honest boundary

A known route is not an executed one. `automatic` is `false` for every route
today. The value now is clear chart-specific guidance: you, a reviewer, or an
agent can see where each hidden behavior goes and what it needs, instead of
reverse-engineering Helm during an install.

Making the product execute observed or routed steps is separate, continuing
work ([#688](https://github.com/confighub/helm-expt/issues/688)).

## See also

- [hook-lifecycle-strategy.md](./hook-lifecycle-strategy.md) — the canonical hook
  treatment and disposition vocabulary.
- [schemas/lifecycle-route-action.schema.json](../../schemas/lifecycle-route-action.schema.json)
  — the action-packet schema.
