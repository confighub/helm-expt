# Production Support Decisions

This generated report records target-scoped production support decisions. It is
separate from production disposition closure.

Disposition closure means the pre-review evidence exists. A production support
decision names the supported base, target scope, delivery path, accepted risks,
live evidence rule, and operator-owned boundaries.

## Summary

```text
decision artifacts: 20
supported decisions: 1
draft decisions: 19
open work items: 57
```

## Workstreams

Workstreams can overlap. One chart can need image, scan, lifecycle, and fresh
evidence work before it becomes production-supported for a target scope.

| Workstream | Charts | Examples | Next action |
| --- | ---: | --- | --- |
| Supported scope evidence | 1 | `bitnami/nginx@24.0.2` (http-clusterip) | Keep target-scoped evidence fresh before using the supported scope as a production example. |
| Image digest resolution or exception | 15 | `argo-cd/argo-cd@9.5.15` (default)<br>`bitnami/mysql@14.0.3` (generated-passwords)<br>`bitnami/rabbitmq@16.0.14` (generated-passwords)<br>`external-secrets/external-secrets@2.5.0` (default)<br>and 11 more | Pin images by digest or record an explicit exception before production OCI support. |
| Scan scope decision | 15 | `argo-cd/argo-cd@9.5.15` (default)<br>`bitnami/mongodb@19.0.7` (generated-passwords)<br>`bitnami/mysql@14.0.3` (generated-passwords)<br>`bitnami/postgresql@18.6.7` (generated-passwords)<br>and 11 more | Record which scanner findings are accepted, fixed, or outside the supported target scope. |
| Security acceptance or hardened base | 3 | `longhorn/longhorn@1.11.2` (default)<br>`prometheus-community/prometheus@29.8.0` (default)<br>`secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` (default) | Accept current security findings for the target scope or create a narrower hardened base. |
| Lifecycle decision or observation | 5 | `external-secrets/external-secrets@2.5.0` (default)<br>`grafana/loki@7.0.0` (single-binary-filesystem)<br>`hashicorp/consul@2.0.0` (default-control-plane)<br>`jetstack/cert-manager@v1.20.2` (default)<br>and 1 more | Record the lifecycle boundary, or execute and observe the selected hook/lifecycle route. |
| Runtime or missing-lane decision | 6 | `bitnami/postgresql@18.6.7` (generated-passwords)<br>`hashicorp/vault@0.32.0` (default)<br>`ingress-nginx/ingress-nginx@4.15.1` (default)<br>`jetstack/cert-manager@v1.20.2` (default)<br>and 2 more | Close the runtime, missing-lane, or lifecycle-observation decision before refreshing final evidence. |
| Fresh target-scoped evidence | 13 | `argo-cd/argo-cd@9.5.15` (default)<br>`bitnami/mongodb@19.0.7` (generated-passwords)<br>`bitnami/mysql@14.0.3` (generated-passwords)<br>`bitnami/rabbitmq@16.0.14` (generated-passwords)<br>and 9 more | After scope and risk decisions are closed, refresh ConfigHub OCI/GitOps and live/e2e evidence for that exact scope. |

## Priority Rows

These rows have the most remaining production-support decisions. The table does
not replace the per-chart decision artifact; it shows where review effort is
currently concentrated.

| Chart | Base | Open work | Next action |
| --- | --- | --- | --- |
| `external-secrets/external-secrets@2.5.0` | default | image; scan scope; lifecycle; fresh evidence | resolve image digests for each affected variant before production OCI support |
| `grafana/loki@7.0.0` | single-binary-filesystem | image; scan scope; lifecycle; fresh evidence | resolve image digests for each affected variant before production OCI support |
| `hashicorp/consul@2.0.0` | default-control-plane | image; scan scope; lifecycle; fresh evidence | resolve image digests for each affected variant before production OCI support |
| `jetstack/cert-manager@v1.20.2` | default | image; scan scope; lifecycle; lifecycle observation | choose whether default is in production scope; record the target-scoped lifecycle support decision before claiming production support |
| `argo-cd/argo-cd@9.5.15` | default | image; scan scope; fresh evidence | resolve image digests for each affected variant before production OCI support |
| `bitnami/mysql@14.0.3` | generated-passwords | image; scan scope; fresh evidence | resolve image digests for each affected variant before production OCI support |
| `bitnami/rabbitmq@16.0.14` | generated-passwords | image; scan scope; fresh evidence | resolve image digests for each affected variant before production OCI support |
| `grafana/grafana@10.5.15` | generated-passwords | image; scan scope; fresh evidence | resolve image digests for each affected variant before production OCI support |

The spreadsheet form is [work-items.csv](./work-items.csv). It has one row per
production-support task or keep-fresh item, so overlapping work such as image,
scan, lifecycle, runtime, and fresh evidence can be assigned independently.

Each decision directory also has a generated workdown page:

| Chart | Workdown |
| --- | --- |
| `argo-cd/argo-cd@9.5.15` | [default](./argo-cd-argo-cd/README.md) |
| `bitnami/mongodb@19.0.7` | [generated-passwords](./bitnami-mongodb/README.md) |
| `bitnami/mysql@14.0.3` | [generated-passwords](./bitnami-mysql/README.md) |
| `bitnami/nginx@24.0.2` | [http-clusterip](./bitnami-nginx/README.md) |
| `bitnami/postgresql@18.6.7` | [generated-passwords](./bitnami-postgresql/README.md) |
| `bitnami/rabbitmq@16.0.14` | [generated-passwords](./bitnami-rabbitmq/README.md) |
| `bitnami/redis@25.5.3` | [default](./bitnami-redis/README.md) |
| `external-secrets/external-secrets@2.5.0` | [default](./external-secrets-external-secrets/README.md) |
| `grafana/grafana@10.5.15` | [generated-passwords](./grafana-grafana/README.md) |
| `grafana/loki@7.0.0` | [single-binary-filesystem](./grafana-loki/README.md) |
| `grafana/tempo@1.24.4` | [local-persistent](./grafana-tempo/README.md) |
| `hashicorp/consul@2.0.0` | [default-control-plane](./hashicorp-consul/README.md) |
| `hashicorp/vault@0.32.0` | [default](./hashicorp-vault/README.md) |
| `ingress-nginx/ingress-nginx@4.15.1` | [default](./ingress-nginx-ingress-nginx/README.md) |
| `jetstack/cert-manager@v1.20.2` | [default](./jetstack-cert-manager/README.md) |
| `longhorn/longhorn@1.11.2` | [default](./longhorn-longhorn/README.md) |
| `metrics-server/metrics-server@3.13.0` | [default](./metrics-server-metrics-server/README.md) |
| `prometheus-community/kube-prometheus-stack@85.3.3` | [default](./prometheus-community-kube-prometheus-stack/README.md) |
| `prometheus-community/prometheus@29.8.0` | [default](./prometheus-community-prometheus/README.md) |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | [default](./secrets-store-csi-driver-secrets-store-csi-driver/README.md) |

## Decisions

| Chart | Base | Decision | Target scope | Live evidence decision | Next action |
| --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | default | draft | vanilla-kubernetes; namespace=argo-cd; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | resolve image digests for each affected variant before production OCI support |
| `bitnami/mongodb@19.0.7` | generated-passwords | draft | vanilla-kubernetes; namespace=mongodb; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `bitnami/mysql@14.0.3` | generated-passwords | draft | vanilla-kubernetes; namespace=mysql; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | resolve image digests for each affected variant before production OCI support |
| `bitnami/nginx@24.0.2` | http-clusterip | supported | cub-lk-kind-vanilla; namespace=nginx; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example. |
| `bitnami/postgresql@18.6.7` | generated-passwords | draft | vanilla-kubernetes; namespace=postgresql; delivery=confighub-oci; controller=argo-or-flux | needs-missing-live-or-confighub-lanes-before-final | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `bitnami/rabbitmq@16.0.14` | generated-passwords | draft | vanilla-kubernetes; namespace=rabbitmq; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | resolve image digests for each affected variant before production OCI support |
| `bitnami/redis@25.5.3` | default | draft | vanilla-kubernetes; namespace=redis; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `external-secrets/external-secrets@2.5.0` | default | draft | vanilla-kubernetes; namespace=external-secrets; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | resolve image digests for each affected variant before production OCI support |
| `grafana/grafana@10.5.15` | generated-passwords | draft | vanilla-kubernetes; namespace=grafana; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | resolve image digests for each affected variant before production OCI support |
| `grafana/loki@7.0.0` | single-binary-filesystem | draft | vanilla-kubernetes; namespace=loki; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | resolve image digests for each affected variant before production OCI support |
| `grafana/tempo@1.24.4` | local-persistent | draft | vanilla-kubernetes; namespace=tempo; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | resolve image digests for each affected variant before production OCI support |
| `hashicorp/consul@2.0.0` | default-control-plane | draft | vanilla-kubernetes; namespace=consul; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | resolve image digests for each affected variant before production OCI support |
| `hashicorp/vault@0.32.0` | default | draft | vanilla-kubernetes; namespace=vault; delivery=confighub-oci; controller=argo-or-flux | needs-runtime-decision-before-final | choose whether default is in production scope; close or document its runtime-review-needed live-readiness issue first |
| `ingress-nginx/ingress-nginx@4.15.1` | default | draft | vanilla-kubernetes; namespace=ingress-nginx; delivery=confighub-oci; controller=argo-or-flux | needs-runtime-decision-before-final | choose whether default is in production scope; close or document its runtime-watch live-readiness issue first |
| `jetstack/cert-manager@v1.20.2` | default | draft | vanilla-kubernetes; namespace=cert-manager; delivery=confighub-oci; controller=argo-or-flux | needs-lifecycle-observation-before-final | choose whether default is in production scope; record the target-scoped lifecycle support decision before claiming production support |
| `longhorn/longhorn@1.11.2` | default | draft | vanilla-kubernetes; namespace=longhorn; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `metrics-server/metrics-server@3.13.0` | default | draft | vanilla-kubernetes; namespace=metrics-server; delivery=confighub-oci; controller=argo-or-flux | needs-missing-live-or-confighub-lanes-before-final | resolve image digests for each affected variant before production OCI support |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | draft | vanilla-kubernetes; namespace=monitoring; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | treat kube-prometheus-stack as the serious-chart proof: close image policy and lifecycle observation next, then refresh scoped ConfigHub OCI/GitOps evidence for the monitoring namespace |
| `prometheus-community/prometheus@29.8.0` | default | draft | vanilla-kubernetes; namespace=prometheus; delivery=confighub-oci; controller=argo-or-flux | needs-missing-live-or-confighub-lanes-before-final | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | draft | vanilla-kubernetes; namespace=secrets-store-csi-driver; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |

## Rule

A `draft` decision is useful because it names the proposed support boundary.
It is not a production support claim. A row can move to `supported` only when
fresh target-scoped evidence for the declared delivery path is recorded and the
decision no longer has `requiredBeforeFinal` entries.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
