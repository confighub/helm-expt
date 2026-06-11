# Prometheus High-Fanout Demo

This generated demo uses `prometheus-community/kube-prometheus-stack@85.3.3` to show why some Helm choices
belong in reviewed base variants instead of ad hoc post-render edits.

## Base Variants

| Base | User choice | Helm objects | CRDs | Webhook configs | Monitoring custom resources | Current proof chain |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `default` | install the stack including Prometheus Operator CRDs | 124 | 10 | 2 | 50 | render `pass`; two-cluster kind `pass`; strict ConfigHub OCI/Argo `pass`; production `supported-for-declared-target-scope` |
| `no-crds` | install the stack without creating CRDs | 114 | 0 | 2 | 50 | render `pass`; two-cluster kind `pass`; strict ConfigHub OCI/Argo `pass`; production `support-evidence-present` |

The `no-crds` base changes one render-time choice:

~~~text
crds.enabled=false
~~~

That removes 10 CRD objects from the rendered set. It does not
remove the Prometheus custom resources that use those CRDs. The existing
older GitOps/OCI receipt records `blocked`
because Flux pulled the ConfigHub OCI artifact, then blocked before apply when
the target cluster did not have the required CRDs. A newer strict
ConfigHub OCI/Argo receipt passes when the compatible CRDs and admission Secret
are staged as target facts.

## Chain Of Proof Status

| Boundary | `default` | `no-crds` | Evidence |
| --- | --- | --- | --- |
| Render parity | `pass` | `pass` | Helm-equivalence receipts under `recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/*/r001/receipts/`. |
| ConfigHub proof | chart-level `pass` | chart-level `pass` | `runs/kube-prometheus-stack-confighub-proof/latest/`. |
| Two-cluster kind parity | `pass` | `pass` | `runs/live-kind-parity/prometheus-community-kube-prometheus-stack-*/receipt.yaml`. |
| ConfigHub OCI/GitOps | strict live `pass` | strict live `pass` with staged target facts; older runtime wave `blocked` without them | `runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml`, `runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml`, and `data/runtime-gitops/receipts/prometheus-community-kube-prometheus-stack/no-crds/latest.yaml`. |
| Production support | `supported-for-declared-target-scope` | `support-evidence-present` | `data/production-support-decisions/prometheus-community-kube-prometheus-stack/support-decision.yaml`, `data/production-support-decisions/prometheus-community-kube-prometheus-stack/fresh-target-evidence-no-crds-2026-06-11.yaml`, and `data/production-disposition/top20.csv`. |

This is the chain-of-proof lesson. The `no-crds` base is not semantically
wrong: it passes two-cluster kind parity and strict ConfigHub OCI/Argo parity
when CRDs and the admission Secret are staged as target facts. It is also
correct for the older runtime GitOps wave to block when those CRDs are absent.

## Value Reachability

The value-source map records two user-visible inputs and the rendered fields
they affect:

| Value path | Impact | Rendered fields |
| --- | --- | ---: |
| `grafana.adminPassword` | changes-grafana-admin-secret-and-dependent-grafana-pods | 4 |
| `crds.enabled` | changes-prometheus-operator-crd-object-set | 10 |

This is deliberately small. It does not claim a full inverse map for the whole
chart. It shows how high-value choices can become explicit graph edges instead
of disappearing into rendered YAML.

For a compact pre-ship view of those choices, see:

`data/high-fanout-demo/operation-preview.md`

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
| `default` | Keep the target-scoped evidence fresh before using this supported scope as a production-support example. |
| `no-crds` | decide whether the recorded staged-CRD and admission-Secret target scope should become a supported no-crds scope |

For production support, the `default` base has a narrow target-scoped
supported decision. The `no-crds` base now has target-scoped support evidence
for the staged-CRD and admission-Secret path, but it still needs a separate
decision before it should be described as supported. Broader environments still
need their own decision for CRD ownership, admission Secret source, webhook
freshness checks, RBAC and scrape scope, storage posture, and the supported
delivery path.

## Production Support Checklist

This chart is the serious-chart proof path. The current evidence makes the
base choices reviewable; it does not mark either base production-supported for
all targets. Production support remains target-scoped.

| Decision | `default` | `no-crds` | Evidence |
| --- | --- | --- | --- |
| CRD ownership | This release owns the Prometheus Operator CRDs. | The target cluster owns compatible Prometheus Operator CRDs before apply. | `data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/crd-lifecycle-and-upgrade-policy.yaml` |
| Admission Secret | Stage or manage `monitoring/kube-prometheus-stack-admission` cert/key before config-only delivery. | Stage the same admission Secret plus the external CRDs. | `data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/target-fact-preflight.yaml` |
| Webhook freshness | Observe webhook, operator, and caBundle readiness after apply. | Same, after CRDs are established. | `data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/webhook-readiness-and-failure-policy.yaml` |
| RBAC and scrape scope | Approve the rendered cluster RBAC and monitoring blast radius for the target. | Same RBAC family; target CRD ownership does not narrow scrape scope by itself. | `data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/cluster-rbac-review.yaml` |
| Scan and image posture | Accept the scan findings for this infrastructure scope or create a hardened base. | Same, plus prerequisite evidence for external CRDs. | `data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/scan-gate-warning-disposition.yaml` |
| Final live evidence | Keep target-scoped live parity, GitOps/OCI, and observation receipts fresh for the supported target. | Use the staged-prerequisite support evidence as proof input, then record a target-scoped support decision for the chosen target. | `runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml`; `runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml`; `runs/live-kind-parity/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml`; `data/production-support-decisions/prometheus-community-kube-prometheus-stack/fresh-target-evidence-no-crds-2026-06-11.yaml` |

Use `default` when the catalog package should own the CRDs. Use `no-crds`
only when CRDs are a target prerequisite with their own owner, version, and
fresh observation. The two bases are both valid review inputs, but they are not
the same operational contract.

## Files

| File | Purpose |
| --- | --- |
| `data/high-fanout-demo/prometheus-kps.csv` | Spreadsheet row for each base and the default-to-no-crds delta. |
| `data/high-fanout-demo/operation-preview.md` | Pre-ship preview for the currently mapped high-fanout inputs. |
| `recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md` | Variant catalog and receipt links. |
| `recipes/prometheus-community/kube-prometheus-stack/85.3.3/value-source-map.yaml` | Value-to-rendered-field reachability for the Grafana admin password and CRD toggle. |
| `recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml` | Desired-state graph fragment showing the base relation. |
| `data/production-support-decisions/prometheus-community-kube-prometheus-stack/README.md` | Human workdown for the current target-scoped production support decision. |
| `data/production-support-decisions/prometheus-community-kube-prometheus-stack/fresh-target-evidence-no-crds-2026-06-11.yaml` | Target-scoped support evidence for the `no-crds` base with compatible CRDs and admission Secret staged. |
| `runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml` | Strict live proof for regular Helm, ConfigHub apply, and ConfigHub OCI/Argo on the default base. |
| `runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml` | Strict live proof for regular Helm, ConfigHub apply, and ConfigHub OCI/Argo on the no-crds base with target facts staged. |
| `runs/live-kind-parity/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml` | Two-cluster kind parity proof for the no-crds base with target facts staged. |
| `data/runtime-gitops/receipts/prometheus-community-kube-prometheus-stack/no-crds/latest.yaml` | GitOps/OCI receipt for the no-crds prerequisite failure. |
| `docs/user/chain-of-proof.md` | User-facing guide to which proof boundary each receipt supports. |

Regenerate:

~~~sh
npm run high-fanout:generate
npm run high-fanout:verify
~~~
