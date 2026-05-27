# Tempo Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/tempo-use-more-now/latest/use-more-now-receipt.yaml
runs/tempo-use-more-now/latest/function-scan-receipt.yaml
runs/tempo-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/grafana/tempo/1.24.4 --json
cub install setup --pull packages/grafana/tempo/1.24.4 --base local-persistent --work-dir .tmp/use-more-now/tempo-local-persistent --non-interactive --namespace tempo
cub install render --work-dir .tmp/use-more-now/tempo-local-persistent
cub install package packages/grafana/tempo/1.24.4 -o .tmp/use-more-now/tempo-archives/tempo-a.tgz
cub install upload --work-dir .tmp/use-more-now/tempo-local-persistent --space helm-tempo-use-more-now --component Tempo --layer App --environment Demo --owner ConfigHubHelm --variant local-persistent --unit-label Component=Tempo --unit-label HelmChart=grafana-tempo --unit-label HelmChartVersion=1.24.4 --unit-label Variant=local-persistent --unit-label Proof=tempo-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/tempo-local-persistent
cub variant create staging helm-tempo-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-tempo-use-more-now --where "Labels.Proof = 'tempo-use-more-now'"
cub function vet vet-format --space helm-tempo-use-more-now --where "Labels.Proof = 'tempo-use-more-now'"
cub unit apply --space helm-tempo-use-more-now --where "Labels.Proof = 'tempo-use-more-now'" --dry-run
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
