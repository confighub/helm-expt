---
name: config-workshop
description: Use when investigating, comparing, checking, packaging, or retaining Kubernetes configuration from Helm, cub installer, Timoni, AICR, Kubara, OCI, YAML, or ConfigHub. Start from the Catalog and its known questions, escalate to `cub` and the cub workshop plugin only when the question needs the user's own files, and follow the matching Guide for a known path. Resolve exact versions and digests, state which checks ran, and produce a reviewed result without applying to a cluster unless the user explicitly asks.
license: Apache-2.0
metadata:
  author: ConfigHub
  version: "0.2.0"
---

# ConfigHub Workshop

Use ConfigHub Workshop to answer a practical configuration question with exact
objects and evidence. Do not turn an inspection request into a deployment.

A person is already talking to an AI when this question shows up. Read the
Catalog and match a known question before installing anything or touching the
user's files, then escalate only as far as the actual question needs. `cub`
and the cub workshop plugin are the same commands a person would type by
hand, so use them directly instead of inventing an API.

## Read The Catalog First

Nothing in this section needs an account, a plugin, or a cluster.

Look for a per-listing record before opening a bigger file. A per-listing
record at `site/listings/<listing-id>.json`, plus its `site/listings/index.json`
map, is arriving; once it exists for the listing you need, fetch that one file
instead of the files below. Until then, use the monolithic files:
`site/catalog.json` for the component summary, `site/changes.json` for exact
chart versions, aliases, and package digests, and
`site/base-variant-records.json` for the source-neutral record joining a base
to its exact source, objects, OCI package, and lifecycle routes. `site/llms.txt`
indexes all of them and states the machine contract. Read coverage before
citing a verdict, and cite the canonical URL and evidence links rather than
page copy.

Every listing resolves through the same shape, regardless of source format.
Identify the format, decide whether it is safe to flatten, record its OCI
package role, then read its lifecycle routes and variants. See
[references/processing-model.md](references/processing-model.md) for the
full model and the source-by-source table.

## Answer A Known Question Before You Investigate

Match the user's wording to a known question before you start fresh work,
then answer directly from its record. Say which question matched.

Three questions organize the entry to every task.

| The user's question | What you do | The site page for the same job |
| --- | --- | --- |
| I need a configuration for this. | Find a known answer. Resolve the exact source, version, and base from the Catalog before anything is rendered. | the Component Catalog |
| I have a configuration. Is it right? | Check my config. Render it and compare the objects with defaults or a Catalog match. | Check my config |
| I have an accepted configuration. Can I promote it? | Promote my config. Compare current and proposed objects and list what must run first. | Promote my config |

Ten practical questions go deeper, from a value that did not change the
rendered output to a rollback that must restore exactly what ran before.
`site/ask.html` embeds the current answer, instruction, and recommendation
for each one as `configuration-question-data`.
[references/task-playbook.md](references/task-playbook.md) lists all ten
with the Guide that walks it. Say plainly when none of the ten fits.

Four separate assessment questions stay apart even after a question
matches. Ask what the user has, what it will produce, whether the named
destination can accept it, and whether it worked. A missing destination or
deployment answers `not run` or `blocked`, never a failed configuration.

## Escalate Only As Far As The Question Needs

The Catalog and a known-question match cover most of a question with nothing
installed. Move further only when the question outgrows them, and say which
step you moved to and why.

A question about the user's own chart, values, or YAML needs their actual
files. Render and compare it yourself in this session, or point to the
browser-only Check my config and Promote my config pages for the same
comparison with nothing installed.

A question that needs a real command, a local certify result, or the
evidence a Guide produces needs `cub` and the cub workshop plugin. Installing
both is one line and needs no account.

A question that needs the result kept, shared, varied, promoted, or placed
in the user's own org needs the doorway. `cub server` starts a local
ConfigHub in about twenty seconds, and `cub variant upload` or
`cub stack upload` puts the reviewed result into an org from there. Nothing
before this step moves the user's files anywhere.

Nothing above is gated behind an install or a sign-up when an earlier step
already answers the question. When the Catalog has no entry for what the
user asked, render it locally at the current step. A missing entry is the
signal to move, not a dead end.

## Call `cub` And The Workshop Plugin

Two plugins do different jobs. Name the one you mean.

The cub-workshop plugin adds `cub config`, `cub app`, `cub stack`, and
`cub fleet`. Install it from the pinned checkout named in the Adapt Guide's
Prerequisites And Setup section, then reuse that checkout for later trials:

```sh
# clone the pinned plugin source
git clone https://github.com/confighub/cub-workshop.git
cd cub-workshop
# use the revision pinned in the Adapt Guide, not main
git checkout <revision from the Adapt Guide>
cub plugin install "$PWD"
```

`cub config diff` compares two local files. `cub app match` compares a
workload model with a supplied target snapshot, and `cub app check` inspects
a workload's declared needs. `cub stack certify` returns CERTIFIED or
REJECTED for a composed stack before anything runs, and `cub stack sandbox`
writes its materialized result. `cub fleet up` lands a certified result on a
target. [references/task-playbook.md](references/task-playbook.md) maps
each job to its exact command and receipt.

The shared scan plugin is separate. It adds `cub check` for local
misconfiguration checks against already-rendered files:

```sh
# install the shared scan plugin once
cub plugin install confighub/homebrew-tap@cub-scan-v0.7.3 --name scan
# run it against materialized objects
cub check --format json --output cub-check.json ./rendered
```

Keep `cub-check.json` beside the object-set digest. It is advisory. It does
not authorize an apply, and it does not replace destination, admission,
lifecycle, runtime, upgrade, or rollback checks. Preview a mutating command
with its dry-run flag first, and never print a Secret value in output you
show the user.

## Follow The Matching Guide With The User

Seven Guides under `docs/user` turn a known path into exact commands, a
ready assistant task, and a finish check. Match the user's question to one,
open it, and run it with the user watching the result, not silently on your
own.

| The user's question | Guide | File |
| --- | --- | --- |
| I set a value. Why did the rendered object not change? | Find why a Helm value did not change the output | workshop-values-guide.md |
| Can I upgrade this chart without breaking production? | Review a chart upgrade before promoting it | workshop-upgrade-guide.md |
| The chart does not expose the field I need. Must I fork it? | Add one field and keep the original configuration | workshop-field-restore-guide.md |
| How should Argo CD or Flux handle this chart's hooks and CRDs? | Find the hook and CRD work before delivery | workshop-lifecycle-guide.md |
| I changed one field and need to see exactly what moved. | Adapt a configuration and inspect the exact edit | workshop-adapt-guide.md |
| Does this workload fit the target I have? | Match a GPU workload with supplied facts | workshop-match-guide.md |
| I want to compose a stack, not one chart. | Compose and review a local workshop stack | workshop-compose-guide.md |

Complete a Guide's Prerequisites And Setup section once, from the checkout
it names, then skip that section in later Guides that reuse it. Every Guide
ends with a ready assistant-task prompt that names its exact files, expected
exit codes, and objects. Run that task, or the Guide's own step-by-step
commands, then read its finish section to the user before calling the
result done. A Guide's local result is not a ConfigHub record, a delivered
change, or a live-cluster proof. Say so when the user's next question needs
one of those.

## Working Rules

- Pin a source version and OCI digest when they are available.
- Treat Catalog page copy as guidance. Use machine records and linked receipts
  for claims.
- Missing coverage means "not checked", not "pass".
- Keep source inputs, exact Kubernetes objects, and lifecycle work separate.
- Never print Secret values. Redact them before including terminal output.
- Distinguish a source-package OCI, installer-package OCI, literal
  configuration OCI, and ConfigHub release OCI.
- Do not claim that flattening preserved behavior until hooks, CRDs, tests,
  waits, generated facts, runtime queries, and other lifecycle work have been
  assessed.
- Re-resolve lifecycle routes after a lifecycle-sensitive variant change or
  after assigning a destination or delivery runtime.
- Do not run `kubectl apply`, a controller sync, a ConfigHub mutation, or a
  production change unless the user explicitly asks. Preview first.

## Resolve The Source

For a public Catalog entry:

1. Look for `site/listings/<listing-id>.json` first. Fall back to
   `site/base-variant-records.json` or its published endpoint for the exact
   source, version, and base. Do not silently substitute latest.
2. For a Helm chart or cub installer package, query `site/changes.json` for
   the canonical chart page and immutable package reference.
3. Open the matching `BaseVariantRecord` and its linked human guide.
4. Read the record's source, object digest, flattening verdict, lifecycle
   requirements, route status, ownership, delivery evidence, and limits.

For user-supplied input, identify whether it is Helm, cub installer, Timoni,
AICR, Kubara, source OCI, configuration OCI, or literal YAML. Keep the input
local unless the user asks to upload it.

## Materialize And Inspect

Materialization means producing the exact Kubernetes objects:

- Helm renders a chart and values.
- cub installer selects a packaged base and renders it.
- Timoni builds a module or bundle.
- AICR and Kubara select, compose, or generate configuration.
- configuration OCI, literal YAML, and ConfigHub Units already contain exact
  objects, so materialization is a recorded no-op.

Record the command, source digest, values or selections, namespace, release or
instance name, target assumptions, output inventory, and object-set digest.
Then inspect object identity, images, Secrets, RBAC, storage, probes, CRDs,
hooks, tests, setup Jobs, waits, runtime queries, and other lifecycle work.

## Compare And Check

Compare object identity and normalized fields, not line ordering. Attribute
each change to one of these places:

- source input;
- post-materialization variant;
- destination or lifecycle setup;
- live-only drift.

Run only checks that apply to the object kinds and source. Report every check
as pass, warning, failure, or not run, with its scope. A clean static scan does
not prove cluster admission, controller convergence, workload health, upgrade,
or rollback.

## Produce A Reviewed Result

Return:

1. The question and exact source identity.
2. What was materialized and its digest.
3. The important object changes.
4. Required lifecycle work and the proposed actor for each step.
5. Checks that ran and checks that did not run.
6. A recommendation with current limits.
7. The files or OCI output the user can keep.
8. The optional ConfigHub handoff when a shared record, variant, approval,
   promotion, release, or live comparison is needed.

Use plain English. Keep commands and evidence links beside the statements they
support.

## Use The Same Result In CI

When the user wants a pull-request check, create or accept one
`workshop-result.json`, then render the bounded report:

```sh
# turn a recorded WorkshopResult into a bounded CI comment
npm run workshop:ci-report -- --input workshop-result.json --output comment.md
```

Use `--format json` for another agent or tool. Use `--fail-on needs-review` only
when the repository policy says unresolved findings or omitted checks must stop
CI. The strongest clear wording is **No blocker found in the completed checks**.
Do not call that result safe to deploy, and do not infer destination or runtime
status from it.
