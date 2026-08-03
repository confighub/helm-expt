# An internal developer platform from ConfigHub and Kubara

An internal developer platform, or IDP, is the shared, self-service base that app
teams build and run their applications on. It bundles the common pieces every app
needs, and it gives every team one consistent, governed way to ship.

This page is the full story of building one, in order, with nothing skipped.
Kubara chose the platform's contents. ConfigHub stored them as reviewed
configuration, governed them, and delivered them through Argo CD. Two apps then
ran on the platform. Every step below is what we actually did, including the
fixes we had to make along the way.

## The four pieces

Four things combined to build it, and each did one job.

- **Kubara** generated the platform. It chose the services, pinned their
  versions, and set the order to install them in.
- **The catalog** is the reviewed library of charts and packages an IDP draws
  from. This build used Kubara's generated platform charts and the ConfigHub
  tutorial's cubbychat app.
- **cub**, the ConfigHub command-line tool, did the hands-on work: `cub cluster
  up`, `cub installer`, `cub variant`, `cub release`, and `cub trigger`.
- **ConfigHub** held it all as reviewed data. It stored each piece, ran its
  checks, required approval for production, and delivered every change through
  Argo CD.

## Step by step

### 1. Set up four clusters

`cub cluster up` created four local test clusters: `hx-app-dev`,
`hx-app-staging`, `hx-app-prod-a`, and `hx-app-prod-b`. On each one it installed
Argo CD, the tool that pulls stored configuration and applies it to the cluster,
and argobot, a ConfigHub bot that tells Argo CD to sync the moment a release is
published. So ConfigHub owns the one Argo CD on every cluster.

### 2. Let Kubara choose the platform

Kubara read a description of one cluster and the capabilities it should have. It
chose seven components, put them in dependency order, and generated a Helm chart
for each: argo-cd, cert-manager, external-secrets, homer-dashboard,
kube-prometheus-stack, metrics-server, and traefik. That is why there are seven.

We dropped Kubara's argo-cd, because ConfigHub's Argo CD already runs on every
cluster. Swapping Kubara's delivery for ConfigHub's is what makes this an
adapted platform.

### 3. Load each platform service into ConfigHub and deliver it

Every service followed the same path. We rendered its chart to plain Kubernetes
files, stored those files in ConfigHub as Units, cloned them onto the dev cluster
with `cub variant create` (bound to the cluster's Argo CD target), and published
with `cub release publish` so Argo CD installed them. Nothing was applied by hand.

Most services needed a fix, and each fix is a real thing that happens with a
generated platform.

- **cert-manager** rendered cleanly. But its ClusterIssuer and its ServiceMonitor
  are custom resources that cannot exist until their definitions do. We delivered
  the controllers and definitions first, then the custom resources.
- **traefik** would not even render its ServiceMonitor unless the monitoring
  definitions were already present. We rendered it with a flag that says those
  definitions exist, and left the ServiceMonitor out until monitoring was
  installed.
- **metrics-server** was straightforward.
- **homer-dashboard** came up empty at first. Its files carried no namespace, so
  Argo CD could not place them. We set the namespace on the files, and it started.
- **kube-prometheus-stack** was the hard one, in three parts:
  - Kubara had pinned it to version `87.15.1`, which the upstream repository had
    since removed. We moved to the nearest surviving version, `87.19.0`.
  - Its definitions are megabytes each and exceed the size Kubernetes allows a
    normal apply to record. We split the definitions into their own delivery and
    told Argo CD to apply them server-side and to replace rather than patch. Then
    they installed.
  - Its Grafana would not start, because it expected a secret that
    external-secrets normally provides, and we had not installed external-secrets.
    We supplied that secret by hand, and Grafana started.
- **external-secrets** we did not deliver. It needs a secret store that a laptop
  cluster does not have. That is the one service of the seven left out.

After this, five of the seven services ran on the dev cluster: cert-manager,
traefik, metrics-server, homer-dashboard, and kube-prometheus-stack. ConfigHub's
Argo CD stood in for the sixth, argo-cd. Only external-secrets was missing.

### 4. Put two apps on the platform

We deployed two apps. The first is a small nginx web server. The second is
cubbychat, the sample chat app from the ConfigHub tutorial: a Postgres database,
a backend, and a frontend.

Each app is stored in ConfigHub and delivered the same way as the platform. For
each, we added a traefik Ingress to put it on the network and a cert-manager
Certificate for its TLS. Kubara's own issuer uses a public certificate authority,
which a laptop cluster cannot reach, so we used a self-signed issuer instead. An
HTTPS request through traefik then returned the app's page, served with the
cert-manager certificate rather than traefik's default.

### 5. Promote a change, roll it back, keep a local difference

We changed the nginx app once, in its base, from two copies to three. That change
promoted from development to staging and then to both production clusters as one
wave. All four reached three copies.

We rolled one production cluster back to two copies, and it went back while the
other stayed at three. We also gave staging one setting the others do not have, a
sandbox address. When the base change promoted into staging, staging kept its
sandbox setting and took the change as well. A local difference survives a
promotion.

### 6. Require approval for production

We added a rule that production changes need a person to approve them. A Trigger
in a `hx-platform` Space runs an approval check, attached to the production Spaces
through a Filter. When a change reached production, `cub release publish` was
refused with an `HTTP 422` error until every Unit in the Space was approved. After
`cub unit approve`, the release published and argobot delivered it. The gate
covers every Unit in a Space, so a namespace or service Unit must be approved
alongside the workload.

### 7. Roll it out across all four clusters

We delivered cert-manager and traefik, and both apps, to all four clusters, each
as its own per-cluster copy. Every cluster serves both apps over HTTPS through
traefik with a cert-manager certificate. The heavier services (metrics-server,
homer-dashboard, and kube-prometheus-stack) stayed on the dev cluster.

### 8. See it in the ConfigHub GUI

You can watch all of this in the ConfigHub web console, not only from the command
line. Sign in to your ConfigHub organization at `https://hub.confighub.com` and
open the Spaces this example created.

- The cluster Spaces `hx-app-dev`, `hx-app-staging`, `hx-app-prod-a`, and
  `hx-app-prod-b` hold each cluster's delivery target and its Argo Applications.
- The platform Spaces such as `hx-cm-dev`, `hx-traefik-dev`, and `hx-kps-main-dev`
  hold the Kubara services.
- The application Spaces `hx-web-*` and `hx-cubbychat-*` hold the two apps.
- The `hx-platform` Space holds the approval rule that gates production.

Each Space page shows its Units, their revision history, and what was delivered.
From the command line, `cub space get <space> --web` opens a Space page directly,
and `cub unit get <unit> --space <space> --web` opens a single Unit.

## What this does not prove

The heavier services ran on the dev cluster only. cert-manager and traefik run on
all four clusters, and both apps run on all four. One of the seven Kubara
services, external-secrets, was not delivered, for the reason in step 3. The apps
are a small nginx service and the cubbychat sample, not production workloads.

## Check the evidence

The [committed receipt](../../../runs/kubara-single-platform-proof/receipt.yaml)
records the clusters, the platform services and their Spaces, the applications,
the promotion and approval flow, and the fixes above. The
[app-rollout walkthrough](app-rollout.md) covers the promotion, rollback, and
approval gate in more detail.
