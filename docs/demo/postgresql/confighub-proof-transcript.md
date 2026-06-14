# PostgreSQL ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/postgresql-confighub-proof/latest/confighub-proof-receipt.yaml
runs/postgresql-confighub-proof/latest/function-scan-receipt.yaml
runs/postgresql-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/bitnami/postgresql/18.6.7 --json
cub installer setup --pull packages/bitnami/postgresql/18.6.7 --base generated-passwords --work-dir .tmp/confighub-proof/postgresql-generated-passwords --non-interactive --namespace postgresql
cub installer render --work-dir .tmp/confighub-proof/postgresql-generated-passwords
cub installer package packages/bitnami/postgresql/18.6.7 -o .tmp/confighub-proof/postgresql-archives/postgresql-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/postgresql-generated-passwords --space helm-postgresql-confighub-proof --component PostgreSQL --layer App --environment Demo --owner ConfigHubHelm --variant generated-passwords --unit-label Component=PostgreSQL --unit-label HelmChart=bitnami-postgresql --unit-label HelmChartVersion=18.6.7 --unit-label Variant=generated-passwords --unit-label Proof=postgresql-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/postgresql-generated-passwords
cub variant create staging helm-postgresql-confighub-proof --environment Staging --region local --namespace postgresql --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists --wait --timeout 10m
cub unit list --space helm-postgresql-confighub-proof --where "Labels.Proof = 'postgresql-confighub-proof'"
cub function vet vet-format --space helm-postgresql-confighub-proof --where "Labels.Proof = 'postgresql-confighub-proof'"
cub unit apply --space helm-postgresql-confighub-proof --where "Labels.Proof = 'postgresql-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 7
separated secrets: 1
ConfigHub Units: 8
Kubernetes Units: 7
installer record Units: 1
staging clone Units: 8
function scan: pass
safe ops: pass
```
