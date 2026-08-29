# cub stack (prototype)

A stack is a certified composition of components, installed by name. This prototype
implements the consumer side of the `cub <noun>` idea: `cub stack <name>` resolves a
named composition from the catalog, certifies it, and renders it for free in a
sandbox. No cluster, no account.

## The nouns

- **component** — one certified part, such as a chart.
- **stack** — a certified composition of components, published and installed by name.
- **platform** — a stack put under governance.
- **app** — a workload that runs on a platform, or straight from OCI.
- **server** — self-hosted ConfigHub.

## Run it

```bash
node scripts/cub-stack.mjs list
node scripts/cub-stack.mjs sandbox observability-base
node scripts/cub-stack.mjs certify metrics-double
node scripts/cub-stack.mjs install web-tiny          # prints the governed-install plan
node scripts/cub-stack.mjs install web-tiny --run    # installs it live in ConfigHub
```

`sandbox` certifies the composition and renders it with no infrastructure. `certify`
runs the gate alone and exits non-zero on a conflict. `install` certifies, then
creates a governed base variant holding the composition and a dev deployment variant
whose release is gated on review. Without `--run` it prints the plan and changes
nothing; with `--run` it drives cub end to end (the same review-gated promotion path
proven live). `web-tiny` is a two-component stack sized for a live run.

## What certify checks

The certify step is where the work is. It composes the components' rendered objects
and reports what a delivery would have to get right:

- **resource conflicts** — no two components claim the same object.
- **CRD-before-CR ordering** — every custom resource's CRD is present and delivered
  first, across components.
- **admission webhooks** — which need a caBundle, and whether cert-manager is in the
  stack to issue it.
- **namespaces** — which are created and which must already exist.

A conflict is the hard failure. `observability-base` certifies clean (175 objects, no
collisions, 10 CRDs before 50 custom resources). `metrics-double` is rejected because
two copies of metrics-server claim the same nine objects.

## Where this fits

`cub stack install <name>` creates the governed base and dev variants in ConfigHub,
gated on review; releasing through OCI and reconciling with the team's own Argo CD or
Flux is the delivery step, and governing it makes it a platform. The certify step
reuses the certified-bundle machinery rather than inventing a new one, which is the
whole point: the moat is composing correctly, not a component picker. The workload
side is [cub app](../cub-app/README.md). See the custom-stacks-and-apps proposal and
the composition-certification brief for the full model.
