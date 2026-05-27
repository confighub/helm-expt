# RabbitMQ Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/rabbitmq-use-more-now/latest/use-more-now-receipt.yaml
runs/rabbitmq-use-more-now/latest/function-scan-receipt.yaml
runs/rabbitmq-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/bitnami/rabbitmq/16.0.14 --json
cub install setup --pull packages/bitnami/rabbitmq/16.0.14 --base generated-passwords --work-dir .tmp/use-more-now/rabbitmq-generated-passwords --non-interactive --namespace rabbitmq
cub install render --work-dir .tmp/use-more-now/rabbitmq-generated-passwords
cub install package packages/bitnami/rabbitmq/16.0.14 -o .tmp/use-more-now/rabbitmq-archives/rabbitmq-a.tgz
cub install upload --work-dir .tmp/use-more-now/rabbitmq-generated-passwords --space helm-rabbitmq-use-more-now --component RabbitMQ --layer App --environment Demo --owner ConfigHubHelm --variant generated-passwords --unit-label Component=RabbitMQ --unit-label HelmChart=bitnami-rabbitmq --unit-label HelmChartVersion=16.0.14 --unit-label Variant=generated-passwords --unit-label Proof=rabbitmq-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/rabbitmq-generated-passwords
cub variant create staging helm-rabbitmq-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-rabbitmq-use-more-now --where "Labels.Proof = 'rabbitmq-use-more-now'"
cub function vet vet-format --space helm-rabbitmq-use-more-now --where "Labels.Proof = 'rabbitmq-use-more-now'"
cub unit apply --space helm-rabbitmq-use-more-now --where "Labels.Proof = 'rabbitmq-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 9
separated secrets: 2
ConfigHub proof Units: 9
staging clone Units: 10
function scan: pass
safe ops: pass
```
