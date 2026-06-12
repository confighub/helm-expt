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
start-here: 29
try-with-proof: 9
runtime-watch: 4
runtime-review-needed: 0
operating-policy-needed: 0
target-fit-needed: 0
target-prerequisite-needed: 0
hook-lifecycle-review-needed: 0
lifecycle-observed: 0
prerequisite-observed: 0
render-only: 0
~~~

Live rerun readiness for non-pass rows:

~~~text
ready-to-collect: 0
model-or-stage-first: 2
review-target-first: 2
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
| `argo-cd/argo-cd@9.5.15` | no-crds | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | complete the missing lane(s): local kind kubectl apply, confighub oci argo live, live helm vs confighub dual compare | - |
| `bitnami/mongodb@19.0.7` | generated-passwords | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/mongodb@19.0.7` | existing-secret-replicaset | no | runtime-watch | review-target-first | object parity passed, but a live GitOps/controller condition needs review | inspect the live parity receipt before rerunning; decide whether this is target behavior, controller timing, or a support boundary | - |
| `bitnami/mysql@14.0.3` | generated-passwords | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/mysql@14.0.3` | existing-secret | no | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/nginx@24.0.2` | http-clusterip | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/nginx@24.0.2` | existing-tls-ingress | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | complete the missing lane(s): confighub upload variant scan safe ops | - |
| `bitnami/postgresql@18.6.7` | generated-passwords | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/postgresql@18.6.7` | existing-secret | no | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/rabbitmq@16.0.14` | generated-passwords | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/rabbitmq@16.0.14` | existing-secret | no | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/redis@25.5.3` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `bitnami/redis@25.5.3` | reuse-existing-secret | no | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `external-secrets/external-secrets@2.5.0` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `external-secrets/external-secrets@2.5.0` | no-crds | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | complete the missing lane(s): confighub upload variant scan safe ops, local kind kubectl apply, confighub oci argo live, live helm vs confighub dual compare | - |
| `grafana/grafana@10.5.15` | existing-secret-ingress | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `grafana/grafana@10.5.15` | generated-passwords | no | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `grafana/loki@7.0.0` | single-binary-filesystem | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `grafana/loki@7.0.0` | simple-scalable-minio | no | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `grafana/tempo@1.24.4` | local-persistent | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `grafana/tempo@1.24.4` | s3-query-observability | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | complete the missing lane(s): local kind kubectl apply, confighub oci argo live, live helm vs confighub dual compare | - |
| `hashicorp/consul@2.0.0` | default-control-plane | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | complete the missing lane(s): confighub upload variant scan safe ops, local kind kubectl apply, confighub oci argo live, live helm vs confighub dual compare | - |
| `hashicorp/vault@0.32.0` | dev-mode | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `hashicorp/vault@0.32.0` | default | no | runtime-watch | model-or-stage-first | object parity passed, but a live GitOps/controller condition needs review | inspect the live parity receipt before rerunning; decide whether this is target behavior, controller timing, or a support boundary | - |
| `hashicorp/vault@0.32.0` | ha-raft-ui | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | complete the missing lane(s): confighub upload variant scan safe ops, local kind kubectl apply, confighub oci argo live, live helm vs confighub dual compare | - |
| `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | no | runtime-watch | model-or-stage-first | object parity passed, but a live GitOps/controller condition needs review | inspect the live parity receipt before rerunning; decide whether this is target behavior, controller timing, or a support boundary | - |
| `ingress-nginx/ingress-nginx@4.15.1` | default | no | runtime-watch | review-target-first | object parity passed, but a live GitOps/controller condition needs review | inspect the live parity receipt before rerunning; decide whether this is target behavior, controller timing, or a support boundary | - |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `jetstack/cert-manager@v1.20.2` | default | no | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `longhorn/longhorn@1.11.2` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `longhorn/longhorn@1.11.2` | ui-ingress | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | complete the missing lane(s): confighub upload variant scan safe ops | - |
| `metrics-server/metrics-server@3.13.0` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `metrics-server/metrics-server@3.13.0` | external-tls-ca | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | complete the missing lane(s): confighub upload variant scan safe ops | - |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `prometheus-community/kube-prometheus-stack@85.3.3` | no-crds | no | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `prometheus-community/prometheus@29.8.0` | server-only-ephemeral | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `prometheus-community/prometheus@29.8.0` | default | no | try-with-proof | - | render parity and two-cluster live parity pass, but one or more broader lanes are missing | complete the missing lane(s): confighub upload variant scan safe ops | - |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | yes | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | sync-secret-rotation | no | start-here | - | all core lanes plus two-cluster parity pass for this base | use as the first catalog path; check production disposition before production use | - |

## Files

| File | Purpose |
| --- | --- |
| `data/top20-base-readiness/base-readiness.csv` | Spreadsheet-ready one-row-per-base readiness table. |
| `data/top20-base-readiness/start-here.md` | Short guide to the clean first catalog paths. |
| `data/outcome-coverage/base-outcomes.csv` | Underlying lane data used by this report. |
| `data/live-kind-parity/summary.md` | Two-cluster Helm-vs-installer parity receipts and non-pass reasons. |
| `data/live-parity-rerun-plan/rerun-plan.csv` | Rerun readiness, next step, and exact rerun command for non-pass live rows. |
| `CATALOG.md` | Top-level chart and variant catalog. |

Rows marked `ready-to-collect` in the CSV already have render parity and
two-cluster parity. Use their `live_rerun_command` value to collect the
missing live Helm-vs-ConfigHub receipt for that specific base.

Regenerate:

~~~sh
npm run top20:base-readiness
npm run top20:base-readiness:verify
~~~
