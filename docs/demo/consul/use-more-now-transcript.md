# Consul Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/consul-use-more-now/latest/use-more-now-receipt.yaml
runs/consul-use-more-now/latest/function-scan-receipt.yaml
runs/consul-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/hashicorp/consul/2.0.0 --json
cub install setup --pull packages/hashicorp/consul/2.0.0 --base default-control-plane --work-dir .tmp/use-more-now/consul-default-control-plane --non-interactive --namespace consul
cub install render --work-dir .tmp/use-more-now/consul-default-control-plane
cub install package packages/hashicorp/consul/2.0.0 -o .tmp/use-more-now/consul-archives/consul-a.tgz
cub install upload --work-dir .tmp/use-more-now/consul-default-control-plane --space helm-consul-use-more-now --component Consul --layer App --environment Demo --owner ConfigHubHelm --variant default-control-plane --unit-label Component=Consul --unit-label HelmChart=hashicorp-consul --unit-label HelmChartVersion=2.0.0 --unit-label Variant=default-control-plane --unit-label Proof=consul-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/consul-default-control-plane
cub variant create staging helm-consul-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-consul-use-more-now --where "Labels.Proof = 'consul-use-more-now'"
cub function vet vet-format --space helm-consul-use-more-now --where "Labels.Proof = 'consul-use-more-now'"
cub unit apply --space helm-consul-use-more-now --where "Labels.Proof = 'consul-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 71
separated secrets: 0
ConfigHub proof Units: 71
staging clone Units: 72
function scan: pass
safe ops: pass
```
