# RabbitMQ ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/rabbitmq-confighub-proof/latest/confighub-proof-receipt.yaml
runs/rabbitmq-confighub-proof/latest/function-scan-receipt.yaml
runs/rabbitmq-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/bitnami/rabbitmq/16.0.14 --json
cub installer setup --pull packages/bitnami/rabbitmq/16.0.14 --base generated-passwords --work-dir .tmp/confighub-proof/rabbitmq-generated-passwords --non-interactive --namespace rabbitmq
cub installer render --work-dir .tmp/confighub-proof/rabbitmq-generated-passwords
cub installer package packages/bitnami/rabbitmq/16.0.14 -o .tmp/confighub-proof/rabbitmq-archives/rabbitmq-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/rabbitmq-generated-passwords --space helm-rabbitmq-confighub-proof --component RabbitMQ --layer App --environment Demo --owner ConfigHubHelm --variant generated-passwords --unit-label Component=RabbitMQ --unit-label HelmChart=bitnami-rabbitmq --unit-label HelmChartVersion=16.0.14 --unit-label Variant=generated-passwords --unit-label Proof=rabbitmq-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/rabbitmq-generated-passwords
cub variant create staging helm-rabbitmq-confighub-proof --environment Staging --region local --space-name-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-rabbitmq-confighub-proof --where "Labels.Proof = 'rabbitmq-confighub-proof'"
cub function vet vet-format --space helm-rabbitmq-confighub-proof --where "Labels.Proof = 'rabbitmq-confighub-proof'"
cub unit apply --space helm-rabbitmq-confighub-proof --where "Labels.Proof = 'rabbitmq-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 9
separated secrets: 2
ConfigHub Units: 10
Kubernetes Units: 9
installer record Units: 1
staging clone Units: 10
function scan: pass
safe ops: pass
```
