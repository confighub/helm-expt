# Longhorn Use-More-Now Transcript

Run date: 2026-05-27

Receipts:

```text
runs/longhorn-use-more-now/latest/use-more-now-receipt.yaml
runs/longhorn-use-more-now/latest/function-scan-receipt.yaml
runs/longhorn-use-more-now/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub install doc packages/longhorn/longhorn/1.11.2 --json
cub install setup --pull packages/longhorn/longhorn/1.11.2 --base default --work-dir .tmp/use-more-now/longhorn-default --non-interactive --namespace longhorn-system
cub install render --work-dir .tmp/use-more-now/longhorn-default
cub install package packages/longhorn/longhorn/1.11.2 -o .tmp/use-more-now/longhorn-archives/longhorn-a.tgz
cub install upload --work-dir .tmp/use-more-now/longhorn-default --space helm-longhorn-use-more-now --component Longhorn --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=Longhorn --unit-label HelmChart=longhorn-longhorn --unit-label HelmChartVersion=1.11.2 --unit-label Variant=default --unit-label Proof=longhorn-use-more-now --retry
cub install plan --work-dir .tmp/use-more-now/longhorn-default
cub variant create staging helm-longhorn-use-more-now --environment Staging --region local --space-name-pattern template:{{.SourceEntitySlug}}-{{.Labels.Variant}} --allow-exists
cub unit list --space helm-longhorn-use-more-now --where "Labels.Proof = 'longhorn-use-more-now'"
cub function vet vet-format --space helm-longhorn-use-more-now --where "Labels.Proof = 'longhorn-use-more-now'"
cub unit apply --space helm-longhorn-use-more-now --where "Labels.Proof = 'longhorn-use-more-now'" --dry-run
```

## Result

```text
rendered objects: 42
separated secrets: 0
ConfigHub proof Units: 42
staging clone Units: 43
function scan: pass
safe ops: pass
```
