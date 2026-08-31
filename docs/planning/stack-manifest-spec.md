# The stack manifest, specified

Future stacks are built by many producers and certified by one engine, and the stack manifest is where they meet. A human writes one directly, Kubara or AICR can emit one from their own composition models, and an assistant can propose one from a goal. Whoever authors it, the manifest is the neutral artifact the shared verbs consume: `cub stack certify` judges it, `cub stack sandbox` renders it for free, and the upload path builds the governed organization from it. The prototype in [examples/cub-stack](../../examples/cub-stack/README.md) implements this spec today, and [eks-inference](../../examples/cub-stack/stacks/eks-inference.yaml) is its worked instance. Graduating the format into the product is a product decision this page prepares.

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

## What stays open

- Graduating the format from the prototype's `helm-expt.confighub.com/v1alpha1` into the product surface is a product decision.
- Bindings currently name one upstream, the platform profile; a general form would name the owning unit per binding.
- Authored components are copied knowledge, not derived: the manifest gives them a home, and turning recurring authored patterns into catalog content remains the longer game.
