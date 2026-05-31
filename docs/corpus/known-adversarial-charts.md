# Known Adversarial Public Charts

Use this list to keep top-20/top-50 proof runs grounded in real public Helm
chart behavior. Enterprise-internal chart variants are out of scope for this
catalog proof.

The point is not to pick impossible charts. The point is to prove that
ConfigHub can classify, control, render, scan, gate, publish, and explain real
public-chart behavior.

| Chart | Stress Features | Proof Focus |
| --- | --- | --- |
| `bitnami/redis` | generated password, existing secret, StatefulSet/PVC, secret separation | first complete proof, Helm equivalence, variants |
| `jetstack/cert-manager` | CRDs, webhooks, hook-like lifecycle, cert bootstrap | CRD readiness, webhook/admission risk, lifecycle policy |
| `prometheus-community/kube-prometheus-stack` | large CRD set, umbrella chart, dependencies, RBAC, webhooks | scale, CRD ordering, dependency closure, policy scans |
| `external-secrets/external-secrets` | CRDs, webhooks, RBAC, controller semantics | CRD/webhook/RBAC control points |
| `argo-cd/argo-cd` | CRDs, RBAC, raw/extra manifests, GitOps integration | ConfigHub OCI -> GitOps handoff, extension slots |
| `ingress-nginx/ingress-nginx` | capability branching, admission webhook, cluster RBAC | capability profiles, webhooks, cluster-scope resources |
| `grafana/loki` | object graph complexity, storage modes, generated config | variants, graph checks, storage risk |
| `kubernetes-dashboard/kubernetes-dashboard` | generated certs, RBAC, service exposure | generated facts, RBAC scan, ingress/service variants |
| `bitnami/postgresql-ha` | stateful/PVC, generated credentials, upgrade hooks | generated facts, PVC policy, upgrade/rollback receipts |
| `longhorn/longhorn` | CRDs, daemonsets, cluster permissions, storage lifecycle | CRD/RBAC/storage lifecycle readiness |
| `istio/istiod` | CRDs, webhooks, APIService/aggregation, capability sensitivity | API capability profile, admission risks |

## Required Coverage

The first adversarial public chart set must include:

- CRDs.
- Hooks or lifecycle-sensitive behavior.
- Generated secrets, certs, UUIDs, or time values.
- Capability branching.
- `tpl`.
- Raw or extra manifest extension points.
- Dependencies or umbrella charts.
- RBAC, webhooks, or APIService.
- Stateful/PVC behavior.
- Upgrade-sensitive charts.

## Linked P0 Gates

- Capability profiles: [#29](https://github.com/confighub/helm-expt/issues/29).
- Generated facts: [#28](https://github.com/confighub/helm-expt/issues/28).
- Upgrade/rollback receipts: [#30](https://github.com/confighub/helm-expt/issues/30).
- Observation freshness: [#27](https://github.com/confighub/helm-expt/issues/27).
- Top-N harness: [#25](https://github.com/confighub/helm-expt/issues/25).

Rows in generated spreadsheets should point back to the chart's readiness card,
control points, rendered object digest, scan/gate result, and proof receipts.

## Hook-Heavy Coverage

The top-500 source scan found 54 charts with Helm hooks. A first-pass risk pass
classified 42 as likely problematic for production lifecycle support, because
they include non-test lifecycle phases, hook ordering/delete policy, Jobs,
cluster RBAC, CRDs, webhooks, APIServices, `lookup`, or generated-fact signals.

Keep these public examples in adversarial coverage:

| Chart | Why |
| --- | --- |
| `prometheus-community/kube-prometheus-stack` | post/pre lifecycle hooks, CRDs, webhooks, RBAC, lookup, generated facts. |
| `jetstack/cert-manager` | post-install startup API check, CRDs, admission webhooks, cluster RBAC. |
| `kyverno/kyverno` | post-upgrade/pre-delete hooks, hook weights/delete policy, admission/CRD risk. |
| `kubernetes-dashboard/kubernetes-dashboard` | upgrade hooks, generated facts, RBAC, APIService. |
| `kong/kong` | pre/post-upgrade hooks, CRDs, webhooks, RBAC. |
| `ory/hydra` / `ory/kratos` | pre-install/pre-upgrade hooks with migration-style lifecycle concerns. |

For each, the proof target is not "run Helm hooks invisibly." The target is:

```text
hook inventory -> lifecycle disposition -> safe translation or blocker ->
receipt / observation
```
