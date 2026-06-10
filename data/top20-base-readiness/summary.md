# Top-20 Base Variant Readiness

This generated table answers the practical catalog question:

~~~text
For each top-20 chart base variant, can a user start with it now, or does it
need a target prerequisite, runtime review, hook lifecycle route, or more proof?
~~~

It is intentionally base-variant level. Chart-level summaries can hide the fact
that one base is a clean first path while another base still needs prerequisites
or runtime review.

## Summary

~~~text
base variants: 42
start-here: 20
try-with-proof: 21
runtime-watch: 0
runtime-review-needed: 0
operating-policy-needed: 0
target-fit-needed: 0
target-prerequisite-needed: 0
hook-lifecycle-review-needed: 0
lifecycle-observed: 1
prerequisite-observed: 0
render-only: 0
~~~

Live rerun readiness for non-pass rows:

~~~text
model-or-stage-first: 0
review-target-first: 0
inspect-diff-first: 0
rerun-now-after-cleanup: 0
~~~

## How To Read User Readiness

| Readiness | Meaning |
| --- | --- |
| `start-here` | Best current demo/catalog path: render parity, ConfigHub proof, local live, GitOps/OCI, selected live parity, and two-cluster parity are all passing. |
| `try-with-proof` | Render parity and two-cluster parity pass, but one or more broader ConfigHub/live lanes are still missing for this base. |
| `runtime-watch` | Object parity passed, but the live target did not fully settle during the run. |
| `runtime-review-needed` | Object parity passed, but runtime state needs investigation before this base is presented as easy. |
| `operating-policy-needed` | Object parity passed, but the app needs a post-render operating procedure before it can be called ready. |
| `target-fit-needed` | Object parity passed, but the selected target does not provide the platform shape this base declares. |
| `target-prerequisite-needed` | The base expects CRDs, APIs, Secrets, storage, or another target prerequisite to exist or be staged. |
| `hook-lifecycle-review-needed` | Helm hook or hook-like lifecycle behavior needs an explicit route and receipt. |
| `lifecycle-observed` | Strict parity remains blocked or watch, but the hook-like lifecycle route has a passing observation receipt. |
| `prerequisite-observed` | The base needs an external prerequisite, and a related observation receipt proves the staged-prerequisite path. |
| `render-only` | Render parity exists, but live/user proof lanes are not present for this base. |

## Rows

| Chart | Base | First | Readiness | Rerun readiness | Why | Next action | Support artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `argo-cd/argo-cd@9.5.15` | no-crds | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `bitnami/mongodb@19.0.7` | generated-passwords | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/mongodb@19.0.7` | existing-secret-replicaset | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `bitnami/mysql@14.0.3` | generated-passwords | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/mysql@14.0.3` | existing-secret | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `bitnami/nginx@24.0.2` | http-clusterip | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/nginx@24.0.2` | existing-tls-ingress | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `bitnami/postgresql@18.6.7` | generated-passwords | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/postgresql@18.6.7` | existing-secret | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `bitnami/rabbitmq@16.0.14` | generated-passwords | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/rabbitmq@16.0.14` | existing-secret | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `bitnami/redis@25.5.3` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/redis@25.5.3` | reuse-existing-secret | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `external-secrets/external-secrets@2.5.0` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `external-secrets/external-secrets@2.5.0` | no-crds | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `grafana/grafana@10.5.15` | generated-passwords | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `grafana/grafana@10.5.15` | existing-secret-ingress | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `grafana/loki@7.0.0` | single-binary-filesystem | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `grafana/loki@7.0.0` | simple-scalable-minio | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `grafana/tempo@1.24.4` | local-persistent | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `grafana/tempo@1.24.4` | s3-query-observability | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `hashicorp/consul@2.0.0` | default-control-plane | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `hashicorp/vault@0.32.0` | dev-mode | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `hashicorp/vault@0.32.0` | default | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `hashicorp/vault@0.32.0` | ha-raft-ui | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `ingress-nginx/ingress-nginx@4.15.1` | default | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `jetstack/cert-manager@v1.20.2` | default | no | lifecycle-observed | - | helm-hook: post-install hook failed (parity passed); lifecycle observation passed | use the lifecycle route evidence at runs/lifecycle-observations/cert-manager-eso/jetstack-cert-manager-default/receipt.yaml; rerun strict parity only if the hook handling decision changes | - |
| `longhorn/longhorn@1.11.2` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `longhorn/longhorn@1.11.2` | ui-ingress | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `metrics-server/metrics-server@3.13.0` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `metrics-server/metrics-server@3.13.0` | external-tls-ca | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `prometheus-community/kube-prometheus-stack@85.3.3` | no-crds | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `prometheus-community/prometheus@29.8.0` | server-only-ephemeral | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `prometheus-community/prometheus@29.8.0` | default | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | sync-secret-rotation | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | run or commit the missing ConfigHub, local live, GitOps, or selected live parity lanes before broader claims | - |

## Files

| File | Purpose |
| --- | --- |
| `data/top20-base-readiness/base-readiness.csv` | Spreadsheet-ready one-row-per-base readiness table. |
| `data/top20-base-readiness/start-here.md` | Short guide to the clean first catalog paths. |
| `data/outcome-coverage/base-outcomes.csv` | Underlying lane data used by this report. |
| `data/live-kind-parity/summary.md` | Two-cluster Helm-vs-installer parity receipts and non-pass reasons. |
| `data/live-parity-rerun-plan/rerun-plan.csv` | Rerun readiness, next step, and exact rerun command for non-pass live rows. |
| `CATALOG.md` | Top-level chart and variant catalog. |

Regenerate:

~~~sh
npm run top20:base-readiness
npm run top20:base-readiness:verify
~~~
