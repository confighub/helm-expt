# Legacy Patch Review

Old-version patches are valuable, but they must not become invisible bespoke
work. The catalog path needs a repeatable lane for them.

## Rule

Only a chart with explicit `catalog-supported` status can open a legacy patch
lane.

That keeps the promise honest:

```text
Do not sell old-version patches until the current supported recipe is itself
reviewed, variant-aware, scan-gated, and reproducible.
```

## Required Artifacts

For each old version we choose to support:

```text
old-version source lock
old-version dependency lock
old-version recipe
old-version variants
old-version rendered revision
patch diff against supported current version
scan/gate receipt
upgrade receipt
rollback receipt
support window and scope
```

## Commands

```sh
npm run legacy-patch:review
npm run legacy-patch:review:verify
```

The generated output lives at:

```text
data/legacy-patch-review/
```

The first open lane is Redis. The next action is to choose which old Redis
versions are worth paid patch support and generate the first old-version
upgrade/patch scenario.
