# MySQL ConfigHub Proof Transcript

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

Run date: 2026-05-27

Receipts:

```text
runs/mysql-confighub-proof/latest/confighub-proof-receipt.yaml
runs/mysql-confighub-proof/latest/function-scan-receipt.yaml
runs/mysql-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/bitnami/mysql/14.0.3 --json
cub installer setup --pull packages/bitnami/mysql/14.0.3 --base generated-passwords --work-dir .tmp/confighub-proof/mysql-generated-passwords --non-interactive --namespace mysql
cub installer render --work-dir .tmp/confighub-proof/mysql-generated-passwords
cub installer package packages/bitnami/mysql/14.0.3 -o .tmp/confighub-proof/mysql-archives/mysql-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/mysql-generated-passwords --space helm-mysql-confighub-proof --component MySQL --layer App --environment Demo --owner ConfigHubHelm --variant generated-passwords --unit-label Component=MySQL --unit-label HelmChart=bitnami-mysql --unit-label HelmChartVersion=14.0.3 --unit-label Variant=generated-passwords --unit-label Proof=mysql-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/mysql-generated-passwords
cub variant create staging helm-mysql-confighub-proof --environment Staging --region local --namespace mysql --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists --wait --timeout 10m
cub unit list --space helm-mysql-confighub-proof --where "Labels.Proof = 'mysql-confighub-proof'"
cub function vet vet-format --space helm-mysql-confighub-proof --where "Labels.Proof = 'mysql-confighub-proof'"
cub unit apply --space helm-mysql-confighub-proof --where "Labels.Proof = 'mysql-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 8
separated secrets: 1
ConfigHub Units: 9
Kubernetes Units: 8
installer record Units: 1
staging clone Units: 9
function scan: pass
safe ops: pass
```
