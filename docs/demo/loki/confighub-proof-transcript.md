# Loki ConfigHub Proof Transcript

Run date: 2026-05-27

Receipts:

```text
runs/loki-confighub-proof/latest/confighub-proof-receipt.yaml
runs/loki-confighub-proof/latest/function-scan-receipt.yaml
runs/loki-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/grafana/loki/7.0.0 --json
cub install setup --pull packages/grafana/loki/7.0.0 --base single-binary-filesystem --work-dir .tmp/confighub-proof/loki-single-binary-filesystem --non-interactive --namespace loki
cub install render --work-dir .tmp/confighub-proof/loki-single-binary-filesystem
cub install package packages/grafana/loki/7.0.0 -o .tmp/confighub-proof/loki-archives/loki-a.tgz
cub install upload --work-dir .tmp/confighub-proof/loki-single-binary-filesystem --space helm-loki-confighub-proof --component Loki --layer App --environment Demo --owner ConfigHubHelm --variant single-binary-filesystem --unit-label Component=Loki --unit-label HelmChart=grafana-loki --unit-label HelmChartVersion=7.0.0 --unit-label Variant=single-binary-filesystem --unit-label Proof=loki-confighub-proof --retry
cub install plan --work-dir .tmp/confighub-proof/loki-single-binary-filesystem
cub variant create staging helm-loki-confighub-proof --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-loki-confighub-proof --where "Labels.Proof = 'loki-confighub-proof'"
cub function vet vet-format --space helm-loki-confighub-proof --where "Labels.Proof = 'loki-confighub-proof'"
cub unit apply --space helm-loki-confighub-proof --where "Labels.Proof = 'loki-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 20
separated secrets: 0
ConfigHub proof Units: 20
staging clone Units: 21
function scan: pass
safe ops: pass
```
