---
name: config-workshop
description: Use when investigating, comparing, checking, packaging, or retaining Kubernetes configuration from Helm, cub installer, Timoni, AICR, Kubara, OCI, YAML, or ConfigHub. Resolve exact versions and digests, inspect materialized objects and lifecycle work, state which checks ran, and produce a reviewed result without applying to a cluster unless the user explicitly asks.
license: Apache-2.0
metadata:
  author: ConfigHub
  version: "0.1.0"
---

# Config Workshop

Use Config Workshop to answer a practical configuration question with exact
objects and evidence. Do not turn an inspection request into a deployment.

## Start With The User's Question

Choose one task:

1. **Find a known answer:** resolve an exact Catalog component and version.
2. **Check my config:** inspect the user's chart, values, YAML, or OCI and
   compare it with defaults, a Catalog configuration, or another object set.
3. **Promote my config:** compare current and proposed objects, identify
   lifecycle and destination work, and state what must run before promotion.
4. **Keep the result:** retain the accepted objects as files, OCI, or a
   ConfigHub base or variant only when the user asks.

Read [references/processing-model.md](references/processing-model.md) when the
source is not plain rendered YAML or when lifecycle behavior matters. Read
[references/task-playbook.md](references/task-playbook.md) for machine
endpoints, commands, and the required result format.

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

1. Query `site/base-variant-records.json` or its published endpoint for the
   exact source, version, and base. Do not silently substitute latest.
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

For shared local misconfiguration checks, install the released check plugin and
run it against the materialized files:

```sh
cub plugin install confighub/homebrew-tap@cub-scan-v0.7.0 --name scan
cub check --format json --output cub-check.json ./rendered
```

Keep `cub-check.json` with the object-set digest. This is advisory evidence. It
does not authorize an apply or replace destination, admission, lifecycle,
runtime, upgrade, rollback, or live-state checks.

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
