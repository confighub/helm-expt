# One flattening model for every plugin

The Workshop's flattening model decides when exact Kubernetes objects may stand in
for the source that produced them. [When to flatten configuration](./flattening-alignment.md)
sets out the four verdicts, [Deciding a flattening lane](./deciding-a-flattening-lane.md)
says how a verdict is reached, and [Secret Lifecycle](./secret-lifecycle.md) separates
credentials from lifecycle state.

The Catalog is no longer the only place that materializes configuration into
ConfigHub. Four cub plugins now do it for live estates. `cub sveltos` flattens the
charts of Sveltos ClusterProfiles. `cub kubara` flattens a platform Kubara generated.
`cub argo` and `cub flux` flatten what Argo CD and Flux deploy. `cub helm` renders a
bare chart into a ConfigHub component.

[The certified bundle spec](./certified-bundle-spec.md) already defines the shape
every producer shares, and it names Kubara and Sveltos among them. A source is
rendered once, packaged as a certified bundle with a receipt, ingested as one Unit
per file, varied per target, and delivered by any reconciler.

This page says how each plugin applies that model and that shape. It adds no new
verdict and no new format. It names the processor for each kind of source, the
checks every render passes, where the verdict comes from, how generated values
split, when to render late, and what counts as the same object set.

## The contract

A plugin materializes a source with the processor for that kind of source. It
produces the certified bundle shape: one bundle per component, a receipt, and one
Unit per file when it ingests into ConfigHub. It checks the render against the same
criteria the Catalog uses, and records them in the receipt. It takes the verdict from the
Catalog when the Catalog holds that exact source, and decides locally, saying so,
when it does not. A generated value keeps the source unsafe to flatten, rendered late, until a
receipt establishes a route for it on that target and delivery runtime. Two renders are the same
configuration exactly when their canonical object sets are equal.

## Which processor materializes which source

The processor is chosen by the kind of source, never by habit. A plugin does not
render a Kustomize overlay with a chart renderer, because the overlay adds labels,
patches and a namespace the chart renderer never sees. A two-object chart rendered
both ways on 2026-09-28 gave the same two objects with different content.

| Source | Processor | Who calls it today |
| --- | --- | --- |
| A bare chart: a Flux HelmRelease, an Argo CD `source.chart`, a Sveltos `helmCharts` entry | `cub helm template`, with the rules in `chartrender` | `cub sveltos`. `cub argo` reports a bare chart source rather than rendering it, and `cub flux` lists each layer's HelmReleases |
| A Kustomize overlay, with or without `helmCharts` inside | `kustomize build --enable-helm` | `cub argo`, `cub flux` |
| A platform Kubara generated | `cub stack from-kubara`, which renders each umbrella chart with its generated values | `cub kubara` |
| An AICR recipe | The AICR bundle step the Catalog records | The Catalog |
| A Timoni module | `timoni build` | The Catalog |
| Literal YAML or configuration OCI | None; the verdict is `born-flattened` | All |

`cub kubara` shows the pattern. Its renderer is an injectable function, and the
default calls the Workshop plugin, so `cub kubara` and the Workshop render a Kubara
platform the same way. The shared thing is the contract, with one processor for each
kind of source.

## The shape is the certified bundle

A plugin does not choose its own layout. It follows the certified bundle spec.

- **One bundle per component**, keyed by the source version and variant, with a
  digest-bound index for the composition.
- **One Unit per file** in ConfigHub, ingested with
  `cub variant upload --granularity per-file` into a base Space no target deploys.
  This settles how finely a chart is stored. Today `cub kubara` stores one Unit per
  component and `cub helm` one Unit per object group, and both move to the bundle's
  files.
- **A receipt** that records the render inputs, including the renderer, the pinned
  kube version and API versions, the values hash and the hook policy, and one
  disposition row for each quirk class.

## Every render passes the same checks

These are the criteria the Catalog already uses, stated for a render a plugin makes.
Each one is a render input or a disposition row in the receipt.

1. **The version is exact.** A floating version, such as `2.4.x`, renders whatever is
   newest that day. The plugin refuses it and names the exact version to pin.
2. **The render repeats.** The plugin renders twice and compares the canonical object
   sets. Any difference is a generated value, handled as the next section says.
3. **Capabilities are pinned and recorded.** A chart that checks for an API, such as a
   ServiceMonitor that needs `monitoring.coreos.com/v1`, is rendered with that API
   declared when another component of the same platform provides it. The declared
   APIs are recorded with the render. A render that fails for a missing capability
   fails loudly; it never drops the object without saying so.
4. **Cluster lookups are named.** A template that calls `lookup` depends on the live
   cluster. That makes the source `unsafe-to-flatten` unless a named route supplies
   the value.
5. **Hooks travel as routes.** A hook is recorded as a route beside the objects, never
   dropped without a record. `cub helm template` drops hooks unless it is given
   `--include-hooks`, so a caller that relies on it records the dropped hooks.
6. **Every object has one owner.** When two components of one platform render the
   same object, such as a CRD both a chart and a bootstrap chart carry, one keeps it
   and the other copy is dropped and named.

## Where the verdict comes from

The Catalog decides first, but only for a configuration it assessed. The index,
`site/listings/index.json`, is for finding an entry. The verdict applies only when
the plugin's render inputs match the entry's `source.fixedAtBuildTime` in its
detailed listing, `site/listings/<id>.json`. Those inputs are the chart and version,
the base, the values, the namespace, the release name and the capability profile.
The verdict also applies when the plugin's canonical object set equals the entry's,
computed as the last section says.

When the chart and version match but other inputs differ, the Catalog's verdict is
evidence about a related configuration, not the verdict for this one. The plugin then
runs the checks above and records its result as decided locally. A local decision is
useful to the user, but it is not a Catalog verdict and is never published as one.
The entry's `flattened.scope` also names when a verdict must be rechecked, such as
after a destination or delivery runtime change.

## Generated values keep a source unsafe until a route is proved

A render that does not repeat has generated something. The source stays
`unsafe-to-flatten` and renders late, unless a receipt establishes a route for that
value on that target and delivery runtime. Prose does not change a lane. This
follows [Secret Lifecycle](./secret-lifecycle.md) and the Catalog's existing
verdicts. Bitnami nginx 24.0.2, for example, generates a TLS certificate at render
time and stays `unsafe-to-flatten`.

**A value generated into a Secret** can be routed in the ways Secret Lifecycle names:
an existing-Secret base, a Secret staged as a target fact, or a secret store such as
External Secrets. One more route has been measured for one runtime. ConfigHub holds
the Secret with its keys and without its values, and Argo CD ignores Secret `data`
with `RespectIgnoreDifferences=true`. On Argo CD 3.5.2, on 2026-09-27, automatic
syncs, later releases and rotations kept the live value, and a manual sync without
`RespectIgnoreDifferences` emptied it. That is a measurement, not yet a receipt, and
it does not carry to Flux, Sveltos or direct apply. Where that route applies, an
annotation that hashes the values, such as `checksum/secret`, travels without them.

**Lifecycle state in a Secret**, such as a webhook serving certificate a controller
fills, takes a lifecycle lane, as Secret Lifecycle says. A certificate the chart
generates itself is not lifecycle state; it is a generated value.

**A value generated anywhere else**, such as a random name or an identifier minted
per render, has no companion that can recover it. The source renders late.

## Render late is a route, not a refusal

An `unsafe-to-flatten` source still has a path into ConfigHub. The source and its
inputs stay authoritative, and the processor runs near the cluster. Each plugin offers
that route instead of stopping.

| Where | The render-late route |
| --- | --- |
| The Catalog | The installer package |
| `cub helm` | The `HelmSource` Unit, which keeps the chart, values and options as the source of truth |
| `cub sveltos` | Sveltos's own Helm delivery for that chart |
| `cub argo`, `cub flux` | The Argo CD Helm source or Flux HelmRelease, left as it is |
| `cub kubara` | Kubara's ApplicationSet for that service, left on its Git source |

## The canonical object set

Two renders hold the same configuration exactly when their canonical object sets are
equal. Every plugin computes the digest the same way.

1. Parse every YAML document, and drop empty documents. Parsing drops comments,
   such as `# Source:`.
2. In an Argo CD Application, parse the string at `spec.source.helm.values` as YAML,
   so embedded values compare as data rather than text.
3. Give each object the identity `apiVersion|kind|namespace|name`, with an empty
   string for a missing namespace.
4. Wrap each object as `{"identity": …, "document": …}`, and sort the list by
   identity.
5. Serialize the list as JSON with every object's keys sorted and no whitespace.
6. Hash the result with SHA-256, write it as `sha256:` followed by the hex digest,
   and record it as `objectSetSha256`.

`objectSetDigest` in `scripts/generate-aicr-platform-variant.mjs` implements exactly
these steps, with `identityFor` from `scripts/lib/proof-common.mjs`. Other scripts in
the repository hash rendered text instead. They should converge on this one, and
each plugin should compute the same value.

This matters when the same chart reaches two clusters by two routes, as a Kustomize
overlay on one and a HelmRelease on another. The objects agree, and the bytes do not.
Compared as text, ConfigHub would show a difference that is not there.

## What each plugin does today

| Plugin | Verdict | Generated values | Render late | Canonical set |
| --- | --- | --- | --- | --- |
| `cub sveltos` | Decided locally by `chartrender` | Refuses any chart that does not repeat | Offered in `chartrender`'s documentation | Compares with what Helm installed (`chartrender` compare) |
| `cub kubara` | Shows Catalog evidence, not the verdict | Keys-only Secrets and emptied `checksum/secret`: the Argo CD route, measured but not yet a receipt | Services without a route stay on Git | Byte comparison of renders |
| `cub argo` | None yet | Not handled yet | A bare chart source is reported and left as it is | Compares what Argo CD owns with what the release holds, object by object (`CompareInventory`) |
| `cub flux` | None yet | Not handled yet | HelmReleases are listed and left as they are | Not yet stated |
| `cub helm` | None | Not checked | The `HelmSource` Unit | Not recorded |

## What is not settled yet

Each open item has an owner.

- **Overlays have no Catalog verdict.** The Catalog decides verdicts for Helm, AICR,
  Timoni, Kubara and literal YAML. A Kustomize overlay is the main input for Argo CD
  and Flux, and it has none. The Catalog owns this (#2001).
- **`cub helm template` cannot declare capabilities.** Plain `helm template` takes
  `--api-versions`, and `cub helm template` has no equivalent. On 2026-09-28 it
  rendered four of five Kubara charts and failed on traefik for this reason.
  ConfigHub owns this ([confighub/cub-helm#2](https://github.com/confighub/cub-helm/issues/2)).
- **The plugins move to per-file Units.** `cub kubara` and `cub helm` follow the
  certified bundle spec's ingest contract, as the section above says. Each plugin's
  repository owns its move.
- **Where the checks run.** They could move into `cub helm` itself as flags, so every
  caller gets them from one command. ConfigHub and the Catalog decide this together.

## Related

- [When to flatten configuration](./flattening-alignment.md)
- [Deciding a flattening lane](./deciding-a-flattening-lane.md)
- [Secret Lifecycle](./secret-lifecycle.md)
- [The certified bundle spec](./certified-bundle-spec.md)
- Rule 6, "Never silent", and rule 10, "A claim must be openable", in [the doctrine](../../tests/doctrine.md)
- [sveltos-confighub `chartrender`](https://github.com/confighub/sveltos-confighub/tree/main/chartrender)
- [kubara-confighub: the `cub kubara` guide](https://github.com/confighub/kubara-confighub/blob/main/docs/user/cub-kubara.md)
