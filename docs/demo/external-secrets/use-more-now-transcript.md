# External Secrets Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/external-secrets-use-more-now/latest/use-more-now-receipt.yaml
runs/external-secrets-use-more-now/latest/function-scan-receipt.yaml
runs/external-secrets-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/external-secrets/external-secrets/2.5.0 --json
cub install setup --pull packages/external-secrets/external-secrets/2.5.0 --base default --work-dir .tmp/use-more-now/external-secrets-default --non-interactive --namespace external-secrets
cub install render --work-dir .tmp/use-more-now/external-secrets-default
cub install package packages/external-secrets/external-secrets/2.5.0 -o .tmp/use-more-now/external-secrets-archives/external-secrets-a.tgz
cub install upload --work-dir .tmp/use-more-now/external-secrets-default --space helm-external-secrets-use-more-now --component ExternalSecrets --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=ExternalSecrets --unit-label HelmChart=external-secrets-external-secrets --unit-label HelmChartVersion=2.5.0 --unit-label Variant=default --unit-label Proof=external-secrets-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/external-secrets-default
cub variant create staging helm-external-secrets-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-external-secrets-use-more-now --where "Labels.Proof = 'external-secrets-use-more-now'"
cub function vet vet-format --space helm-external-secrets-use-more-now --where "Labels.Proof = 'external-secrets-use-more-now'"
cub unit apply --space helm-external-secrets-use-more-now --where "Labels.Proof = 'external-secrets-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 42
separated secrets: 1
ConfigHub proof Units: 42
staging clone Units: 43
function scan: pass
safe ops: pass
```
