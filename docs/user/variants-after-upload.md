# After Upload: Create A Variant And Promote Changes

**UNOFFICIAL/EXPERIMENTAL.** The upload and variant flow has a committed live
receipt. The commands on this page were also checked against `cub` v0.2.9 on
2026-08-02.

You ran a base variant's `confighub.sh` (or `cub installer upload` yourself). Your rendered chart objects now live in a ConfigHub Space as Units. This page is the next step: make an environment version of that Space, change it safely, and pull reviewed base changes forward when the base moves.

## The whole chain, with the variants labeled

Variants appear at two levels, and they meet here:

```text
chart -> base variant (chosen with --base) -> OCI package
      -> upload -> base Space
      -> derived variants (staging, production) -> promote
```

A **base variant** is a named way to render the chart's recipe, such as default, no-crds, or reuse-existing-secret; `--base` picks it. A **derived variant** is a ConfigHub Space cloned from your uploaded base for an environment. It never re-renders Helm.

Keep the two kinds of variants separate. The package is chosen and rendered
before upload. `cub installer upload` stores the rendered Kubernetes objects
and an untargeted `installer-record` Unit. The source package, chart, and
templates remain in the package OCI; ConfigHub does not rerender them.

## Choose The Right Kind Of Variant

- If a change alters what Helm renders (HA mode, CRDs on or off, a different Secret strategy), that is a different base variant. Go back to the chart page and pick it with `--base`.
- If the rendered objects are right but need to live somewhere else (another environment, region, namespace, labels, or gates), that is a derived variant. Nothing re-renders.

Why this matters: the base you reviewed stays one thing. Each environment
difference becomes a recorded ConfigHub change that you can compare and
promote, instead of hiding in a values-file fork.

## How To Tell What Set A Field

- Open the base Space's `installer-record` Unit to see which package was
  uploaded. Catalog demo Spaces may also contain `readme` and render-intent
  Units that explain the chart, values profile, and required setup.
- Open the package's Helm render-intent record to see which Helm values and
  render settings produced the starting objects.
- Open the Kubernetes Unit's revision history for changes made in ConfigHub.
- Open the derived Space's upstream link to see which base it started from.
- Treat a value seen only in the live cluster as drift until the team records
  it as an intended revision or removes it.

If a new base render and a local ConfigHub revision change the same field,
review that overlap before promotion. The full rule and the chart-page view are
in [Helm Chart Presets And Values](./helm-presets-and-values.md#where-each-setting-lives).

## What you have after upload

One Space holding your rendered objects as Units, one Unit per manifest, plus
the untargeted `installer-record` Unit. See them:

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

This prints how many Units would be upgraded and how many would be added from
upstream since the clone. Nothing re-renders. To see the proposed field
changes, add the mutations output:

```text
cub variant promote my-redis-prod --dry-run -o mutations
```

Use the plain `--dry-run` when you only need the summary.

Then promote:

```text
cub variant promote my-redis-prod --change-desc "Pull the reviewed base forward"
```

Validation triggers run on the changed Units. A failing check attaches an
apply gate; fix the data or the rule rather than working around the gate.
Recorded variant changes remain when they do not overlap the new base. If the
base and the variant changed the same field, review that overlap before
promotion.

## Step 4: Deliver, verify, roll back

- Deliver: apply the Space to its Target, or let the Argo or Flux you already run pull it from ConfigHub's OCI endpoint. The [GitOps adopter guide](./gitops-adopter-guide.md) and [serverless mode notes](./serverless-mode.md) cover both shapes.
- Verify: the chart page's evidence links show what the catalog itself checks after apply.
- Roll back: every promotion is ordinary revisions. Restore the before state and apply again; the product docs cover `--restore` forms.

## Honest boundaries

- Only Spaces created by `cub variant create` can be promoted with `cub variant promote`. It follows the upstream link recorded at create time; a Space made any other way has no such link.
- Rendered Secrets are not uploaded. Stage them out of band; the base variant's `try.sh` and chart page record what each base variant needs.
- `cub variant upload` also exists, as a general way to seed a base Space from any rendered manifests. The catalog path uses `cub installer upload`, which additionally records the package.
- The committed proof for this flow is in the promotion receipts linked from
  the [master catalog matrix](../../data/master-catalog-matrix/summary.md). This
  guide explains the commands behind those receipts.
