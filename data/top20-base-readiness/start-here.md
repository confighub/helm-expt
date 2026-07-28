# Top-20 Start-Here Bases

This generated page lists the catalog bases that are currently the easiest
first paths. Each row has render parity, ConfigHub proof, local live evidence,
GitOps/OCI evidence, selected live Helm-vs-ConfigHub parity, and two-cluster
kind parity passing for that base.

These are not production support claims. Before production use, check the
target-scoped support decision for the chart/base/target you intend to use.

## Summary

~~~text
start-here bases: 26
top-20 base variants: 42
target-scoped supported decisions: 17
target-scoped superseded decisions: 2
target-scoped rejected decisions: 1
target-scoped draft decisions: 0
~~~

## First Paths

| Chart | Base | Command | Before production |
| --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/argo-cd-argo-cd:9.5.15 --base default --work-dir <tmp> --non-interactive --namespace argocd` | check production decision for argo-cd/argo-cd |
| `bitnami/mysql@14.0.3` | existing-secret | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-mysql:14.0.3 --base existing-secret --work-dir <tmp> --non-interactive --namespace mysql` | check production decision for bitnami/mysql |
| `bitnami/mysql@14.0.3` | static-passwords | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-mysql:14.0.3 --base static-passwords --work-dir <tmp> --non-interactive --namespace mysql` | check production decision for bitnami/mysql |
| `bitnami/rabbitmq@16.0.14` | existing-secret | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-rabbitmq:16.0.14 --base existing-secret --work-dir <tmp> --non-interactive --namespace rabbitmq` | check production decision for bitnami/rabbitmq |
| `bitnami/rabbitmq@16.0.14` | static-passwords | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-rabbitmq:16.0.14 --base static-passwords --work-dir <tmp> --non-interactive --namespace rabbitmq` | check production decision for bitnami/rabbitmq |
| `external-secrets/external-secrets@2.5.0` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/external-secrets-external-secrets:2.5.0 --base default --work-dir <tmp> --non-interactive --namespace external-secrets` | check production decision for external-secrets/external-secrets |
| `external-secrets/external-secrets@2.5.0` | no-crds | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/external-secrets-external-secrets:2.5.0 --base no-crds --work-dir <tmp> --non-interactive --namespace external-secrets` | check production decision for external-secrets/external-secrets |
| `grafana/grafana@10.5.15` | existing-secret-ingress | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-grafana:10.5.15 --base existing-secret-ingress --work-dir <tmp> --non-interactive --namespace grafana` | check production decision for grafana/grafana |
| `grafana/grafana@10.5.15` | static-passwords | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-grafana:10.5.15 --base static-passwords --work-dir <tmp> --non-interactive --namespace grafana` | check production decision for grafana/grafana |
| `grafana/loki@7.0.0` | single-binary-filesystem | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-loki:7.0.0 --base single-binary-filesystem --work-dir <tmp> --non-interactive --namespace loki` | check production decision for grafana/loki |
| `grafana/loki@7.0.0` | simple-scalable-minio | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-loki:7.0.0 --base simple-scalable-minio --work-dir <tmp> --non-interactive --namespace loki` | check production decision for grafana/loki |
| `grafana/tempo@1.24.4` | local-persistent | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-tempo:1.24.4 --base local-persistent --work-dir <tmp> --non-interactive --namespace tempo` | check production decision for grafana/tempo |
| `hashicorp/consul@2.0.0` | default-control-plane | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/hashicorp-consul:2.0.0 --base default-control-plane --work-dir <tmp> --non-interactive --namespace consul` | check production decision for hashicorp/consul |
| `hashicorp/vault@0.32.0` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/hashicorp-vault:0.32.0 --base default --work-dir <tmp> --non-interactive --namespace vault` | check production decision for hashicorp/vault |
| `hashicorp/vault@0.32.0` | dev-mode | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/hashicorp-vault:0.32.0 --base dev-mode --work-dir <tmp> --non-interactive --namespace vault` | check production decision for hashicorp/vault |
| `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/ingress-nginx-ingress-nginx:4.15.1 --base internal-clusterip --work-dir <tmp> --non-interactive --namespace ingress-nginx` | check production decision for ingress-nginx/ingress-nginx |
| `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/ingress-nginx-ingress-nginx:4.15.1 --base admission-disabled --work-dir <tmp> --non-interactive --namespace ingress-nginx` | check production decision for ingress-nginx/ingress-nginx |
| `ingress-nginx/ingress-nginx@4.15.1` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/ingress-nginx-ingress-nginx:4.15.1 --base default --work-dir <tmp> --non-interactive --namespace ingress-nginx` | check production decision for ingress-nginx/ingress-nginx |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/jetstack-cert-manager:v1.20.2 --base crds-enabled --work-dir <tmp> --non-interactive --namespace cert-manager` | check production decision for jetstack/cert-manager |
| `jetstack/cert-manager@v1.20.2` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/jetstack-cert-manager:v1.20.2 --base default --work-dir <tmp> --non-interactive --namespace cert-manager` | check production decision for jetstack/cert-manager |
| `longhorn/longhorn@1.11.2` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/longhorn-longhorn:1.11.2 --base default --work-dir <tmp> --non-interactive --namespace longhorn-system` | check production decision for longhorn/longhorn |
| `longhorn/longhorn@1.11.2` | ui-ingress | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/longhorn-longhorn:1.11.2 --base ui-ingress --work-dir <tmp> --non-interactive --namespace longhorn-system` | check production decision for longhorn/longhorn |
| `metrics-server/metrics-server@3.13.0` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/metrics-server-metrics-server:3.13.0 --base default --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for metrics-server/metrics-server |
| `metrics-server/metrics-server@3.13.0` | external-tls-ca | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/metrics-server-metrics-server:3.13.0 --base external-tls-ca --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for metrics-server/metrics-server |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/secrets-store-csi-driver-secrets-store-csi-driver:1.6.0 --base default --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for secrets-store-csi-driver/secrets-store-csi-driver |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | sync-secret-rotation | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/secrets-store-csi-driver-secrets-store-csi-driver:1.6.0 --base sync-secret-rotation --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for secrets-store-csi-driver/secrets-store-csi-driver |

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
| `data/production-support-decisions/summary.md` | Current target-scoped production support decisions. |
| `data/production-disposition/support-decision-contract.md` | Pre-decision contract used to create the current support decisions. |
| `CATALOG.md` | Top-level chart and variant catalog. |
