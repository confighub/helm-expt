# Import one Kubara Git revision into ConfigHub

This is the reusable six-step adoption boundary for an existing Kubara user:

1. choose components and wiring in Kubara;
2. let Kubara generate the platform, add-ons, ApplicationSets, overrides, and
   per-cluster configuration;
3. prepare, scan, commit, push, and offline-verify the raw inputs plus their
   separate clean hand-off subtree at one exact Git revision;
4. verify that exact revision and publish immutable component/config OCI
   packages plus the platform index;
5. load them into a user-selected ConfigHub organization with the recognizable
   hub-and-spoke shape; and
6. deploy and promote applications through ConfigHub while Argo CD remains the
   cluster reconciler.

The importer is deterministic code, not an AI rewrite. Kubara remains the
composer. ConfigHub adds a component-first Catalog surface, immutable package
and release evidence, reviewable definitions and variants, visible wiring, and
promotion history.

## What the importer publishes

It does **not** flatten the platform into one giant OCI layer. It publishes:

- one target-neutral, immutable OCI package per reusable component definition;
- one target-neutral, immutable OCI package per effective component/config set;
- one target-neutral platform index referencing every exact manifest and layer
  digest plus the Kubara config, wiring ledger, content lock, runtime contract,
  and delivery-template contract; and
- a separate `destination-binding-lock.yaml` for organization, Space, Target,
  delivery-runtime, workload, and evidence identities. This file is explicitly
  excluded from OCI.

`PlatformDigest` identifies the portable Kubara result and materialization
contract. `BindingDigest` identifies its exact ConfigHub destination. Importing
the same Git revision under the same import name and catalog repository base
into two organizations preserves the platform digest, component/config member
payloads, and aggregate index while producing different binding digests. If the
import name or repository base changes, member content bytes and
`PlatformDigest` still remain stable, but the aggregate index's metadata or
member refs necessarily change. Secrets and target-local facts stay outside
Git and OCI.

## Before you begin

Install `git`, Node.js, the exact Kubara binary and Helm build named by your
reviewed preparation request/source lock, `cub` 0.2.11 or later, `oras`, a
pinned external secret scanner, and the tools you use to observe each cluster. Authenticate `cub` to
the selected organization and `oras` to `spec.destination.catalogOCIBase`.
Hold exclusive single-writer control of that OCI repository base for the whole
`--package` operation. ORAS publication uses inspect, push, and post-inspect;
without an external single-writer gate, a concurrent writer could race between
those operations.

Serialize each `--apply` against other writers to importer-managed Spaces,
Units, Links, target/bootstrap metadata, platform delivery Applications, and
request-pinned workload heads. `cub` reads and mutations are not a
cross-client conditional transaction; post-verification detects drift but
cannot prove another writer did not race between a read and write. Unrelated
application source Spaces not named by the request remain outside this lock.

The importer never creates or selects an organization implicitly. It also
never creates Targets or ConfigHub's cluster-local Argo bootstrap. Create the
organization explicitly, switch to its exact context, and provision each
cluster with `cub cluster up` or an equivalent controlled process first. For a
disposable four-cluster proof that could be:

```sh
cub --context acme-kubara cluster up --name hx-app-dev \
  --space acme-target-dev
cub --context acme-kubara cluster up --name hx-app-staging \
  --space acme-target-staging
cub --context acme-kubara cluster up --name hx-app-prod-a \
  --space acme-target-prod-a
cub --context acme-kubara cluster up --name hx-app-prod-b \
  --space acme-target-prod-b
```

Do not rerun bootstrap commands against production blindly. The required
pre-existing shape is:

- one target Space and OCI Target for every Kubara cluster;
- one `<cluster>-argo-apps` Space containing `root` and the argobot
  Application;
- `argobot-base/argobot`; and
- one `argobot-<cluster>/argobot` instance with its `UpgradeUnit` lineage.

The selected organization may be newly created, but those bootstrap objects
must exist before inspection. Anything else that must remain outside importer
ownership is declared under `spec.externalInfrastructure`.

## 1. Generate and prepare the complete Kubara hand-off

Choose the platform in Kubara's `config.yaml`, then run the normal Kubara
generation path. The bridge does not replace or emulate that run. It consumes
Kubara's native `config.yaml`, generated `platform-components` and
`platform-configs`, documented overrides, a SHA-pinned source lock, and a
reviewed `KubaraComponentArtifactSet`.

Copy and review
[`current-platform.prepare.yaml`](./current-platform.prepare.yaml). Its paths
may point anywhere inside an existing dedicated Kubara checkout, including
`source.path: .`; only the named inputs are read. `output.path` must be a
separate, non-overlapping clean subtree. Pin every enabled service's release
name and namespace, the exact kube version/API capabilities, the full Helm Git
commit, the Kubara binary version/SHA, and every exact chart archive SHA. OCI
chart rows also require the exact OCI manifest digest. A missing, duplicate,
conflicting, or unreviewed component/version fails—there is no silent nearby
version or arbitrary Catalog auto-resolution.

After Kubara has generated its normal tree, run the only network/write phase:

```sh
node scripts/prepare-kubara-git-handoff.mjs --generate \
  --request /absolute/path/to/current-platform.prepare.yaml \
  --checkout /absolute/path/to/kubara-checkout \
  --kubara-bin /absolute/path/to/sha-pinned-kubara
```

The preparer fetches only reviewed exact artifacts, rejects pre-vendored opaque
chart archives, renders every enabled instance twice with the pinned profile,
extracts the in-tree provides/needs graph, applies a conservative structural
credential-shaped-material scan, and atomically replaces only `output.path`.
It re-inventories every input immediately before promotion, so a concurrent
source edit leaves the prior output untouched. It never runs Kubara, reads a
cluster, creates an organization, packages OCI, or claims that its built-in
scan replaces the required external scan.

The clean output contains source/config and reviewed overrides, generated
component/config trees, exact source/artifact locks, effective renders, an
importer-compatible generation receipt, wiring graph, preparation receipt, and
checksums. It excludes `apps/**`, `target-facts/**`, `.env`, and material caught
by the structural scanner. Application sources remain a later, separate
ConfigHub workflow.

This repository's reproducible example writes that complete boundary to
`examples/kubara/prepared-current-platform`; its committed preparation receipt
and checksums cover all 167 files. The preparer also refuses `.env.*` and
singular `target-facts.yaml`, `target-facts.yml`, and `target-facts.json` files.

Commit and push together to the HTTPS remote named by the import request:

- `config.yaml` and documented overrides;
- Kubara's generated platform components, add-ons, ApplicationSets, and cluster
  config;
- the reviewed preparation request and exact chart/dependency/source locks; and
- the complete prepared output subtree.

In a clean checkout of that final commit, verify offline with zero repository
writes and no network access:

```sh
node scripts/prepare-kubara-git-handoff.mjs --verify \
  --request /absolute/path/to/current-platform.prepare.yaml \
  --checkout /absolute/path/to/clean-checkout
```

Pass `--kubara-bin` as an optional stronger re-observation of the exact binary.
Without it, verification still checks the committed SHA/version claim copied
from the source lock, the exact Helm build, all inventories, renders, wiring,
receipts, checksums, and the zero-write boundary. The repository gate exercises
the concrete four-cluster subtree with `npm run
kubara-git-handoff:verify-current`; `npm run kubara-git-handoff:self-test`
also proves two-root byte neutrality, atomic interruption, adversarial
refusals, and preparer-to-importer compile/verify.

The subsequent import request names an HTTPS repository ending in `.git`, one full 40- or
64-character lowercase commit object ID, and one selected path. Use a detached,
clean checkout at that exact object. A branch, tag, dirty file, untracked file,
symlink, source-origin mismatch, or byte change during compilation is refused.

Keep application source trees, target facts, credentials, private keys, and
secret values outside the selected platform path. The importer inventories the
complete selected path, applies a conservative credential-shaped-material
check, and requires a separately produced external scan attestation. Neither
check is a general proof that arbitrary bytes contain no secret; review opaque
files and scanner scope explicitly.

## 2. Scan the exact commit and scope

Run the approved scanner/version against the selected directory in the exact
detached checkout. For example, after independently installing and verifying
Gitleaks 8.24.3:

```sh
gitleaks dir /absolute/path/to/clean-checkout/platform \
  --report-format json \
  --report-path /controlled/evidence/gitleaks-report.json
```

Require the scanner to exit successfully, retain its report outside the Git
tree, set `scanner: gitleaks@8.24.3`, and set
`opaqueFilesReviewed: true` only after that review is complete. The destination
inspector hashes the report bytes and binds the exact source commit and scope;
it never embeds the report contents in the reviewed request.

## 3. Record the exact delivery runtime for every cluster

Kubara's generated Argo CD component and ConfigHub's existing delivery runtime
are distinct identities:

- `hx-argo-base` is the **Faithful** Kubara definition. In the current example,
  wrapper chart 10.2.1 renders Argo CD v3.4.5.
- `hx-argo-runtime-base` is the **Adapted** ConfigHub delivery-runtime
  definition. Its exact version and image come from external observation of
  each already running target; the current example observes v3.4.6.

For every target, create a secret-free observation outside the imported Git
path. Example:

```yaml
apiVersion: import.confighub.com/v1alpha1
kind: KubaraArgoRuntimeObservation
metadata:
  name: hx-app-dev-argocd-runtime
spec:
  cluster: hx-app-dev
  componentVersion: v3.4.6
  image: quay.io/argoproj/argocd:v3.4.6
  evidenceRef: evidence://change/CR-1234/hx-app-dev/argocd-runtime
status:
  result: pass
```

Derive those facts with your approved `kubectl`, provider, or inventory
workflow. The importer validates and hashes the observation file; it does not
connect to the cluster or infer a runtime version from a chart.

## 4. Inspect the selected ConfigHub destination

Copy [request.example.yaml](./request.example.yaml), replace the Git source,
layout, scanner version, desired organization/context and stable entity slugs,
then run one read-only inspection:

```sh
node scripts/import-kubara-git-revision.mjs --inspect-destination \
  --request /absolute/path/to/request-template.yaml \
  --context acme-kubara \
  --credential-scan-report /controlled/evidence/gitleaks-report.json \
  --runtime-evidence hx-app-dev=/controlled/evidence/dev-runtime.yaml \
  --runtime-evidence hx-app-staging=/controlled/evidence/staging-runtime.yaml \
  --runtime-evidence hx-app-prod-a=/controlled/evidence/prod-a-runtime.yaml \
  --runtime-evidence hx-app-prod-b=/controlled/evidence/prod-b-runtime.yaml \
  --output /controlled/import/acme-reviewed-request.yaml
```

The inspector requires exactly one runtime observation per request target. It
uses narrow `cub ... list --where ... --select ... -o json` queries and
`cub unit data` only for the exact named bootstrap/workload Units. It records
IDs, ConfigHub `DataHash` values, raw Unit-byte SHA-256 hashes, argobot source
identity, published workload release pins, and the explicit organization
coordinate. It does not put Unit data, scanner-report content, runtime-evidence
content, tokens, or secret values in its output.

Review the resulting request before continuing. This is the user-visible
authorization boundary: wrong organization, context, server, Space, Target,
Unit, delivery root, argobot lineage, workload pin, or unexpected infrastructure
is a refusal rather than a guessed repair.

## 5. Compile and verify without mutation

Keep the output outside the checkout:

```sh
node scripts/import-kubara-git-revision.mjs --compile \
  --request /controlled/import/acme-reviewed-request.yaml \
  --checkout /absolute/path/to/clean-checkout \
  --output /controlled/import/revision-1

node scripts/import-kubara-git-revision.mjs --verify \
  --request /controlled/import/acme-reviewed-request.yaml \
  --checkout /absolute/path/to/clean-checkout \
  --output /controlled/import/revision-1
```

`--plan` prints the same plan without writing it. Compile writes six exact
files:

- `platform-lock.yaml` — target-neutral source/content/materialization lock and
  `PlatformDigest`;
- `destination-binding-lock.yaml` — target-specific binding and
  `BindingDigest`, marked `includedInOCI: false`;
- `import-plan.json` — ordered Spaces, Units, packages, delivery Applications,
  `UpgradeUnit` lineage, and curated `NeedsProvides` Links;
- `target-facts-required.yaml` — a pending operator-attestation template;
- `acceptance.json` — implemented claims and explicit boundaries; and
- `checksums.txt` — exact hashes of the five semantic outputs.

Verification regenerates all six from the same Git bytes and request and
requires byte-for-byte equality.

## 6. Complete the target-fact attestation

Copy `target-facts-required.yaml` to controlled storage outside Git and OCI.
For each binding set `status: verified-present`. For every required resolution,
set `status: satisfied` or `not-applicable-reviewed` and add an external,
secret-free `evidenceRef` plus the exact `sha256:` digest of that evidence.
Finally set:

```yaml
policy:
  secretValuesIncluded: false
  generatedTemplateIsAnAttestation: true
```

The generated file is only a template until an operator makes those changes.
Apply refuses pending facts, another organization/binding digest, missing
evidence hashes, or an attestation containing secret values.

## 7. Publish the exact OCI set

With `oras` authenticated to the reviewed repository base:

```sh
node scripts/import-kubara-git-revision.mjs --package \
  --request /controlled/import/acme-reviewed-request.yaml \
  --checkout /absolute/path/to/clean-checkout \
  --output /controlled/import/revision-1
```

`oci-publication-receipt.json` pins each remote manifest and layer digest. Under
the required exclusive single-writer gate, a pre-existing ref is reused only
when artifact type, media type, layer count, digest, and size all match; an
observed conflict is refused. Apply later pulls those exact layers and verifies
their bytes before ConfigHub mutation.

## 8. Apply twice and require the zero-action proof

```sh
node scripts/import-kubara-git-revision.mjs --apply \
  --request /controlled/import/acme-reviewed-request.yaml \
  --checkout /absolute/path/to/clean-checkout \
  --output /controlled/import/revision-1 \
  --context acme-kubara \
  --target-facts /controlled/evidence/target-facts-attested.yaml

# Required acceptance run: identical inputs, immediately again.
node scripts/import-kubara-git-revision.mjs --apply \
  --request /controlled/import/acme-reviewed-request.yaml \
  --checkout /absolute/path/to/clean-checkout \
  --output /controlled/import/revision-1 \
  --context acme-kubara \
  --target-facts /controlled/evidence/target-facts-attested.yaml
```

While holding that apply lock, the order is deterministic: pin
bootstrap/target facts; publish any
argobot source releases; create definitions and control Units; create variants
and instances; update platform delivery Applications; publish each apps root;
create exact Links; then publish source Spaces. A bounded interruption can be
resumed from the same exact inputs. The second run must produce:

```text
status.result: pass
status.lastActionCount: 0
status.secondRunZeroActions: true
status.localReceiptCryptographicProof: false
```

The local receipt is an exact deterministic continuity record, not a
server-signed or cryptographically tamper-proof attestation. A changed input or
live drift is rechecked/refused; any actual mutation resets the two-run proof.
The importer issues no delete operation. Generated Argo Applications do enable
pruning, so a reviewed later source release that removes Kubernetes objects can
cause Argo to delete those objects after sync.

## 9. Verify Argo and cluster convergence separately

`apply-receipt.json` proves the exact ConfigHub and OCI state. It deliberately
sets `clusterConvergenceClaim: false`. For each cluster, independently retain
observations showing every platform Application is `Synced`, `Healthy`, and has
completed successfully at the exact source-release manifest digest recorded in
the receipt. A ConfigHub release is not itself proof of cluster health.

## 10. Deploy applications through the normal ConfigHub workflow

After the platform converges, teams create or reuse application definition
Units, target variants, promotion/approval policy, and releases. ConfigHub
governs and promotes those revisions; each cluster's local Argo instance keeps
reconciling them. The platform importer does not invent application code or
hide app manifests inside the platform index.

If workload Applications already exist in a target apps-root Space, preserve
them explicitly. Add each known Application and its source Space/Unit to
`delivery.workloadApplications` in the request template, then rerun
`--inspect-destination`. Inspection fills its exact Unit ID, `DataHash`, raw
byte hash, published head revision, source IDs, and source release manifest
digest. Recompile and apply twice. Adding these destination pins changes only
`BindingDigest`; it does not change `PlatformDigest` or the target-neutral OCI
payloads. A pending workload head or later silent change is refused.

## 11. Move to the next Kubara Git revision

A platform-content change is an explicit, additive transition:

1. Preserve the prior passing `apply-receipt.json` as an immutable, separate
   file. Never overwrite it in the next output directory.
2. Generate and commit the next complete Kubara result, rescan its exact commit
   and path, refresh runtime evidence if it changed, and rerun destination
   inspection.
3. Compile once **without** `spec.transition` into a disposable draft directory
   to review the new `PlatformDigest` and `BindingDigest`.
4. Add `spec.transition` to the reviewed request using the prior receipt's
   platform/binding digests and the SHA-256 of its exact bytes:

   ```yaml
   transition:
     fromPlatformDigest: sha256:<prior-platform-digest>
     fromBindingDigest: sha256:<prior-binding-digest>
     previousApplyReceiptSHA256: sha256:<exact-prior-receipt-bytes>
     policy: additive-confighub-topology-importer-no-delete-argo-prune-disclosed
   ```

5. Compile and package into a new, empty final output directory. Transition
   authority is recorded but excluded from both content and binding digests.
6. Apply twice, passing the preserved receipt each time:

   ```sh
   node scripts/import-kubara-git-revision.mjs --apply \
     --request /controlled/import/revision-2-request.yaml \
     --checkout /absolute/path/to/revision-2-checkout \
     --output /controlled/import/revision-2 \
     --context acme-kubara \
     --target-facts /controlled/evidence/revision-2-target-facts.yaml \
     --previous-apply-receipt /controlled/receipts/revision-1-apply-receipt.json
   ```

The transition accepts an exact prior state, an exact current state, or the
bounded mixed state produced by an interrupted authorized run. It cannot remove
or rename a previously managed Space, Unit, Link, delivery Application, or
preserved workload pin; rebind a Target or upstream lineage; or rewire a Link.
Decommissioning is a separate, explicitly authorized workflow.

## What a Kubara user still recognizes

The source is still Kubara's `config.yaml`; Kubara still selects and specializes
its platform catalog; generated folders, wrapper versions, overrides,
ApplicationSets, hub/spoke placement, and local Argo reconciliation retain
their meaning. ConfigHub takes the hub governance role while each cluster keeps
a small local reconciler. The Kubara docs remain useful.

The visible improvement is additive: Components is component-first and retains
every catalog version; selected deployable/config variants follow from those
components; definition and instance Spaces make the hub/spoke shape queryable;
`NeedsProvides` Links expose operational wiring; immutable OCI and release
receipts make exact content reviewable; and app promotion no longer requires
rewriting Kubara's composition model.

Run the complete offline acceptance suite with:

```sh
npm run kubara-git-import:self-test
```

The suite creates isolated fake Git, OCI, and ConfigHub surfaces. It proves
exact compilation, target-neutral cross-organization packaging, remote-layer
reuse/refusal, destination inspection without content disclosure, bootstrap
pinning, root-before-source release order, workload preservation, resumable
additive transitions, a zero-action second run, and adversarial refusals. It
does not contact a live ConfigHub organization, registry, or cluster.
