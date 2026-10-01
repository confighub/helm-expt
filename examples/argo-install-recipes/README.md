# Build an Argo CD installation candidate

Choose how Argo runs, who may deploy, and whether it reads ConfigHub. This
example produces explicit configuration from those choices. It does not
install anything or certify a production control plane. Tracking: #2043.

## Start locally

Requirements: Node.js, Helm, and Python with PyYAML for the render verifier.
No cluster, ConfigHub account or credentials are needed for this preview.
Run from the repository root:

```sh
node scripts/render-argo-install-recipe.mjs \
  examples/argo-install-recipes/fixtures/hardened-hub.json \
  ./argo-install-candidate
```

The output directory must not already exist. Read `values.yaml`,
`projects.yaml`, `prerequisites.json` and `evidence-not-run.json` before using
any result. JSON documents are valid YAML; the values file is Helm input and
the project file is Kubernetes configuration. The example domains are
illustrative and will not work as a real IdP, repository or cluster.

Four names express intent: `demo-in-cluster`, `demo-hub`,
`hardened-in-cluster`, `hardened-hub`. Omit `delivery` for Git sources; include
it for the optional ConfigHub source configuration. The builder rejects
unknown fields and credential-bearing URLs. Supply references, never Secret
values, tokens or private keys.

## Target input

Use the fixture as the strict input contract. `target.server` is the local
Kubernetes service address for in-cluster recipes. Hub recipes additionally
require a distinct `target.remoteServer`; tenant projects may deploy to both
listed clusters. `target.namespace` is reserved for the platform project;
each hardened team needs its own different namespace and developer group.
The platform project starts with no permitted source until separately reviewed.

Hardened input requires `oidc`, `ingress` and `syncWindow`. The ingress profile
currently targets ingress-nginx with an HTTPS backend and a pre-existing TLS
Secret. The window accepts five numeric-or-wildcard cron fields (UTC) and a
positive duration in minutes or hours; the fixture denies automatic sync from
22:00 for eight hours but permits a manual sync. Other cron syntax is refused.
These settings require behavioral validation before production use.

ConfigHub delivery currently accepts one tenant and one exact Space URL per
candidate. This is a whole-control-plane candidate, not an incremental team
onboarding command: do not overwrite existing shared RBAC with another
candidate. Multi-team Git input is supported with distinct destinations.

## Render the exact source

The Catalog locks chart 10.2.1, Argo CD v3.4.5. Download and check it before
rendering, rather than trusting a mutable repository lookup:

```sh
mkdir -p ./argo-chart
helm pull argo-cd --repo https://argoproj.github.io/argo-helm \
  --version 10.2.1 --destination ./argo-chart
printf '%s  %s\n' \
  27e930e366d22c999002008ad5ec7961bda00410a84287210d0fffbee8150885 \
  ./argo-chart/argo-cd-10.2.1.tgz | shasum -a 256 -c -
helm template argo-cd ./argo-chart/argo-cd-10.2.1.tgz \
  --namespace argocd --kube-version 1.30.0 --include-crds \
  --skip-tests --no-hooks -f ./argo-install-candidate/values.yaml \
  > ./argo-install-candidate/rendered.yaml
```

These explicit objects are the flattened foundation. Keep the values,
projects, source digest and target-fact inputs with them. Chart render output
and the separate AppProjects are both parts of the candidate. Do not apply
the projects before the Argo CRDs exist. Do not treat a successful render as
a functioning install: `--no-hooks` omits the Redis credential initializer,
and the existing Catalog's Secret and lifecycle prerequisites still apply.

## What to check before installation

- Confirm a working OIDC provider, groups, redirect URL and referenced Secret
  before disabling local admin. Readonly is global read access, not tenant
  confidentiality.
- Precreate allowed tenant namespaces. Review project allowlists and platform
  privileges; never permit tenant writes to the Argo control-plane namespace.
- Register hub clusters separately. The recipe never exports cluster Secrets.
- For ConfigHub delivery, provision gateway prefix credentials and argobot
  using the upstream plugin workflow. This builder does not install argobot
  or claim to remove every handover prerequisite. Change Git-owned projects
  at their source so self-heal cannot undo the allowlist.
- Confirm ingress/controller compatibility, TLS and the Helm hook lifecycle.
  Pinned Kustomize versions need a verified binary; enabling Helm inflation
  alone is not evidence that a named binary is present.

## Evidence and next qualification

`node --test tests/argo-install-recipes.test.mjs` tests input refusals and
configuration boundaries. To rerun eight render combinations against the
locked archive:

```sh
node scripts/verify-argo-install-recipes.mjs ./argo-chart/argo-cd-10.2.1.tgz
node scripts/verify-argo-install-recipes.mjs
```

The first command writes a render receipt under `runs/`; the second checks
that its inputs still match. Neither establishes controller behavior. Admin
login denial, SSO authorization, forbidden-resource/repository/destination
sync, sync windows, second-cluster delivery and ConfigHub status need serial
live tests. These candidates are not published supported Catalog bases yet.

The [implementation plan](../../docs/planning/argo-install-recipes.md)
records that qualification work and applications to other components.
