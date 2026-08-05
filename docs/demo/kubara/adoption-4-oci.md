# Step 4: Turn the exact Kubara Git revision into immutable OCI

## Your goal

Take the exact reviewed Git revision from Step 3, verify that it is the Kubara
platform you approved, and publish it as a digest-bound OCI set that ConfigHub
can materialize in Step 5.

The result is deliberately not one giant platform artifact. It contains one
target-neutral package per reusable component definition, one target-neutral
package per effective component/configuration set, and one platform index that
references their exact manifest and layer digests. Destination bindings,
cluster facts, and secrets are not placed in those portable packages.

## What stays Kubara

- The input is still Kubara's committed `config.yaml`, generated component and
  cluster trees, ordinary overrides, locks, renders, and wiring facts.
- The Git commit remains the portable, independently reviewable hand-off.
- Kubara remains the composer. The importer consumes Kubara's result; it does
  not regenerate it, reinterpret it with AI, or replace it with a new schema.
- Application source is still separate from the platform hand-off and enters
  the journey in Step 6.

## What ConfigHub adds

- Exact-source and complete-scope verification before packaging.
- Component-first packages whose retained versions can be governed separately
  from one platform selection.
- Content-addressed OCI publication with exact remote manifest and layer
  verification.
- A target-neutral `PlatformDigest` for the portable platform and a separate
  `BindingDigest` for the selected ConfigHub destination.
- Refusal of dirty, mutable, ambiguous, mismatched, credential-shaped, or
  concurrently changed inputs.

The implementation is deterministic code. AI is not part of the required
import path.

## Before you start

The current importer cannot compile or package first and choose the
destination later. Before either operation, the user must explicitly select a
readable ConfigHub organization and provide one pre-existing ConfigHub Target
and one observed, healthy cluster-local Argo delivery runtime for every Kubara
cluster. Step 5 applies into those reviewed identities; it does not discover
or create them implicitly.

Complete Steps 1–3 and have all of the following:

- a clean detached checkout at the full pushed Git object ID;
- the prepared platform subtree bound by its
  [`preparation-receipt.yaml`](../../../examples/kubara/prepared-current-platform/preparation-receipt.yaml)
  and [`checksums.txt`](../../../examples/kubara/prepared-current-platform/checksums.txt);
- a passing external secret-scan report stored outside that checkout;
- one secret-free Argo runtime observation for every target cluster;
- a ConfigHub context already switched to the organization the user selected;
- pre-existing ConfigHub Targets and cluster-local Argo delivery runtimes; and
- `oras` authenticated to the untagged repository base in
  `spec.destination.catalogOCIBase`.

The exact importer contract and full field reference live in
[`examples/kubara/git-import/README.md`](../../../examples/kubara/git-import/README.md).
Start from
[`request.example.yaml`](../../../examples/kubara/git-import/request.example.yaml),
but never use its example IDs, hashes, repository, or organization as real
authority.

Run the repository commands below from the `helm-expt` repository root.

For the commands below, substitute your controlled paths and context name:

```bash
export KUBARA_CHECKOUT=/absolute/path/to/clean-detached-checkout
export KUBARA_IMPORT=/controlled/import/revision-1
export KUBARA_CONTEXT=acme-kubara
mkdir -p "$KUBARA_IMPORT"
```

Do not put the controlled import directory inside the Git checkout.

## 4.1 Inspect the selected destination without changing it

First edit a copy of the request template so that its Git repository, full
commit ID, selected path, intended stable slugs, and OCI repository base are
correct. Then bind the request to live, exact destination identities:

```bash
node scripts/import-kubara-git-revision.mjs --inspect-destination \
  --request /controlled/import/request-template.yaml \
  --context "$KUBARA_CONTEXT" \
  --credential-scan-report /controlled/evidence/gitleaks-report.json \
  --runtime-evidence hx-app-dev=/controlled/evidence/dev-runtime.yaml \
  --runtime-evidence hx-app-staging=/controlled/evidence/staging-runtime.yaml \
  --runtime-evidence hx-app-prod-a=/controlled/evidence/prod-a-runtime.yaml \
  --runtime-evidence hx-app-prod-b=/controlled/evidence/prod-b-runtime.yaml \
  --output /controlled/import/reviewed-request.yaml
```

This operation is read-only against ConfigHub. It uses narrow queries to pin
the organization, Spaces, Targets, argobot lineage, delivery roots, and any
workload Application heads explicitly preserved by the request. It hashes but
does not embed the scanner report or runtime observation contents.

Review `/controlled/import/reviewed-request.yaml` before continuing. In
particular, confirm:

- organization display name, external ID, internal entity ID, server URL, and
  context;
- all four Space and Target identities;
- the observed local Argo version and image for each cluster;
- the exact catalog OCI base; and
- every existing workload Application that must remain preserved.

### An honest current product boundary

The current CLI requires this read-only destination inspection **before**
compile and package. That is why Step 4 already needs a readable, selected
organization even though ConfigHub mutation does not begin until Step 5.

This ordering is a property of the current importer interface, not something
Kubara intrinsically requires. The reviewed request carries both portable
source intent and destination authorization. The split remains real:

- component/config payload bytes and `PlatformDigest` are target-neutral;
- `destination-binding-lock.yaml` and `BindingDigest` bind the selected
  organization and are explicitly excluded from OCI; and
- applying the same content to another organization preserves the portable
  member bytes while producing a different binding digest.

A future product command can make this boundary feel like one guided import,
but this tutorial does not pretend that sequencing already exists.

## 4.2 Compile, inspect, and reproduce the plan

Compile outside the checkout, then regenerate and compare all semantic output
bytes:

```bash
node scripts/import-kubara-git-revision.mjs --compile \
  --request /controlled/import/reviewed-request.yaml \
  --checkout "$KUBARA_CHECKOUT" \
  --output "$KUBARA_IMPORT"

node scripts/import-kubara-git-revision.mjs --verify \
  --request /controlled/import/reviewed-request.yaml \
  --checkout "$KUBARA_CHECKOUT" \
  --output "$KUBARA_IMPORT"
```

Review `import-plan.json` before publication. It is the exact ordered plan for
Spaces, Units, packages, delivery Applications, `UpgradeUnit` lineage, and
curated `NeedsProvides` Links. A changed source byte, Git object, request field,
or generated output causes verification to fail.

## 4.3 Complete the external target-fact attestation

The compiler writes a pending template at:

```text
/controlled/import/revision-1/target-facts-required.yaml
```

Copy it to controlled storage outside Git and OCI. For every binding set
`status: verified-present`. For every required resolution set either
`satisfied` or `not-applicable-reviewed`, then add a secret-free external
`evidenceRef` and its exact `sha256:` digest. Finally require:

```yaml
policy:
  secretValuesIncluded: false
  generatedTemplateIsAnAttestation: true
```

This attestation is consumed during apply in Step 5. It is not an invitation
to copy target credentials or secret values into the platform package.

## 4.4 Publish and verify the immutable OCI set

Hold exclusive single-writer control of the reviewed OCI repository base for
the complete publication operation, then run:

```bash
node scripts/import-kubara-git-revision.mjs --package \
  --request /controlled/import/reviewed-request.yaml \
  --checkout "$KUBARA_CHECKOUT" \
  --output "$KUBARA_IMPORT"
```

The importer inspects, publishes, and post-inspects every remote artifact. A
pre-existing content-addressed reference is reused only when its artifact type,
media type, layer count, digest, and size all match. A conflict is refused.

## Expected artifacts

The controlled output contains:

| Path | Meaning |
| --- | --- |
| `platform-lock.yaml` | Exact source/content/materialization lock and target-neutral `PlatformDigest`. |
| `destination-binding-lock.yaml` | Exact organization, Target, and delivery binding plus `BindingDigest`; excluded from OCI. |
| `import-plan.json` | Ordered ConfigHub topology, packages, releases, and Links for Step 5. |
| `target-facts-required.yaml` | Pending operator-attestation template, never the completed secret-free evidence file. |
| `acceptance.json` | Claims implemented by this importer and the boundaries it does not claim. |
| `checksums.txt` | Exact hashes of the five semantic compiler outputs. |
| `oci/payloads/*.json` | The deterministic local bytes published as component/config packages and the platform index. |
| `oci-publication-receipt.json` | Exact remote refs, manifest digests, layer digests, roles, and publication result. |

For the committed four-cluster fixture, the isolated acceptance suite produces
22 component/config packages plus one digest index. That number describes the
fixture, not a required count for every Kubara platform.

## Machine checkpoint

Anyone can exercise the complete importer contract without a live
organization, registry, or cluster:

```bash
npm run kubara-git-import:self-test
```

Expected final line:

```text
Kubara Git importer self-test passed: exact Git compile, 22 component/config OCI packages plus digest index, pulled-payload verification, pinned delivery topology, 12 platform Argo Applications, four root releases, second-run zero actions, and adversarial refusals
```

This is **current deterministic, isolated evidence**. The self-test uses fake
Git, OCI, and ConfigHub surfaces. It proves the importer contract and its
refusals; it does not prove that your selected live organization has been
changed or that any cluster is healthy.

For a real publication, also require
`oci-publication-receipt.json.status.result` to equal `pass`, confirm that
`targetFactsIncluded` is `false`, and retain the receipt with the reviewed
request and Git object ID.

## Screenshot to capture after the checkpoint passes

Do not manufacture a registry screenshot for the isolated self-test. This
chapter owns exactly one future adoption frame, separate from the ConfigHub
GUI tour.

<!-- kubara-adoption-screenshot step="4" id="oci-packages-index" path="../../images/kubara-adoption/04-oci-packages-index.png" -->

After the isolated self-test checkpoint and the complete source-current
documentation gate pass, capture one real terminal/workspace frame from that
same self-test run. It must show the complete passing final line, including
the reported 22 component/config OCI packages, digest index, pulled-payload
verification, pinned delivery topology, zero-action second run, and refusal
cases. The caption must name the Git commit and say explicitly that these are
deterministic **fake Git, OCI, and ConfigHub test surfaces**. This frame proves
the importer contract and isolated package/index behavior; it does not claim a
live registry publication, ConfigHub materialization, or cluster health.

Embed it at the declared path only when the six-frame adoption receipt binds
the exact source commit and Git trees, prepared hand-off receipt, importer
implementation, release-acceptance contract, image digest, UTC capture time,
visible package/index identities, sensitive-value handling, caption, and
claim boundary. It must not be presented as the real-publication receipt
described above. Until then, leave the hook unexpanded.

## Troubleshooting

| Symptom | What it means | Safe response |
| --- | --- | --- |
| Destination inspection reports an organization or context mismatch | The active identity is not the one authorized by the request. | Switch to the intended context and rerun inspection. Never hand-edit live UUIDs into the reviewed output. |
| A Target, delivery root, or argobot Unit is missing | Step 5 prerequisites have not been bootstrapped. | Stop, provision the named prerequisite deliberately, then rerun inspection and review the new request. |
| Compile rejects a branch, dirty checkout, untracked file, or changed byte | The input is not the exact Git hand-off from Step 3. | Create a clean detached checkout at the pushed object ID. Do not bypass the check. |
| The credential scan or structural scan fails | The selected tree is unsafe or its attestation does not bind this exact commit and scope. | Remove the material from the portable tree, rescan the final commit, and regenerate the reviewed request. |
| Verification says an output is stale | The request, Git bytes, or compiled output changed after compilation. | Use a fresh output directory and recompile from the exact reviewed inputs. |
| OCI publication observes a different existing layer | Another writer or prior incompatible publication owns that reference. | Keep the conflicting evidence, stop publication, and resolve repository ownership. Never overwrite it. |
| The self-test passes but the live registry is empty | The self-test is intentionally isolated. | Run the real `--package` command with authenticated `oras` and inspect its publication receipt. |

## Safe to stop

It is safe to stop after destination inspection, compile/verify, or package.
None of those operations mutates ConfigHub or a cluster. OCI publication is
additive and content-addressed; retain the output and receipt if it completed.

Do not begin Step 5 unless all compiler outputs still verify, the exact OCI
receipt passes, and the completed target-fact attestation is available. If
anything changed, create a new controlled output directory rather than
rewriting evidence for the prior revision.

Previous: [Step 3 — commit and push the complete hand-off](adoption-3-git.md)

Next: [Step 5 — materialize the platform in the selected ConfigHub organization](adoption-5-confighub-org.md)
