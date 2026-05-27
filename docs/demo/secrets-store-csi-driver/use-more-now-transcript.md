# Secrets Store CSI Driver Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/secrets-store-csi-driver-use-more-now/latest/use-more-now-receipt.yaml
runs/secrets-store-csi-driver-use-more-now/latest/function-scan-receipt.yaml
runs/secrets-store-csi-driver-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0 --json
cub install setup --pull packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0 --base default --work-dir .tmp/use-more-now/secrets-store-csi-driver-default --non-interactive --namespace kube-system
cub install render --work-dir .tmp/use-more-now/secrets-store-csi-driver-default
cub install package packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0 -o .tmp/use-more-now/secrets-store-csi-driver-archives/secrets-store-csi-driver-a.tgz
cub install upload --work-dir .tmp/use-more-now/secrets-store-csi-driver-default --space helm-secrets-store-csi-driver-use-more-now --component SecretsStoreCSIDriver --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=SecretsStoreCSIDriver --unit-label HelmChart=secrets-store-csi-driver-secrets-store-csi-driver --unit-label HelmChartVersion=1.6.0 --unit-label Variant=default --unit-label Proof=secrets-store-csi-driver-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/secrets-store-csi-driver-default
cub variant create staging helm-secrets-store-csi-driver-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-secrets-store-csi-driver-use-more-now --where "Labels.Proof = 'secrets-store-csi-driver-use-more-now'"
cub function vet vet-format --space helm-secrets-store-csi-driver-use-more-now --where "Labels.Proof = 'secrets-store-csi-driver-use-more-now'"
cub unit apply --space helm-secrets-store-csi-driver-use-more-now --where "Labels.Proof = 'secrets-store-csi-driver-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 11
separated secrets: 0
ConfigHub proof Units: 11
staging clone Units: 12
function scan: pass
safe ops: pass
```
