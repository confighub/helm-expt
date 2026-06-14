# Metrics Server ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/metrics-server-confighub-proof/latest/confighub-proof-receipt.yaml
runs/metrics-server-confighub-proof/latest/function-scan-receipt.yaml
runs/metrics-server-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/metrics-server/metrics-server/3.13.0 --json
cub installer setup --pull packages/metrics-server/metrics-server/3.13.0 --base default --work-dir .tmp/confighub-proof/metrics-server-default --non-interactive --namespace kube-system
cub installer render --work-dir .tmp/confighub-proof/metrics-server-default
cub installer package packages/metrics-server/metrics-server/3.13.0 -o .tmp/confighub-proof/metrics-server-archives/metrics-server-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/metrics-server-default --space helm-metrics-server-confighub-proof --component MetricsServer --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=MetricsServer --unit-label HelmChart=metrics-server-metrics-server --unit-label HelmChartVersion=3.13.0 --unit-label Variant=default --unit-label Proof=metrics-server-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/metrics-server-default
cub variant create staging helm-metrics-server-confighub-proof --environment Staging --region local --namespace kube-system --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists --wait --timeout 10m
cub unit list --space helm-metrics-server-confighub-proof --where "Labels.Proof = 'metrics-server-confighub-proof'"
cub function vet vet-format --space helm-metrics-server-confighub-proof --where "Labels.Proof = 'metrics-server-confighub-proof'"
cub unit apply --space helm-metrics-server-confighub-proof --where "Labels.Proof = 'metrics-server-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 10
separated secrets: 0
ConfigHub Units: 11
Kubernetes Units: 10
installer record Units: 1
staging clone Units: 11
function scan: pass
safe ops: pass
```
