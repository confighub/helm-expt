# Vault ConfigHub Proof Transcript

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

Run date: 2026-05-27

Receipts:

```text
runs/vault-confighub-proof/latest/confighub-proof-receipt.yaml
runs/vault-confighub-proof/latest/function-scan-receipt.yaml
runs/vault-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/hashicorp/vault/0.32.0 --json
cub installer setup --pull packages/hashicorp/vault/0.32.0 --base dev-mode --work-dir .tmp/confighub-proof/vault-dev-mode --non-interactive --namespace vault
cub installer render --work-dir .tmp/confighub-proof/vault-dev-mode
cub installer package packages/hashicorp/vault/0.32.0 -o .tmp/confighub-proof/vault-archives/vault-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/vault-dev-mode --space helm-vault-confighub-proof --component Vault --layer App --environment Demo --owner ConfigHubHelm --variant dev-mode --unit-label Component=Vault --unit-label HelmChart=hashicorp-vault --unit-label HelmChartVersion=0.32.0 --unit-label Variant=dev-mode --unit-label Proof=vault-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/vault-dev-mode
cub variant create staging helm-vault-confighub-proof --environment Staging --region local --namespace vault --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists --wait --timeout 10m
cub unit list --space helm-vault-confighub-proof --where "Labels.Proof = 'vault-confighub-proof'"
cub function vet vet-format --space helm-vault-confighub-proof --where "Labels.Proof = 'vault-confighub-proof'"
cub unit apply --space helm-vault-confighub-proof --where "Labels.Proof = 'vault-confighub-proof'" --dry-run
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
