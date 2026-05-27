# Prometheus Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/prometheus-use-more-now/latest/use-more-now-receipt.yaml
runs/prometheus-use-more-now/latest/function-scan-receipt.yaml
runs/prometheus-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/prometheus-community/prometheus/29.8.0 --json
cub install setup --pull packages/prometheus-community/prometheus/29.8.0 --base default --work-dir .tmp/use-more-now/prometheus-default --non-interactive --namespace monitoring
cub install render --work-dir .tmp/use-more-now/prometheus-default
cub install package packages/prometheus-community/prometheus/29.8.0 -o .tmp/use-more-now/prometheus-archives/prometheus-a.tgz
cub install upload --work-dir .tmp/use-more-now/prometheus-default --space helm-prometheus-use-more-now --component Prometheus --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=Prometheus --unit-label HelmChart=prometheus-community-prometheus --unit-label HelmChartVersion=29.8.0 --unit-label Variant=default --unit-label Proof=prometheus-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/prometheus-default
cub variant create staging helm-prometheus-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-prometheus-use-more-now --where "Labels.Proof = 'prometheus-use-more-now'"
cub function vet vet-format --space helm-prometheus-use-more-now --where "Labels.Proof = 'prometheus-use-more-now'"
cub unit apply --space helm-prometheus-use-more-now --where "Labels.Proof = 'prometheus-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 24
separated secrets: 0
ConfigHub proof Units: 24
staging clone Units: 25
function scan: pass
safe ops: pass
```
