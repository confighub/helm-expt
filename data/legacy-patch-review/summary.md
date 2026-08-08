# Legacy Patch Review

This generated review creates the lane for valuable old-version patch support.
It does not claim old-version support yet.

## Summary

```text
recipes reviewed: 139
legacy patch lanes open: 20
old versions selected: 0
```

## Open Lanes

| Chart | Status | Next action |
| --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `bitnami/mongodb@19.0.7` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `bitnami/mysql@14.0.3` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `bitnami/nginx@24.0.2` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `bitnami/postgresql@18.6.7` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `bitnami/rabbitmq@16.0.14` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `bitnami/redis@25.5.3` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `external-secrets/external-secrets@2.5.0` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `grafana/grafana@10.5.15` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `grafana/loki@7.0.0` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `grafana/tempo@1.24.4` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `hashicorp/consul@2.0.0` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `hashicorp/vault@0.32.0` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `ingress-nginx/ingress-nginx@4.15.1` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `jetstack/cert-manager@v1.20.2` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `longhorn/longhorn@1.11.2` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `metrics-server/metrics-server@3.13.0` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `prometheus-community/kube-prometheus-stack@85.3.3` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `prometheus-community/prometheus@29.8.0` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | review-lane-open | Select old chart versions worth paid patch support and generate the first upgrade/patch scenario. |

## Required Proof Before Selling Old-Version Patches

- old-version source lock and dependency lock
- old-version recipe and installer package
- old-version rendered revision digest
- patch diff against the supported current recipe
- scan/gate result for the patched rendered objects
- upgrade and rollback receipts
- explicit support window and scope
