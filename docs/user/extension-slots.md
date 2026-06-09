# Extension Slots

**UNOFFICIAL/EXPERIMENTAL**

Some Helm charts expose values that let users inject extra configuration,
template snippets, sidecars, raw Kubernetes objects, or application-specific
config files. This project calls those values extension slots.

Examples include:

```text
serverBlock
extraDeploy
extraObjects
sidecars
extraVolumes
extraScrapeConfigs
dashboards
tpl-powered values
raw manifests
```

Extension slots are useful because they make charts flexible. They are also
where a simple install can stop being simple. A filled extension slot can change
the rendered object set, add security risk, alter lifecycle behavior, or make a
variant depend on target facts that were not needed before.

## Current Coverage

The generated extension-slot report currently finds:

```text
13/20 top-20 catalog charts with explicit extension-slot control points
82/100 top-100 chart facts with extension slots surfaced
254/500 top-500 source rows using raw or extra manifest values
363/500 top-500 source rows using tpl or raw/extra manifest values
```

Use the generated report for the exact chart list:

[Extension Slot Coverage](../../data/extension-slots/summary.md)

The CSV is:

[extension-slots.csv](../../data/extension-slots/extension-slots.csv)

## How To Use Them

Use the supported catalog base when the extension slot is empty, disabled, or
already part of the reviewed base.

Create a new `cub installer` base variant when you fill an extension slot that
changes rendered Kubernetes objects or application configuration.

Examples:

```text
add NGINX serverBlock text
add Prometheus extra scrape config
add Grafana dashboard sidecars
add Loki extra objects
add Vault extra volumes or sidecars
add raw manifests through extraDeploy
```

The new base should have its own rendered objects, render parity, scan/gate
results, and receipts.

Use a derived ConfigHub variant only when the rendered object set is already
reviewed and the change is operational metadata.

Examples:

```text
target
region
environment
labels
approval policy
observation policy
approved resource patch
approved image patch
```

This keeps the rule simple:

```text
Extension slot changes that affect render output go through cub installer.
Post-render operational changes go through ConfigHub variants.
```

## NGINX Example

NGINX is the clearest example because the chart exposes config-file slots such
as `serverBlock`, `streamServerBlock`, and `extraDeploy`.

The current supported NGINX bases keep those slots empty or disabled. A custom
NGINX config file should become a new reviewed base variant, not an invisible
edit to an existing base.

Read the worked NGINX guide here:

[NGINX Configuration Files](./nginx-configuration-files.md)
