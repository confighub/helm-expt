# Vault Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/vault-use-more-now/latest/use-more-now-receipt.yaml
runs/vault-use-more-now/latest/function-scan-receipt.yaml
runs/vault-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/hashicorp/vault/0.32.0 --json
cub install setup --pull packages/hashicorp/vault/0.32.0 --base default --work-dir .tmp/use-more-now/vault-default --non-interactive --namespace vault
cub install render --work-dir .tmp/use-more-now/vault-default
cub install package packages/hashicorp/vault/0.32.0 -o .tmp/use-more-now/vault-archives/vault-a.tgz
cub install upload --work-dir .tmp/use-more-now/vault-default --space helm-vault-use-more-now --component Vault --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=Vault --unit-label HelmChart=hashicorp-vault --unit-label HelmChartVersion=0.32.0 --unit-label Variant=default --unit-label Proof=vault-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/vault-default
cub variant create staging helm-vault-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-vault-use-more-now --where "Labels.Proof = 'vault-use-more-now'"
cub function vet vet-format --space helm-vault-use-more-now --where "Labels.Proof = 'vault-use-more-now'"
cub unit apply --space helm-vault-use-more-now --where "Labels.Proof = 'vault-use-more-now'" --dry-run
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
