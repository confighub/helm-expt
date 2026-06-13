# Prometheus ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/prometheus-confighub-proof/latest/confighub-proof-receipt.yaml
runs/prometheus-confighub-proof/latest/function-scan-receipt.yaml
runs/prometheus-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/prometheus-community/prometheus/29.8.0 --json
cub installer setup --pull packages/prometheus-community/prometheus/29.8.0 --base server-only-ephemeral --work-dir .tmp/confighub-proof/prometheus-server-only-ephemeral --non-interactive --namespace monitoring
cub installer render --work-dir .tmp/confighub-proof/prometheus-server-only-ephemeral
cub installer package packages/prometheus-community/prometheus/29.8.0 -o .tmp/confighub-proof/prometheus-archives/prometheus-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/prometheus-server-only-ephemeral --space helm-prometheus-confighub-proof --component Prometheus --layer App --environment Demo --owner ConfigHubHelm --variant server-only-ephemeral --unit-label Component=Prometheus --unit-label HelmChart=prometheus-community-prometheus --unit-label HelmChartVersion=29.8.0 --unit-label Variant=server-only-ephemeral --unit-label Proof=prometheus-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/prometheus-server-only-ephemeral
cub variant create staging helm-prometheus-confighub-proof --environment Staging --region local --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-prometheus-confighub-proof --where "Labels.Proof = 'prometheus-confighub-proof'"
cub function vet vet-format --space helm-prometheus-confighub-proof --where "Labels.Proof = 'prometheus-confighub-proof'"
cub unit apply --space helm-prometheus-confighub-proof --where "Labels.Proof = 'prometheus-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 7
separated secrets: 0
ConfigHub Units: 8
Kubernetes Units: 7
installer record Units: 1
staging clone Units: 8
function scan: pass
safe ops: pass
```
