# Ingress NGINX ConfigHub Proof Transcript

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

Run date: 2026-05-27

Receipts:

```text
runs/ingress-nginx-confighub-proof/latest/confighub-proof-receipt.yaml
runs/ingress-nginx-confighub-proof/latest/function-scan-receipt.yaml
runs/ingress-nginx-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/ingress-nginx/ingress-nginx/4.15.1 --json
cub installer setup --pull packages/ingress-nginx/ingress-nginx/4.15.1 --base internal-clusterip --work-dir .tmp/confighub-proof/ingress-nginx-internal-clusterip --non-interactive --namespace ingress-nginx
cub installer render --work-dir .tmp/confighub-proof/ingress-nginx-internal-clusterip
cub installer package packages/ingress-nginx/ingress-nginx/4.15.1 -o .tmp/confighub-proof/ingress-nginx-archives/ingress-nginx-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/ingress-nginx-internal-clusterip --space helm-ingress-nginx-confighub-proof --component IngressNGINX --layer App --environment Demo --owner ConfigHubHelm --variant internal-clusterip --unit-label Component=IngressNGINX --unit-label HelmChart=ingress-nginx-ingress-nginx --unit-label HelmChartVersion=4.15.1 --unit-label Variant=internal-clusterip --unit-label Proof=ingress-nginx-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/ingress-nginx-internal-clusterip
cub variant create staging helm-ingress-nginx-confighub-proof --environment Staging --region local --namespace ingress-nginx --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists --wait --timeout 10m
cub unit list --space helm-ingress-nginx-confighub-proof --where "Labels.Proof = 'ingress-nginx-confighub-proof'"
cub function vet vet-format --space helm-ingress-nginx-confighub-proof --where "Labels.Proof = 'ingress-nginx-confighub-proof'"
cub unit apply --space helm-ingress-nginx-confighub-proof --where "Labels.Proof = 'ingress-nginx-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 10
separated secrets: 0
ConfigHub Units: 11
Kubernetes Units: 10
installer record Units: 1
staging clone Units: 11
function scan: pass
safe ops: pass
```
