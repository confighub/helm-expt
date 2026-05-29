# Argo CD ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/argo-cd-confighub-proof/latest/confighub-proof-receipt.yaml
runs/argo-cd-confighub-proof/latest/function-scan-receipt.yaml
runs/argo-cd-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/argo-cd/argo-cd/9.5.15 --json
cub installer setup --pull packages/argo-cd/argo-cd/9.5.15 --base default --work-dir .tmp/confighub-proof/argo-cd-default --non-interactive --namespace argocd
cub installer render --work-dir .tmp/confighub-proof/argo-cd-default
cub installer package packages/argo-cd/argo-cd/9.5.15 -o .tmp/confighub-proof/argo-cd-archives/argo-cd-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/argo-cd-default --space helm-argo-cd-confighub-proof --component ArgoCD --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=ArgoCD --unit-label HelmChart=argo-cd-argo-cd --unit-label HelmChartVersion=9.5.15 --unit-label Variant=default --unit-label Proof=argo-cd-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/argo-cd-default
cub variant create staging helm-argo-cd-confighub-proof --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-argo-cd-confighub-proof --where "Labels.Proof = 'argo-cd-confighub-proof'"
cub function vet vet-format --space helm-argo-cd-confighub-proof --where "Labels.Proof = 'argo-cd-confighub-proof'"
cub unit apply --space helm-argo-cd-confighub-proof --where "Labels.Proof = 'argo-cd-confighub-proof'" --dry-run
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
