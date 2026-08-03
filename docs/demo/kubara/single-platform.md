# An internal developer platform from ConfigHub and Kubara

An internal developer platform, or IDP, is the shared, self-service base that app
teams build and run their applications on. It bundles the common pieces every app
needs, and it gives every team one consistent, governed way to ship.

This example builds an IDP from two tools, then runs real apps on it.

Kubara chooses what the platform is made of. ConfigHub stores that choice as plain
configuration a team can read, check, approve, and promote, and it owns the
delivery onto the clusters. App teams then get one path to run their apps on the
platform: the same review, approval, and promotion the platform itself uses.

One place is in charge. Kubara decides the contents. ConfigHub governs and
delivers them. The apps travel the same path as the platform.

## How we built this IDP

Four pieces combined to build it, and each did one job.

- **Kubara** generated the platform. It chose the services, pinned their
  versions, and set the order to install them in.
- **The catalog** is the reviewed library of charts and packages an IDP draws
  from. This build used Kubara's generated platform charts and the ConfigHub
  tutorial's cubbychat app.
- **cub**, the ConfigHub command-line tool, did the hands-on work. It created the
  clusters and their Argo CD with `cub cluster up`, pulled and rendered packages
  with `cub installer`, and created, promoted, and approval-gated the
  configuration with `cub variant`, `cub release`, and `cub trigger`.
- **ConfigHub** held it all as reviewed data. It stored each piece, ran its
  checks, required approval for production, and delivered every change through
  Argo CD.

Kubara decides, the catalog supplies, cub drives, and ConfigHub governs and
delivers.

## The setup

`cub cluster up` created four local test clusters: `hx-app-dev`, `hx-app-staging`,
`hx-app-prod-a`, and `hx-app-prod-b`. On each one it installed Argo CD, the tool
that pulls stored configuration and applies it to the cluster, and argobot, a
ConfigHub bot that tells Argo CD to sync the moment a release is published. So
ConfigHub owns the one Argo CD on every cluster, and nothing else runs its own.

Kubara normally ships its own Argo CD and its own cluster wiring. Here that part
is dropped. Kubara's job is reduced to what it is best at: choosing and
configuring the platform. ConfigHub's Argo CD is the single delivery engine.

## The platform

Kubara did not pick the services at random. The example gives Kubara a
description of one cluster and the capabilities it should have. Kubara turned
that into seven components, put them in dependency order, and generated a Helm
chart for each. Each chart wraps a public upstream chart plus Kubara's own
settings.

Loading the platform into ConfigHub followed one plain, repeatable path. Each
chart was rendered to plain Kubernetes files. Those files became ConfigHub Units.
`cub variant create` cloned the Units onto each cluster and bound them to that
cluster's Argo CD target, and `cub release publish` handed the result to Argo CD.
Nothing was applied to a cluster by hand.

This Kubara platform has seven services. ConfigHub's own Argo CD stands in for
Kubara's argo-cd, which is what makes the platform adapted. Five of the other six
run on the dev cluster:

- **cert-manager** issues TLS certificates.
- **traefik** routes ingress traffic.
- **metrics-server** serves resource metrics.
- **homer-dashboard** is a platform landing page.
- **kube-prometheus-stack** runs Prometheus, Alertmanager, node-exporter,
  kube-state-metrics, and the Prometheus operator.

The sixth, **external-secrets**, is not delivered. It needs a secret store that a
laptop kind cluster does not have, which is also why Grafana's admin credential
was supplied out of band.

## The applications

Two applications run on the platform and use it. Both follow the same GitOps
pattern as the platform: their configuration lives in ConfigHub, and Argo CD
keeps each cluster matching it.

The first is a small nginx web server. The second is **cubbychat**, the sample
application from the ConfigHub tutorial: a Postgres database, a backend, and a
frontend. Each application is stored in ConfigHub, delivered onto the cluster by
Argo CD, put on the network through the platform's traefik ingress, and given a
TLS certificate by the platform's cert-manager.

An HTTPS request to the cubbychat host through traefik returns the Cubby AI Chat
page, served with the cert-manager certificate rather than traefik's default.
The application is not beside the platform. It runs on it and depends on it.

Both applications run on all four clusters. cubbychat's two production Spaces
carry the same require-approval gate as nginx, so a change to production cubbychat
is refused until it is approved.

## Governance across the fleet

The same platform and applications promote across the four clusters. A change is
made once in a base Space and promoted development to staging to production. The
two production clusters take the change as one wave.

Production carries a require-approval gate. A Trigger in an `hx-platform` Space
runs `vet-approvedby`, attached to the production Spaces through a Filter. When a
change reaches production, `cub release publish` is refused with `HTTP 422` until
every Unit in the Space is approved. After approval, argobot delivers the change.
A separate rollback moves a Unit back to a prior revision and republishes.

## What we learned

Bringing a real generated platform up on a laptop taught several things that a
clean demo hides. Each one is a place where storing configuration as reviewed
data helps.

- **A pinned chart version can disappear.** Kubara pinned
  `kube-prometheus-stack` at `87.15.1`. The upstream repository had since pruned
  that version from its index, so the bundle no longer built. The fix was to move
  to the nearest surviving version in the same line, `87.19.0`. A months-old
  bundle can become undeployable through no change of its own.
- **Custom resources need their definitions first.** cert-manager's
  `ClusterIssuer` and the many `ServiceMonitor` objects are custom resources.
  They cannot apply until their CRDs exist and, for cert-manager, its webhook is
  ready. The bring-up order is CRDs, then controllers, then custom resources.
- **The charts assume the whole platform.** Several charts refuse to render their
  `ServiceMonitor` unless the Prometheus operator CRD is present, so they were
  rendered with `--api-versions monitoring.coreos.com/v1`.
- **Large CRDs break normal apply.** The kube-prometheus-stack CRDs are megabytes
  each and exceed Kubernetes' 256 KB annotation limit that client-side apply
  uses. The Argo CD Application needed `ServerSideApply=true` and `Replace=true`
  before the largest CRDs would install.
- **A rendered secret is not a secret.** The generated stack expected an external
  secret to supply Grafana's admin credentials. Without that source on kind,
  Grafana could not start. The credential must be supplied out of band, not
  carried in the delivered configuration.
- **A render can omit its namespace.** The homer-dashboard render left the
  namespace off its objects, so Argo CD could not place them. The namespace was
  set on the Units before delivery.

## What this does not prove

The heavier services ran on the dev cluster only. cert-manager and traefik run on
all four clusters, and both applications run on all four. The one Kubara service
not delivered is external-secrets, covered above. The applications are a small
nginx service and the cubbychat sample, not production workloads.

## See it in the ConfigHub GUI

You can watch all of this in the ConfigHub web console, not only from the command
line. Sign in to your ConfigHub organization at `https://hub.confighub.com` and
open the Spaces this example created.

- The cluster Spaces `hx-app-dev`, `hx-app-staging`, `hx-app-prod-a`, and
  `hx-app-prod-b` hold each cluster's delivery target and its Argo Applications.
- The platform Spaces such as `hx-cm-dev`, `hx-traefik-dev`, and `hx-kps-main-dev`
  hold the Kubara services.
- The application Spaces `hx-web-*` and `hx-cubbychat-*` hold the two apps.
- The `hx-platform` Space holds the require-approval Trigger that gates
  production.

Each Space page shows its Units, their revision history, and what was delivered.
From the command line, `cub space get <space> --web` opens a Space page directly,
and `cub unit get <unit> --space <space> --web` opens a single Unit.

## Check the evidence

The [committed receipt](../../../runs/kubara-single-platform-proof/receipt.yaml)
records the clusters, the platform services and their Spaces, the applications,
the promotion and approval flow, and the findings above. The
[app-rollout walkthrough](app-rollout.md) covers the promotion, rollback, and
approval gate in detail.
