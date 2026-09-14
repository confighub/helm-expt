# Task playbook

## Public machine endpoints

- Per-listing record, one `CatalogListing` shape for every format:
  `https://confighub.github.io/helm-expt/site/listings/<listing-id>.json`,
  indexed by `https://confighub.github.io/helm-expt/site/listings/index.json`
  and shaped by `https://confighub.github.io/helm-expt/site/listing.schema.json`.
  Look for it first; fall back to the change feed and base records below when
  it is not there for the listing you need.
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

1. Look for `site/listings/<listing-id>.json` first, indexed by
   `site/listings/index.json` and shaped by `site/listing.schema.json`, one
   `CatalogListing` shape for every format. Fall back to
   `base-variant-records.json` for the exact source, version, and base when
   it is not there. Do not silently substitute latest.
2. For Helm and cub installer packages, use `changes.json` to find the chart
   page and immutable package reference.
3. Choose a base for the user's actual purpose; do not assume `default` is the
   safest base.
4. Follow the source record, rendered object inventory, lifecycle records, and
   evidence links.
5. State what is checked and what remains target-dependent.

Query one entry instead of opening the complete indexes:

```sh
# find one chart-and-version row in the change feed
jq --arg name 'bitnami/redis' --arg version '25.5.3' \
  '.entries[] | select(.chart == $name and .version == $version)' site/changes.json

# find the matching source-neutral base record
jq --arg name 'bitnami/redis' --arg version '25.5.3' --arg base 'reuse-existing-secret' \
  '.records[] | select(.spec.source.name == $name and .spec.source.version == $version and .spec.baseVariant.name == $base)' \
  site/base-variant-records.json
```

Before using a linked receipt, read its chart or source, version, base, digest,
and result. Ignore a receipt whose internal identity does not match the question,
even when another record links to it, and report the stale pointer.

## Known questions

Match the user's wording to one of these before starting fresh work, then
answer directly from its record and say which question matched. The question
and recommendation columns come from `scripts/lib/configuration-questions.mjs`,
the same record `site/ask.html` renders as `configuration-question-data`; do
not restate them from memory once a newer answer is recorded there.

| Known question | Current recommendation | Guide | Command |
| --- | --- | --- | --- |
| AI wrote these values. What did they actually change? | Review the exact object diff, correct the values or rendered objects, and retain the accepted result. | workshop-helm-questions-guide.md, question 10 | `cub config diff <a> <b> --json --exit-code --out <new-file>.json` |
| I set a value. Why did the rendered object not change? | Use the chart's effective value path, or treat the requirement as a reviewed post-render change when the chart does not expose it. | workshop-values-guide.md | `cub config diff <a> <b> --json --exit-code --out <new-file>.json` |
| Can I upgrade this chart without breaking production? | Test the candidate against the retained current configuration, then promote it through a limited environment or rollout wave. | workshop-upgrade-guide.md | `cub config diff <a> <b> --json --exit-code --out <new-file>.json` |
| The chart does not expose the field I need. Must I fork it? | Keep the chart when possible and record the smallest object-level change as a derived configuration. | workshop-field-restore-guide.md | `cub config diff <a> <b> --json --exit-code --out <new-file>.json` |
| How should Argo CD or Flux handle this chart's hooks and CRDs? | Choose an explicit owner and order for every prerequisite and lifecycle action before delivery. | workshop-lifecycle-guide.md | `cub config diff <a> <b> --json --out <new-file>.json` for the hooks; `cub stack certify ./<dir>/stack.yaml --json > <new-file>.json` for the CRDs |
| Can I roll back to exactly what ran before? | Restore a retained object set or OCI digest, and handle external state with its own recovery plan. | workshop-helm-questions-guide.md, question 8 | none; answer from the record |
| How is this candidate different from production? | Review and approve the exact desired-config diff, then check live state separately after delivery. | workshop-adapt-guide.md | `cub config diff <a> <b> --json --exit-code --out <new-file>.json` |
| Where does this vulnerable image run, and how can I update it safely? | Use ConfigHub or another complete estate inventory to scope the change, then test and roll it out in controlled waves. | none; this needs a fleet-wide search, past the doorway | none; answer from the record |
| What will this install, and what must already exist? | Provide or route every prerequisite, then deliver only the reviewed object set. | workshop-helm-questions-guide.md, question 1. For a Timoni module, workshop-timoni-guide.md, question 1 | `cub config check <name \| local.yaml>` |
| Do these version and digest records identify the same bytes? | Use an immutable digest for the reviewed input and retain the source record with the result. | none; use the digest comparison in Known Catalog configuration above. For a Timoni module, workshop-timoni-guide.md, question 5 | none; answer from the record |

Four separate assessment questions stay apart even after a known question
matches. Ask what the user has, what it will produce, whether the named
destination can accept it, and whether it worked. A Catalog match is useful
for comparison but is not required. A missing destination or deployment is
`not run` or `blocked`, not a failed configuration.

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

## Call `cub` and the workshop plugin

The three known-question entry jobs (need a configuration, check a
configuration, promote a configuration) map to one released command
sequence, proved end to end for a Helm example and a literal Kubernetes YAML
example in `data/config-workshop-command-contract/`.

| Stage | Status | Example command |
| --- | --- | --- |
| select | real work | `cub installer inspect oci://<package-ref> --json` |
| materialize | real work for Helm, recorded no-op for already-rendered YAML | `cub helm template nginx nginx --repo https://charts.bitnami.com/bitnami --version 24.0.2 --namespace nginx --values reviewed-values.yaml --output-dir ./rendered` |
| check | local advisory | `cub check --format json --output cub-check.json ./rendered` |
| record | machine-readable | `node scripts/create-config-workshop-result.mjs --candidate ./rendered --cub-check cub-check.json --output workshop-result.json` |
| retain | managed, dry-run first | `cub variant upload --dry-run --component <name> --variant <name> --space <space> ./rendered` |
| vary | proved | `cub variant create staging <space> --space-pattern template:<pattern> --environment Staging` |
| promote | proved, preview only | `cub variant promote <staging-space> --dry-run -o mutations` |
| release | requires a release target and gates | `cub release publish <space>` |

See `data/config-workshop-command-contract/command-map.json` and
`summary.md` for the complete generated commands, both examples, and their
statuses. Run `npm run workshop:commands:run-local` to execute the released
Helm and `cub check` commands in a temporary directory and compare the
resulting object set with this committed record.

The cub-workshop plugin adds its own verbs, each proved on a Guide or a
generated site page:

| Verb | What it proves | Proved in |
| --- | --- | --- |
| `cub config diff` | exact field-level comparison between two local files | Adapt, Field-Restore, Lifecycle, Upgrade, and Values Guides |
| `cub app match` | a workload model compared with a supplied target snapshot | Match Guide |
| `cub app check` | a workload's declared needs | `site/apps.html` |
| `cub stack certify` | CERTIFIED or REJECTED for a composed stack before anything runs | Compose and Lifecycle Guides |
| `cub stack sandbox` | the composed stack's materialized result | Compose and Lifecycle Guides |
| `cub fleet up` | lands a certified result on a target | requires the doorway and an org |

## Report a refusal exactly as printed

`cub stack certify`, `cub config diff --exit-code`, and `cub app match --json`
can refuse or disagree instead of failing to run. Quote `certified: false`,
`status: "mismatch"`, `status: "unknown"`, and the exit code exactly as
printed. A nonzero mismatch or unknown result is an expected finding, not an
error; never report it as success.

Keep the refusal JSON and the failed workspace. Recover in a separate copy
with new output filenames, for example `cp -R incompatible recovered` before
fixing anything. Never repair the failed workspace in place, and never call a
static recovery a live recovery.

## Follow a Guide

Every Guide lives under `docs/user` and names its assistant-task section
differently; open the Guide and jump to its own anchor instead of guessing
the wording.

| Guide | File | Assistant-task anchor |
| --- | --- | --- |
| Adapt a configuration and inspect the exact edit | workshop-adapt-guide.md | #a-task-for-an-ai-assistant |
| Compose and review a local workshop stack | workshop-compose-guide.md | #a-task-for-an-ai-assistant |
| Match a GPU workload with supplied facts | workshop-match-guide.md | #a-task-for-an-ai-assistant |
| Review a chart upgrade before promoting it | workshop-upgrade-guide.md | #a-task-for-an-assistant |
| Find the hook and CRD work before delivery | workshop-lifecycle-guide.md | #a-task-for-an-assistant |
| Add one field and keep the original configuration | workshop-field-restore-guide.md | #give-the-same-task-to-an-assistant |
| Find why a Helm value did not change the output | workshop-values-guide.md | #ask-an-assistant-to-investigate |
| Answer the ten questions Helm users ask | workshop-helm-questions-guide.md | #give-an-assistant-the-whole-path |
| Answer the questions Timoni users ask | workshop-timoni-guide.md | #give-an-assistant-the-whole-timoni-path |
| Answer the questions plain Kubernetes YAML users ask | workshop-yaml-guide.md | #give-an-assistant-the-whole-yaml-path |
| Answer the questions AICR users ask | workshop-aicr-guide.md | #give-an-assistant-the-whole-aicr-path |
| Answer the questions Kubara users ask | workshop-kubara-guide.md | #give-an-assistant-the-whole-kubara-path |
| Render your own chart to exact objects, adapt them as data, and keep them | workshop-byo-charts-guide.md | #give-an-assistant-the-whole-path |

The Adapt Guide's Prerequisites And Setup section is the canonical
cub-workshop plugin install; every other Guide points back to it and names
the plugin version and pinned revision it was tested against. Read that
section for the current pin instead of caching a version number here, so
this playbook cannot drift out of sync with the Guide it points to.

Run the assistant task, or the Guide's own numbered steps, with the user
present. Read the Guide's finish section to the user before calling the job
done. Every Guide states plainly what its local result does not prove; carry
that limit into your own recommendation instead of dropping it.

## Shared local checks

After a source has produced Kubernetes YAML, run the shared checker locally:

```sh
# install the shared scan plugin once
cub plugin install confighub/homebrew-tap@cub-scan-v0.7.3 --name scan
# run it against materialized objects
cub check --format json --output cub-check.json ./rendered
```

The plugin uses the same scanner engine and pinned pattern bundle as the
standalone `cub-scan` command. Keep the JSON result with the exact object-set
digest. It is advisory and does not apply files, authorize a ConfigHub change,
or prove target-specific behavior.

After composing `workshop-result.json`, create a local CI or pull-request report:

```sh
# turn a recorded WorkshopResult into a bounded CI or PR report
npm run workshop:ci-report -- --input workshop-result.json --output comment.md
```

Use `--format json` for machine consumption. Keep the result's object-set hash,
checks not run, and destination/runtime limits unchanged.

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
