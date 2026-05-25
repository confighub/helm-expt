# ConfigHub Helm Experiment

This repository is the proof workspace for the ConfigHub Helm mission:

```text
Use Helm charts. Ship ConfigHub variants.
```

The archived top-20 render-and-vendor examples below are compatibility evidence,
not the main product proof. The main proof is the planned Redis recipe/variant
path documented in `docs/agreed-execution-plan.md`.

The archived chart set is the current top 20 Helm packages returned by Artifact Hub, sorted by stars:

<https://artifacthub.io/api/v1/packages/search?kind=0&sort=stars&limit=20&deprecated=false>

Generated at: `2026-05-23T19:46:18.577Z`

Helm used for this run: `v4.1.4 05fa37973dc9e42b76e1d2883494c87174b6074f go1.26.2`

Each archived chart directory contains:

- `installer.yaml`: a minimal ConfigHub package wrapper.
- `helm-import.spec.yaml`: the proposed first-class Helm import inputs.
- `helm-import.receipt.yaml`: the receipt with chart source, archive hash, render command, output hash, and two-render determinism check.
- `values.yaml`: the explicit values overlay used for the import. Most are `{}`; charts with required or randomly generated defaults use deterministic experiment placeholders.
- `base/kustomization.yaml`: a kustomize base that includes the rendered upstream manifest.
- `base/upstream.yaml`: the rendered Helm manifest captured as the package input.

## Archived Top 20 Render-And-Vendor Evidence

| Rank | Chart | Version | Stars | Status | 2x deterministic | Resources | Path |
| ---: | --- | --- | ---: | --- | --- | ---: | --- |
| 1 | `prometheus-community/kube-prometheus-stack` | 85.3.0 | 1206 | rendered | yes | 124 | [01-prometheus-community-kube-prometheus-stack](archive/render-and-vendor-top20/charts/01-prometheus-community-kube-prometheus-stack/) |
| 2 | `cert-manager/cert-manager` | 1.20.2 | 973 | rendered | yes | 42 | [02-cert-manager-cert-manager](archive/render-and-vendor-top20/charts/02-cert-manager-cert-manager/) |
| 3 | `ingress-nginx/ingress-nginx` | 4.15.1 | 828 | rendered | yes | 11 | [03-ingress-nginx-ingress-nginx](archive/render-and-vendor-top20/charts/03-ingress-nginx-ingress-nginx/) |
| 4 | `argo/argo-cd` | 9.5.15 | 824 | rendered | yes | 49 | [04-argo-argo-cd](archive/render-and-vendor-top20/charts/04-argo-argo-cd/) |
| 5 | `prometheus-community/prometheus` | 29.8.0 | 542 | rendered | yes | 23 | [05-prometheus-community-prometheus](archive/render-and-vendor-top20/charts/05-prometheus-community-prometheus/) |
| 6 | `bitnami/redis` | 25.5.3 | 507 | rendered | yes | 14 | [06-bitnami-redis](archive/render-and-vendor-top20/charts/06-bitnami-redis/) |
| 7 | `bitnami/postgresql` | 18.6.7 | 417 | rendered | yes | 7 | [07-bitnami-postgresql](archive/render-and-vendor-top20/charts/07-bitnami-postgresql/) |
| 8 | `traefik/traefik` | 40.2.0 | 414 | rendered | yes | 31 | [08-traefik-traefik](archive/render-and-vendor-top20/charts/08-traefik-traefik/) |
| 9 | `k8s-dashboard/kubernetes-dashboard` | 7.14.0 | 364 | rendered | yes | 35 | [09-k8s-dashboard-kubernetes-dashboard](archive/render-and-vendor-top20/charts/09-k8s-dashboard-kubernetes-dashboard/) |
| 10 | `grafana/loki` | 7.0.0 | 337 | rendered | yes | 19 | [10-grafana-loki](archive/render-and-vendor-top20/charts/10-grafana-loki/) |
| 11 | `metrics-server/metrics-server` | 3.13.0 | 308 | rendered | yes | 9 | [11-metrics-server-metrics-server](archive/render-and-vendor-top20/charts/11-metrics-server-metrics-server/) |
| 12 | `hashicorp/vault` | 0.32.0 | 294 | rendered | yes | 12 | [12-hashicorp-vault](archive/render-and-vendor-top20/charts/12-hashicorp-vault/) |
| 13 | `gitlab/gitlab` | 10.0.0 | 274 | rendered | yes | 148 | [13-gitlab-gitlab](archive/render-and-vendor-top20/charts/13-gitlab-gitlab/) |
| 14 | `harbor/harbor` | 1.19.0 | 269 | rendered | yes | 30 | [14-harbor-harbor](archive/render-and-vendor-top20/charts/14-harbor-harbor/) |
| 15 | `bitnami/keycloak` | 25.2.0 | 269 | rendered | yes | 15 | [15-bitnami-keycloak](archive/render-and-vendor-top20/charts/15-bitnami-keycloak/) |
| 16 | `jenkinsci/jenkins` | 5.9.22 | 247 | rendered | yes | 12 | [16-jenkinsci-jenkins](archive/render-and-vendor-top20/charts/16-jenkinsci-jenkins/) |
| 17 | `external-secrets-operator/external-secrets` | 2.5.0 | 241 | rendered | yes | 42 | [17-external-secrets-operator-external-secrets](archive/render-and-vendor-top20/charts/17-external-secrets-operator-external-secrets/) |
| 18 | `external-dns/external-dns` | 1.21.1 | 229 | rendered | yes | 6 | [18-external-dns-external-dns](archive/render-and-vendor-top20/charts/18-external-dns-external-dns/) |
| 19 | `longhorn/longhorn` | 1.11.2 | 216 | rendered | yes | 41 | [19-longhorn-longhorn](archive/render-and-vendor-top20/charts/19-longhorn-longhorn/) |
| 20 | `bitnami/rabbitmq` | 16.0.14 | 214 | rendered | yes | 10 | [20-bitnami-rabbitmq](archive/render-and-vendor-top20/charts/20-bitnami-rabbitmq/) |

## Regenerate

```sh
npm run generate
```

## Verify Stored Receipts

```sh
npm run verify
```

The verify command checks that each stored `base/upstream.yaml` still matches the SHA256 in its receipt. It intentionally does not refetch Artifact Hub or chart repositories.
