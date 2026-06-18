# Longhorn ConfigHub Proof Transcript

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

Run date: 2026-05-27

Receipts:

```text
runs/longhorn-confighub-proof/latest/confighub-proof-receipt.yaml
runs/longhorn-confighub-proof/latest/function-scan-receipt.yaml
runs/longhorn-confighub-proof/latest/safe-ops-receipt.yaml
```

## Commands

```sh
cub installer doc packages/longhorn/longhorn/1.11.2 --json
cub installer setup --pull packages/longhorn/longhorn/1.11.2 --base default --work-dir .tmp/confighub-proof/longhorn-default --non-interactive --namespace longhorn-system
cub installer render --work-dir .tmp/confighub-proof/longhorn-default
cub installer package packages/longhorn/longhorn/1.11.2 -o .tmp/confighub-proof/longhorn-archives/longhorn-a.tgz
cub installer upload --work-dir .tmp/confighub-proof/longhorn-default --space helm-longhorn-confighub-proof --component Longhorn --layer App --environment Demo --owner ConfigHubHelm --variant default --unit-label Component=Longhorn --unit-label HelmChart=longhorn-longhorn --unit-label HelmChartVersion=1.11.2 --unit-label Variant=default --unit-label Proof=longhorn-confighub-proof --retry
cub installer plan --work-dir .tmp/confighub-proof/longhorn-default
cub variant create staging helm-longhorn-confighub-proof --environment Staging --region local --namespace longhorn-system --space-pattern template:{{.Labels.Component}}-{{.Labels.Variant}} --allow-exists --wait --timeout 10m
cub unit list --space helm-longhorn-confighub-proof --where "Labels.Proof = 'longhorn-confighub-proof'"
cub function vet vet-format --space helm-longhorn-confighub-proof --where "Labels.Proof = 'longhorn-confighub-proof'"
cub unit apply --space helm-longhorn-confighub-proof --where "Labels.Proof = 'longhorn-confighub-proof'" --dry-run
```

## Result

```text
rendered objects: 42
separated secrets: 0
ConfigHub Units: 43
Kubernetes Units: 42
installer record Units: 1
staging clone Units: 43
function scan: pass
safe ops: pass
```
