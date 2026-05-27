# Ingress NGINX Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/ingress-nginx-use-more-now/latest/use-more-now-receipt.yaml
runs/ingress-nginx-use-more-now/latest/function-scan-receipt.yaml
runs/ingress-nginx-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/ingress-nginx/ingress-nginx/4.15.1 --json
cub install setup --pull packages/ingress-nginx/ingress-nginx/4.15.1 --base default --work-dir .tmp/use-more-now/ingress-nginx-default --non-interactive --namespace ingress-nginx
cub install render --work-dir .tmp/use-more-now/ingress-nginx-default
cub install package packages/ingress-nginx/ingress-nginx/4.15.1 -o .tmp/use-more-now/ingress-nginx-archives/ingress-nginx-a.tgz
cub install upload --work-dir .tmp/use-more-now/ingress-nginx-default --space helm-ingress-nginx-use-more-now --component IngressNGINX --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=IngressNGINX --unit-label HelmChart=ingress-nginx-ingress-nginx --unit-label HelmChartVersion=4.15.1 --unit-label Variant=default --unit-label Proof=ingress-nginx-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/ingress-nginx-default
cub variant create staging helm-ingress-nginx-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-ingress-nginx-use-more-now --where "Labels.Proof = 'ingress-nginx-use-more-now'"
cub function vet vet-format --space helm-ingress-nginx-use-more-now --where "Labels.Proof = 'ingress-nginx-use-more-now'"
cub unit apply --space helm-ingress-nginx-use-more-now --where "Labels.Proof = 'ingress-nginx-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 12
separated secrets: 0
ConfigHub proof Units: 12
staging clone Units: 13
function scan: pass
safe ops: pass
```
