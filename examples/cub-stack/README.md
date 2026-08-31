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
node scripts/cub-stack.mjs upload web-tiny          # prints the governed-upload plan
node scripts/cub-stack.mjs upload web-tiny --run    # uploads it live into ConfigHub
```

`sandbox` certifies the composition and renders it with no infrastructure. `certify`
runs the gate alone and exits non-zero on a conflict. `upload` certifies, then
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

A conflict is the hard failure. `metrics-double` is rejected because two copies of
metrics-server claim the same nine objects.

## The example stacks

All are composed from committed chart renders, and all but `metrics-double` certify.

- **observability-base** — cert-manager, metrics-server, kube-prometheus-stack. 175
  objects, 10 CRDs before 50 custom resources.
- **web-platform** — cert-manager, ingress-nginx, kube-prometheus-stack. Carries
  exactly what an app like `shop-web` depends on (see [cub app](../cub-app/README.md)).
- **data-services** — redis, postgresql, rabbitmq. A clean stateful tier, 31 objects,
  no CRDs.
- **gitops-secrets** — cert-manager, external-secrets, argo-cd. Three CRD-shipping
  components, 26 CRDs composed together.
- **web-tiny** — two ConfigMaps, sized for a live `upload --run`.
- **metrics-double** — two copies of metrics-server, rejected on conflict.

Sandbox is Config Workshop's free mode, one rung up: the anonymous browser Check
renders a single config for free, and `cub stack sandbox` renders a whole certified
composition for free. Same "look before you install," no account, no cluster.

## The keystone as a stack

`eks-inference` is the flagship: the EKS inference platform composed from eight digest-pinned certified bundles across three planes, pulled by digest and hash-verified against their receipts before a single object parses. `cub stack sandbox eks-inference` certifies and renders all 130 objects for free, names the hub plane as held in ConfigHub, and reports the shared ACK CRDs carried more than once inside one component instead of hiding them. Its governed upload is the proven organization rebuild, and the full eight-check composition verdict is the committed judgment the certify step cross-references.

## The second producer

`kubara-platform` is the second producer through the same verbs: the composition proposal's stage-one Kubara platform of cert-manager, Traefik, and metrics-server, composed from the catalog's certified renders and certified at 86 objects with its namespace prerequisites named. The eks-inference stack proves the bundle form; this one proves the render form.

## Where this fits

`cub stack upload <name>` creates the governed base and dev variants in ConfigHub,
gated on review; releasing through OCI and reconciling with the team's own Argo CD or
Flux is the delivery step, and governing it makes it a platform. The certify step
reuses the certified-bundle machinery rather than inventing a new one, which is the
whole point: the moat is composing correctly, not a component picker. The workload
side is [cub app](../cub-app/README.md). See the custom-stacks-and-apps proposal and
the composition-certification brief for the full model.
