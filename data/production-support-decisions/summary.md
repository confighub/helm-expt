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
```

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
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | draft | vanilla-kubernetes; namespace=monitoring; delivery=confighub-oci; controller=argo-or-flux | needs-fresh-target-evidence-before-final | treat kube-prometheus-stack as the serious-chart proof: close image, security, and lifecycle decisions first, then refresh scoped ConfigHub OCI/GitOps evidence for the monitoring namespace |
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
