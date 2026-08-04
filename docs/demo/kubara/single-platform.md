# An internal developer platform from ConfigHub and Kubara

An internal developer platform, or IDP, is the shared, self-service base that app
teams build and run their applications on. It bundles the common pieces every app
needs, and it gives every team one consistent, governed way to ship.

This page records the build in chronological order. Kubara chose the platform's
contents. ConfigHub stored the derived configuration, governed it, and delivered
it through Argo CD. Two apps then ran on the platform. The page includes the
fixes made during bring-up, so it is an evidence narrative rather than a
one-command clean-room reproduction. That linear adoption runner is the
acceptance bar, not a claim this page makes today.

> **Topology note.** This historical walkthrough demonstrates ConfigHub's
> optional per-cluster delivery topology. Existing Kubara users can keep Git,
> the hub Argo CD, ApplicationSets, AppProjects, and registered spokes unchanged;
> that zero-repoint adoption path is described below. ConfigHub governance does
> not require replacing Kubara's hub topology.

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
published. In this optional delivery topology, each cluster runs a
ConfigHub-managed Argo CD and argobot.

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

For the four-cluster proof on this page, we chose ConfigHub's optional
per-cluster delivery topology: each cluster already had a local Argo CD, so we
did not install Kubara's hub Argo CD there. This is the adapted lane, not a
requirement for adoption. The Kubara-native lane keeps Kubara's hub Argo CD,
ApplicationSets, and registered-spoke model intact.

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
  - Kubara had pinned it to version `87.15.1`, which the upstream index visible
    during the historical run did not resolve. The adapted proof explicitly used
    `87.19.0` instead. Version `87.15.1` is retrievable upstream again today, so
    this remains a recorded departure, not a current availability claim or an
    acceptable silent substitution.
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
kube-prometheus-stack. For this proof, ConfigHub's local Argo CD supplied the
delivery role, so Kubara's generated hub Argo CD was omitted. That omission is
specific to the optional delivery topology and is not required for adoption; all
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

### 8. Record the contract and label the topology

The `hx-platform/platform-contract` Unit now mirrors the committed Kubara
`config.yaml` as native `AppConfig/YAML`. Its provider is `None`, so the contract
has revision history but no target and is not target-applied. This proof does not
publish the `hx-platform` Space or inspect release membership. The Unit records
its source path and SHA-256 digest.

An exact, repeatable sweep then labels an explicit allowlist of 53 existing
Spaces. `ExampleCohort=kubara-v0.12.0` groups the whole proof; `Cluster` and
`Environment` appear only on target instances; `Scope=Fleet` and
`DefinitionScope=Base` identify reusable definitions. `KubaraVersion` is
reserved for the contract and Kubara-derived component surfaces. Roles separate
components, lifecycle parts, prerequisites, wiring, delivery, applications, and
application-to-platform bindings. `KubaraComponent` keeps the canonical Kubara
component name beside short proof aliases such as `hx-cm`, while
`KubaraSelectedVersion` is checked against the catalog alignment manifest.
`ObservedComponentVersion` appears only where the historical live receipt names
the running version; the KPS labels therefore preserve both selected `87.15.1`
and observed `87.19.0` without treating the departure as equivalent.

```bash
npm run kubara-org-shape:plan
npm run kubara-org-shape:apply
npm run kubara-org-shape:verify
npm run kubara-org-shape:receipt-verify
```

The apply command refuses any organization except `Kubara`, verifies that all
53 planned Spaces exist before writing, addresses each Space by exact slug,
deletes no Space or Unit, removes only stale keys from the label vocabulary it
owns, verifies the live result, and writes the committed
[org-shape receipt](../../../runs/kubara-org-shape-proof/receipt.yaml). Re-running
it makes no live changes when the mapping already matches; it refreshes the
receipt's observation timestamp.

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
- The `hx-platform` Space holds the mirrored Kubara contract and the approval
  rule that gates production.

Each Space page shows its Units, their revision history, and what was delivered.
From the command line, `cub space get <space> --web` opens a Space page directly,
and `cub unit get <unit> --space <space> --web` opens a single Unit.

## How ConfigHub fits an existing Kubara platform

> **ConfigHub simplifies operating Kubara without making Kubara's platform model
> fundamentally different.**

If you already use Kubara, keep its working model: the effective ordered catalog
set, `config.yaml`, documented overrides, generated `platform-components/` and
`platform-configs/`, Git review, ApplicationSets, AppProjects, and Argo CD
reconciliation. The catalog set can remain Kubara's built-in catalogs plus any
external catalogs you already supply; an organization-owned catalog is optional,
not a new adoption prerequisite. ConfigHub adds governance around the resulting
revision. Adoption must not require an AI rewrite, a fork of Kubara, or a second
platform model to maintain.

The zero-repoint compatibility design keeps Argo's Git source unchanged:

```text
effective Kubara catalog set + config.yaml + documented overrides
  -> kubara generate --helm
  -> platform-components/ + platform-configs/
  -> Git diff, test, and review
  -> ConfigHub checks, approval, and attestation of that Git revision
  -> required repository status/merge gate (adoption target)
  -> existing Kubara hub Argo CD + ApplicationSets keep pulling Git
  -> hub and registered spokes
```

The page also records an optional ConfigHub-delivery topology. This mode makes an
explicit source change: Argo pulls a ConfigHub-published OCI release instead of
the original Git path.

```text
the same Kubara-generated revision
  -> rendered ConfigHub Units and cluster variants
  -> checks, approvals, and OCI releases
  -> Argo source explicitly points at the ConfigHub OCI artifact
  -> target clusters
```

These are two delivery choices, not two definitions of the platform. In the
compatibility path, Kubara's hub remains the Argo CD management cluster and
ConfigHub records the policy decision around the Git revision. It becomes an
enforced decision in this mode only when the repository requires the ConfigHub
status before merge or promotion; that integration is not proved here. The per-cluster
Argo and argobot topology used for the four-cluster proof is optional: it makes
each cluster's release, rollback, and reconciliation state explicit, but it is
not required for Kubara adoption. The complete zero-repoint multi-cluster flow is
an adoption target; this repository has not proved it end to end yet.

The memorable boundary is: **Kubara composes; ConfigHub governs; Argo
reconciles.** The effective Kubara catalog set, `config.yaml`, and documented
overrides remain the platform-authoring authority. In native mode today, Git
merge and the revision Argo can observe remain the release decision; ConfigHub
adds checks and an attestation record, becoming an enforceable approval gate only
through the planned required-status integration. In ConfigHub-delivery mode,
ConfigHub is also the release and fleet-promotion authority, OCI transports the
approved revision, and Argo reconciles it.

### Sidebar: component catalogs and platform composition

There are three surfaces to preserve, not one catalog that has to win.

- **Kubara's catalogs remain supported component sources.** The
  official [Kubara catalogs repository](https://github.com/kubara-io/catalogs)
  currently separates a fixed `bootstrap/` foundation from `general/` reusable
  platform services. Kubara can also resolve external catalogs supplied to the
  workflow. Existing users keep that effective ordered catalog set.
- **ConfigHub Catalog is a component catalog first.** Its primary entry is an
  exact component version: a reviewed and retained package, source digest,
  rendered object set, and lifecycle or prerequisite facts. The follow-on is to
  expose useful deployable variants and configuration profiles for that
  component. It is not a curated catalog of every possible platform.
- **Kubara still owns platform selection and wiring.** For each cluster, the
  effective catalog set supplies the available services, templates, defaults,
  and connections; `config.yaml` selects and specializes them, with documented
  overrides layered on top. An organization may package its platform choices in
  an external catalog, but ConfigHub adoption does not require inventing one.
  Kubara's own [catalog documentation](https://docs.kubara.io/latest-stable/2_concepts/catalogs/)
  describes a catalog as a packaged, templateable platform setup containing
  service definitions, `platform-components/`, and `platform-configs/`.

ConfigHub Catalog entries are not Kubara catalogs today, and an exact upstream
chart is not enough to recreate a Kubara component. The optional second source
lane therefore needs both the reviewed upstream package and a versioned Kubara
compatibility profile containing its `ServiceDefinition`, wrapper templates,
defaults, and additions. A deterministic adapter exports those inputs as a
Kubara-compatible external catalog: `Catalog.yaml`, `services/`,
`platform-components/`, and `platform-configs/`.

The parity harness will derive two source-specific config copies from one
platform intent. Lane A keeps the normal Kubara catalog references. Lane B
replaces only the non-bootstrap component-catalog references with the exported
ConfigHub Catalog OCI reference; service selections, service configuration, and
documented values overrides stay identical. Each lane resolves in a clean work
directory. The exported catalog is not appended beside the original catalog,
and any unexpected duplicate service definition fails rather than relying on a
silent overwrite.

```text
same platform intent; config copies differ only in component-catalog references
  ├─> lane A: Kubara catalogs -> effective set A -> kubara generate -> output A
  └─> lane B: ConfigHub component Catalog
             + Kubara compatibility profiles
             -> adapter/export -> effective set B -> kubara generate -> output B

output A <---------------- deterministic parity + live outcome ----------------> output B
```

“Equivalent” is a gate, not a slogan. For the same component selection and
platform intent, both lanes must align on canonical component identity, exact
version, default values and schema, wrapper additions, rendering capabilities,
lifecycle routes, target and secret facts, and the semantic object inventory.
The final check compares live behavior. Byte-for-byte equality is preferred;
when lifecycle routing deliberately separates a hook or CRD from the main
payload, the prepared payload plus route plan must still produce the same live
objects and outcome.

If an exact ConfigHub Catalog entry is absent, the Kubara-upstream lane remains
valid. ConfigHub may retain and review that exact package or report the missing
mapping. It must never silently substitute a nearby version. This gives existing
users a zero-repoint adoption path first and an optional ConfigHub-Catalog-backed
path once the adapter and parity proof exist. Catalog growth is additive: adding
a Kubara-selected version never removes an older retained version, package,
receipt, or public path.

No AI is required for this path: an existing Kubara catalog and config remain
valid inputs. AI wiring is only an optional future author for bespoke
compositions; if used, it faces the same deterministic closure, parity,
lifecycle, and policy gates and never becomes authority.

This is the alignment contract plus an offline candidate proof, not a shipped
compatibility claim. All seven exact public pins now have digest-bound candidate
recipes and installer packages, while every older retained version remains in
place. The proof demonstrates that those exact artifacts pass the scoped offline
render and package lanes, but it does not root-retain or publish them, run the
same platform through both component-source lanes, resolve the live platform
directly from ConfigHub Catalog entries, or round-trip every fix into Kubara
inputs.
The checked
[catalog alignment manifest](../../../examples/kubara/local-platform/catalog-alignment.yaml)
records all eight component mappings, seven verified public artifact digests,
every locally retained older version, and the separate upstream-package and
Kubara-compatibility gaps.

### Why use ConfigHub with Kubara

The preference case is operational, not a replacement story. The adapted live
lane already shows ConfigHub approvals, immutable release digests, fleet
promotion, rollback, preserved target departures, and evidence receipts around
Kubara-generated state. ConfigHub's component reviews also carried the CRD,
hook, readiness, and secret facts that predicted the failures found during this
bring-up, while retained older recipes and packages demonstrate the anti-rot
shape Kubara's exact pins need.

The next differentiators remain deliberately labelled as targets: retain and
review every exact Kubara-selected component, generate the same output through a
Kubara-compatible Catalog adapter, enforce ConfigHub approval in zero-repoint Git
mode, publish a live component-by-cluster matrix, and show wiring edges in the
GUI. Those are the steps that turn “works with Kubara” into the safer, easier
default way to operate it; this page does not claim they have shipped already.

Concept by concept, the adoption contract is:

| Kubara surface | What remains authoritative | What ConfigHub adds | Evidence today |
| --- | --- | --- | --- |
| Effective Kubara catalog set | Built-in and external catalogs remain valid package sources; adoption does not require repointing them. | Exact component mappings and, later, a parity-proven Kubara catalog export sourced from ConfigHub Catalog. | Built-in v0.12.0 output is pinned; external-catalog import and dual-source parity are not yet shown. |
| Platform selection and wiring | The effective catalog set, `config.yaml`, and documented overrides remain authoritative. An organization-owned external catalog is optional. | A checked, diffable derivation without introducing a second platform model. | The example's built-in selection and wiring are generated; the deterministic importer is not shipped. |
| Kubara component profile | Its `ServiceDefinition`, wrapper templates, defaults, and additions remain part of the component contract, not incidental glue. | A versioned compatibility profile lets a reviewed ConfigHub package export the same Kubara component. | Wrapper fixtures are checksum-locked; ServiceDefinitions and adapter profiles are not yet captured. |
| `config.yaml` | Remains the cluster-specialization source in Git. | A native YAML contract mirror, revision history, and provenance. | `hx-platform/platform-contract` now mirrors the committed one-cluster source; it does not describe the four-cluster fleet. |
| ConfigHub Catalog component | Does not replace Kubara's catalog resolution or platform composition. | Component-first retention and review; deployable variants and configurations follow. A complete mapping needs both the exact upstream package and a Kubara compatibility profile for the ServiceDefinition and wrapper additions. | All seven exact public pins have digest-bound offline candidate recipes/packages with historical roots preserved. None is root-retained or live-qualified yet, and none of the eight complete Kubara component profiles is retained. |
| `platform-components/` | The generated directory remains valid and regenerable. | Rendered components can be materialized as reusable base Units. | The committed generated tree and live base Spaces both exist; their content/provenance lineage has not yet been verified. |
| `platform-configs/<cluster>/` | Generated cluster values remain valid and regenerable. | Their renders can become target-bound variants with release history. | One native cluster config and four adapted variants are proved separately. |
| `values-*.yaml` | Remains the durable customization mechanism. | Semantic review of its effect and explicit target departures. | Native overrides and ConfigHub departures are proved; automatic round-trip is not. |
| Git review and promotion | Git remains the authoring and source-review workflow. | Native mode can add checks and attestation, with approval enforced through a required repository status; ConfigHub-delivery mode adds immutable releases, fleet promotion, and rollback. | ConfigHub promotion and rollback are proved in the adapted lane; the required-status zero-repoint loop is not. |
| Argo CD reconciliation | Argo CD remains the continuous reconciler. | The exact approved desired-state revision and its delivery record. | Argo reconciliation is proved in the native one-cluster and adapted four-cluster lanes; unchanged-Git multi-cluster adoption is not. |
| Hub Argo CD | Remains unchanged in the compatibility path. | Per-cluster Argo CD is an optional topology with isolated release state. | Native one-cluster and adapted four-cluster proofs exist; native multi-cluster is next. |
| ApplicationSets and cluster labels | Remain valid in the compatibility path. | Explicit target variants optionally add per-cluster promotion and rollback history. | Native selection is proved on one cluster; explicit variants are proved on four. |
| `kubara cluster add` | Continues to register existing spokes through Kubara and its secret backend. | ConfigHub binds governed releases to the resulting targets. | Not yet shown; `cub cluster up` creates disposable kind clusters and is not equivalent. |
| AppProjects and Argo RBAC | Remain the repository, destination, resource, and tenant boundary. | Spaces, checks, and approvals add release governance. | Generated AppProjects exist; a real tenant-scoped boundary is not yet proved. |
| External secret backend | Remains the owner of secret values and cluster or repository credentials. | Reference and prerequisite checks without putting secret values into generated state. | ESO is proved with a kind-only fake provider; production credentials are not. |
| Day-2 workflow | Update the Kubara catalog, config, or overrides; regenerate; inspect the Git diff. | Semantic diff, checks, approval, promotion, and rollback. | ConfigHub-side change handling is proved; the full regeneration loop is not. |
| Exit path | The Kubara Git tree and Argo topology must continue to operate without ConfigHub. | ConfigHub remains an adoptable operational layer rather than a migration boundary. | Not yet proved. |

Two implementations exist in this repository. The
[Kubara-native lane](local-platform.md) preserves Kubara's own shape end to end
on one cluster: Kubara's Argo CD, its ApplicationSets, and one downstream service
reaching health. The adapted lane on this page is the live four-cluster platform.
In that lane, Kubara remains the platform composer, ConfigHub is the release
control plane, OCI is the transport, and per-cluster Argo CD is the reconciler.

The principal current gap is round-trip authority. Several fixes in the adapted
lane exist as post-render ConfigHub changes or receipt facts rather than as
Kubara catalog, contract, or override inputs. A clean regeneration therefore
does not yet reconstruct the released fleet. The adoption target is that every
persistent platform change either updates a Kubara-supported input or is
explicitly classified as release policy, target fact, approval state, or live
observation. The
[composition strategy](../../planning/catalog-kubara-composition-strategy.md)
describes the checked bridge, but it is still a strategy rather than shipped
evidence.

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
