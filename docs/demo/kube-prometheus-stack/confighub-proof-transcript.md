# kube-prometheus-stack ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/kube-prometheus-stack-confighub-proof/latest/confighub-proof-receipt.yaml
runs/kube-prometheus-stack-confighub-proof/latest/function-scan-receipt.yaml
runs/kube-prometheus-stack-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/prometheus-community/kube-prometheus-stack/85.3.3 --json
cub installer setup --pull packages/prometheus-community/kube-prometheus-stack/85.3.3 --base default --work-dir .tmp/confighub-proof/kube-prometheus-stack-default --non-interactive --namespace monitoring
cub installer render --work-dir .tmp/confighub-proof/kube-prometheus-stack-default
cub installer package packages/prometheus-community/kube-prometheus-stack/85.3.3 -o .tmp/confighub-proof/kube-prometheus-stack-archives/kube-prometheus-stack-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/kube-prometheus-stack-default --space helm-kube-prometheus-stack-confighub-proof --component KubePrometheusStack --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=KubePrometheusStack --unit-label HelmChart=prometheus-community-kube-prometheus-stack --unit-label HelmChartVersion=85.3.3 --unit-label Variant=default --unit-label Proof=kube-prometheus-stack-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/kube-prometheus-stack-default
cub variant create staging helm-kube-prometheus-stack-confighub-proof --environment Staging --region local --space-name-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-kube-prometheus-stack-confighub-proof --where "Labels.Proof = 'kube-prometheus-stack-confighub-proof'"
cub function vet vet-format --space helm-kube-prometheus-stack-confighub-proof --where "Labels.Proof = 'kube-prometheus-stack-confighub-proof'"
cub unit apply --space helm-kube-prometheus-stack-confighub-proof --where "Labels.Proof = 'kube-prometheus-stack-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 123
separated secrets: 2
ConfigHub Units: 124
Kubernetes Units: 123
installer record Units: 1
staging clone Units: 124
function scan: pass
safe ops: pass
```
