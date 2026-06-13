# Secrets Store CSI Driver ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/secrets-store-csi-driver-confighub-proof/latest/confighub-proof-receipt.yaml
runs/secrets-store-csi-driver-confighub-proof/latest/function-scan-receipt.yaml
runs/secrets-store-csi-driver-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0 --json
cub installer setup --pull packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0 --base default --work-dir .tmp/confighub-proof/secrets-store-csi-driver-default --non-interactive --namespace kube-system
cub installer render --work-dir .tmp/confighub-proof/secrets-store-csi-driver-default
cub installer package packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0 -o .tmp/confighub-proof/secrets-store-csi-driver-archives/secrets-store-csi-driver-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/secrets-store-csi-driver-default --space helm-secrets-store-csi-driver-confighub-proof --component SecretsStoreCSIDriver --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=SecretsStoreCSIDriver --unit-label HelmChart=secrets-store-csi-driver-secrets-store-csi-driver --unit-label HelmChartVersion=1.6.0 --unit-label Variant=default --unit-label Proof=secrets-store-csi-driver-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/secrets-store-csi-driver-default
cub variant create staging helm-secrets-store-csi-driver-confighub-proof --environment Staging --region local --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-secrets-store-csi-driver-confighub-proof --where "Labels.Proof = 'secrets-store-csi-driver-confighub-proof'"
cub function vet vet-format --space helm-secrets-store-csi-driver-confighub-proof --where "Labels.Proof = 'secrets-store-csi-driver-confighub-proof'"
cub unit apply --space helm-secrets-store-csi-driver-confighub-proof --where "Labels.Proof = 'secrets-store-csi-driver-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 11
separated secrets: 0
ConfigHub Units: 12
Kubernetes Units: 11
installer record Units: 1
staging clone Units: 12
function scan: pass
safe ops: pass
```
