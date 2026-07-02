# After Upload: Create A Variant And Promote Changes

**UNOFFICIAL/EXPERIMENTAL.** Commands on this page were verified against `cub <verb> --help` and a live end-to-end run (upload, two variants, base edit, promotions, cleanup) on 2026-07-02. The catalog's committed evidence for this flow is the master matrix's Promotion lane, which records server-side variant-promotion receipts per chart preset.

You ran a preset's `confighub.sh` (or `cub installer upload` yourself). Your rendered chart objects now live in a ConfigHub Space as Units. This page is the next step: make an environment version of that Space, change it safely, and pull reviewed base changes forward when the base moves.

## The whole chain, with the variants labeled

Variants appear at two levels, and they meet here:

```text
chart -> base variant (chosen with --base) -> OCI package
      -> upload -> base Space
      -> derived variants (staging, production) -> promote
```

A **base variant** is a preset: a named Helm render choice such as default, no-crds, or reuse-existing-secret. The chart page calls it a preset chart configuration; `--base` picks it. A **derived variant** is a ConfigHub Space cloned from your uploaded base for an environment. It never re-renders Helm.

One boundary keeps the two straight: the preset lives in the package and is chosen at render time, before upload. ConfigHub never sees the preset, only the rendered result, stored fully materialized. Templates stay outside; data lives inside.

## The one decision, restated

- If a change alters what Helm renders (HA mode, CRDs on or off, a different Secret strategy), that is a different base variant. Go back to the chart page and pick it with `--base`.
- If the rendered objects are right but need to live somewhere else (another environment, region, namespace, labels, or gates), that is a derived variant. Nothing re-renders.

Why this matters: the base you reviewed stays one thing. Every environment difference is explicit, diffable, and promotable, instead of hiding in a values-file fork.

## What you have after upload

One Space holding your rendered objects as Units, one Unit per manifest. See it:

```text
cub unit list --space helm-redis-default
```

Replace `helm-redis-default` with the Space your script printed. The upload also set the Space's well-known `Component` label from the package name.

## Step 1: Create an environment variant

```text
cub variant create prod helm-redis-default \
  --space-pattern "template:my-redis-prod" \
  --environment Prod \
  --namespace redis-prod \
  --unit-delete-gate prod-critical \
  --unit-destroy-gate prod-critical
```

What each part does, and why you want it:

| Part | What it does | Why |
| --- | --- | --- |
| `prod` | The variant name. It becomes the new Space's `Variant` label. | The environment difference gets a name instead of hiding in a fork. |
| `helm-redis-default` | The upstream Space to clone. | The variant records this upstream link. Promotion follows it later. |
| `--environment Prod` | Sets the `Environment` label on the new Space. | Fleet queries like "everything in Prod" work without parsing names. |
| `--namespace redis-prod` | Runs `set-namespace` on the cloned Units. | Each environment lands in its own namespace; the base stays neutral. |
| `--unit-delete-gate` / `--unit-destroy-gate` | Blocks delete and destroy of the cloned Units until the gate is removed. | Prod objects should not be one bulk command away from gone. Name the gate for the reason it exists. |

Name the new Space yourself with `--space-pattern` (for example `--space-pattern "template:my-redis-prod"`); in live testing, omitting it produced a server-derived slug like `<upstream>-<variant>-<Environment>`, which works but is long. Either way, confirm with `cub space list`. The clone copies the upstream Space's triggers and permissions along with the Units. Both the namespace rewrite and the gates were verified live: cloned Units carry the new namespace, and a gated Space refuses plain deletion until the gate is removed or overridden.

## Step 2: Change something in the variant

Edit Unit data with a ConfigHub function, not by re-rendering the chart:

```text
cub run set-replicas --replicas 3 --space my-redis-prod --unit <unit-slug> \
  --change-desc "Prod runs three replicas"
```

Every change is a recorded revision on that Unit, with the description you gave. The base Space is untouched.

## Step 3: When the base moves, preview then promote

The base Space changes when you upload a newer render of the chart or edit it. Your variant does not move by itself. First preview exactly what promotion would do:

```text
cub variant promote my-redis-prod --dry-run
```

This prints how many Units would be upgraded and how many would be added from upstream since the clone. Nothing re-renders. One honest note from live testing on 2026-07-02: `--dry-run -o mutations` currently prints nothing for `variant promote`, so use the plain `--dry-run` summary; to inspect exact data, read the Unit before and after with `cub unit get <unit> --space <space> --data-only`.

Then promote:

```text
cub variant promote my-redis-prod --change-desc "Pull the reviewed base forward"
```

Validation triggers run on the changed Units. A failing check attaches an apply gate; fix the data or the rule rather than working around the gate. Your variant's own changes (the replicas edit above) are preserved through the merge.

## Step 4: Deliver, verify, roll back

- Deliver: apply the Space to its Target, or let the Argo or Flux you already run pull it from ConfigHub's OCI endpoint. The [GitOps adopter guide](./gitops-adopter-guide.md) and [serverless mode notes](./serverless-mode.md) cover both shapes.
- Verify: the chart page's evidence links show what the catalog itself checks after apply.
- Roll back: every promotion is ordinary revisions. Restore the before state and apply again; the product docs cover `--restore` forms.

## Honest boundaries

- Only Spaces created by `cub variant create` can be promoted with `cub variant promote`. It follows the upstream link recorded at create time; a Space made any other way has no such link.
- Rendered Secrets are not uploaded. Stage them out of band; the preset's `try.sh` and chart page record what each preset needs.
- `cub variant upload` also exists, as a general way to seed a base Space from any rendered manifests. The catalog path uses `cub installer upload`, which additionally records the package.
- The committed proof for this flow is the [master catalog matrix](../../data/master-catalog-matrix/summary.md) Promotion lane per chart preset. This page is the user-facing walkthrough of the same mechanism, not a separate proof.
