# One platform from ConfigHub and Kubara, running GitOps apps

This example puts two tools together to build one platform, then runs real apps
on it.

Kubara chooses what the platform is made of. ConfigHub stores that choice as
plain configuration a team can read, check, approve, and promote. ConfigHub also
owns the delivery onto the clusters. The apps then run on the platform and use
it.

One place is in charge. Kubara decides the contents. ConfigHub reviews and
delivers them. The apps travel the same path as the platform.

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

Kubara generated the platform as a set of Helm charts. Each chart wraps a public
upstream chart plus Kubara's own settings. Those charts were turned into plain
Kubernetes files and stored in ConfigHub, one copy per cluster. ConfigHub
publishes each copy as a package that Argo CD pulls and installs.

Five Kubara services now run on the dev cluster:

- **cert-manager** issues TLS certificates.
- **traefik** routes ingress traffic.
- **metrics-server** serves resource metrics.
- **homer-dashboard** is a platform landing page.
- **kube-prometheus-stack** runs Prometheus, Alertmanager, node-exporter,
  kube-state-metrics, and the Prometheus operator.

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

The heavier services ran on the dev cluster only, not all seventeen Kubara
services and not every service on every cluster. cert-manager and traefik run on
all four clusters, and both applications run on all four. Longhorn, MetalLB,
Velero, external-dns, and oauth2-proxy were not delivered, because they need
infrastructure a laptop kind cluster does not have. Grafana runs, but only after
its admin credential was supplied out of band as a plain demo Secret in place of
the ExternalSecret source. The applications are a small nginx service and the
cubbychat sample, not production workloads.

## Check the evidence

The [committed receipt](../../../runs/kubara-single-platform-proof/receipt.yaml)
records the clusters, the platform services and their Spaces, the applications,
the promotion and approval flow, and the findings above. The
[app-rollout walkthrough](app-rollout.md) covers the promotion, rollback, and
approval gate in detail.
