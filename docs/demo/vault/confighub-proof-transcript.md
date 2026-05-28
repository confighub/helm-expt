# Vault ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/vault-confighub-proof/latest/confighub-proof-receipt.yaml
runs/vault-confighub-proof/latest/function-scan-receipt.yaml
runs/vault-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/hashicorp/vault/0.32.0 --json
cub install setup --pull packages/hashicorp/vault/0.32.0 --base default --work-dir .tmp/confighub-proof/vault-default --non-interactive --namespace vault
cub install render --work-dir .tmp/confighub-proof/vault-default
cub install package packages/hashicorp/vault/0.32.0 -o .tmp/confighub-proof/vault-archives/vault-a.tgz
cub install upload --work-dir .tmp/confighub-proof/vault-default --space helm-vault-confighub-proof --component Vault --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=Vault --unit-label HelmChart=hashicorp-vault --unit-label HelmChartVersion=0.32.0 --unit-label Variant=default --unit-label Proof=vault-confighub-proof --retry
cub install plan --work-dir .tmp/confighub-proof/vault-default
cub variant create staging helm-vault-confighub-proof --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-vault-confighub-proof --where "Labels.Proof = 'vault-confighub-proof'"
cub function vet vet-format --space helm-vault-confighub-proof --where "Labels.Proof = 'vault-confighub-proof'"
cub unit apply --space helm-vault-confighub-proof --where "Labels.Proof = 'vault-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 13
separated secrets: 0
ConfigHub proof Units: 13
staging clone Units: 14
function scan: pass
safe ops: pass
```
