# GitOps Adopter Guide

**UNOFFICIAL/EXPERIMENTAL.**

For teams already running Argo CD or Flux: what changes and what stays the same
when ConfigHub publishes the reviewed objects as an OCI bundle.

## What stays the same

You keep your controller. Argo stays Argo. Flux stays Flux. They pull and
reconcile as they do today.

ConfigHub is not asking you to replace your GitOps controller. It changes the
source that the controller reads.

## What changes: the source

Instead of pointing the controller at a git repo of Helm values that each tool
re-renders, you point it at **one OCI bundle** published from reviewed ConfigHub
Units. Every controller pulls the same generated objects. There is no per-tool
Helm re-render in the GitOps controller path.

See [cub-deployment-path](cub-deployment-path.md).

## Check the receipt for the configuration you want

There are two separate questions.

1. Can one ConfigHub release OCI be consumed by Argo CD, Flux, and direct apply?
2. Has the configuration you want to run been delivered and observed through your controller?

The first answer is yes. A small routed-hook fixture was published once and
successfully consumed through all three paths. That proves the delivery
mechanism.

The second answer depends on the catalog entry. Look for a delivery receipt on
that entry's page. A receipt for the fixture, or for another chart, does not
prove that your selected configuration has reconciled successfully.

## Argo CD

An Argo `Application` can point at the OCI URL and a path inside the bundle.
Argo still reports sync and health as usual. The catalog records which
chart/preset rows have evidence for the render, ConfigHub upload, OCI handoff,
Argo sync, and live result.

## Flux

Flux can use an `OCIRepository` plus a `Kustomization` for the same bundle. Flux
has its own Helm path when you use Flux Helm resources. The ConfigHub OCI path
is different: Flux pulls generated objects from the bundle.

Any extra work around the chart, such as hooks or setup jobs, still needs a
documented action, check, target fact, blocker, or refusal. Do not assume Flux
will automatically recreate Helm hook behavior in this path.

## No controller (cub-direct)

`oras` and `kubectl` can pull and apply the same generated bundle when you do
not want a controller. This is useful for a one-shot apply or a CI step, but it
also means you must be more explicit about ordering, pruning, CRDs, and setup
work.

## vs. raw Helm-through-Argo

Argo's native Helm support re-renders the chart inside Argo. The ConfigHub path
renders first, records the inputs, and sends the reviewed objects to GitOps.
That gives you one clear review point before delivery.

This does not make every Helm hook automatic. Hooks and hook-like work are
handled per chart: observed, routed, target-specific, blocked, or refused. See
[chart-hooks-what-happens](chart-hooks-what-happens.md).

## Hooks under GitOps

A Helm hook becomes a named piece of work, not an inherited Argo or Flux hook.
For one chart the right answer may be a preflight check. For another it may be
an Argo sync action, a Flux-compatible step, a target fact, or a blocker. The
catalog should say which answer applies and what evidence exists.

See [pathway-route-hooks-transparently](pathway-route-hooks-transparently.md).

## See Also

- [How It Works](how-it-works.md)
- [Deployment Path](cub-deployment-path.md)
- [Delivery mechanism receipt](../../data/oci-hook-delivery-proof/summary.md)
- [What Happens To Chart Hooks](chart-hooks-what-happens.md)
- [Doctrine](../../tests/doctrine.md)
