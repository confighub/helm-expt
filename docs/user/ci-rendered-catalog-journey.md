# Your CI already renders your charts. Hold the renders as data.

Many platform teams render their chart catalog through CI into plain YAML and commit the result to git, and a reconciler deploys from there. If that is you, you have already accepted the premise this site is built on: render first, then commit the exact objects. What you are holding is the weak form of it, rendered configuration stored as text in a repo. This journey takes those exact files and holds them as governed data instead, and your Argo CD or Flux keeps pulling the same way it does today.

The whole journey is a recorded run with [a committed receipt](../../data/ci-rendered-catalog/receipt.yaml), and every step is one command you can repeat with [the journey driver](../../scripts/run-ci-rendered-catalog-journey.mjs).

## Land the renders you already have

The fixture is three CI-rendered files taken verbatim from this catalog's committed renders, a Redis, a metrics-server, and a Traefik, standing in for a private repo of rendered charts. Each file gets the free look first, `cub check`, which names its advisory findings with stable identifiers. Then each lands with one command:

```sh
cub variant upload --component redis --variant base --granularity per-resource redis.yaml
```

The receipt carries the claim that matters: the objects in ConfigHub are canonically equal to the files CI rendered. Nothing is lost in the move, so there is nothing to re-review.

## What data adds over text

Four things happened next in the recorded run, none of which a repo of YAML text can do.

**A query, not a grep.** `cub k8s get deploy --space "*"` answers "which Deployments exist across the whole catalog" in one line, and the same surface filters by image, field values, or labels, server-side.

**A change with its reason attached.** One governed edit annotated the Traefik Deployment with a change description. The description is visible in `cub revision list`, so the history reads as decisions, not diffs. The receipt records the consequence honestly: the data now differs from the frozen CI file in exactly that one annotation, and the history says why. Text stays frozen; data moves with its reason.

**An environment variant with a protected choice.** Staging was cloned from the Redis base in one command, and its replica count was set with `--protect`, so the choice belongs to staging. `cub unit get -o mutations` lists it under locally overridden, and an upstream refresh will not silently flatten it.

**A release by digest.** Publishing staging produced a release whose manifest digest is what a reconciler pulls. The exact-digest handoff to Argo CD and to Flux is proven separately, with receipts, in [the operator ladder record](../../data/ai-operator-ladder/summary.md) and [the Flux delivery receipt](../../data/eks-inf-replica/flux-delivery/receipt.yaml); this journey's release rides the same mechanism.

## Where this journey ends and the commercial tier begins

Everything above runs against a disposable organization with public content, and you can repeat it today. A private catalog at CI scale, private sources, team access, approvals as policy, and production responsibility, is the commercial tier, and the [offering page](../../site/offering.html) says so plainly. The journey's steps are deliberately mechanical: a script runs them end to end, which also means an assistant can run them for you, the same way the [Pilot prototype](../planning/aicr-pilot-variants-brief.md) generates variants on demand behind a parity gate.

## Run it yourself

```sh
node scripts/run-ci-rendered-catalog-journey.mjs --fixture
node scripts/run-ci-rendered-catalog-journey.mjs --land
node scripts/run-ci-rendered-catalog-journey.mjs --advantage
node scripts/run-ci-rendered-catalog-journey.mjs --capture
node scripts/run-ci-rendered-catalog-journey.mjs --down
```

The capture refuses to write a receipt unless the identity, history, protection, and release claims all hold, and the teardown leaves the organization exactly as it found it.
