# Custom stacks and apps, and the `cub <noun>` vocabulary

This is a proposal, not a decision. It captures an idea that surfaced while
reviewing `cub eks-inf`, and it sits on tracks that already exist (the certified
bundle work and roadmap lines 93 and 139). Treat it as something to pressure-test.

## The idea in one line

Give a user a `cub stack <name>` verb that installs a stack by name from the
ConfigHub and catalog system, and a `cub app <name>` verb for their own workload,
so that composing a stack and running an app become named, self-serve operations
rather than curated one-offs.

## What `cub eks-inf` already teaches

The eks-inference plugin is a consumer tool for a stack that was certified
upstream. Its build steps, which are render, guard, and bundle, are deliberately
absent from the plugin. They run only in the eks-inference repository and its CI,
because they need the source tree, Helm, and GNU tar. The plugin covers what a
consumer of the stack does. It installs component bases from OCI bundles, deploys
downstream variants and publishes their releases, enrolls a cluster, and owns
shared values through a platform profile. It also has a `sandbox` command that
builds the whole configuration with no infrastructure, for free.

Two things follow. The consumer model is already proven, so a custom stack can
reuse it. And the hard part is the certify step, which eks-inf pushes to CI
precisely because composing components correctly is where the work is.

## The nouns, and where each one lives

Each noun is a layer the site already has, and each becomes one `cub` verb. Read
the table top to bottom as parts becoming a running, governed system.

| Noun | What it is | Its state | Verb |
| --- | --- | --- | --- |
| Component | one certified part, such as a chart | a part in the Catalog | the existing `cub unit` surface |
| **Stack** | a certified composition of components, named and published as one OCI bundle | an **artifact** — nothing is running | `cub stack <name>` |
| **Platform** | a stack that has been installed and put under governance | a **running, governed instance** | Kubara, and platform operations |
| **App** | a workload | its own OCI bundle that reconciles onto a cluster | `cub app <name>` |
| Server | self-hosted ConfigHub itself | the substrate under all of it | `cub server` |

One sentence holds it together: a component is a part, a stack composes parts into
an artifact, a platform is that artifact installed and governed, an app is a
workload that runs on it, and a server hosts the whole thing.

## The stack and platform boundary, resolved

A stack and a platform are the same content in two states, so the cut is **artifact
versus governed instance**, not infrastructure versus keystone.

- A **stack** is a noun you can hold. It is a named, digest-addressed OCI bundle in
  the catalog. Nothing is running yet.
- A **platform** is that same stack installed and under governance. It is running,
  with identity, approvals, releases, rollback, drift repair, and a fleet view.

A stack is to a platform as a container image is to a running, orchestrated
deployment. The bytes are the same. The difference is whether they are standing up
under rules.

**Kubara is the stack builder.** It selects components from the catalog, renders and
wires them, and produces a named OCI bundle with a `PlatformDigest`. That bundle is
a stack. Standing it up under ConfigHub governance is what turns it into a platform.
So a person does not build a platform and rename it a stack. A person builds a
stack, and governing it makes it a platform.

## Does a stack provision its own cluster?

Do not split the stack noun by whether it carries a cluster. The question dissolves
once every part of a stack is treated as config.

- A stack is always config that reconciles onto a cluster. There is always a seat
  cluster to reconcile onto.
- Cluster provisioning, when a stack needs it, is just more components in the stack.
  ACK, Crossplane, and Cluster-API resources are config that reconciles onto a small
  bootstrap cluster and creates the real one. eks-inf shows this in the open. Its
  management plane runs on a kind cluster and applies the provisioning config, and
  its workload plane runs on the cluster that config created.

**Default a stack to target a cluster the user brings, and make provisioning an
explicit opt-in layer.** Three reasons make this the right default rather than a
coin flip.

1. It protects the strongest asset. The anonymous Flux and Argo path works because a
   stack is OCI a person points their own reconciler at. Baking provisioning into
   the base stack would couple it to one cloud, since ACK is AWS only, and break
   "reconcile onto the cluster you already run."
2. It keeps the stack portable. The same stack lands on kind, EKS, GKE, or an
   existing cluster. Provisioning ties it to one provider.
3. It matches the spine. Config as data, delivered over OCI, reconciled by the
   user's Argo or Flux. Provisioning as config fits that. Provisioning as a special
   mode fights it.

**Include the provisioning layer only when the cluster's shape is inseparable from
what the stack is for.** Inference needs GPU nodes on EKS, which a person cannot
sensibly bring, so eks-inf composes provisioning in. Generic platform services such
as cert-manager, ingress, and monitoring run anywhere, so a Kubara-style stack
targets whatever cluster the user already has. So this is a per-stack composition
choice, not a global scope. eks-inf and a Kubara platform are both stacks at one
noun, and they differ only in whether the provisioning components are in the bundle.

The `sandbox` render keeps this honest. It builds the whole stack for free with no
infrastructure, including the provisioning config, so even a provisioning stack
stays inspectable before anything is applied.

## What does an app deploy onto?

`cub app <name>` pulls the app's reviewed OCI bundle from the catalog and reconciles
it onto a cluster through the Argo or Flux the team already runs.

An app does not need a stack or a platform to exist. A self-contained app goes
straight to a cluster from OCI, which is the same anonymous Flux and Argo path the
site already proves. An app needs a platform only for its dependencies, such as TLS
from cert-manager, an ingress controller, or monitoring, and those come from a
stack. So a standalone app runs direct, and an app with dependencies lands on a
platform that carries the stack it needs.

## How a custom stack would flow

The flow reuses the certified bundle model end to end.

1. A person starts from the Catalog, which holds the certified parts.
2. They pick components, or an assistant assembles a candidate stack from a goal.
3. The system certifies the composition. It renders the objects and checks
   versions, CRDs, shared dependencies, and conflicts across components. This is
   the step that earns its keep.
4. The certified stack is published to ConfigHub and the catalog as a named stack,
   as a bundle with receipts.
5. `cub stack <name>` installs it, and `sandbox` renders it for free with no
   infrastructure, which keeps the anonymous first-look promise at stack altitude.
6. Delivery goes through the reconciler the team already runs, which is Argo CD or
   Flux, and the reviewed result stays in ConfigHub.

Curated stacks like eks-inference become templates a person forks. A custom stack
is one a person composes from the same parts.

## Where this fits the site

The proposal answers a gap the topology review named. Between checking one chart at
the entry and governing a fleet at the keystone, there was a long climb with no
middle. The two middle rungs are the app and the stack. `cub app` names the spine
that already exists. `cub stack` names the build rung that composes infrastructure.
The keystone stays the platform.

The map that shows this is the Keystone and Spine artifact. It now carries the
`cub <noun>` vocabulary and marks the stack rung.

## Where the work actually is

The moat is the certify step, not the picker. A stack builder that only lets a
person select components, without proving the composition renders and reconciles,
ships the composition problem to the user. The value is the certified bundle
engine, which already produces a per-component and per-variant verdict. This
proposal reuses that engine rather than building new machinery, so the
architecture risk is low and the build risk sits in one place.

## What is already true

- The doctrine states the job as inspect, test, compare, change, promote, deploy,
  operate, or build an application or platform. Application and platform are
  already the two build targets.
- The site runs the app lifecycle today through the check and promote pages, and it
  carries pages for custom and existing apps.
- The roadmap already asks a user to compose a platform from tested components on
  lines 93 and 139.
- The certified bundle track and its spec provide the compose and certify
  machinery.
- eks-inf proves the consumer model and the free sandbox render.

## Settled above

Two questions that earlier drafts left open are now decided in the sections above,
and they are recorded here so the decisions do not get relitigated.

- The stack and platform boundary is artifact versus governed instance. Kubara
  builds the stack, and governing it makes it a platform.
- A stack does not carry a cluster by default. Provisioning is an opt-in composed
  layer, included only when the cluster's shape is inseparable from the stack's
  purpose.

## Open questions

- Naming. `cub stack` and `cub app` follow Jesper's `cub server` pattern, so decide
  them together with him rather than in isolation.
- Tier. Composing a stack and rendering it in `sandbox` should stay anonymous and
  free, in keeping with the look-before-you-install ethos, while keeping, promoting,
  and governing a stack need an account. This mirrors the existing value ladder.
- Assistant role. Composing a stack from a goal is an obvious place for the
  assistant. It is the same wedge as turning one AI-produced chart into a
  trustworthy result, one level up.

## What to prove first

Prove the certify step on two or three real stacks before making compose-your-own
a headline. An inference stack and an observability stack are good candidates,
because both have real cross-component constraints. If the certify engine holds
across those, the self-serve flow rests on something real.
