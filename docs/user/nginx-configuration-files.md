# NGINX Configuration Files

**UNOFFICIAL/EXPERIMENTAL**

NGINX has its own configuration model: `nginx.conf`, optional files under
`conf.d`, and directive contexts such as `http`, `stream`, `server`, and
`location`. The NGINX documentation describes that model here:
[Create NGINX Plus and NGINX Configuration Files](https://docs.nginx.com/nginx/admin-guide/basic-functionality/managing-configuration-files/).

In this project, the NGINX Helm chart is already handled as a reviewed
`cub installer` package. The NGINX configuration language itself is not yet a
first-class ConfigHub model.

That gives this project a clear boundary:

```text
NGINX Helm chart and Kubernetes objects -> modeled today
custom nginx.conf / conf.d content      -> future NGINX-specific validation lane
```

## Current Catalog Shape

The catalog currently supports:

```text
bitnami/nginx@24.0.2
  http-clusterip
  existing-tls-ingress
```

Use the chart catalog to inspect the exact variants:

```text
recipes/bitnami/nginx/24.0.2/CATALOG.md
```

The supported variants keep these powerful Helm values empty or disabled:

```text
serverBlock
streamServerBlock
extraDeploy
cloneStaticSiteFromGit
metrics
sidecars
```

That is deliberate. These values can inject NGINX config text, extra
Kubernetes objects, sidecars, source-control pulls, or observability add-ons.
They should not appear silently in a supported base variant.

The repo has a generated check that proves the two supported NGINX bases do not
silently use those slots:

```sh
npm run nginx:config-checks:verify
```

The report is here:

[NGINX Config Extension Checks](../../data/nginx-config-checks/summary.md)

## When To Create A Base Variant

Create a new `cub installer` base variant when a change makes Helm render a
different NGINX install shape.

Examples:

```text
add a custom serverBlock
add a streamServerBlock
add extraDeploy objects
enable git-cloned static content
enable metrics or ServiceMonitor
add sidecars
change ingress or TLS shape
switch from generated TLS to existing TLS Secrets
```

The output should be treated as a new reviewed install shape:

```text
chart values -> recipe/base variant -> rendered objects -> scan/gate -> receipt
```

For NGINX config text, the new base should also add an NGINX-specific validation
receipt. That receipt should say where the effective config came from, which
ConfigMap or Secret supplies it, whether `nginx -t` passed, and what reload or
rollout policy was used.

## When To Create A Derived ConfigHub Variant

Create a derived ConfigHub variant when the NGINX object set is already
reviewed and the change is operational.

Examples:

```text
target
environment
region
labels
approval policy
observation freshness
existing Secret binding
approved image patch
approved resource patch
```

This should start from an uploaded base and use ConfigHub Units, links,
functions, changesets, gates, and receipts. It should not rerender Helm.

## Checks We Have Today

For the supported NGINX base variant, the repo records Helm-vs-ConfigHub parity
and per-chart pain points. The NGINX pain report also records the chart’s config
extension slots and why the supported variants keep them empty.

Useful files:

```text
recipes/bitnami/nginx/24.0.2/helm-pain-report.yaml
recipes/bitnami/nginx/24.0.2/control-points.yaml
data/live-helm-confighub-compare/summary.md
data/extension-slots/summary.md
data/nginx-config-checks/summary.md
```

For the broader catalog count of NGINX-like extension slots, use
[Extension Slot Coverage](../../data/extension-slots/summary.md).
For the supported NGINX bases, use
[NGINX Config Extension Checks](../../data/nginx-config-checks/summary.md).

## Future NGINX-Specific Checks

A stronger NGINX lane should add checks that understand NGINX config files
directly:

```text
extract rendered nginx.conf / conf.d content
run nginx -t against the rendered config
record which ConfigMap or Secret supplies each file
check reload or rollout policy
scan risky directives and includes
record a receipt for the NGINX config check
```

Until that exists, the project’s guarantee is about the Helm chart output and
ConfigHub-managed Kubernetes objects. It is not yet a guarantee that arbitrary
NGINX config text is semantically valid.
