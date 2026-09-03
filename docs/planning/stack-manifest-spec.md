# The stack manifest, specified

Future stacks are built by many producers and certified by one engine, and the stack manifest is where they meet. A human writes one directly, Kubara or AICR can emit one from their own composition models, and an assistant can propose one from a goal. Whoever authors it, the manifest is the neutral artifact the shared verbs consume: `cub stack certify` judges it, `cub stack sandbox` renders it for free, and the upload path builds the governed organization from it. The prototype in [cub-workshop](https://github.com/confighub/cub-workshop) implements this spec today, and [eks-inference](https://github.com/confighub/cub-workshop/blob/main/stacks/eks-inference.yaml) is its worked instance. Graduating the format into the product is a product decision this page prepares.

## The shape

```yaml
apiVersion: helm-expt.confighub.com/v1alpha1
kind: Stack
metadata:
  name: <stack-name>
spec:
  description: "<one sentence>"
  fullVerdict: <repo path>          # optional: the committed eight-check verdict
  components:
    - name: <component>
      plane: hub | mgmt | workload  # optional; see planes
      order: <int>                  # optional; ties inside a plane
      # exactly one source form:
      bundle: "oci://<ref>@sha256:<digest>"   # a retained certified bundle
      receipt: <repo path>                    # required with bundle
      render: <repo path>                     # a committed chart render
      authored: <repo path>                   # literal YAML the stack authors
  bindings:                         # optional: the declared link set
    pathBindings:
      - component: <component>
        unit: <unit>
        field: <profile field>
        resourceType: <apiVersion/Kind>
        resourceName: <ns/name or /name>
        path: <normalized path>
        pathEscaped: <path with ~1 escapes>
        upstream: <profile path>
    envBindings:
      - component: <component>
        unit: <unit>
        field: <profile field>
        container: <container name>
        envVar: <NAME>
```

## The three component forms

A **bundle** selects retained, certified content by digest. The consumer pulls it once into a digest-keyed cache and hash-verifies every file the named receipt lists before parsing an object, so a bundle component cannot drift from its certification. A **render** points at a committed chart render, the original prototype form. An **authored** component is literal YAML the stack itself owns, first-class rather than a workaround, because every real platform carries objects no chart renders; the eks-inference platform carries seven of them. Exactly one form per component.

## Planes and order

Planes express the ordering a composition needs across delivery boundaries: the hub plane is held in ConfigHub and never applied to a cluster, the management plane converges before the workload plane deploys, and `order` breaks ties inside a plane. The certify step's ordering checks use this sequence, and the sandbox render reports it. Cross-plane convergence itself, waiting for one plane before the next, remains the deliverer's job, which is the same boundary the producer's own workflow documents.

## Bindings

Bindings declare the shared-value fan-out: which profile field feeds which downstream path or environment variable. Declaring them in the manifest, rather than in producer code, is what lets a generic upload wire the links, and it is what the single-owner check reads, so a literal copy the links would not repair is a named finding rather than an invisible drift. The eks-inference bindings were derived mechanically from the producer's link declarations, and the manifest is now the single source both the composition verdict and the organization rebuild read.

## Certification, and the armed gate

The prototype's certify runs four checks on every stack: cross-component conflicts, with byte-identical same-component duplicates classified as a warning because the last occurrence wins at apply; CRD-before-CR ordering along the plane sequence; admission webhook certificate paths; and namespace prerequisites. The full eight-check composition verdict remains the committed judgment a stack's `fullVerdict` field cross-references.

For eks-inference the verdict is armed as a regression gate in the verify chain: `run-eks-inf-composition-verdict.mjs --gate` refuses any new finding, any check that slips from pass, and any composition-digest change the committed verdict has not recorded. The triaged findings of the known-good stack stay visible and accepted; anything new fails the pull request that introduced it. This is the staged arming the composition proposal called for: annotate first, triage, then refuse.

## Fleets: the placement layer

The stack manifest deliberately excludes destinations, the same portability rule Kubara's portable packages follow, so "which clusters does each component land on" needs a home of its own. The fleet manifest is that home: a clusters list, where one may be marked real and wired by `cub cluster up` while the rest stay sandbox scaffolding, and placements that put a stack or an authored app onto named clusters. The component-and-target matrix the doctrine has always kept as a report becomes a declaration the generator consumes.

The three layers separate cleanly. The stack manifest says what a platform is made of. The fleet manifest says where each piece runs. And the attention states a fleet view renders, pending changes, variants behind their base, blocked releases, rollouts in flight, are not manifest data at all: they are the residue of operations, produced by replaying the ladder. [The fleet generator](https://github.com/confighub/cub-workshop/blob/main/lib/fleet.mjs) runs all three layers from [a worked fleet manifest](https://github.com/confighub/cub-workshop/blob/main/fleets/meridian.yaml) and recomputes the four attention tiles from the same fleet queries a components view renders, with [a committed receipt](../../data/fleet-slice/receipt.yaml) that includes one real cluster's controller rows.

## The published form: an index of images

The manifest is a source file. Its published form is an OCI image index whose
entries are the component bundles by digest, with the manifest and the certify
verdict attached to the index digest as a record. The Catalog holds indexes, not
manifests. A release of the stack is a second, flattened artifact, because a
reconciler pulls one manifest; the receipt links the index and the release. The
plugin's `cub stack publish` produces the index and `cub stack sandbox --out
oci://` the flattened form. See `oci-design-center.md`.

## Prior art and relatives

The envelope and the references are standard; the composition semantics assemble proven patterns; two pieces are ours. Syntactically the manifest is KRM YAML, so graduating it to a CRD, or holding it in ConfigHub as a Unit the way the platform profile is held, is a rename rather than a redesign. The bundle references use OCI digest addressing, the same supply-chain practice as Helm OCI charts, Flux OCIRepositories, ORAS, and cosign.

| Relative | Relationship |
| --- | --- |
| Helm | The component producer, and one deliberate inversion: Helm composes templates before rendering, the manifest composes certified artifacts after rendering, which is what makes the composition checkable. |
| Kustomize, plain KRM repos | The render and authored forms compose committed YAML by path, the same spirit without digests, planes, or bindings. |
| kpt | The closest philosophical ancestor, configuration as data with packages and setters; the bindings' field-and-parameter model descends from its setters. |
| Crossplane Compositions | The structural twin of bindings, fromFieldPath to toFieldPath, with the difference that Crossplane demands its runtime controller while bindings are data that ConfigHub links execute. |
| OCM component descriptors | The nearest match for bundle-plus-receipt provenance, without a certify step. |
| Timoni | OCI-referenced module bundles, already a catalog format here; a natural manifest emitter. |
| Score | The other end of the seam: Score specifies what a workload needs, the stack specifies what a platform provides, and cub app already exports Score. |
| Argo CD and Flux | The consumers. Planes and order map down onto sync waves and dependsOn inside one cluster; the cross-plane wait stays the deliverer's job. |
| AICR | A manifest emitter, not an alternative: its profile-owned values and refuse-on-conflict rule map onto bindings and the verdict, and its platformDigest is the same primitive as the composition digest. |

### The Kubara platform index, the nearest relative of all

Kubara's adoption step four compiles one OCI package per effective component and one digest-bound platform index that references their exact manifest and layer digests, with destination bindings, cluster facts, and secrets excluded from the portable packages. That index is a producer-private stack manifest, and the correspondence is close to one-to-one: its member packages are the components list, its platformDigest is the composition digest the armed gate now enforces, its source-and-intent record is the receipts-and-verdict honesty pattern, and its exclusion of destination bindings is the same portability rule this manifest keeps. Two differences carry the design. Kubara's wiring plan recovers the needs-and-provides graph from rendered output and classifies without gating, while the manifest declares bindings and the checks gate on them; reconciling extracted against declared is a check waiting to exist, and the extractor is the natural deriver of future bindings. And hub-and-spoke is cluster topology while planes are apply phases, overlapping but not the same thing. The convergence path is for Kubara's exporter to emit a stack manifest beside its index until they are one artifact, which is what the composition proposal's shared certifying layer asks of every producer.

Both producer paths now run through the same verbs: the eks-inference stack proves the bundle form, and [kubara-platform](https://github.com/confighub/cub-workshop/blob/main/stacks/kubara-platform.yaml), the composition proposal's second stage-one target, proves the render form, certified at 86 objects with its prerequisites named.

## What stays open

- Graduating the format from the prototype's `helm-expt.confighub.com/v1alpha1` into the product surface is a product decision.
- Bindings currently name one upstream, the platform profile; a general form would name the owning unit per binding.
- Authored components are copied knowledge, not derived: the manifest gives them a home, and turning recurring authored patterns into catalog content remains the longer game.
