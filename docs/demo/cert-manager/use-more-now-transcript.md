# cert-manager Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/cert-manager-use-more-now/latest/use-more-now-receipt.yaml
runs/cert-manager-use-more-now/latest/function-scan-receipt.yaml
runs/cert-manager-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/jetstack/cert-manager/v1.20.2 --json
cub install setup --pull packages/jetstack/cert-manager/v1.20.2 --base default --work-dir .tmp/use-more-now/cert-manager-default --non-interactive --namespace cert-manager
cub install render --work-dir .tmp/use-more-now/cert-manager-default
cub install package packages/jetstack/cert-manager/v1.20.2 -o .tmp/use-more-now/cert-manager-archives/cert-manager-a.tgz
cub install upload --work-dir .tmp/use-more-now/cert-manager-default --space helm-cert-manager-use-more-now --component CertManager --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=CertManager --unit-label HelmChart=jetstack-cert-manager --unit-label HelmChartVersion=v1.20.2 --unit-label Variant=default --unit-label Proof=cert-manager-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/cert-manager-default
cub variant create staging helm-cert-manager-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-cert-manager-use-more-now --where "Labels.Proof = 'cert-manager-use-more-now'"
cub function vet vet-format --space helm-cert-manager-use-more-now --where "Labels.Proof = 'cert-manager-use-more-now'"
cub unit apply --space helm-cert-manager-use-more-now --where "Labels.Proof = 'cert-manager-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 43
separated secrets: 0
ConfigHub proof Units: 43
staging clone Units: 44
function scan: pass
safe ops: pass
```
