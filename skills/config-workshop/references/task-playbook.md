# Task playbook

## Public machine endpoints

- Catalog summary: `https://confighub.github.io/helm-expt/site/catalog.json`
- Versioned change feed: `https://confighub.github.io/helm-expt/site/changes.json`
- Source-neutral base records:
  `https://confighub.github.io/helm-expt/site/base-variant-records.json`
- Agent index: `https://confighub.github.io/helm-expt/site/llms.txt`
- Check my config: `https://confighub.github.io/helm-expt/site/ask.html`
- Promote my config: `https://confighub.github.io/helm-expt/site/promote.html`

Inside a checkout, prefer the corresponding files under `site/`, `data/`,
`recipes/`, and `runs/` so the exact committed evidence is available.

## Known Catalog configuration

1. Resolve the exact source, version, and base in `base-variant-records.json`.
2. For Helm and cub installer packages, use `changes.json` to find the chart
   page and immutable package reference.
3. Choose a base for the user's actual purpose; do not assume `default` is the
   safest base.
4. Follow the source record, rendered object inventory, lifecycle records, and
   evidence links.
5. State what is checked and what remains target-dependent.

Query one entry instead of opening the complete indexes:

```sh
jq --arg name 'bitnami/redis' --arg version '25.5.3' \
  '.entries[] | select(.chart == $name and .version == $version)' site/changes.json

jq --arg name 'bitnami/redis' --arg version '25.5.3' --arg base 'reuse-existing-secret' \
  '.records[] | select(.spec.source.name == $name and .spec.source.version == $version and .spec.baseVariant.name == $base)' \
  site/base-variant-records.json
```

Before using a linked receipt, read its chart or source, version, base, digest,
and result. Ignore a receipt whose internal identity does not match the question,
even when another record links to it, and report the stale pointer.

## User-owned configuration

Keep private files local. For Helm, render with the chart version, values,
namespace, release name, and capabilities recorded. For literal YAML, use the
browser-local Check flow or local parsers. For OCI, pull by digest and first
identify whether it contains source material or exact Kubernetes objects.

Compare with:

- the source defaults;
- a relevant Catalog base;
- the user's current environment, when supplied;
- the proposed destination, when supplied.

## Shared local checks

After a source has produced Kubernetes YAML, run the shared checker locally:

```sh
cub plugin install confighub/homebrew-tap@cub-scan-v0.7.1 --name scan
cub check --format json --output cub-check.json ./rendered
```

The plugin uses the same scanner engine and pinned pattern bundle as the
standalone `cub-scan` command. Keep the JSON result with the exact object-set
digest. It is advisory and does not apply files, authorize a ConfigHub change,
or prove target-specific behavior.

## Promotion review

Require both current and proposed object sets. Report:

- object additions, removals, and field changes;
- source-controlled and variant-controlled fields;
- lifecycle work that changed;
- destination facts needed before staging;
- static, admission, controller, runtime, rollback, and observation checks;
- checks that have not run.

Do not call a comparison a promotion until the accepted result is retained with
its source digest, object digest, destination, checks, and decision.

## Result format

```text
Question:
Source:
Materialized result:
Important changes:
Lifecycle work:
Checks run:
Checks not run:
Recommendation:
Result to keep:
Optional ConfigHub handoff:
```

For ConfigHub, retain reviewed exact objects as a base or derived variant.
Preview changes before mutation, require the appropriate policy gates, publish
the approved release OCI, and keep desired-versus-live observations separate.
An OCI publication is not lifecycle execution. Resolve required routes for the
chosen variant, destination, and controller before delivery.
