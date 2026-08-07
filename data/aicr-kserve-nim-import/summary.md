# KServe NIM inference ConfigHub import proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the scratch proof with `npm run aicr-kserve-nim-import:run`;
verify it without external access with `npm run aicr-kserve-nim-import:verify`.

ConfigHub imported the 26 retained KServe NIM surfaces
(10 serving runtimes and
16 model shapes from the Apache-2.0
nim-deploy KServe subtree) as one base-variant Unit from a temporary OCI
reference, and the imported Unit matched the committed retained bytes
exactly. The entry's committed platform digest at the time of the run was
`sha256:7a219c5b0fdef1860454f741d7089379b605d9a7c88d6a2a2ec1df5dbb90c720`.

The license boundary held live. The artifact carried only retained
configuration; no NGC surface was contacted, no image was pulled, and the
imported data carries no literal credential value. The
10 gated image references present in the
imported runtimes are recorded in the receipt as evidence that references are
data.

Development and staging variants were created from the base, and one reviewed
change renamed the shared model-cache claim that every model shape mounts,
from `nvidia-nim-pvc` to `hx-nim-model-cache`.
Upstream leaves that claim for the operator to create, so its name is a
per-cluster decision, and one review has to land consistently everywhere it
appears. ConfigHub's dry run reported the change and left the stored
configuration untouched; the real change updated exactly
16 model shapes and left all ten
serving runtimes alone. The staging promotion was previewed first, reported
one Unit, and left staging unchanged; the real promotion then carried the
reviewed configuration to staging with matching canonical data.

The proof ran in the scratch organization
`Cubby AI Inc` on 2026-08-07T12:42:47.424Z. All
three scratch Spaces and the temporary registry were removed afterward.

## Limits

- This run used a temporary local registry; it does not prove public registry publication.
- This run started no Kubernetes cluster and required no KServe installation. It does not prove serving, model loading, or any workload behavior.
- The scratch organization did not run the helm-catalog apply-policy Triggers, so this receipt does not prove policy execution.
- This receipt proves one retained-entry import, one reviewed model-cache claim rename in a development variant, and one dev-to-staging promotion of that reviewed change. Delivery for the inference entry is a separate increment.
- NIM_TELEMETRY_MODE remains the documented telemetry control point, but setting it means adding an environment entry, and ConfigHub's search-replace substitutes single tokens rather than inserting structure. That change waits for a structural editing path.
