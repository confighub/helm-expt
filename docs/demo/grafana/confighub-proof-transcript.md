# Grafana ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/grafana-confighub-proof/latest/confighub-proof-receipt.yaml
runs/grafana-confighub-proof/latest/function-scan-receipt.yaml
runs/grafana-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/grafana/grafana/10.5.15 --json
cub installer setup --pull packages/grafana/grafana/10.5.15 --base generated-passwords --work-dir .tmp/confighub-proof/grafana-generated-passwords --non-interactive --namespace grafana
cub installer render --work-dir .tmp/confighub-proof/grafana-generated-passwords
cub installer package packages/grafana/grafana/10.5.15 -o .tmp/confighub-proof/grafana-archives/grafana-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/grafana-generated-passwords --space helm-grafana-confighub-proof --component Grafana --layer App --environment Demo --owner ConfigHubHelm --variant generated-passwords --unit-label Component=Grafana --unit-label HelmChart=grafana-grafana --unit-label HelmChartVersion=10.5.15 --unit-label Variant=generated-passwords --unit-label Proof=grafana-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/grafana-generated-passwords
cub variant create staging helm-grafana-confighub-proof --environment Staging --region local --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists --wait --timeout 10m
cub unit list --space helm-grafana-confighub-proof --where "Labels.Proof = 'grafana-confighub-proof'"
cub function vet vet-format --space helm-grafana-confighub-proof --where "Labels.Proof = 'grafana-confighub-proof'"
cub unit apply --space helm-grafana-confighub-proof --where "Labels.Proof = 'grafana-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 9
separated secrets: 1
ConfigHub Units: 10
Kubernetes Units: 9
installer record Units: 1
staging clone Units: 10
function scan: pass
safe ops: pass
```
