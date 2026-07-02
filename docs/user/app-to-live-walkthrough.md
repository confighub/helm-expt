# Your App To Live: Variants And Promotions End To End

**UNOFFICIAL/EXPERIMENTAL.** This walkthrough was run live, end to end, on 2026-07-02: every command below is verbatim from that run, and the observed outputs are quoted where they matter. It answers one question: I have a simple app; how do I get it into ConfigHub as a base, make staging and production variants, promote changes through them, and see the result live on a cluster through GitOps?

The chain:

```text
your app (plain manifests)
  -> cub variant upload        -> base Space
  -> cub variant create (x2)   -> staging and production Spaces
  -> cub unit set-target       -> bound to an OCI target
  -> cub unit apply            -> published to ConfigHub's OCI registry
  -> Argo CD pulls             -> pods live on the cluster
  -> edit base, promote        -> staged rollout, environment by environment
```

## Prerequisites

- `cub` installed and logged in (`cub auth login`).
- Docker running (for the local kind cluster).
- The lk plugin: `cub plugin install jesperfj/cub-lk`.

## Step 1: One command for cluster, Argo, worker, and target

```text
cub lk up --name demo
```

This provisions a kind cluster, installs Argo CD, creates a `demo-cluster` Space with an OCI target (`demo-cluster/oci`), provisions the OCI pull credentials into Argo, and installs a root app-of-apps that syncs the `demo-cluster` Space. Argo's UI is printed at the end (localhost:30000). Load the cluster credentials in any shell that needs kubectl:

```text
source ~/.confighub/lk/demo.env
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
  --environment Staging --namespace acme-staging

cub variant create production acme-web-base \
  --space-pattern "template:acme-web-prod" \
  --environment Prod --namespace acme-prod \
  --unit-delete-gate customer-demo --unit-destroy-gate customer-demo
```

Each clone records its upstream link (promotion follows it later), rewrites the namespace on every cloned Unit (verified: the staging ConfigMap says `namespace: acme-staging`, prod says `acme-prod`), and production's Units are gated against accidental delete and destroy. Pass `--space-pattern` for a predictable Space name; the server default produces a longer derived slug.

## Step 5: Bind both environments to the OCI target

```text
cub unit set-target demo-cluster/oci --space acme-web-staging --where "Slug LIKE '%'"
cub unit set-target demo-cluster/oci --space acme-web-prod    --where "Slug LIKE '%'"
```

One OCI target serves any number of Spaces; each Space becomes a path inside the published artifact.

## Step 6: Tell Argo about the two environments, as config

The Argo `Application` objects are themselves Units in the cluster Space, so even the delivery wiring is versioned config:

```text
cub unit create --space demo-cluster acme-web-staging-app app-staging.yaml \
  --target demo-cluster/oci --change-desc "Argo Application for the staging variant"
```

The Application's source is the target's OCI repo, and the path is the Space:

```yaml
source:
  repoURL: oci://oci.hub.confighub.com:443/target/demo-cluster/oci
  targetRevision: latest
  path: ./acme-web-staging
```

Same again for prod (path `./acme-web-prod`, destination namespace `acme-prod`).

## Step 7: Apply, and watch it become real

```text
cub unit apply --space acme-web-staging --where "Slug LIKE '%'" --wait --timeout 2m0s
cub unit apply --space acme-web-prod    --where "Slug LIKE '%'" --wait --timeout 2m0s
cub unit apply --space demo-cluster --unit acme-web-staging-app,acme-web-prod-app --wait --timeout 2m0s
```

Apply on an OCI target publishes the Units' data to the registry; Argo pulls and converges. In the live run both apps reached `Synced/Healthy` and both namespaces had a Running pod within minutes, both serving `VERSION 1`.

## Step 8: The staged rollout

Change the base with a function (a recorded revision with your reason), then promote one environment at a time:

```text
cub run set-yq --space acme-web-base --unit acme-configmap-acme-web-content \
  --change-desc "Release VERSION 2 of the content" \
  '.data."index.html" = "acme-web VERSION 2\n"'

cub variant promote acme-web-staging --dry-run
cub variant promote acme-web-staging --change-desc "Promote VERSION 2 to staging"
cub unit apply --space acme-web-staging --where "HeadRevisionNum > LiveRevisionNum" --wait --timeout 2m0s
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
- The rig's kubeconfig is its own file (`~/.confighub/lk/<name>.kubeconfig`); source the env file rather than assuming your default kubeconfig has the context.

## Teardown

```text
cub lk down --name demo
cub space delete acme-web-staging --recursive
cub space delete acme-web-prod --recursive-force   # gates block plain delete, by design
cub space delete acme-web-base --recursive
```

## Where this fits

- The variant model and the decision rule behind it: [variants after upload](./variants-after-upload.md).
- Delivery shapes beyond Argo, including Flux and the no-controller path: [cub deployment path](./cub-deployment-path.md).
- The catalog's receipted evidence for the same mechanism per chart preset: the master matrix Promotion lane.
