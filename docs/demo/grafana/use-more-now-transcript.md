# Grafana Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/grafana-use-more-now/latest/use-more-now-receipt.yaml
runs/grafana-use-more-now/latest/function-scan-receipt.yaml
runs/grafana-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/grafana/grafana/10.5.15 --json
cub install setup --pull packages/grafana/grafana/10.5.15 --base generated-passwords --work-dir .tmp/use-more-now/grafana-generated-passwords --non-interactive --namespace grafana
cub install render --work-dir .tmp/use-more-now/grafana-generated-passwords
cub install package packages/grafana/grafana/10.5.15 -o .tmp/use-more-now/grafana-archives/grafana-a.tgz
cub install upload --work-dir .tmp/use-more-now/grafana-generated-passwords --space helm-grafana-use-more-now --component Grafana --layer App --environment Demo --owner ConfigHubHelm --variant generated-passwords --unit-label Component=Grafana --unit-label HelmChart=grafana-grafana --unit-label HelmChartVersion=10.5.15 --unit-label Variant=generated-passwords --unit-label Proof=grafana-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/grafana-generated-passwords
cub variant create staging helm-grafana-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-grafana-use-more-now --where "Labels.Proof = 'grafana-use-more-now'"
cub function vet vet-format --space helm-grafana-use-more-now --where "Labels.Proof = 'grafana-use-more-now'"
cub unit apply --space helm-grafana-use-more-now --where "Labels.Proof = 'grafana-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 9
separated secrets: 1
ConfigHub proof Units: 9
staging clone Units: 10
function scan: pass
safe ops: pass
```
