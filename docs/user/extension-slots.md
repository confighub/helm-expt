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

| User action | Route |
| --- | --- |
| Leave the extension slot empty, disabled, or already part of the reviewed base. | Use the supported catalog base. |
| Fill a slot that changes Kubernetes objects or application configuration. | Create a new `cub installer` base variant. |
| Change only target, region, environment, labels, gates, links, approval policy, observation policy, or another approved post-render field. | Use a derived ConfigHub variant after upload. |

Examples that create a new `cub installer` base:

| Example | Why |
| --- | --- |
| Add NGINX `serverBlock` text. | The application config inside the rendered workload changes. |
| Add Prometheus extra scrape config. | The monitoring behavior changes and needs its own rendered proof. |
| Add Grafana dashboard sidecars. | New sidecars or mounted config affect the workload shape. |
| Add Loki extra objects. | Raw object injection changes the rendered object set. |
| Add Vault extra volumes or sidecars. | Pod shape and security review change. |
| Add raw manifests through `extraDeploy`. | Arbitrary Kubernetes objects need scan/gate proof. |

The new base should have its own rendered objects, render parity, scan/gate
results, and receipts.

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
