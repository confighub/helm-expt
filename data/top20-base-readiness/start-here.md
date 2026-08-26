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
| `argo-cd/argo-cd@9.5.15` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/argo-cd-argo-cd:9.5.15@sha256:9ec6bd1950e4b8b300ac61a62b85943a462dd7fc80d64e5bc79995f054c2ce4d --base default --work-dir <tmp> --non-interactive --namespace argocd` | check production decision for argo-cd/argo-cd |
| `bitnami/mysql@14.0.3` | existing-secret | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-mysql:14.0.3@sha256:d6f28a53019fe3768773ec9e58210ed5ba160f3338cb9ae746343cf47dc1c884 --base existing-secret --work-dir <tmp> --non-interactive --namespace mysql` | check production decision for bitnami/mysql |
| `bitnami/mysql@14.0.3` | static-passwords | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-mysql:14.0.3@sha256:d6f28a53019fe3768773ec9e58210ed5ba160f3338cb9ae746343cf47dc1c884 --base static-passwords --work-dir <tmp> --non-interactive --namespace mysql` | check production decision for bitnami/mysql |
| `bitnami/rabbitmq@16.0.14` | existing-secret | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-rabbitmq:16.0.14@sha256:fbdec937aa01df18d8cedc10a9dbd9b76f78cb209de1e6133f2118e92930fba9 --base existing-secret --work-dir <tmp> --non-interactive --namespace rabbitmq` | check production decision for bitnami/rabbitmq |
| `bitnami/rabbitmq@16.0.14` | static-passwords | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-rabbitmq:16.0.14@sha256:fbdec937aa01df18d8cedc10a9dbd9b76f78cb209de1e6133f2118e92930fba9 --base static-passwords --work-dir <tmp> --non-interactive --namespace rabbitmq` | check production decision for bitnami/rabbitmq |
| `external-secrets/external-secrets@2.5.0` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/external-secrets-external-secrets:2.5.0@sha256:3360d8a7d2d83748808b0f4a66969feaa33b305312dcb8bbe956fec08407b001 --base default --work-dir <tmp> --non-interactive --namespace external-secrets` | check production decision for external-secrets/external-secrets |
| `external-secrets/external-secrets@2.5.0` | no-crds | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/external-secrets-external-secrets:2.5.0@sha256:3360d8a7d2d83748808b0f4a66969feaa33b305312dcb8bbe956fec08407b001 --base no-crds --work-dir <tmp> --non-interactive --namespace external-secrets` | check production decision for external-secrets/external-secrets |
| `grafana/grafana@10.5.15` | existing-secret-ingress | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-grafana:10.5.15@sha256:fc038da08ab8544cdf8d3c08fd981e542de4d5e0f8ae61e21f163a9eb9956cc3 --base existing-secret-ingress --work-dir <tmp> --non-interactive --namespace grafana` | check production decision for grafana/grafana |
| `grafana/grafana@10.5.15` | static-passwords | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-grafana:10.5.15@sha256:fc038da08ab8544cdf8d3c08fd981e542de4d5e0f8ae61e21f163a9eb9956cc3 --base static-passwords --work-dir <tmp> --non-interactive --namespace grafana` | check production decision for grafana/grafana |
| `grafana/loki@7.0.0` | single-binary-filesystem | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-loki:7.0.0@sha256:c89f127344879cdb6c7e4033735bcde8eaca3257d5c16bdcca89aad2a0f602da --base single-binary-filesystem --work-dir <tmp> --non-interactive --namespace loki` | check production decision for grafana/loki |
| `grafana/loki@7.0.0` | simple-scalable-minio | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-loki:7.0.0@sha256:c89f127344879cdb6c7e4033735bcde8eaca3257d5c16bdcca89aad2a0f602da --base simple-scalable-minio --work-dir <tmp> --non-interactive --namespace loki` | check production decision for grafana/loki |
| `grafana/tempo@1.24.4` | local-persistent | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/grafana-tempo:1.24.4@sha256:bdeba9d642d10538e41f72eb96bd59f62428a6d0bc395111c74a7bcb8c1e7e12 --base local-persistent --work-dir <tmp> --non-interactive --namespace tempo` | check production decision for grafana/tempo |
| `hashicorp/consul@2.0.0` | default-control-plane | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/hashicorp-consul:2.0.0@sha256:eec0c002730d44e10c1c807aaf9f02fe8d1454e54e3ec6024956e2e079b5a2a5 --base default-control-plane --work-dir <tmp> --non-interactive --namespace consul` | check production decision for hashicorp/consul |
| `hashicorp/vault@0.32.0` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/hashicorp-vault:0.32.0@sha256:7216f8cbbb3e2dafe3ed987f1e4b6fa962de60b2bf5ba7d2d0b7eb45eb138292 --base default --work-dir <tmp> --non-interactive --namespace vault` | check production decision for hashicorp/vault |
| `hashicorp/vault@0.32.0` | dev-mode | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/hashicorp-vault:0.32.0@sha256:7216f8cbbb3e2dafe3ed987f1e4b6fa962de60b2bf5ba7d2d0b7eb45eb138292 --base dev-mode --work-dir <tmp> --non-interactive --namespace vault` | check production decision for hashicorp/vault |
| `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/ingress-nginx-ingress-nginx:4.15.1@sha256:dc0f6c1a8158230957c1cae1b26073339b009b220c79cff0e3df31e9f21c73e4 --base internal-clusterip --work-dir <tmp> --non-interactive --namespace ingress-nginx` | check production decision for ingress-nginx/ingress-nginx |
| `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/ingress-nginx-ingress-nginx:4.15.1@sha256:dc0f6c1a8158230957c1cae1b26073339b009b220c79cff0e3df31e9f21c73e4 --base admission-disabled --work-dir <tmp> --non-interactive --namespace ingress-nginx` | check production decision for ingress-nginx/ingress-nginx |
| `ingress-nginx/ingress-nginx@4.15.1` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/ingress-nginx-ingress-nginx:4.15.1@sha256:dc0f6c1a8158230957c1cae1b26073339b009b220c79cff0e3df31e9f21c73e4 --base default --work-dir <tmp> --non-interactive --namespace ingress-nginx` | check production decision for ingress-nginx/ingress-nginx |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/jetstack-cert-manager:v1.20.2@sha256:b688d5ef7ae759bd73d2970528a7192e14058bc593a8601b6af12157270c6d2c --base crds-enabled --work-dir <tmp> --non-interactive --namespace cert-manager` | check production decision for jetstack/cert-manager |
| `jetstack/cert-manager@v1.20.2` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/jetstack-cert-manager:v1.20.2@sha256:b688d5ef7ae759bd73d2970528a7192e14058bc593a8601b6af12157270c6d2c --base default --work-dir <tmp> --non-interactive --namespace cert-manager` | check production decision for jetstack/cert-manager |
| `longhorn/longhorn@1.11.2` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/longhorn-longhorn:1.11.2@sha256:0617a692620540d997f515cba0ffc86c9cccd3b2b254d0a56698667cfc957b7f --base default --work-dir <tmp> --non-interactive --namespace longhorn-system` | check production decision for longhorn/longhorn |
| `longhorn/longhorn@1.11.2` | ui-ingress | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/longhorn-longhorn:1.11.2@sha256:0617a692620540d997f515cba0ffc86c9cccd3b2b254d0a56698667cfc957b7f --base ui-ingress --work-dir <tmp> --non-interactive --namespace longhorn-system` | check production decision for longhorn/longhorn |
| `metrics-server/metrics-server@3.13.0` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/metrics-server-metrics-server:3.13.0@sha256:682e4610d70e6ad31dfc87c1a04ec2172cd2e5446ae3ff1e2ecaa8c6c2356127 --base default --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for metrics-server/metrics-server |
| `metrics-server/metrics-server@3.13.0` | external-tls-ca | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/metrics-server-metrics-server:3.13.0@sha256:682e4610d70e6ad31dfc87c1a04ec2172cd2e5446ae3ff1e2ecaa8c6c2356127 --base external-tls-ca --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for metrics-server/metrics-server |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/secrets-store-csi-driver-secrets-store-csi-driver:1.6.0@sha256:82d30ba796f0dc7cee0fcc6e385fa42fb151d3de62604a1639160bbab4ee7791 --base default --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for secrets-store-csi-driver/secrets-store-csi-driver |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | sync-secret-rotation | `cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/secrets-store-csi-driver-secrets-store-csi-driver:1.6.0@sha256:82d30ba796f0dc7cee0fcc6e385fa42fb151d3de62604a1639160bbab4ee7791 --base sync-secret-rotation --work-dir <tmp> --non-interactive --namespace kube-system` | check production decision for secrets-store-csi-driver/secrets-store-csi-driver |

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
