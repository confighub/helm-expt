# Redis ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/redis-confighub-proof/latest/confighub-proof-receipt.yaml
runs/redis-confighub-proof/latest/function-scan-receipt.yaml
runs/redis-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/bitnami/redis/25.5.3 --json
cub installer setup --pull packages/bitnami/redis/25.5.3 --base default --work-dir .tmp/confighub-proof/redis-default --non-interactive --namespace redis
cub installer render --work-dir .tmp/confighub-proof/redis-default
cub installer package packages/bitnami/redis/25.5.3 -o .tmp/confighub-proof/redis-archives/redis-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/redis-default --space helm-redis-confighub-proof --component Redis --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=Redis --unit-label HelmChart=bitnami-redis --unit-label HelmChartVersion=25.5.3 --unit-label Variant=default --unit-label Proof=redis-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/redis-default
cub variant create staging helm-redis-confighub-proof --environment Staging --region local --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-redis-confighub-proof --where "Labels.Proof = 'redis-confighub-proof'"
cub function vet vet-format --space helm-redis-confighub-proof --where "Labels.Proof = 'redis-confighub-proof'"
cub unit apply --space helm-redis-confighub-proof --where "Labels.Proof = 'redis-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 14
separated secrets: 1
ConfigHub Units: 15
Kubernetes Units: 14
installer record Units: 1
staging clone Units: 15
function scan: pass
safe ops: pass
```
