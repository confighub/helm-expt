# Kubara v0.13.0 four-cluster platform

This is the current, reproducible Kubara + ConfigHub mini-IDP source. Kubara
still owns the familiar platform selection and wiring model. ConfigHub reviews
and retains the exact component versions, configuration variants, change
history, and fleet state. Argo CD remains the small local reconciler in the hub.

The committed `source/config.yaml` deliberately retains Kubara's official
`bootstrap:1.1.0` and `general:1.1.0` OCI references. The generator rewrites
only clean temporary copies to two pinned local catalogs:

1. Kubara's immutable 1.1.0 release snapshot.
2. The ConfigHub-aligned, byte-preserving export of that snapshot.

Kubara v0.13.0 must generate the same paths and bytes from both. The
[catalog parity receipt](catalog-parity-receipt.yaml) binds that claim to every
generated file; no AI translation is part of the required path.

## Platform shape

| Cluster | Kubara role | Enabled platform services |
| --- | --- | --- |
| `hx-app-dev` | hub | Argo CD, cert-manager, External Secrets, Homer, kube-prometheus-stack, Metrics Server, Traefik |
| `hx-app-staging` | spoke | cert-manager, Traefik |
| `hx-app-prod-a` | spoke | cert-manager, Traefik |
| `hx-app-prod-b` | spoke | cert-manager, Traefik |

That is 13 deterministic service renders: one hub Argo render, cert-manager and
Traefik on four clusters, and four additional services on the hub. The rendered
objects are desired-state evidence, not a claim that a live cluster reconciled
them.

## Why the normal values overrides exist

- `overrides/hx-app-dev/helm/argo-cd/values-repository-paths.yaml` points ApplicationSets at this committed
  example and explicitly allows `https://github.com/confighub/helm-expt.git`
  in the `hx-app-dev-dev` AppProject. Kubara 1.1.0's generated project only
  adds `argocd.helmRepo.url`; this example uses Git for both source lanes, so
  the explicit `sourceRepos` entry is required or Argo CD rejects them.
- `overrides/hx-app-dev/helm/homer-dashboard/values-project-links.yaml` replaces the catalog's illustrative Secrets
  Manager URL with working Kubara and ConfigHub links.
- Each cluster's `helm/cert-manager/values-kind.yaml` selects a deterministic
  self-signed issuer for the local proof instead of contacting public ACME.
- `overrides/hx-app-dev/helm/metrics-server/values-kind.yaml` records the local-kind kubelet TLS
  departure rather than hiding it in a one-off command.

`source/overrides/<cluster>/helm/<service>/` is the single canonical override
input hierarchy. The generator copies those files beside `values.generated.yaml`, exactly where
Kubara and Argo CD already load `values-*.yaml` customizations.

## Reproduce, in order

1. Verify or regenerate the byte-preserving catalog adapter:

   ~~~sh
   npm run kubara-catalog-adapter:verify
   ~~~

2. Download Kubara v0.13.0 for your platform. Verify its release archive and
   extracted binary against [source-lock.yaml](source-lock.yaml).

3. Generate both catalog lanes, fetch every exact chart archive, verify all
   seven SHA-256 locks (and the Traefik OCI manifest digest), and render the
   full four-cluster selection twice:

   ~~~sh
   KUBARA_BIN=/absolute/path/to/kubara \
     node scripts/generate-kubara-current-example.mjs --generate
   ~~~

4. Run the network-free verifier:

   ~~~sh
   node scripts/generate-kubara-current-example.mjs --verify
   ~~~

Generation needs Kubara, Helm, curl, oras, and network access. Verification
needs none of the release binary, Helm, registry, catalog OCI endpoints, chart
repositories, or clusters. It validates the pinned catalog trees, official
references, four-cluster selection, exact dependency versions, every source and
output checksum, both parity lanes, AppProject source authorization, and all 13
effective renders. The recorded generation used v4.1.4+g05fa379.

The one illustrative URL still present in Kubara's raw generated Homer values
is preserved as upstream output and byte-covered by the parity receipt. The
normal values override replaces it, and the effective render verifier rejects
that placeholder (as well as credential material and workstation paths).
