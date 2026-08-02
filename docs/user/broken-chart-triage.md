# Find Out Why A Chart Failed

**UNOFFICIAL/EXPERIMENTAL.** Use this guide when a Helm chart, values file,
`cub installer` run, or ConfigHub deployment does not behave as expected.

First find out whether the Kubernetes objects changed before deployment, or the
expected objects reached a target and failed there. That distinction tells you
where to look next.

## First Question

```text
Did the desired object set differ from regular Helm, or did the target fail to
run the same desired object set?
```

If the objects differ, check the chart version, values, release settings, and
Kubernetes capabilities used during rendering. If the objects match, check
target prerequisites, install order, images, the delivery controller, and
runtime health.

## Triage Path

| Step | Ask | Where to look |
| --- | --- | --- |
| 1. Compare the render | Does `cub installer` produce the same objects as Helm for the same chart, configuration, values, and Kubernetes capabilities? | chart page, rendered YAML, render comparison receipt |
| 2. Check target prerequisites | Does the target provide the required CRDs, Secrets, StorageClasses, cloud identity, APIs, and cluster features? | chart requirements and target-prerequisite guide |
| 3. Check install and upgrade work | Does a hook, CRD install, webhook setup, Job, or post-apply check need to run separately? | chart page, hook guide, and recorded actions |
| 4. Check images | Is an image missing, private, moved, or in need of a mirror, digest pin, or pull Secret? | chart page and image notes |
| 5. Check GitOps | Did Argo CD or Flux report a successful sync while the workload remained unhealthy? | delivery receipt and controller status |
| 6. Check runtime health | Did Pods, PVCs, Jobs, webhooks, or APIService readiness fail after apply? | live receipt and cluster events |
| 7. Check the catalog configuration | Does this use case need different values, Kubernetes capabilities, or another ready-made configuration? | chart page and catalog configuration guide |

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

A useful result includes a repeatable test, the observed failure, and the next
action. The catalog records the outcome as `pass`, `watch`, `blocked`, or
`refused`. If the project cannot support the path yet, the answer should say so
directly.
