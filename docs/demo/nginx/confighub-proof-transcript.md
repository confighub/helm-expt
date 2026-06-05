# NGINX ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/nginx-confighub-proof/latest/confighub-proof-receipt.yaml
runs/nginx-confighub-proof/latest/function-scan-receipt.yaml
runs/nginx-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/bitnami/nginx/24.0.2 --json
cub installer setup --pull packages/bitnami/nginx/24.0.2 --base http-clusterip --work-dir .tmp/confighub-proof/nginx-http-clusterip --non-interactive --namespace nginx
cub installer render --work-dir .tmp/confighub-proof/nginx-http-clusterip
cub installer package packages/bitnami/nginx/24.0.2 -o .tmp/confighub-proof/nginx-archives/nginx-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/nginx-http-clusterip --space helm-nginx-confighub-proof --component NGINX --layer App --environment Demo --owner ConfigHubHelm --variant http-clusterip --unit-label Component=NGINX --unit-label HelmChart=bitnami-nginx --unit-label HelmChartVersion=24.0.2 --unit-label Variant=http-clusterip --unit-label Proof=nginx-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/nginx-http-clusterip
cub variant create staging helm-nginx-confighub-proof --environment Staging --region local --space-name-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-nginx-confighub-proof --where "Labels.Proof = 'nginx-confighub-proof'"
cub function vet vet-format --space helm-nginx-confighub-proof --where "Labels.Proof = 'nginx-confighub-proof'"
cub unit apply --space helm-nginx-confighub-proof --where "Labels.Proof = 'nginx-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 6
separated secrets: 0
ConfigHub Units: 7
Kubernetes Units: 6
installer record Units: 1
staging clone Units: 7
function scan: pass
safe ops: pass
```
