# Prometheus High-Fanout Demo

This generated demo uses `prometheus-community/kube-prometheus-stack@85.3.3` to show why some Helm choices
belong in reviewed base variants instead of ad hoc post-render edits.

## Base Variants

| Base | User choice | Helm objects | CRDs | Webhook configs | Monitoring custom resources | Current proof chain |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `default` | install the stack including Prometheus Operator CRDs | 124 | 10 | 2 | 50 | render `pass`; two-cluster kind `pass`; strict ConfigHub OCI/Argo `pass`; production `production-review-ready` |
| `no-crds` | install the stack without creating CRDs | 114 | 0 | 2 | 50 | render `pass`; two-cluster kind `pass`; runtime GitOps wave `blocked`; production `production-review-ready` |

The `no-crds` base changes one render-time choice:

~~~text
crds.enabled=false
~~~

That removes 10 CRD objects from the rendered set. It does not
remove the Prometheus custom resources that use those CRDs. The existing
GitOps/OCI receipt records `blocked`
because Flux pulled the ConfigHub OCI artifact, then blocked before apply when
the target cluster did not have the required CRDs.

## Chain Of Proof Status

| Boundary | `default` | `no-crds` | Evidence |
| --- | --- | --- | --- |
| Render parity | `pass` | `pass` | Helm-equivalence receipts under `recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/*/r001/receipts/`. |
| ConfigHub proof | chart-level `pass` | chart-level `pass` | `runs/kube-prometheus-stack-confighub-proof/latest/`. |
| Two-cluster kind parity | `pass` | `pass` | `runs/live-kind-parity/prometheus-community-kube-prometheus-stack-*/receipt.yaml`. |
| ConfigHub OCI/GitOps | strict live `pass` | runtime wave `blocked` without pre-existing CRDs | `runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml` and `data/runtime-gitops/receipts/prometheus-community-kube-prometheus-stack/no-crds/latest.yaml`. |
| Production support | `production-review-ready` | `production-review-ready` | `data/production-disposition/top20.csv` and the KPS production-disposition receipts. |

This is the chain-of-proof lesson. The `no-crds` base is not semantically
wrong: it passes two-cluster kind parity when CRDs and the admission Secret are
staged as target facts. It is also correct for the runtime GitOps wave to block
when those CRDs are absent.

## Removed Objects

| Kind | Name |
| --- | --- |
| `CustomResourceDefinition` | `alertmanagerconfigs.monitoring.coreos.com` |
| `CustomResourceDefinition` | `alertmanagers.monitoring.coreos.com` |
| `CustomResourceDefinition` | `podmonitors.monitoring.coreos.com` |
| `CustomResourceDefinition` | `probes.monitoring.coreos.com` |
| `CustomResourceDefinition` | `prometheusagents.monitoring.coreos.com` |
| `CustomResourceDefinition` | `prometheuses.monitoring.coreos.com` |
| `CustomResourceDefinition` | `prometheusrules.monitoring.coreos.com` |
| `CustomResourceDefinition` | `scrapeconfigs.monitoring.coreos.com` |
| `CustomResourceDefinition` | `servicemonitors.monitoring.coreos.com` |
| `CustomResourceDefinition` | `thanosrulers.monitoring.coreos.com` |

## How To Use The Example

Use this as the pattern for high-fanout charts:

1. Make render-time choices explicit as base variants.
2. Compare the rendered object inventory before promotion.
3. Keep target prerequisites visible, such as pre-existing CRDs and separated
   Secrets.
4. Treat blocked live receipts as useful evidence, not noise.

The lesson is not "always install CRDs with the chart." The lesson is that
`default` and `no-crds` are different deployable contracts. One release owns
the CRDs. The other assumes the target already provides them.

## Next Hard Work

| Base | Next action |
| --- | --- |
| `default` | record final target-scoped support decision and refresh live/e2e evidence for that scope. |
| `no-crds` | stage CRDs and admission Secret for the target, then rerun GitOps/OCI and record a target-scoped support decision. |

For production support, the target-scoped decision still has to choose CRD
ownership, admission Secret source, webhook freshness checks, RBAC and scrape
scope, storage posture, and the supported delivery path.

## Files

| File | Purpose |
| --- | --- |
| `data/high-fanout-demo/prometheus-kps.csv` | Spreadsheet row for each base and the default-to-no-crds delta. |
| `recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md` | Variant catalog and receipt links. |
| `recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml` | Desired-state graph fragment showing the base relation. |
| `runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml` | Strict live proof for regular Helm, ConfigHub apply, and ConfigHub OCI/Argo on the default base. |
| `runs/live-kind-parity/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml` | Two-cluster kind parity proof for the no-crds base with target facts staged. |
| `data/runtime-gitops/receipts/prometheus-community-kube-prometheus-stack/no-crds/latest.yaml` | GitOps/OCI receipt for the no-crds prerequisite failure. |
| `docs/user/chain-of-proof.md` | User-facing guide to which proof boundary each receipt supports. |

Regenerate:

~~~sh
npm run high-fanout:generate
npm run high-fanout:verify
~~~
