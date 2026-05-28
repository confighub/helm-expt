# Consul ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/consul-confighub-proof/latest/confighub-proof-receipt.yaml
runs/consul-confighub-proof/latest/function-scan-receipt.yaml
runs/consul-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/hashicorp/consul/2.0.0 --json
cub install setup --pull packages/hashicorp/consul/2.0.0 --base default-control-plane --work-dir .tmp/confighub-proof/consul-default-control-plane --non-interactive --namespace consul
cub install render --work-dir .tmp/confighub-proof/consul-default-control-plane
cub install package packages/hashicorp/consul/2.0.0 -o .tmp/confighub-proof/consul-archives/consul-a.tgz
cub install upload --work-dir .tmp/confighub-proof/consul-default-control-plane --space helm-consul-confighub-proof --component Consul --layer App --environment Demo --owner ConfigHubHelm --variant default-control-plane --unit-label Component=Consul --unit-label HelmChart=hashicorp-consul --unit-label HelmChartVersion=2.0.0 --unit-label Variant=default-control-plane --unit-label Proof=consul-confighub-proof --retry
cub install plan --work-dir .tmp/confighub-proof/consul-default-control-plane
cub variant create staging helm-consul-confighub-proof --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-consul-confighub-proof --where "Labels.Proof = 'consul-confighub-proof'"
cub function vet vet-format --space helm-consul-confighub-proof --where "Labels.Proof = 'consul-confighub-proof'"
cub unit apply --space helm-consul-confighub-proof --where "Labels.Proof = 'consul-confighub-proof'" --dry-run
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
