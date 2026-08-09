# How much of the catalog's upstream publishes provenance

**UNOFFICIAL/EXPERIMENTAL.** The snapshot is taken by
`npm run upstream-provenance:run`, which is the only step that reaches the
network. The summary is rendered by `npm run upstream-provenance:generate`
and checked offline by `npm run upstream-provenance:verify`. The full table
is [provenance.csv](./provenance.csv).

The AICR track proved a provenance chain end to end: a signature verified
offline against pinned trust material, bound to bytes this repository holds.
The obvious next question is how far that can reach, and nobody had asked it.
This asks once per retained chart.

Surveyed **2026-08-08**. For each retained chart, the upstream repository index was read for that exact version's tarball URL, and a HEAD request asked whether a Helm provenance file sits beside it. No signature was verified and nothing was downloaded.

## The answer

**33 of 139 retained charts** publish a Helm provenance file, which is
24% of the catalog. 74 publish none, and 32 could not be asked, mostly
because their charts are hosted in a way this convention does not cover.

That number is the ceiling on any provenance claim the catalog could make by
this mechanism. It is not a criticism of the publishers who sign nothing:
signing a Helm chart is uncommon, and most of this catalog's upstreams have
never done it.

## By upstream repository

9 of 58 upstream repositories sign at least one retained chart.

| Repository | Retained charts | Signed | Verdict |
| --- | --- | --- | --- |
| https://aquasecurity.github.io/helm-charts | 1 | 0 | publishes none |
| https://argoproj.github.io/argo-helm | 8 | 8 | signs every retained chart |
| https://bitnami-labs.github.io/sealed-secrets | 1 | 0 | could not be asked |
| https://charts.bitnami.com/bitnami | 21 | 0 | OCI-hosted, no provenance convention |
| https://charts.crossplane.io/stable | 1 | 0 | publishes none |
| https://charts.dexidp.io | 1 | 0 | publishes none |
| https://charts.external-secrets.io | 3 | 3 | signs every retained chart |
| https://charts.fairwinds.com/stable | 2 | 0 | could not be asked |
| https://charts.gitlab.io | 1 | 1 | signs every retained chart |
| https://charts.jetstack.io | 4 | 2 | signs some |
| https://charts.longhorn.io | 2 | 0 | publishes none |
| https://charts.rook.io/release | 2 | 0 | publishes none |
| https://cloudnative-pg.github.io/charts | 1 | 1 | signs every retained chart |
| https://coredns.github.io/helm | 1 | 0 | publishes none |
| https://docs.tigera.io/calico/charts | 1 | 0 | publishes none |
| https://falcosecurity.github.io/charts | 2 | 0 | publishes none |
| https://fluent.github.io/helm-charts | 2 | 0 | publishes none |
| https://grafana.github.io/helm-charts | 9 | 0 | publishes none |
| https://haproxytech.github.io/helm-charts | 1 | 0 | publishes none |
| https://helm.elastic.co | 5 | 0 | publishes none |
| https://helm.linkerd.io/stable | 1 | 0 | publishes none |
| https://helm.releases.hashicorp.com | 3 | 3 | signs every retained chart |
| https://helm.runix.net | 1 | 0 | publishes none |
| https://istio-release.storage.googleapis.com/charts | 2 | 0 | publishes none |
| https://jaegertracing.github.io/helm-charts | 2 | 0 | publishes none |
| https://kedacore.github.io/charts | 1 | 0 | publishes none |
| https://kubernetes-sigs.github.io/aws-ebs-csi-driver | 1 | 0 | publishes none |
| https://kubernetes-sigs.github.io/descheduler | 1 | 0 | publishes none |
| https://kubernetes-sigs.github.io/external-dns | 1 | 0 | publishes none |
| https://kubernetes-sigs.github.io/metrics-server | 2 | 0 | publishes none |
| https://kubernetes-sigs.github.io/nfs-subdir-external-provisioner | 1 | 0 | publishes none |
| https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts | 1 | 0 | publishes none |
| https://kubernetes.github.io/autoscaler | 2 | 0 | publishes none |
| https://kubernetes.github.io/ingress-nginx | 1 | 0 | publishes none |
| https://kyverno.github.io/kyverno | 4 | 0 | publishes none |
| https://kyverno.github.io/policy-reporter | 1 | 1 | signs every retained chart |
| https://metallb.github.io/metallb | 1 | 0 | publishes none |
| https://nats-io.github.io/k8s/helm/charts | 3 | 0 | publishes none |
| https://nvidia.github.io/k8s-device-plugin | 1 | 0 | publishes none |
| https://oauth2-proxy.github.io/manifests | 1 | 0 | publishes none |
| https://open-policy-agent.github.io/gatekeeper/charts | 1 | 0 | publishes none |
| https://open-telemetry.github.io/opentelemetry-helm-charts | 1 | 0 | publishes none |
| https://opencost.github.io/opencost-helm-chart | 1 | 0 | publishes none |
| https://operator.min.io | 2 | 0 | publishes none |
| https://percona.github.io/percona-helm-charts | 3 | 0 | publishes none |
| https://prometheus-community.github.io/helm-charts | 14 | 13 | signs some |
| https://stakater.github.io/stakater-charts | 2 | 0 | publishes none |
| https://strimzi.io/charts | 1 | 0 | publishes none |
| https://traefik.github.io/charts | 1 | 1 | signs every retained chart |
| https://valkey.io/valkey-helm | 1 | 0 | publishes none |
| https://victoriametrics.github.io/helm-charts | 2 | 0 | publishes none |
| https://vmware-tanzu.github.io/helm-charts | 2 | 0 | publishes none |
| oci://ghcr.io/traefik/helm | 1 | 0 | OCI-hosted, no provenance convention |
| oci://public.ecr.aws/aws-controllers-k8s | 3 | 0 | OCI-hosted, no provenance convention |
| oci://public.ecr.aws/karpenter | 1 | 0 | OCI-hosted, no provenance convention |
| oci://registry-1.docker.io/cloudpirates/nginx | 1 | 0 | OCI-hosted, no provenance convention |
| oci://registry-1.docker.io/cloudpirates/rabbitmq | 1 | 0 | OCI-hosted, no provenance convention |
| oci://registry-1.docker.io/cloudpirates/redis | 1 | 0 | OCI-hosted, no provenance convention |

## The charts that could carry a provenance claim today

| `alertmanager` | 1.37.0 | https://prometheus-community.github.io/helm-charts |
| `argo-cd` | 10.1.3 | https://argoproj.github.io/argo-helm |
| `argo-cd` | 10.2.1 | https://argoproj.github.io/argo-helm |
| `argo-cd` | 9.5.15 | https://argoproj.github.io/argo-helm |
| `argo-cd` | 9.5.17 | https://argoproj.github.io/argo-helm |
| `argo-events` | 2.4.21 | https://argoproj.github.io/argo-helm |
| `argo-rollouts` | 2.40.9 | https://argoproj.github.io/argo-helm |
| `argo-workflows` | 1.0.14 | https://argoproj.github.io/argo-helm |
| `argocd-image-updater` | 1.2.2 | https://argoproj.github.io/argo-helm |
| `cert-manager` | v1.20.2 | https://charts.jetstack.io |
| `cert-manager` | v1.21.0 | https://charts.jetstack.io |
| `cloudnative-pg` | 0.28.2 | https://cloudnative-pg.github.io/charts |
| `consul` | 2.0.0 | https://helm.releases.hashicorp.com |
| `external-secrets` | 2.5.0 | https://charts.external-secrets.io |
| `external-secrets` | 2.7.0 | https://charts.external-secrets.io |
| `external-secrets` | 2.8.0 | https://charts.external-secrets.io |
| `gitlab-runner` | 0.89.0 | https://charts.gitlab.io |
| `kube-prometheus-stack` | 85.3.3 | https://prometheus-community.github.io/helm-charts |
| `kube-prometheus-stack` | 86.1.0 | https://prometheus-community.github.io/helm-charts |
| `kube-prometheus-stack` | 87.15.1 | https://prometheus-community.github.io/helm-charts |
| `kube-prometheus-stack` | 87.19.2 | https://prometheus-community.github.io/helm-charts |
| `kube-state-metrics` | 7.4.0 | https://prometheus-community.github.io/helm-charts |
| `policy-reporter` | 3.9.1 | https://kyverno.github.io/policy-reporter |
| `prometheus` | 29.8.0 | https://prometheus-community.github.io/helm-charts |
| `prometheus` | 29.9.0 | https://prometheus-community.github.io/helm-charts |
| `prometheus-adapter` | 5.3.0 | https://prometheus-community.github.io/helm-charts |
| `prometheus-blackbox-exporter` | 11.10.0 | https://prometheus-community.github.io/helm-charts |
| `prometheus-blackbox-exporter` | 11.15.1 | https://prometheus-community.github.io/helm-charts |
| `prometheus-node-exporter` | 4.55.0 | https://prometheus-community.github.io/helm-charts |
| `prometheus-operator-crds` | 29.0.0 | https://prometheus-community.github.io/helm-charts |
| `terraform` | 1.1.2 | https://helm.releases.hashicorp.com |
| `traefik` | 40.2.0 | https://traefik.github.io/charts |
| `vault` | 0.32.0 | https://helm.releases.hashicorp.com |

## What this does not do

It does not verify a signature. A Helm provenance file is signed with a PGP key
the publisher distributes separately, and deciding which keys to trust is a
policy question this survey exists to inform rather than to pre-empt. Presence
is a fact about the publisher; trust is a decision about them.

It also asks only about Helm's own provenance mechanism. A publisher might sign
container images, or attest builds, without signing the chart, and none of that
would appear here. What this measures is the provenance a chart consumer can
check at the point they pull the chart.

## Why the rest could not be asked

- **21** are listed in an HTTP index that points at an OCI reference rather than a tarball, which is the migration that followed one publisher's repricing.
- **8** sit in an OCI repository, which has no index and no provenance convention.
- **2** answered with a refusal rather than an answer.
- **1** sit in a repository whose index could not be read.

An unanswered question is not a negative answer, so none of these count as
unsigned. The OCI rows are the interesting ones: a chart served from a registry
carries no file beside a tarball, so provenance there would have to come from a
registry-native signature rather than from this mechanism.

## When a publisher stops signing

No chart has changed verdict since the previous survey. This is the first record for some of them, and a first record cannot show a change.

A provenance claim that quietly disappears is worse than one never made. Each
run compares its answers against the previous snapshot and records every chart
whose verdict moved, so a publisher who stops signing leaves a record rather
than a silence. That is the only way this survey can carry a claim over time
rather than describing one afternoon.

Everything in the verify path runs offline against committed bytes. Nothing was
downloaded, no signature was made, and no cluster or organization took part.
