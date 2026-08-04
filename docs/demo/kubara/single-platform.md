# An internal developer platform from ConfigHub and Kubara

An internal developer platform, or IDP, is the shared, self-service base that app
teams build and run their applications on. It bundles the common pieces every app
needs, and it gives every team one consistent, governed way to ship.

This page is the full story of building one, in order, with nothing skipped.
Kubara chose the platform's contents. ConfigHub stored them as reviewed
configuration, governed them, and delivered them through Argo CD. Two apps then
ran on the platform. Every step below is what we actually did, including the
fixes we had to make along the way.

## The three pieces

Three things combined to build it, and each did one job.

- **Kubara** generated the platform. It chose the services, pinned their versions,
  set the order to install them in, and produced a chart for each. Each chart
  wraps a public upstream chart, such as cert-manager from jetstack or
  kube-prometheus-stack from prometheus-community, plus Kubara's own additions.
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
for each. Each one covers a common need: argo-cd delivers configuration,
cert-manager issues certificates, external-secrets fetches secrets, traefik
handles ingress, metrics-server serves the resource metrics that `kubectl top`
and autoscaling read, kube-prometheus-stack runs full monitoring with Prometheus
and Grafana, and homer-dashboard is a landing page. That is why there are seven,
and why two of them are about metrics: metrics-server for the live resource
numbers and kube-prometheus-stack for dashboards and history.

We dropped Kubara's argo-cd, because ConfigHub's Argo CD already runs on every
cluster. Swapping Kubara's delivery for ConfigHub's is what makes this an
adapted platform.

### 3. Load each platform service into ConfigHub and deliver it

Every service followed the same path. We rendered its chart to plain Kubernetes
files, stored those files in ConfigHub as Units, cloned them onto the dev cluster
with `cub variant create` (bound to the cluster's Argo CD target), and published
with `cub release publish` so Argo CD installed them. No workload manifest was
applied directly; the targeted Argo recovery and cleanup exceptions are called
out below.

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
  - Its definitions are megabytes each, past the size the default apply records in
    an annotation. `cub cluster up` installs a stock Argo CD, and Argo CD defaults
    to that client-side apply, so the first large chart hits the limit. The fix is
    server-side apply, which large CRDs need and which a cluster handling charts
    like this should turn on. We set it on the Argo Application and they installed.
    A temporary `Replace=true` fallback used during bring-up was removed afterward;
    the final application uses server-side apply only and all 10 monitoring CRDs
    remain installed.
  - Its Grafana would not start, because its admin secret was missing. Grafana
    only reads a Secret; it does not depend on external-secrets. Kubara's platform
    uses external-secrets to create that Secret from a secret store. We initially
    supplied it directly so Grafana could start, then retired that temporary
    delivery after external-secrets took ownership.
- **external-secrets** was not delivered in the first pass. Kubara installs the
  operator but deliberately leaves the secret store as a prerequisite. We later
  delivered the pinned `2.7.0` operator through three ConfigHub Spaces: the
  operator, a kind-only fake `ClusterSecretStore`, and Grafana's `ExternalSecret`.
  The operator installed 24 CRDs and its controller, webhook, and cert-controller
  all became ready. The store became `Ready=True (Valid)`, the ExternalSecret
  became `Ready=True (SecretSynced)`, and the generated
  `grafana-admin-credentials` Secret gained external-secrets management labels and
  an `ExternalSecret` controller owner reference. We removed the temporary app Unit
  and published the apps Space, but that root Application has pruning disabled, so
  the stale child Application correctly remained. After confirming it was the only
  extra resource and had no cascade finalizer, we deleted that one Application
  directly, removed both manual-secret Spaces, and cleared the Secret's stale
  tracking, origin, and last-applied annotations directly. Grafana was still
  `1/1` after cleanup.

  Two live details mattered. external-secrets `2.7.0` no longer accepts the old
  fake-provider `valueMap` shape, so the two demo keys were encoded as one JSON
  string in `value`, which `dataFrom.extract` decodes. Also, the rendered chart
  included the already-shared `Namespace/default`; its Argo tracking annotations
  conflicted with the existing Homer Application. We removed only that redundant
  Namespace document from the external-secrets payload, leaving the namespace and
  its workloads untouched.

> Note on server-side apply. `cub cluster up` installs a stock Argo CD, whose
> default apply is client-side and cannot handle CRDs larger than 256 KB. A
> cluster that will run charts with large CRDs, such as kube-prometheus-stack,
> should turn on server-side apply on its Argo Applications. On a clean install
> with it on when the sync operation begins, that alone is enough. The
> external-secrets follow-up exposed a publication race: `cub variant create`
> published the Application before its SSA edit, so the first auto-sync captured
> the old options and failed on the two largest store CRDs. We terminated that
> stale operation and resynced with SSA; the final Application is
> `Synced/Healthy` with all 24 CRDs.

After the follow-up, six of the seven Kubara services ran on the dev cluster:
cert-manager, external-secrets, traefik, metrics-server, homer-dashboard, and
kube-prometheus-stack. ConfigHub's Argo CD stands in for Kubara's argo-cd, so all
seven platform roles are accounted for.

### 4. Put two apps on the platform

We deployed two apps to show how a team uses the platform. We chose two on
purpose. The first is a small nginx web server, the simplest possible app, to
prove the path end to end. The second is cubbychat, the sample chat app from the
ConfigHub tutorial and a realistic three-tier app: a Postgres database, a
backend, and a frontend. Between them they show that both a trivial app and a
real one run the same way.

Using the platform is the same for both. A team stores its app in ConfigHub, adds
a traefik Ingress to put it on the network, and adds a cert-manager Certificate
for TLS. The platform's traefik and cert-manager do the rest; the app team does
not install either. Kubara's own certificate issuer uses a public certificate
authority, which a laptop cluster cannot reach, so we used a self-signed issuer
instead. An HTTPS request through traefik then returned the app's page, served
with the cert-manager certificate rather than traefik's default.

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

### 8. Label the Spaces so the console groups them

ConfigHub's console groups Spaces by their `Owner` label. At first only one Space
had that label set, so the console showed one lonely group and put everything
else under "Unassigned". We set `Owner` on every Space so the console shows two
clean groups: `Platform` for the Kubara services, the four clusters, and the
delivery bots, and `Apps` for nginx and cubbychat. Within each group the console
lists the components, such as `hx-cm`, `hx-traefik`, `hx-web`, and `hx-cubbychat`.

### 9. See it in the ConfigHub GUI

You can watch all of this in the ConfigHub web console, not only from the command
line. Sign in to your ConfigHub organization at `https://hub.confighub.com` and
open the Spaces this example created.

- The cluster Spaces `hx-app-dev`, `hx-app-staging`, `hx-app-prod-a`, and
  `hx-app-prod-b` hold each cluster's delivery target and its Argo Applications.
- The platform Spaces such as `hx-cm-dev`, `hx-traefik-dev`, `hx-kps-main-dev`,
  `hx-eso-dev`, `hx-eso-store-dev`, and `hx-eso-grafana-es-dev` hold the Kubara
  services and their cluster-specific prerequisites.
- The application Spaces `hx-web-*` and `hx-cubbychat-*` hold the two apps.
- The `hx-platform` Space holds the approval rule that gates production.

Each Space page shows its Units, their revision history, and what was delivered.
From the command line, `cub space get <space> --web` opens a Space page directly,
and `cub unit get <unit> --space <space> --web` opens a single Unit.

## How this maps to Kubara

If you know Kubara from its own documentation, this section is the map. The
short version: ConfigHub simplifies Kubara's operating model without making it
fundamentally different. Kubara's shape survives the port. What changes is
where the authority lives.

Kubara's article describes this flow.

```text
config.yaml + effective catalog
  -> platform-components/ + platform-configs/
  -> Git review and promotion
  -> hub Argo CD + ApplicationSets
  -> hub and registered spokes
```

This implementation runs this flow.

```text
Kubara contract + pinned generated snapshot
  -> rendered Kubernetes objects
  -> ConfigHub base and variant Spaces
  -> checks, approvals, OCI releases
  -> per-cluster Argo CD + argobot
  -> target clusters
```

The hub-and-spoke picture is the one to hold onto. In Kubara's terms, ConfigHub
takes the hub role: it holds the desired state, the review, and the release
decision for the whole fleet. Each cluster keeps a small local reconciler, Argo
CD plus argobot, in the spoke role. The cognitive map is the same. Contract,
generated state, review, reconcile. Only the hub's machinery moves from a
cluster into ConfigHub.

Concept by concept, honestly labeled.

| Kubara concept | In this implementation | Fidelity |
| --- | --- | --- |
| `config.yaml` platform contract | Stored in ConfigHub as the `platform-contract` Unit. It describes the one-cluster specimen; the live four-cluster topology lives in Spaces and receipts, not yet in one contract. | Kept for the specimen |
| Built-in and external catalog | Kubara v0.12.0's built-in catalog output, pinned by source lock and digests. No external-catalog merge is shown. | Kept, built-in only |
| `platform-components/` | The base Spaces: one reviewed definition per service. | Kept |
| `platform-configs/<cluster>/` | The per-cluster variant Spaces. Kubara stores pre-render values; ConfigHub stores the rendered objects. | Kept, different layer |
| `values-*.yaml` overrides | Per-Space departures that survive promotion, as the staging sandbox setting proved. Kubara's overrides survive regeneration instead; the two do not round-trip automatically. | Adapted |
| Git review and promotion | Unit revisions, policy checks, the approval gate, promotion, rollback, and immutable OCI releases. The authority moves from Git to ConfigHub. | Adapted |
| One Argo CD on the hub | ConfigHub is the hub; every cluster runs its own Argo CD as the spoke reconciler. | Adapted, deliberately |
| ApplicationSets select clusters by label | Explicit per-cluster variants bound to targets give the same fan-out without runtime label selection. | Adapted |
| `kubara cluster add` spoke registration | `cub cluster up` creates and wires each cluster. Registering an existing cluster is not shown. | Not yet shown |
| AppProject tenant boundaries | Spaces, filters, and approval gates govern publication. Team-scoped destination boundaries are not shown. | Not yet shown |
| External secret backend | Real external-secrets, with a kind-only fake store standing in for a production backend. | Adapted for kind |
| Day-2 regenerate, diff, promote | ConfigHub-side change, promotion, and rollback are proven. The contract-regeneration cycle is not yet. | Not yet shown |

Two implementations exist in this repository, and it is worth being plain about
that. The [Kubara-native lane](local-platform.md) preserves the article's own
shape end to end on one cluster: Kubara's Argo CD, its ApplicationSets, and one
downstream service reaching health. The adapted lane on this page is the live
four-cluster platform. The clearest one-line description of the adapted lane:
Kubara remains the platform composer, ConfigHub is the authority and release
control plane, OCI is the transport, and per-cluster Argo CD is the reconciler.

What the port loses today is Kubara's single regenerable contract as the
authority for the live fleet: several live fixes exist as ConfigHub edits and
receipts rather than as contract inputs, so a fresh Kubara generation would not
reconstruct them. The
[composition strategy](../../planning/catalog-kubara-composition-strategy.md)
describes the bridge that closes this, importing Kubara output into a checked
composition so the contract stops being forgotten in translation.

## What this does not prove

The heavier services ran on the dev cluster only. cert-manager and traefik run on
all four clusters, and both apps run on all four. external-secrets was proven on
kind with its built-in fake provider and demo `admin/admin` data held in
ConfigHub; this does not prove a production Vault, AWS, or other secret backend.
The three external-secrets Applications and the kube-prometheus-stack CRD
Application finished `Synced/Healthy`, but the cluster-wide Argo snapshot still
contains unrelated pre-existing OutOfSync or Progressing aggregate state on six
other Applications. The apps are a small nginx service and the cubbychat sample,
not production workloads.

## Check the evidence

The [committed receipt](../../../runs/kubara-single-platform-proof/receipt.yaml)
records the clusters, the platform services and their Spaces, the applications,
the promotion and approval flow, and the fixes above. The
[app-rollout walkthrough](app-rollout.md) covers the promotion, rollback, and
approval gate in more detail.
