# Broken Chart Triage

**UNOFFICIAL/EXPERIMENTAL.** Use this when a Helm chart, values file, or
ConfigHub/cub installer path does not behave the way a user expected.

The goal is not to argue that the chart is good or bad. The goal is to turn the
failure into a named result: `pass`, `watch`, `blocked`, `refused`, or a routed
gap with evidence.

## First Question

```text
Did the desired object set differ from regular Helm, or did the target fail to
run the same desired object set?
```

That split matters. A render mismatch is a recipe/model problem. A target
failure is usually a prerequisite, lifecycle, image, controller, or runtime
problem.

## Triage Path

| Step | Ask | Where to look |
| --- | --- | --- |
| 1. Render | Does `cub installer` render the same object set as Helm for the same chart, base, values, and capability profile? | chart page, render receipt, matrix `R` lane |
| 2. Target prerequisites | Does the target provide required CRDs, Secrets, StorageClasses, cloud identity, API capabilities, or topology? | target prerequisite docs, matrix watch/blocked reason |
| 3. Lifecycle actions | Did a hook, CRD install, webhook bootstrap, or post-apply observation need an explicit route? | chart actions, lifecycle route actions |
| 4. Images | Did an image disappear or require a mirror, digest pin, pull secret, or legacy namespace? | image workdown, chart page watch reason |
| 5. GitOps sync | Did the controller sync objects but the workload stayed unhealthy? | live receipts, why-synced-is-not-working |
| 6. Runtime health | Did pods, PVCs, Jobs, webhooks, or APIService readiness fail after apply? | local/live receipts and active proof queue |
| 7. Model gap | Is the base too default-shaped, missing a useful values path, or using the wrong capability profile? | chart-use guide, useful-base queue |

## What To Send

If you want the project to reproduce the problem, send:

```text
chart repository and chart name
chart version
values file or flags
Kubernetes version if relevant
controller path: Helm, cub installer, ConfigHub OCI, Argo, Flux, or cub-direct
what you expected
what happened
```

The expected response is a fixture, receipt, named refusal, route, or watch row.
If the project cannot prove the claim, the answer should say so directly.

