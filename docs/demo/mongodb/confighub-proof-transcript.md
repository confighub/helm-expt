# MongoDB ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/mongodb-confighub-proof/latest/confighub-proof-receipt.yaml
runs/mongodb-confighub-proof/latest/function-scan-receipt.yaml
runs/mongodb-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/bitnami/mongodb/19.0.7 --json
cub install setup --pull packages/bitnami/mongodb/19.0.7 --base generated-passwords --work-dir .tmp/confighub-proof/mongodb-generated-passwords --non-interactive --namespace mongodb
cub install render --work-dir .tmp/confighub-proof/mongodb-generated-passwords
cub install package packages/bitnami/mongodb/19.0.7 -o .tmp/confighub-proof/mongodb-archives/mongodb-a.tgz
cub install upload --work-dir .tmp/confighub-proof/mongodb-generated-passwords --space helm-mongodb-confighub-proof --component MongoDB --layer App --environment Demo --owner ConfigHubHelm --variant generated-passwords --unit-label Component=MongoDB --unit-label HelmChart=bitnami-mongodb --unit-label HelmChartVersion=19.0.7 --unit-label Variant=generated-passwords --unit-label Proof=mongodb-confighub-proof --retry
cub install plan --work-dir .tmp/confighub-proof/mongodb-generated-passwords
cub variant create staging helm-mongodb-confighub-proof --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-mongodb-confighub-proof --where "Labels.Proof = 'mongodb-confighub-proof'"
cub function vet vet-format --space helm-mongodb-confighub-proof --where "Labels.Proof = 'mongodb-confighub-proof'"
cub unit apply --space helm-mongodb-confighub-proof --where "Labels.Proof = 'mongodb-confighub-proof'" --dry-run
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
