# MongoDB Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/mongodb-use-more-now/latest/use-more-now-receipt.yaml
runs/mongodb-use-more-now/latest/function-scan-receipt.yaml
runs/mongodb-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/bitnami/mongodb/19.0.7 --json
cub install setup --pull packages/bitnami/mongodb/19.0.7 --base generated-passwords --work-dir .tmp/use-more-now/mongodb-generated-passwords --non-interactive --namespace mongodb
cub install render --work-dir .tmp/use-more-now/mongodb-generated-passwords
cub install package packages/bitnami/mongodb/19.0.7 -o .tmp/use-more-now/mongodb-archives/mongodb-a.tgz
cub install upload --work-dir .tmp/use-more-now/mongodb-generated-passwords --space helm-mongodb-use-more-now --component MongoDB --layer App --environment Demo --owner ConfigHubHelm --variant generated-passwords --unit-label Component=MongoDB --unit-label HelmChart=bitnami-mongodb --unit-label HelmChartVersion=19.0.7 --unit-label Variant=generated-passwords --unit-label Proof=mongodb-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/mongodb-generated-passwords
cub variant create staging helm-mongodb-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-mongodb-use-more-now --where "Labels.Proof = 'mongodb-use-more-now'"
cub function vet vet-format --space helm-mongodb-use-more-now --where "Labels.Proof = 'mongodb-use-more-now'"
cub unit apply --space helm-mongodb-use-more-now --where "Labels.Proof = 'mongodb-use-more-now'" --dry-run
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
