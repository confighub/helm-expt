# Prometheus High-Fanout Demo

This generated demo uses `prometheus-community/kube-prometheus-stack@85.3.3` to show why some Helm choices
belong in reviewed base variants instead of ad hoc post-render edits.

## Base Variants

| Base | User choice | Helm objects | CRDs | Webhook configs | Monitoring custom resources | Current live evidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `default` | install the stack including Prometheus Operator CRDs | 124 | 10 | 2 | 50 | local kind parity: `watch` |
| `no-crds` | install the stack without creating CRDs | 114 | 0 | 2 | 50 | GitOps/OCI: `blocked`; local kind parity: `blocked` |

The `no-crds` base changes one render-time choice:

~~~text
crds.enabled=false
~~~

That removes 10 CRD objects from the rendered set. It does not
remove the Prometheus custom resources that use those CRDs. The existing
GitOps/OCI receipt records `blocked`
because Flux pulled the ConfigHub OCI artifact, then blocked before apply when
the target cluster did not have the required CRDs.

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

## Files

| File | Purpose |
| --- | --- |
| `data/high-fanout-demo/prometheus-kps.csv` | Spreadsheet row for each base and the default-to-no-crds delta. |
| `recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md` | Variant catalog and receipt links. |
| `recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml` | Desired-state graph fragment showing the base relation. |
| `data/runtime-gitops/receipts/prometheus-community-kube-prometheus-stack/no-crds/latest.yaml` | GitOps/OCI receipt for the no-crds prerequisite failure. |

Regenerate:

~~~sh
npm run high-fanout:generate
npm run high-fanout:verify
~~~
