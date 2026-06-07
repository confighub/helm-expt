# Direct Cub Helm Model

This note explains where the current `cub helm template` and `cub helm install`
commands fit in the Helm experiment.

They are real and useful commands. They are not the maintained catalog recipe
path by themselves.

## Command Roles

| Command | Role | Use it when |
| --- | --- | --- |
| `cub helm template` | Local Helm renderer. It renders a chart to stdout or local files and does not require a ConfigHub server connection. | You want quick local inspection, a baseline for comparison, or the first input to recipe analysis. |
| `cub helm install` | Direct Helm-to-ConfigHub action. It renders a chart and creates ConfigHub Units. | You want a one-shot ConfigHub load from a chart, values, and flags. |
| `cub installer` package path | Maintained catalog path. It renders from a reviewed recipe/package with named bases, receipts, scans, upload/publish evidence, and live checks. | You want repeatable, supportable, variant-aware Helm-derived configs. |

## Direct Render

```sh
cub helm template redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis \
  --output-dir out/redis
```

This path is deliberately low ceremony:

```text
chart + values + flags
-> rendered YAML
```

It is the right first tool for:

- seeing what a chart produces;
- creating a regular Helm baseline;
- debugging values;
- checking CRD/resource split;
- feeding a future import/analyze workflow.

It does not create a reusable recipe, base variant, package, scan receipt,
upload receipt, or maintenance record.

## Direct Install

```sh
cub helm install redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis
```

This path creates a quick ConfigHub representation:

```text
Helm chart
-> rendered YAML
-> ConfigHub Units
```

It is a good fast path when the user wants to get a chart into ConfigHub now.
It should stay simpler than the catalog path.

It does not, by itself, answer the maintained-catalog questions:

- Which base variants are supported?
- Which values, facts, capabilities, hooks, CRDs, and secrets were reviewed?
- Is the output equivalent to regular Helm under recorded inputs?
- Which scans, gates, promotion rules, live checks, and receipts apply?
- How will future chart versions and old-version patches be maintained?

## Maintained Catalog Path

```text
chart + values + flags
-> cub helm template baseline
-> recipe analysis
-> cub installer recipe/package
-> named base variants
-> rendered objects
-> Helm-equivalence receipts
-> scans, gates, upload/publish receipts, live evidence
```

The product bridge we want is:

```text
cub installer import helm
```

That command should graduate a direct Helm render or install into a maintained
recipe/package candidate. Until that product surface exists, helm-expt uses
repo generators and proof scripts to build and verify the same artifact chain.

## Current Redis Compatibility Check

Use these commands to reproduce the current Redis `cub installer` compatibility
check:

```sh
go install sigs.k8s.io/kustomize/kustomize/v5@v5.8.1
export PATH="$PATH:$(go env GOPATH)/bin"
cub plugin install confighub/installer --source-repo --name installer --force
make -C ~/.confighub/plugins/installer build

export REDIS_PACKAGE=./packages/bitnami/redis/25.5.3
export WORK_DIR=/tmp/confighub-helm-redis

cub installer doc "$REDIS_PACKAGE"
cub installer setup \
  --pull "$REDIS_PACKAGE" \
  --work-dir "$WORK_DIR" \
  --non-interactive \
  --namespace redis

npm run redis:compare
```

The comparison verifies the `cub installer` output against the regular Helm
baseline and explains the intentional Namespace support object.
