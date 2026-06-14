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
cub installer setup --pull packages/jetstack/cert-manager/v1.20.2 --base crds-enabled --work-dir .tmp/confighub-proof/cert-manager-crds-enabled --non-interactive --namespace cert-manager
cub installer render --work-dir .tmp/confighub-proof/cert-manager-crds-enabled
cub installer package packages/jetstack/cert-manager/v1.20.2 -o .tmp/confighub-proof/cert-manager-archives/cert-manager-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/cert-manager-crds-enabled --space helm-cert-manager-confighub-proof --component CertManager --layer App --environment Demo --owner ConfigHubHelm --variant crds-enabled --unit-label Component=CertManager --unit-label HelmChart=jetstack-cert-manager --unit-label HelmChartVersion=v1.20.2 --unit-label Variant=crds-enabled --unit-label Proof=cert-manager-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/cert-manager-crds-enabled
cub variant create staging helm-cert-manager-confighub-proof --environment Staging --region local --namespace cert-manager --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists --wait --timeout 10m
cub unit list --space helm-cert-manager-confighub-proof --where "Labels.Proof = 'cert-manager-confighub-proof'"
cub function vet vet-format --space helm-cert-manager-confighub-proof --where "Labels.Proof = 'cert-manager-confighub-proof'"
cub unit apply --space helm-cert-manager-confighub-proof --where "Labels.Proof = 'cert-manager-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 49
separated secrets: 0
ConfigHub Units: 50
Kubernetes Units: 49
installer record Units: 1
staging clone Units: 50
function scan: pass
safe ops: pass
```
