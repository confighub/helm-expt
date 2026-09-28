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

This page says how each of them applies the one model. It adds no new verdict. It
names the processor for each kind of source, the checks every render passes, where
the verdict comes from, how generated values split, when to render late, and what
counts as the same object set.

## The contract

A plugin materializes a source with the processor for that kind of source. It checks
the render against the same criteria the Catalog uses. It takes the verdict from the
Catalog when the Catalog holds that exact source, and decides locally, saying so,
when it does not. Generated Secret values stay with the target, and any other
generated value sends the source to render late. Two renders are the same
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

## Every render passes the same checks

These are the criteria the Catalog already uses, stated for a render a plugin makes.

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

The Catalog decides first. When the Catalog holds the exact chart version and base, its
`flatteningVerdict` applies, read from `site/listings/index.json`. A plugin shows that
verdict and links the entry.

When the Catalog does not hold that exact source, the plugin runs the checks above and
records its result as decided locally. A local decision is useful to the user, but it
is not a Catalog verdict and is never published as one. A version that differs from a
Catalog entry by one patch release is a different source.

## Generated values split in two

A render that does not repeat has generated something. Where it generated the value
decides the answer. This follows [Secret Lifecycle](./secret-lifecycle.md).

**A value generated into a Secret** is credential material, such as a chart's random
admin password. The source is `flatten-with-routes`. ConfigHub holds the Secret with
its keys and without its values, and the values are owned by the target: staged as a
target fact, supplied by a secret store such as External Secrets, or taken from an
existing Secret. An annotation that hashes those values, such as `checksum/secret`, is
emptied with them. The delivery path must not overwrite the live values. For Argo CD
that means `ignoreDifferences` on Secret `data` with `RespectIgnoreDifferences=true`.
This was measured on Argo CD 3.5.2 on 2026-09-27: automatic syncs, later releases and
rotations kept the live value, and a manual sync without `RespectIgnoreDifferences`
emptied it.

**Lifecycle state in a Secret**, such as a webhook serving certificate a controller
fills, takes a lifecycle lane, as Secret Lifecycle says.

**A value generated anywhere else**, such as a random name or an identifier minted per
render, cannot be recovered by a companion. The source is `unsafe-to-flatten`, and it
renders late.

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
equal. The canonical form is computed the same way everywhere.

1. Parse every YAML document, and drop empty documents.
2. Identify each object by API group, kind, namespace and name.
3. Remove comments a generator adds, such as `# Source:`.
4. Sort the objects by identity.
5. Serialize each object as JSON with its keys sorted.
6. Hash the result with SHA-256, and record it as `objectSetSha256`.

This matters when the same chart reaches two clusters by two routes, as a Kustomize
overlay on one and a HelmRelease on another. The objects agree, and the bytes do not.
Compared as text, ConfigHub would show a difference that is not there.

The repository computes this in more than one way today. `objectSetDigest` in
`scripts/generate-aicr-platform-variant.mjs` follows the steps above, and some other
scripts hash rendered text. They should converge on one implementation, and each
plugin should compute the same value.

## What each plugin does today

| Plugin | Verdict | Generated values | Render late | Canonical set |
| --- | --- | --- | --- | --- |
| `cub sveltos` | Decided locally by `chartrender` | Refuses any chart that does not repeat | Offered in `chartrender`'s documentation | Compares with what Helm installed (`chartrender` compare) |
| `cub kubara` | Shows Catalog evidence, not the verdict | Keys-only Secrets, emptied `checksum/secret` | Services without a route stay on Git | Byte comparison of renders |
| `cub argo` | None yet | Not handled yet | A bare chart source is reported and left as it is | Compares what Argo CD owns with what the release holds, object by object (`CompareInventory`) |
| `cub flux` | None yet | Not handled yet | HelmReleases are listed and left as they are | Not yet stated |
| `cub helm` | None | Not checked | The `HelmSource` Unit | Not recorded |

## What is not settled yet

- **Overlays have no Catalog verdict.** The Catalog decides verdicts for Helm, AICR,
  Timoni, Kubara and literal YAML. A Kustomize overlay is the main input for Argo CD
  and Flux, and it has none.
- **`cub helm template` cannot declare capabilities.** Plain `helm template` takes
  `--api-versions`, and `cub helm template` has no equivalent. On 2026-09-28 it
  rendered four of five Kubara charts and failed on traefik for this reason.
- **Granularity differs.** `cub helm` stores a chart as many Units, one per object
  group. `cub kubara` stores one Unit per component. A platform that mixes the two
  needs one rule.
- **Where the rules live.** The checks above could move into `cub helm` itself as
  flags, so every caller gets them from one command.

## Related

- [When to flatten configuration](./flattening-alignment.md)
- [Deciding a flattening lane](./deciding-a-flattening-lane.md)
- [Secret Lifecycle](./secret-lifecycle.md)
- Rule 6, "Never silent", and rule 10, "A claim must be openable", in [the doctrine](../../tests/doctrine.md)
- [sveltos-confighub `chartrender`](https://github.com/confighub/sveltos-confighub/tree/main/chartrender)
- [kubara-confighub: the `cub kubara` guide](https://github.com/confighub/kubara-confighub/blob/main/docs/user/cub-kubara.md)
