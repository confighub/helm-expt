# cert-manager ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/cert-manager-confighub-proof/latest/confighub-proof-receipt.yaml
runs/cert-manager-confighub-proof/latest/function-scan-receipt.yaml
runs/cert-manager-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/jetstack/cert-manager/v1.20.2 --json
cub installer setup --pull packages/jetstack/cert-manager/v1.20.2 --base default --work-dir .tmp/confighub-proof/cert-manager-default --non-interactive --namespace cert-manager
cub installer render --work-dir .tmp/confighub-proof/cert-manager-default
cub installer package packages/jetstack/cert-manager/v1.20.2 -o .tmp/confighub-proof/cert-manager-archives/cert-manager-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/cert-manager-default --space helm-cert-manager-confighub-proof --component CertManager --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=CertManager --unit-label HelmChart=jetstack-cert-manager --unit-label HelmChartVersion=v1.20.2 --unit-label Variant=default --unit-label Proof=cert-manager-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/cert-manager-default
cub variant create staging helm-cert-manager-confighub-proof --environment Staging --region local --space-name-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-cert-manager-confighub-proof --where "Labels.Proof = 'cert-manager-confighub-proof'"
cub function vet vet-format --space helm-cert-manager-confighub-proof --where "Labels.Proof = 'cert-manager-confighub-proof'"
cub unit apply --space helm-cert-manager-confighub-proof --where "Labels.Proof = 'cert-manager-confighub-proof'" --dry-run
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
