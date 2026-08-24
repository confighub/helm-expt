# Kube Prometheus Stack promotion through ConfigHub

This example answers one practical question: can the checked
`85.3.3` `no-crds` configuration move to `86.1.0`
without losing the chart-specific CRD and admission setup work?

The answer for this exact version pair and test destination is **yes**.
ConfigHub retained the current object set, showed the candidate changes,
promoted the candidate through staging, required approval, stored the route,
published a new OCI release, and Argo CD completed the ordered work.

## What changed

| Check | Result |
| --- | --- |
| Current objects | 130 |
| Candidate objects | 130 |
| Added | 0 |
| Removed | 0 |
| Changed | 111 |
| Unchanged | 19 |

## What ConfigHub retained

| Stage | Space | Result |
| --- | --- | --- |
| Base | `kps-no-crds-upgrade-base` | Exact candidate objects and source OCI digest |
| Staging | `kps-no-crds-upgrade-staging` | Promoted candidate, README, route, and approval |
| Delivery | Temporary target-bound variant | Two immutable release digests and the Argo CD result |

The current release was `sha256:dd92541c2bc583359ba5c8d7f38937fe78bd16bbc0f07b38af0f0f35b61785f0`. The candidate
release was `sha256:b676a4ac138c0c932336a128883332c797fd8715c4b76c7aae269e5f08f0208e`.

## Lifecycle work

- The destination supplied the two Secrets from the checked chart render. Their values are not in the release OCI or this receipt.
- The target-bound variant preserved the chart's `monitoring` and `kube-system` namespaces. A global namespace override would have moved five Services incorrectly.
- Argo CD established ten CRDs before the chart's custom resources.
- The retained Argo Application used server-side apply for the large CRDs.
- The proof runner removed the two completed admission setup Jobs before replacement.
- Argo CD then applied the recorded sync waves and reran both Jobs.
- The proof checked three matching webhook CA bundles, six ready workloads, a ready operator endpoint, and one server-side dry run.

The route is recorded as `automatic: false`. ConfigHub keeps and checks the
decision, but a person or automation still starts the Job replacement step. A different
chart version, Kubernetes target, or delivery controller needs another route
resolution and another test.

## Open the records

- [Promotion review](../../examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/promotion-review.yaml)
- [Lifecycle route](../../examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/lifecycle-route.yaml)
- [Destination resolution](../lifecycle-route-resolutions/kube-prometheus-stack-86-1-0-no-crds-argo-cd.yaml)
- [Earlier Argo CD and Flux staged-OCI proof](../../runs/kps-gitops-lifecycle-proof/receipt.yaml)
- [Live receipt](../../runs/kps-confighub-lifecycle-promotion/receipt.yaml)

## Limits

- This proves one 85.3.3 to 86.1.0 no-crds promotion through ConfigHub, one Argo CD destination, and one throwaway kind cluster.
- The target supplied the Alertmanager and Grafana Secrets separately. Their values are not present in OCI or this receipt.
- The operator removed the two completed setup Jobs before publishing the candidate. ConfigHub records and checks that route, but does not yet choose and run it automatically.
- The separate staged-OCI proof covers Flux for this version pair. This ConfigHub release proof covers Argo CD only.
- Rollback, long-running soak, and a production cluster were not tested in this run.
