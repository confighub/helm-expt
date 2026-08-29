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

## The four nouns

Each noun names a layer that the site already has, and each becomes a `cub` verb.

- `cub app <name>` installs and operates a user's workload. This is the spine the
  website already runs, where a person brings a configuration, sees what it does,
  promotes it, and keeps it. The app is the thing that runs on a platform.
- `cub stack <name>` installs a certified composition of catalog components. A
  stack is the platform or infrastructure the app runs on. The eks-inference stack
  is one example. A custom stack is one a user composed from the same certified
  parts.
- A platform is the governed keystone, where apps run on stacks with identity,
  approvals, releases, rollback, drift repair, and a fleet view. Kubara builds one.
- `cub server` installs self-hosted ConfigHub itself. Jesper is releasing this now,
  and its naming set the `cub <noun>` house pattern this proposal follows.

The vocabulary reads as one system. A component is a part. A stack composes parts.
An app runs on a stack. A platform governs apps and stacks. A server hosts all of
it. The site already separates these roles, so the nouns name what is there rather
than inventing new concepts.

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

## Open questions

- Naming. `cub stack` and `cub app` follow Jesper's `cub server` pattern, so this
  is worth deciding together with him rather than in isolation.
- Boundary. A large custom stack and a small Kubara platform start to look alike.
  The proposal keeps a stack as infrastructure a person installs and a platform as
  the governed keystone, but the line needs a clear test.
- Tier. The compose and sandbox render should stay anonymous and free, in keeping
  with the look-before-you-install ethos, while keeping, promoting, and governing a
  stack need an account. This mirrors the existing value ladder.
- Assistant role. Composing a stack from a goal is an obvious place for the
  assistant, which is the same AI-produces-configuration-and-we-make-it-trustworthy
  wedge, one level up from a single chart.

## What to prove first

Prove the certify step on two or three real stacks before making compose-your-own
a headline. An inference stack and an observability stack are good candidates,
because both have real cross-component constraints. If the certify engine holds
across those, the self-serve flow rests on something real.
