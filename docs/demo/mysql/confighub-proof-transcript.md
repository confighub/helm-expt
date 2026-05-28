# MySQL ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/mysql-confighub-proof/latest/confighub-proof-receipt.yaml
runs/mysql-confighub-proof/latest/function-scan-receipt.yaml
runs/mysql-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/bitnami/mysql/14.0.3 --json
cub install setup --pull packages/bitnami/mysql/14.0.3 --base generated-passwords --work-dir .tmp/confighub-proof/mysql-generated-passwords --non-interactive --namespace mysql
cub install render --work-dir .tmp/confighub-proof/mysql-generated-passwords
cub install package packages/bitnami/mysql/14.0.3 -o .tmp/confighub-proof/mysql-archives/mysql-a.tgz
cub install upload --work-dir .tmp/confighub-proof/mysql-generated-passwords --space helm-mysql-confighub-proof --component MySQL --layer App --environment Demo --owner ConfigHubHelm --variant generated-passwords --unit-label Component=MySQL --unit-label HelmChart=bitnami-mysql --unit-label HelmChartVersion=14.0.3 --unit-label Variant=generated-passwords --unit-label Proof=mysql-confighub-proof --retry
cub install plan --work-dir .tmp/confighub-proof/mysql-generated-passwords
cub variant create staging helm-mysql-confighub-proof --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-mysql-confighub-proof --where "Labels.Proof = 'mysql-confighub-proof'"
cub function vet vet-format --space helm-mysql-confighub-proof --where "Labels.Proof = 'mysql-confighub-proof'"
cub unit apply --space helm-mysql-confighub-proof --where "Labels.Proof = 'mysql-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 8
separated secrets: 1
ConfigHub proof Units: 8
staging clone Units: 9
function scan: pass
safe ops: pass
```
