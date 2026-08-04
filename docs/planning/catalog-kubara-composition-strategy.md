# Catalog and Kubara composition strategy

Planning doc. Status: draft for discussion. This note answers three questions
that came out of the live IDP build recorded in
[the single-platform example](../demo/kubara/single-platform.md) and
[its receipt](../../runs/kubara-single-platform-proof/receipt.yaml). Should the
catalog grow newer chart versions? Did Kubara expose faults in the catalog? And
how should wiring and composition work when the catalog cannot review every
platform? It is a companion to the Pilot ad-hoc variant model, whose
generation-gated-by-parity doctrine this note extends from single charts to
whole platforms.

## What the comparison showed

We compared the catalog's reviewed charts with the charts Kubara generated for
the live platform. Every chart Kubara wraps is already a catalog recipe, at a
different version.

| Chart | Catalog | Kubara |
| --- | --- | --- |
| cert-manager | v1.20.2 | v1.21.0 |
| kube-prometheus-stack | 85.3.3, 86.1.0 | 87.15.1, pruned upstream |
| external-secrets | 2.5.0 | 2.7.0 |
| metrics-server | 3.13.0 | 3.13.1 |
| traefik | 40.2.0 | 41.0.2 |

The two sides hold different kinds of knowledge. The catalog holds review: the
[cert-manager recipe](../../recipes/jetstack/cert-manager/v1.20.2/README.md)
records hook policy, required CRDs as target facts, a value model, a source lock
with the package digest, and the rendered objects themselves. Kubara holds
composition: its values wire cert-manager's ACME solver to traefik's ingress
class, every ServiceMonitor to the monitoring instance, Grafana's admin Secret
to an external-secrets store, and seventeen ApplicationSets to a label
switchboard on the in-cluster Secret that enables exactly seven services.

The catalog's per-chart review predicted every live failure we hit. The CRD
ordering, the hook Job, the webhook readiness wait, and the Grafana password
were all already recorded on the recipes. Kubara's raw wrappers walked into
each one.

The comparison also found wiring defects in the generated platform that nobody
had noticed, because nothing checks wiring today. metrics-server's generated
values set ServiceMonitor labels while leaving the monitor disabled, so
metrics-server is never scraped, and the labels themselves are a nested
`monitoring:` map that would be rejected as invalid if anyone enabled the
monitor, while cert-manager's values use the correct flat form. Grafana ships a
Loki datasource while the switchboard disables Loki. The external-secrets
config creates no ClusterSecretStore, yet three services reference one. Each of
these is silent today. The platform looks healthy while a declared intent
quietly fails.

## The scaling problem

The obvious next step would be to review compositions the way we review charts.
That step does not scale, and we should say so plainly. The catalog can afford
deep review of roughly a hundred charts times a few variants each, because that
surface is bounded. Platforms are not bounded. Every team composes its own,
with its own services, clusters, hosts, and secret backends. A catalog of
reviewed compositions would chase an unbounded surface with a bounded team, and
it would always be behind.

## The thesis

Composition is generated, not curated. The catalog reviews parts and records
small facts about each part. A machine generates the wiring on demand.
Deterministic gates check the generated wiring against the recorded facts.
ConfigHub records the result and delivers it. A human reviews only the
judgment calls the gates cannot make.

This is the Pilot ad-hoc variant doctrine applied one level up. The generator
is an author, not an authority. Parity against reviewed data is what makes
generation safe, and the reviewed data here is the catalog's per-chart facts.

## How wiring works

Each catalog variant gains one sibling file, `wiring-facts.yaml`, holding two
lists. The `needs` list says what this chart requires from outside itself. The
`provides` list says what this chart offers to others. Both draw from a small
closed vocabulary of typed facts taken from the real wiring inventory:
IngressClass, ClusterIssuer, CRDs, Secret, SecretStore, PrometheusScrape,
NamespaceLabels, HttpPath, HookRun, PullSecretFanout.

A need names its kind, its parameters, and the exact values paths where the
provider's value must land. A Secret need also names who materializes it, for
example external-secrets, which is precisely the distinction the Grafana
failure taught us. A provide names its kind and the rendered field that carries
the authoritative value.

Two rules keep the facts honest. Provides are derived mechanically from the
variant's rendered objects, never hand-claimed, because hand-written facts rot
exactly as prose route notes do. And no chart declares anything about another
chart. Cross-chart knowledge lives only in generated compositions.

A sketch for kube-prometheus-stack shows the shape.

```yaml
kind: WiringFacts
spec:
  needs:
    - kind: CRDs
      names: [prometheuses.monitoring.coreos.com, ...]
      applyMode: server-side-apply
      establishedBeforeConsumers: true
    - kind: IngressClass
      boundAt: [kube-prometheus-stack.grafana.ingress.ingressClassName]
    - kind: Secret
      name: grafana-admin-credentials
      keys: [admin-user, admin-password]
      materializedBy: external-secrets
      boundAt: [kube-prometheus-stack.grafana.admin.existingSecret]
  provides:
    - kind: PrometheusScrape
      selector: { monitoring.instance: "<instance>" }
```

This unifies three things that already exist in inconsistent shapes: the
`targetFacts.requiredCRDs` on variants, the kube-prometheus-stack value-model
binds, and the free-text external requirements in installer packages. It is an
extension of existing machinery, not a new system.

## How composition works

A generator takes an intent, for example ingress, certificates, and monitoring
on these four clusters with this host and this secret backend. It selects
catalog parts by digest and emits one data object, the Composition. The
Composition contains the selections per cluster, the edges that bind each need
to one provider with the resolved value, a wave order derived from the edges,
value overlays that touch only declared need paths, the target facts it assumes
from the environment, the hook routes, and a policy exceptions list.

The generator can be an AI agent, and it can be Kubara. Both write the same
object and face the same gates.

Four deterministic gates then run, offline, before anything is delivered.

1. Closure. Every need is met by exactly one enabled provider on that cluster,
   or by one named target fact. Unmet needs and duplicate providers both fail.
2. Parity. Each part re-renders from its catalog package plus the overlay, and
   the diff against the catalog render may differ only at declared need paths.
   A hallucinated value fails here, exactly as in the Pilot variant doctrine.
   The same pass verifies every claimed provide actually renders.
3. Ordering. CRD facts become wave semantics with server-side apply, checked
   rather than remembered. Hook objects must carry a route or fail.
4. Policy. Vet functions run over the composed render. The privileged
   pod-security labels Kubara stamps on namespaces stop passing silently and
   become an explicit exception a person accepts or rejects.

One further check is a hard gate, not advisory. Any ingress class, issuer
annotation, secret reference, or secret store reference that appears in the
rendered objects but is covered by no edge and no target fact fails the run.
This is how the closed vocabulary gets caught when it is incomplete, and it is
what would have caught the metrics-server label mismatch and the undeclared
ClusterSecretStore.

Run against today's Kubara platform, the gates reproduce the real defects as
findings. That reproduction is the acceptance test for the whole mechanism.

The Composition output is canonicalized, so generating the same intent twice
produces the same object. The second use of a wiring is a lookup and a diff,
not a regeneration.

## What a human reviews

Nobody reviews generated YAML line by line. The review is a short pass over
five things: the exceptions list with reasons, the external boundary the
composition assumes from the cluster and the secret backend, the hook route
table, the closure report, and the edge-level diff against the previously
approved composition. The production approval gate stays exactly where it is,
as the live IDP example proved it, and it remains the last word before a
production cluster changes.

## How it lands in ConfigHub

Delivery reuses the lane the live example proved. Each selection becomes a Unit
in a per-cluster Space, published as an OCI release that Argo CD pulls and
argobot syncs. Each edge can become a ConfigHub Link, whose direction, consumer
to provider, matches the need-to-provide relationship one for one. The
Composition itself is uploaded as a Unit, so the wiring ledger is diffable data
in the same system that delivers it.

Two cautions from the Link research. Automatic needs and provides matching
today recognizes a small set of standard attributes, so the chart-specific
paths here each need an Attribute registration once per kind. And the committed
composition file stays authoritative while Links remain a delivery convenience,
with automatic updates off until the round trip is proven, including survival
across `cub variant create`, which is currently assumed rather than proven.

## What the live failures map to

Every failure from the live build becomes a named gate finding rather than an
afternoon of debugging. The pruned chart version becomes a sourcing failure,
because parts resolve against the catalog's kept, digest-pinned packages rather
than upstream indexes. The Grafana secret becomes an unmet Secret need naming
its materializer. The CRD ordering and the apply mode become wave semantics.
The hook Job shipped as a plain object becomes a missing hook route. The
privileged namespace labels become a policy exception requiring a decision. The
metrics-server mismatch becomes a value mismatch at compose time.

## Where Kubara fits

Kubara stays what it is, a fast generator of a proven platform shape, and gains
value from the catalog rather than competing with it. An importer parses a
Kubara tree into a Composition, so today's output becomes checkable without
Kubara changing at all. Kubara's chart dependencies then repoint at the
catalog's kept packages, which ends the pruned-version failure mode. Longer
term its template library can emit wiring facts natively. Kubara-authored
charts such as homer-dashboard should become first-party catalog recipes, so
their defects surface as chart findings rather than platform noise.

## What this means for catalog growth

Grow versions demand-driven, not by chasing latest. The composers set the
freshness bar, and today that means adding the versions Kubara pins:
cert-manager v1.21.0, kube-prometheus-stack 87.19.x, external-secrets 2.7.0,
traefik 41.x, metrics-server 3.13.1, plus argo-cd as a new recipe, the largest
and hookiest part still outside the catalog. Keep older versions as kept,
still-deployable reviews, because the pruning incident showed that retention is
the catalog's structural advantage. And adopt the one correction Kubara taught
us: add an existing-secret variant for kube-prometheus-stack so configuration
references the Grafana credential rather than carrying it, with the Secret need
recorded as a wiring fact.

## Risks

The closed fact vocabulary will be incomplete at first, which is why the
unreviewed-reference check is a hard gate rather than advisory. Derived
provides depend on the extractor being right, so its output is digest-pinned
and fixture-tested. Exactly-one-provider closure needs scoping before real
fleets arrive, because two ingress classes on one cluster is legitimate. New
committed surfaces invite the schema-drift cascade this repo has met before, so
the surface count stays minimal until the gates earn their keep. Environment
fact checks are point-in-time, so live verification remains load-bearing.
Gate-green is not works; the live lanes stay.

## First steps

1. Ship the provides extractor, generating provenance-flagged facts from each
   variant's rendered objects.
2. Hand-write needs for the seven platform recipes from the existing wiring
   inventory, folding required CRDs, required Secrets, and external requires
   into the one schema.
3. Build the four gates plus the unreviewed-reference check, and fixture-test
   them until they reproduce the six live failures and the three latent defects
   as findings.
4. Run the Kubara importer over the local-platform example and commit the
   resulting Composition and findings as the first ledger, with
   recorded-not-live statuses.
5. Ship the review roll-up as markdown, CSV, and self-contained HTML, showing
   exceptions and the closure report rather than generated YAML.
6. Prove the ConfigHub Link round trip on the dev cluster, including survival
   across variant creation, before any fan-out relies on it.
7. Re-deliver the single-platform proof from the gated composition on a fresh
   cluster and flip receipt statuses to pass on live evidence only.
8. Wire the AI generator behind the gates last, using the Pilot parity pattern,
   and publish the plain-English page mapping each live failure to the gate
   finding that catches it.

Steps one through five are offline and burn no quota. Steps six and seven are
live and quota-bound, so they run serially and only after the shape is agreed.
