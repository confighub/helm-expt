# Ingress NGINX ConfigHub Proof Transcript

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
cub installer setup --pull packages/ingress-nginx/ingress-nginx/4.15.1 --base default --work-dir .tmp/confighub-proof/ingress-nginx-default --non-interactive --namespace ingress-nginx
cub installer render --work-dir .tmp/confighub-proof/ingress-nginx-default
cub installer package packages/ingress-nginx/ingress-nginx/4.15.1 -o .tmp/confighub-proof/ingress-nginx-archives/ingress-nginx-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/ingress-nginx-default --space helm-ingress-nginx-confighub-proof --component IngressNGINX --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=IngressNGINX --unit-label HelmChart=ingress-nginx-ingress-nginx --unit-label HelmChartVersion=4.15.1 --unit-label Variant=default --unit-label Proof=ingress-nginx-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/ingress-nginx-default
cub variant create staging helm-ingress-nginx-confighub-proof --environment Staging --region local --space-name-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-ingress-nginx-confighub-proof --where "Labels.Proof = 'ingress-nginx-confighub-proof'"
cub function vet vet-format --space helm-ingress-nginx-confighub-proof --where "Labels.Proof = 'ingress-nginx-confighub-proof'"
cub unit apply --space helm-ingress-nginx-confighub-proof --where "Labels.Proof = 'ingress-nginx-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 12
separated secrets: 0
ConfigHub Units: 13
Kubernetes Units: 12
installer record Units: 1
staging clone Units: 13
function scan: pass
safe ops: pass
```
