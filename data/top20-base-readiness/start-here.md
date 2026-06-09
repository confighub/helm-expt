# Top-20 Start-Here Bases

This generated page lists the catalog bases that are currently the easiest
first paths. Each row has render parity, ConfigHub proof, local live evidence,
GitOps/OCI evidence, selected live Helm-vs-ConfigHub parity, and two-cluster
kind parity passing for that base.

These are not production support claims. Before production use, check the
production support decision contract and the chart's support decision queue.

## Summary

~~~text
start-here bases: 11
top-20 base variants: 40
production-supported charts: 0
~~~

## First Paths

| Chart | Base | Command | Before production |
| --- | --- | --- | --- |
| `bitnami/mongodb@19.0.7` | generated-passwords | `cub installer setup --pull packages/bitnami/mongodb/19.0.7 --base generated-passwords --work-dir <tmp> --non-interactive --namespace mongodb` | check production decision for bitnami/mongodb |
| `bitnami/mysql@14.0.3` | generated-passwords | `cub installer setup --pull packages/bitnami/mysql/14.0.3 --base generated-passwords --work-dir <tmp> --non-interactive --namespace mysql` | check production decision for bitnami/mysql |
| `bitnami/nginx@24.0.2` | http-clusterip | `cub installer setup --pull packages/bitnami/nginx/24.0.2 --base http-clusterip --work-dir <tmp> --non-interactive --namespace nginx` | check production decision for bitnami/nginx |
| `bitnami/rabbitmq@16.0.14` | generated-passwords | `cub installer setup --pull packages/bitnami/rabbitmq/16.0.14 --base generated-passwords --work-dir <tmp> --non-interactive --namespace rabbitmq` | check production decision for bitnami/rabbitmq |
| `bitnami/redis@25.5.3` | default | `cub installer setup --pull packages/bitnami/redis/25.5.3 --base default --work-dir <tmp> --non-interactive --namespace redis` | check production decision for bitnami/redis |
| `external-secrets/external-secrets@2.5.0` | default | `cub installer setup --pull packages/external-secrets/external-secrets/2.5.0 --base default --work-dir <tmp> --non-interactive --namespace external-secrets` | check production decision for external-secrets/external-secrets |
| `grafana/grafana@10.5.15` | generated-passwords | `cub installer setup --pull packages/grafana/grafana/10.5.15 --base generated-passwords --work-dir <tmp> --non-interactive --namespace grafana` | check production decision for grafana/grafana |
| `grafana/loki@7.0.0` | single-binary-filesystem | `cub installer setup --pull packages/grafana/loki/7.0.0 --base single-binary-filesystem --work-dir <tmp> --non-interactive --namespace loki` | check production decision for grafana/loki |
| `hashicorp/consul@2.0.0` | default-control-plane | `cub installer setup --pull packages/hashicorp/consul/2.0.0 --base default-control-plane --work-dir <tmp> --non-interactive --namespace consul` | check production decision for hashicorp/consul |
| `longhorn/longhorn@1.11.2` | default | `cub installer setup --pull packages/longhorn/longhorn/1.11.2 --base default --work-dir <tmp> --non-interactive --namespace longhorn-system` | check production decision for longhorn/longhorn |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | `cub installer setup --pull packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0 --base default --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for secrets-store-csi-driver/secrets-store-csi-driver |

## After Setup

Replace `<tmp>` with the work directory from the row you used.

~~~sh
cub installer render --work-dir <tmp>
cub installer plan --work-dir <tmp>
~~~

For a direct local Kubernetes check, apply separated Secrets first only when
the work directory contains `out/secrets`, then apply the manifests:

~~~sh
kubectl apply -f <tmp>/out/secrets
kubectl apply -f <tmp>/out/manifests
~~~

For ConfigHub, upload the work directory with the chart's component and variant
labels. Use the chart demo transcript for exact labels, or start with the Redis
tutorial for the smallest worked example:

~~~sh
cub installer upload --work-dir <tmp> --space <space> ...
~~~

## Related Files

| File | Use |
| --- | --- |
| `data/top20-base-readiness/base-readiness.csv` | Full one-row-per-base table. |
| `data/top20-base-readiness/summary.md` | All readiness categories, including runtime and prerequisite rows. |
| `data/production-disposition/support-decision-contract.md` | What must be recorded before production support can be claimed. |
| `data/production-disposition/support-decision-queue.csv` | One production decision row per top-20 chart. |
| `CATALOG.md` | Top-level chart and variant catalog. |
