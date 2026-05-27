# Argo CD Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/argo-cd-use-more-now/latest/use-more-now-receipt.yaml
runs/argo-cd-use-more-now/latest/function-scan-receipt.yaml
runs/argo-cd-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/argo-cd/argo-cd/9.5.15 --json
cub install setup --pull packages/argo-cd/argo-cd/9.5.15 --base default --work-dir .tmp/use-more-now/argo-cd-default --non-interactive --namespace argocd
cub install render --work-dir .tmp/use-more-now/argo-cd-default
cub install package packages/argo-cd/argo-cd/9.5.15 -o .tmp/use-more-now/argo-cd-archives/argo-cd-a.tgz
cub install upload --work-dir .tmp/use-more-now/argo-cd-default --space helm-argo-cd-use-more-now --component ArgoCD --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=ArgoCD --unit-label HelmChart=argo-cd-argo-cd --unit-label HelmChartVersion=9.5.15 --unit-label Variant=default --unit-label Proof=argo-cd-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/argo-cd-default
cub variant create staging helm-argo-cd-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-argo-cd-use-more-now --where "Labels.Proof = 'argo-cd-use-more-now'"
cub function vet vet-format --space helm-argo-cd-use-more-now --where "Labels.Proof = 'argo-cd-use-more-now'"
cub unit apply --space helm-argo-cd-use-more-now --where "Labels.Proof = 'argo-cd-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 48
separated secrets: 2
ConfigHub proof Units: 48
staging clone Units: 49
function scan: pass
safe ops: pass
```
