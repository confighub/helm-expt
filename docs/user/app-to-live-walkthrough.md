# Your App To Live: Variants And Promotions End To End

**UNOFFICIAL/EXPERIMENTAL.** This walkthrough answers one question: I have a
simple app; how do I store it as a base, make staging and production variants,
promote a change, and deliver each environment through GitOps?

The variant and promotion sequence was run live on 2026-07-02. The cluster and
OCI commands have since moved into the main `cub` CLI. The commands below use
the current `cub cluster` and `cub release publish` path rather than preserving
the retired command spelling from that run.

The chain:

```text
your app (plain manifests)
  -> cub variant upload        -> base Space
  -> cub variant create (x2)   -> staging and production Spaces
  -> cub release publish       -> one OCI release per environment
  -> Argo CD pulls             -> the reviewed objects run on the cluster
  -> edit base, promote        -> staged rollout, environment by environment
```

## Prerequisites

- `cub` installed and logged in (`cub auth login`).
- Docker running (for the local kind cluster).

## Step 1: Create a temporary cluster and its delivery target

```text
cub cluster up --name demo --space demo-cluster
```

This provisions a kind cluster, installs Argo CD, creates a `demo-cluster`
Space with an OCI target (`demo-cluster/oci`), installs the OCI pull
credentials, and bootstraps a root Application. Load the cluster credentials
in any shell that needs `kubectl`:

```text
source ~/.confighub/clusters/demo.env
```

## Step 2: A simple app, three manifests

A Deployment (nginx serving a mounted ConfigMap), the ConfigMap (one line of content with a version marker), and a Service, all in namespace `acme`. Any plain manifests work; nothing here is chart-specific.

## Step 3: Upload the base

```text
cub variant upload --component acme-web --variant base \
  --space acme-web-base --granularity per-resource ./app
```

One Unit per resource lands in `acme-web-base`, links inferred from references. The upload warns about anything your manifests reference but do not contain (for example the namespace, or a Secret it expects to exist): read those warnings, they are the honest list of what the target cluster must provide.

## Step 4: Staging and production variants

```text
cub variant create staging acme-web-base \
  --space-pattern "template:acme-web-staging" \
  --environment Staging --namespace acme-staging \
  --target demo-cluster/oci

cub variant create production acme-web-base \
  --space-pattern "template:acme-web-prod" \
  --environment Prod --namespace acme-prod \
  --target demo-cluster/oci \
  --unit-delete-gate customer-demo --unit-destroy-gate customer-demo
```

Each clone records its upstream link (promotion follows it later), rewrites the namespace on every cloned Unit (verified: the staging ConfigMap says `namespace: acme-staging`, prod says `acme-prod`), and production's Units are gated against accidental delete and destroy. Pass `--space-pattern` for a predictable Space name; the server default produces a longer derived slug.

## Step 5: Publish one release OCI for each environment

```text
cub release publish acme-web-staging
cub release publish acme-web-prod
```

Each command packages the exact Units in that Space. The pull URLs are
`oci://oci.hub.confighub.com:443/space/acme-web-staging` and
`oci://oci.hub.confighub.com:443/space/acme-web-prod`.

## Step 6: Tell Argo about the two environments, as config

The Argo `Application` objects are themselves Units in the cluster Space, so even the delivery wiring is versioned config:

```text
cub unit create --space demo-cluster acme-web-staging-app app-staging.yaml \
  --target demo-cluster/oci --change-desc "Argo Application for the staging variant"
```

The Application source is the Space release OCI:

```yaml
source:
  repoURL: oci://oci.hub.confighub.com:443/space/acme-web-staging
  targetRevision: latest
  path: .
```

Same again for prod (path `./acme-web-prod`, destination namespace `acme-prod`).

## Step 7: Publish the cluster Space, and watch it become real

```text
cub release publish demo-cluster
```

The root Application created by `cub cluster up` reads the cluster Space
release and creates the two child Applications. Each child pulls its
environment's release OCI. In the recorded run, both apps reached
`Synced/Healthy` and both namespaces served `VERSION 1`.

## Step 8: The staged rollout

Change the base with a function (a recorded revision with your reason), then promote one environment at a time:

```text
cub run set-yq --space acme-web-base --unit acme-configmap-acme-web-content \
  --change-desc "Release VERSION 2 of the content" \
  '.data."index.html" = "acme-web VERSION 2\n"'

cub variant promote acme-web-staging --dry-run
cub variant promote acme-web-staging --change-desc "Promote VERSION 2 to staging"
cub release publish acme-web-staging
```

Observed live state after that, and this is the point of the whole model:

```text
staging: acme-web VERSION 2
prod:    acme-web VERSION 1
```

Two environments, one reviewed base, the difference explicit and deliberate. Then the same two commands for `acme-web-prod`, and both environments read `VERSION 2`. The prod Unit's revision history tells the story in three lines: `CloneUnit` (the variant was created), `Invoke` (the namespace rewrite), `UpgradeUnit` (the promotion).

## Honest notes from the live run

- Use `cub run set-yq` (or another mutating function) to edit data. Its read-only sibling `yq` accepts `--change-desc` and exits cleanly while changing nothing; if a promote then says nothing needs upgrading, check the base actually gained a revision (`cub revision list`).
- `cub variant promote --dry-run` prints a correct would-upgrade summary. `--dry-run -o mutations` currently prints nothing; do not read its silence as "nothing to promote".
- Right after content lands, Argo can briefly report `OutOfSync` with the content already correct; it settles on the next reconcile.
- The cluster's kubeconfig is its own file
  (`~/.confighub/clusters/<name>.kubeconfig`); source the generated env file
  rather than assuming your default kubeconfig has the context.

## Teardown

```text
cub cluster down --name demo
cub space delete acme-web-staging --recursive
cub space delete acme-web-prod --recursive-force   # gates block plain delete, by design
cub space delete acme-web-base --recursive
```

## Where this fits

- The variant model and the decision rule behind it: [variants after upload](./variants-after-upload.md).
- Delivery shapes beyond Argo, including Flux and the no-controller path: [cub deployment path](./cub-deployment-path.md).
- The catalog's receipted evidence for the same mechanism per chart base variant: the master matrix Promotion lane.
