# External Secrets ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/external-secrets-confighub-proof/latest/confighub-proof-receipt.yaml
runs/external-secrets-confighub-proof/latest/function-scan-receipt.yaml
runs/external-secrets-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/external-secrets/external-secrets/2.5.0 --json
cub installer setup --pull packages/external-secrets/external-secrets/2.5.0 --base default --work-dir .tmp/confighub-proof/external-secrets-default --non-interactive --namespace external-secrets
cub installer render --work-dir .tmp/confighub-proof/external-secrets-default
cub installer package packages/external-secrets/external-secrets/2.5.0 -o .tmp/confighub-proof/external-secrets-archives/external-secrets-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/external-secrets-default --space helm-external-secrets-confighub-proof --component ExternalSecrets --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=ExternalSecrets --unit-label HelmChart=external-secrets-external-secrets --unit-label HelmChartVersion=2.5.0 --unit-label Variant=default --unit-label Proof=external-secrets-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/external-secrets-default
cub variant create staging helm-external-secrets-confighub-proof --environment Staging --region local --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-external-secrets-confighub-proof --where "Labels.Proof = 'external-secrets-confighub-proof'"
cub function vet vet-format --space helm-external-secrets-confighub-proof --where "Labels.Proof = 'external-secrets-confighub-proof'"
cub unit apply --space helm-external-secrets-confighub-proof --where "Labels.Proof = 'external-secrets-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 42
separated secrets: 1
ConfigHub Units: 43
Kubernetes Units: 42
installer record Units: 1
staging clone Units: 43
function scan: pass
safe ops: pass
```
