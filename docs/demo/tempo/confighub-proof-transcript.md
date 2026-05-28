# Tempo ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/tempo-confighub-proof/latest/confighub-proof-receipt.yaml
runs/tempo-confighub-proof/latest/function-scan-receipt.yaml
runs/tempo-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/grafana/tempo/1.24.4 --json
cub install setup --pull packages/grafana/tempo/1.24.4 --base local-persistent --work-dir .tmp/confighub-proof/tempo-local-persistent --non-interactive --namespace tempo
cub install render --work-dir .tmp/confighub-proof/tempo-local-persistent
cub install package packages/grafana/tempo/1.24.4 -o .tmp/confighub-proof/tempo-archives/tempo-a.tgz
cub install upload --work-dir .tmp/confighub-proof/tempo-local-persistent --space helm-tempo-confighub-proof --component Tempo --layer App --environment Demo --owner ConfigHubHelm --variant local-persistent --unit-label Component=Tempo --unit-label HelmChart=grafana-tempo --unit-label HelmChartVersion=1.24.4 --unit-label Variant=local-persistent --unit-label Proof=tempo-confighub-proof --retry
cub install plan --work-dir .tmp/confighub-proof/tempo-local-persistent
cub variant create staging helm-tempo-confighub-proof --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-tempo-confighub-proof --where "Labels.Proof = 'tempo-confighub-proof'"
cub function vet vet-format --space helm-tempo-confighub-proof --where "Labels.Proof = 'tempo-confighub-proof'"
cub unit apply --space helm-tempo-confighub-proof --where "Labels.Proof = 'tempo-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 5
separated secrets: 0
ConfigHub proof Units: 5
staging clone Units: 6
function scan: pass
safe ops: pass
```
