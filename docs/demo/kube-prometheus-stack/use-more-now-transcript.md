# kube-prometheus-stack Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/kube-prometheus-stack-use-more-now/latest/use-more-now-receipt.yaml
runs/kube-prometheus-stack-use-more-now/latest/function-scan-receipt.yaml
runs/kube-prometheus-stack-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/prometheus-community/kube-prometheus-stack/85.3.3 --json
cub install setup --pull packages/prometheus-community/kube-prometheus-stack/85.3.3 --base default --work-dir .tmp/use-more-now/kube-prometheus-stack-default --non-interactive --namespace monitoring
cub install render --work-dir .tmp/use-more-now/kube-prometheus-stack-default
cub install package packages/prometheus-community/kube-prometheus-stack/85.3.3 -o .tmp/use-more-now/kube-prometheus-stack-archives/kube-prometheus-stack-a.tgz
cub install upload --work-dir .tmp/use-more-now/kube-prometheus-stack-default --space helm-kube-prometheus-stack-use-more-now --component KubePrometheusStack --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=KubePrometheusStack --unit-label HelmChart=prometheus-community-kube-prometheus-stack --unit-label HelmChartVersion=85.3.3 --unit-label Variant=default --unit-label Proof=kube-prometheus-stack-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/kube-prometheus-stack-default
cub variant create staging helm-kube-prometheus-stack-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-kube-prometheus-stack-use-more-now --where "Labels.Proof = 'kube-prometheus-stack-use-more-now'"
cub function vet vet-format --space helm-kube-prometheus-stack-use-more-now --where "Labels.Proof = 'kube-prometheus-stack-use-more-now'"
cub unit apply --space helm-kube-prometheus-stack-use-more-now --where "Labels.Proof = 'kube-prometheus-stack-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 123
separated secrets: 2
ConfigHub proof Units: 123
staging clone Units: 124
function scan: pass
safe ops: pass
```
