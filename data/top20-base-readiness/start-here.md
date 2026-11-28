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
| `argo-cd/argo-cd@9.5.15` | default | `cub installer setup --pull oci://ghcr.io/confighub/packages/argo-cd-helm:v9.5.15@sha256:99905bdd2e18e2a2dd221b57a9ced594e610b7db551ae5667e935be17f5b798e --base default --work-dir <tmp> --non-interactive --namespace argocd` | check production decision for argo-cd/argo-cd |
| `bitnami/mysql@14.0.3` | existing-secret | `cub installer setup --pull oci://ghcr.io/confighub/packages/mysql:v14.0.3@sha256:3c72e1c46034bcbeb759237da02a4ba9736ec972e2170b862a17ab7138a6d6f9 --base existing-secret --work-dir <tmp> --non-interactive --namespace mysql` | check production decision for bitnami/mysql |
| `bitnami/mysql@14.0.3` | static-passwords | `cub installer setup --pull oci://ghcr.io/confighub/packages/mysql:v14.0.3@sha256:3c72e1c46034bcbeb759237da02a4ba9736ec972e2170b862a17ab7138a6d6f9 --base static-passwords --work-dir <tmp> --non-interactive --namespace mysql` | check production decision for bitnami/mysql |
| `bitnami/rabbitmq@16.0.14` | existing-secret | `cub installer setup --pull oci://ghcr.io/confighub/packages/bitnami-rabbitmq:v16.0.14@sha256:5fb192f66f915a59685dc5e1160b49ed9be06b10200b2dfdcfc2e1739d3a0d30 --base existing-secret --work-dir <tmp> --non-interactive --namespace rabbitmq` | check production decision for bitnami/rabbitmq |
| `bitnami/rabbitmq@16.0.14` | static-passwords | `cub installer setup --pull oci://ghcr.io/confighub/packages/bitnami-rabbitmq:v16.0.14@sha256:5fb192f66f915a59685dc5e1160b49ed9be06b10200b2dfdcfc2e1739d3a0d30 --base static-passwords --work-dir <tmp> --non-interactive --namespace rabbitmq` | check production decision for bitnami/rabbitmq |
| `external-secrets/external-secrets@2.5.0` | default | `cub installer setup --pull oci://ghcr.io/confighub/packages/external-secrets:v2.5.0@sha256:96a836a741789de4ec810585923d6774cc63c459f949be65ee2e4f894a1417eb --base default --work-dir <tmp> --non-interactive --namespace external-secrets` | check production decision for external-secrets/external-secrets |
| `external-secrets/external-secrets@2.5.0` | no-crds | `cub installer setup --pull oci://ghcr.io/confighub/packages/external-secrets:v2.5.0@sha256:96a836a741789de4ec810585923d6774cc63c459f949be65ee2e4f894a1417eb --base no-crds --work-dir <tmp> --non-interactive --namespace external-secrets` | check production decision for external-secrets/external-secrets |
| `grafana/grafana@10.5.15` | existing-secret-ingress | `cub installer setup --pull oci://ghcr.io/confighub/packages/grafana:v10.5.15@sha256:6b4a5d1ebf104fb5214504017f3bea306aa604e97aa2b7830248da821232c3c3 --base existing-secret-ingress --work-dir <tmp> --non-interactive --namespace grafana` | check production decision for grafana/grafana |
| `grafana/grafana@10.5.15` | static-passwords | `cub installer setup --pull oci://ghcr.io/confighub/packages/grafana:v10.5.15@sha256:6b4a5d1ebf104fb5214504017f3bea306aa604e97aa2b7830248da821232c3c3 --base static-passwords --work-dir <tmp> --non-interactive --namespace grafana` | check production decision for grafana/grafana |
| `grafana/loki@7.0.0` | single-binary-filesystem | `cub installer setup --pull oci://ghcr.io/confighub/packages/loki:v7.0.0@sha256:7aff5d06c8c241f307494406f7119da9e74c5a6871de2ff7da9e385a1abf3f2a --base single-binary-filesystem --work-dir <tmp> --non-interactive --namespace loki` | check production decision for grafana/loki |
| `grafana/loki@7.0.0` | simple-scalable-minio | `cub installer setup --pull oci://ghcr.io/confighub/packages/loki:v7.0.0@sha256:7aff5d06c8c241f307494406f7119da9e74c5a6871de2ff7da9e385a1abf3f2a --base simple-scalable-minio --work-dir <tmp> --non-interactive --namespace loki` | check production decision for grafana/loki |
| `grafana/tempo@1.24.4` | local-persistent | `cub installer setup --pull oci://ghcr.io/confighub/packages/tempo:v1.24.4@sha256:5c5e9597520f79c574b455cd79e70c87d23fb3fd087a5aa14f8df43932f1f707 --base local-persistent --work-dir <tmp> --non-interactive --namespace tempo` | check production decision for grafana/tempo |
| `hashicorp/consul@2.0.0` | default-control-plane | `cub installer setup --pull oci://ghcr.io/confighub/packages/consul:v2.0.0@sha256:cd9acaf54da1520129fbdc6690916d711467184a9b5fd298480b5a5a31ca7a3e --base default-control-plane --work-dir <tmp> --non-interactive --namespace consul` | check production decision for hashicorp/consul |
| `hashicorp/vault@0.32.0` | default | `cub installer setup --pull oci://ghcr.io/confighub/packages/vault:v0.32.0@sha256:92ff740422b96797f9258841952df40f8627517f2a07ac0ca6669e7fc206c45a --base default --work-dir <tmp> --non-interactive --namespace vault` | check production decision for hashicorp/vault |
| `hashicorp/vault@0.32.0` | dev-mode | `cub installer setup --pull oci://ghcr.io/confighub/packages/vault:v0.32.0@sha256:92ff740422b96797f9258841952df40f8627517f2a07ac0ca6669e7fc206c45a --base dev-mode --work-dir <tmp> --non-interactive --namespace vault` | check production decision for hashicorp/vault |
| `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | `cub installer setup --pull oci://ghcr.io/confighub/packages/ingress-nginx:v4.15.1@sha256:644621e316d9bd6c2803b7f1677cb2aee6d074432bdea9156e65c06794a1fe38 --base internal-clusterip --work-dir <tmp> --non-interactive --namespace ingress-nginx` | check production decision for ingress-nginx/ingress-nginx |
| `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | `cub installer setup --pull oci://ghcr.io/confighub/packages/ingress-nginx:v4.15.1@sha256:644621e316d9bd6c2803b7f1677cb2aee6d074432bdea9156e65c06794a1fe38 --base admission-disabled --work-dir <tmp> --non-interactive --namespace ingress-nginx` | check production decision for ingress-nginx/ingress-nginx |
| `ingress-nginx/ingress-nginx@4.15.1` | default | `cub installer setup --pull oci://ghcr.io/confighub/packages/ingress-nginx:v4.15.1@sha256:644621e316d9bd6c2803b7f1677cb2aee6d074432bdea9156e65c06794a1fe38 --base default --work-dir <tmp> --non-interactive --namespace ingress-nginx` | check production decision for ingress-nginx/ingress-nginx |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | `cub installer setup --pull oci://ghcr.io/confighub/packages/cert-manager:v1.20.2@sha256:9e611f6573fdf19f9f532482ea00d527ed6351acae979c6d15a0055d77921ef5 --base crds-enabled --work-dir <tmp> --non-interactive --namespace cert-manager` | check production decision for jetstack/cert-manager |
| `jetstack/cert-manager@v1.20.2` | default | `cub installer setup --pull oci://ghcr.io/confighub/packages/cert-manager:v1.20.2@sha256:9e611f6573fdf19f9f532482ea00d527ed6351acae979c6d15a0055d77921ef5 --base default --work-dir <tmp> --non-interactive --namespace cert-manager` | check production decision for jetstack/cert-manager |
| `longhorn/longhorn@1.11.2` | default | `cub installer setup --pull oci://ghcr.io/confighub/packages/longhorn:v1.11.2@sha256:d7117fae9bcc789db08e87c8dfc8548228b7d6fa2e5237c1edef943a0d8c3d67 --base default --work-dir <tmp> --non-interactive --namespace longhorn-system` | check production decision for longhorn/longhorn |
| `longhorn/longhorn@1.11.2` | ui-ingress | `cub installer setup --pull oci://ghcr.io/confighub/packages/longhorn:v1.11.2@sha256:d7117fae9bcc789db08e87c8dfc8548228b7d6fa2e5237c1edef943a0d8c3d67 --base ui-ingress --work-dir <tmp> --non-interactive --namespace longhorn-system` | check production decision for longhorn/longhorn |
| `metrics-server/metrics-server@3.13.0` | default | `cub installer setup --pull oci://ghcr.io/confighub/packages/metrics-server:v3.13.0@sha256:147aad673532ea989d6e1a55e1e499236606cd0014c1f3eaf9f48eb154487e61 --base default --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for metrics-server/metrics-server |
| `metrics-server/metrics-server@3.13.0` | external-tls-ca | `cub installer setup --pull oci://ghcr.io/confighub/packages/metrics-server:v3.13.0@sha256:147aad673532ea989d6e1a55e1e499236606cd0014c1f3eaf9f48eb154487e61 --base external-tls-ca --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for metrics-server/metrics-server |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | `cub installer setup --pull oci://ghcr.io/confighub/packages/secrets-store-csi-driver:v1.6.0@sha256:211ddeff91a62d8477c5c740421bc9db8dd897b10a7295d1f3c2860e70ed8e2a --base default --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for secrets-store-csi-driver/secrets-store-csi-driver |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | sync-secret-rotation | `cub installer setup --pull oci://ghcr.io/confighub/packages/secrets-store-csi-driver:v1.6.0@sha256:211ddeff91a62d8477c5c740421bc9db8dd897b10a7295d1f3c2860e70ed8e2a --base sync-secret-rotation --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for secrets-store-csi-driver/secrets-store-csi-driver |

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
