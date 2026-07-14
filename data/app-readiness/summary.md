# Green-Field App-Readiness: an RBAC read-app on the held data

This is a small **app built on the held config-as-data** - no cluster, no re-render. It reads the already-rendered WET YAML of every committed default render and analyses its RBAC for broad/risky permissions, the same shape of tool the *"There should be an app for that"* thesis builds on ConfigHub (the RBAC Manager). It exists to prove the **green-field** stage of the user story: the held data is *app-able* (queryable + analysable), so you can build tools on it instead of writing templates.

Scanned **95** default renders; **69** ship RBAC; **50** contain at least one broad/risky rule by these conservative heuristics.

Findings across the catalog:

| Finding | Charts | Meaning |
| --- | ---: | --- |
| `full-wildcard` | 8 | a rule grants `*` verbs on `*` resources (admin-like) |
| `secret-read` | 46 | a rule can read Secrets (`get`/`list`/`watch` or `*`) |
| `priv-escalation` | 2 | a rule has `escalate`/`bind`/`impersonate` |
| `all-resources` | 8 | a rule targets `*` resources (non-wildcard verbs) |

## Charts with the most broad/risky RBAC rules

| Chart | ClusterRoles | Roles | Risky rules | Findings |
| --- | ---: | ---: | ---: | --- |
| `crossplane-stable/crossplane/2.3.1` | 12 | 0 | 22 | `all-resources`, `full-wildcard`, `priv-escalation`, `secret-read` |
| `rook-release/rook-ceph/v1.19.5` | 33 | 14 | 16 | `secret-read` |
| `argo-cd/argo-cd/9.5.15` | 3 | 6 | 10 | `all-resources`, `full-wildcard`, `secret-read` |
| `argo-cd/argo-cd/9.5.17` | 3 | 6 | 10 | `all-resources`, `full-wildcard`, `secret-read` |
| `jetstack/cert-manager/v1.20.2` | 13 | 4 | 8 | `secret-read` |
| `istio/istiod/1.30.0` | 3 | 1 | 6 | `all-resources`, `secret-read` |
| `gatekeeper/gatekeeper/3.22.2` | 1 | 1 | 4 | `all-resources`, `secret-read` |
| `kyverno/kyverno/3.8.1` | 16 | 4 | 4 | `secret-read` |
| `haproxytech/kubernetes-ingress/1.52.0` | 1 | 0 | 3 | `all-resources`, `secret-read` |
| `kedacore/keda/2.19.0` | 4 | 1 | 3 | `all-resources`, `secret-read` |
| `minio-operator/operator/7.1.1` | 1 | 0 | 3 | `full-wildcard`, `secret-read` |
| `prometheus-community/kube-prometheus-stack/85.3.3` | 4 | 0 | 3 | `secret-read` |
| `prometheus-community/kube-prometheus-stack/86.1.0` | 4 | 0 | 3 | `secret-read` |
| `sealed-secrets/sealed-secrets/2.18.6` | 1 | 2 | 3 | `secret-read` |
| `hashicorp/terraform/1.1.2` | 0 | 1 | 2 | `full-wildcard`, `secret-read` |
| `projectcalico/tigera-operator/v3.32.0` | 2 | 0 | 2 | `priv-escalation`, `secret-read` |
| `aqua/trivy-operator/0.32.1` | 4 | 2 | 2 | `secret-read` |
| `argo-cd/argo-workflows/1.0.14` | 7 | 1 | 2 | `secret-read` |
| `external-secrets/external-secrets/2.5.0` | 5 | 1 | 2 | `secret-read` |
| `fairwinds-stable/goldilocks/10.3.0` | 2 | 0 | 2 | `all-resources` |
| `ingress-nginx/ingress-nginx/4.15.1` | 1 | 1 | 2 | `secret-read` |
| `longhorn/longhorn/1.11.2` | 1 | 1 | 2 | `secret-read` |
| `strimzi/strimzi-kafka-operator/1.0.0` | 7 | 0 | 2 | `secret-read` |
| `argo-cd/argo-events/2.4.21` | 1 | 0 | 1 | `secret-read` |
| `argo-cd/argo-rollouts/2.40.9` | 4 | 0 | 1 | `secret-read` |
| _… and 25 more_ | | | | |

## Why this matters (the green-field thesis)

- It runs entirely on the **held render-once data** - no cluster lookup, no `helm template`, no re-render. The objects are already explicit, queryable WET YAML.
- This is the **read** half of an app on the data. The **write** half (make a change, gated + reviewed) is the reverse-reconcile design (`docs/user/reverse-reconcile-design.md`).
- You could not build this cleanly on Helm charts / kustomize / jsonnet source (you would have to render first, per chart, per cluster). That is the config-as-code gap the catalog closes.

## Honest scope

- These are **conservative heuristics over rendered RBAC**, not a full authorization analysis (no aggregationRule expansion, no binding-graph resolution of who-binds-what yet).
- A risky finding is a **review prompt**, not a verdict: many infrastructure charts legitimately need broad RBAC. The point is that the data makes it *visible and queryable*.
- The production app (e.g. the RBAC Manager) lives in ConfigHub; this proves the **substrate** that such an app needs.

## Regenerate

~~~sh
npm run app-readiness:generate
npm run app-readiness:verify
~~~
