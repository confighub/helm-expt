# Import one Kubara Git revision into ConfigHub

Yes: the six-step adoption flow is sound, with one deliberate product boundary.
Kubara remains the deterministic platform composer; a ConfigHub importer
validates and preserves its output. This is not an AI rewrite and it does not
flatten a platform into one opaque OCI artifact.

The flow is:

1. Select platform components in Kubara.
2. Run Kubara and the deterministic effective-render/wiring extractors.
3. Commit the platform source, generated components, generated per-cluster
   config, exact dependency locks, effective renders, and wiring ledger to Git.
4. Compile that exact Git revision into component-first catalog OCI and
   per-component-instance config OCI plans.
5. Reconcile the plan into the user-selected ConfigHub organization, preserving
   definition/instance lineage, cluster mappings, and `NeedsProvides` wiring.
6. Add and deploy applications after the platform and its target facts converge.

`scripts/import-kubara-git-revision.mjs` implements the safe, reusable boundary
available now: offline plan compilation and byte-for-byte verification. Generic
OCI publication and organization apply are explicitly refused until their
idempotency and clean-room gates are implemented and accepted.

## The input contract

Copy [request.example.yaml](https://github.com/confighub/helm-expt/blob/main/examples/kubara/git-import/request.example.yaml) outside the imported Git
revision (it names that revision, so it cannot self-pin), then supply:

- one HTTPS Git URL ending in `.git`;
- one full immutable commit object, never a branch or tag;
- one clean, committed platform path;
- Kubara's generated component/config directories and effective renders;
- an additive, exact artifact lock with a SHA-256 for every remote dependency;
- a generation receipt binding every effective render to those exact artifacts;
- the provides/needs graph produced from those effective renders;
- a user-selected ConfigHub organization and one exact target mapping per
  Kubara cluster; and
- an untagged component-catalog OCI repository base.

Keep application sources outside the imported platform path for the later app
handoff. Keep target facts and all secret values outside that path and outside
OCI. The importer scans the complete selected Git path—not only files it plans
to package—and rejects Kubernetes Secret credentials, credential-bearing URLs,
private keys, fake-provider values, symlinks, untracked files, and a
`target-facts/` directory.

## Compile and verify

Use a detached, clean checkout at the commit named in the request. Write output
outside that checkout so compilation cannot dirty its own source:

~~~sh
node scripts/import-kubara-git-revision.mjs --compile \
  --request /absolute/path/to/request.yaml \
  --checkout /absolute/path/to/clean-checkout \
  --output /absolute/path/to/import-plan

node scripts/import-kubara-git-revision.mjs --verify \
  --request /absolute/path/to/request.yaml \
  --checkout /absolute/path/to/clean-checkout \
  --output /absolute/path/to/import-plan
~~~

`--plan` prints the same plan without writing files. Compilation produces:

- `platform-lock.yaml`: repository, commit, complete path inventory, source
  tree digest, semantic-request digest, topology digest, OCI-plan digests, and
  the final platform digest;
- `import-plan.json`: component definitions, per-cluster instances, catalog OCI
  refs, ConfigHub release-OCI templates, Spaces, Units, `UpgradeUnit` lineage,
  `NeedsProvides` links, org conflict policy, target-fact boundary, phases, and
  the application handoff;
- `acceptance.json`: the offline gates and explicit claim boundary; and
- `checksums.txt`: exact hashes for the three generated artifacts.

Run the bundled acceptance test with:

~~~sh
node scripts/import-kubara-git-revision.mjs --self-test
~~~

The self-test creates a temporary Git repository from the current Kubara
v0.13.0 four-cluster fixture. It first proves that the example's test-only
in-Git target fact and application credential are refused, externalizes target
facts and applications from the import scope, then proves one hub, three
spokes, seven deployable component definitions, and all 13 component-instance
config release plans. It also proves refusal of mutable refs, missing cluster
mappings, unsafe organization policy, non-exact chart versions, newly committed
credential material, and modified compiler output.

## What is preserved

The plan retains Kubara's enabled and disabled selections, wrapper versions,
hub/spoke labels, per-cluster values, exact rendered objects, and mechanically
extracted wiring. ConfigHub adds a reviewable layer around that shape:

- one catalog package per component definition;
- one ConfigHub Unit and immutable release OCI per selected component instance;
- one digest-pinned index of those release members, not an opaque fleet blob;
- explicit definition-to-instance lineage;
- visible consumer-to-provider links with auto-update disabled; and
- a target-fact queue that must be resolved at binding time.

With `confighub-managed-argo`, the Kubara hub Argo render is retained as the
faithful definition but is not targeted in the adapted lane; ConfigHub supplies
the governance hub and each cluster keeps its local reconciler. The separate
faithful-lane proof retains Kubara's one-hub delivery topology; this generic
import compiler does not pretend to be that executor.

## Apply boundary

The future executor must use the generated exact allowlist and enforce all of
these conditions before writes:

- the selected organization is new and empty, or already importer-owned with
  the identical platform digest;
- a partial cluster/target state is a failure, not a cue to recreate it;
- existing OCI refs are reused only when their digest is identical;
- target facts are externally bound before dependent Units are targeted;
- CRDs, hooks, and other lifecycle prerequisites have an accepted ordering
  route for every component instance;
- no unexpected Space, Unit, Link, or release is overwritten or deleted; and
- a second apply produces zero actions and a receipt.

Until that executor exists, `--package` and `--apply` fail intentionally. The
plan is app-ready only after a future accepted executor publishes, reconciles,
and verifies the platform; application deployment remains the next explicit
stage.
