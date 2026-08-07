# KServe NIM inference ConfigHub variant proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the scratch proof with `npm run aicr-kserve-nim-variant:run`;
verify it without external access with `npm run aicr-kserve-nim-variant:verify`.

ConfigHub imported the 26 retained inference surfaces as a
base variant from a temporary OCI reference and kept them byte-faithful: the
base Unit's canonical data matched the committed files exactly, and the Space
recorded the exact source reference and digest. The entry's committed platform
digest at the time of the run was `sha256:7a219c5b0fdef1860454f741d7089379b605d9a7c88d6a2a2ec1df5dbb90c720`.

Development and staging variants were created from the base, and one reviewed
decision was applied in development. Model shapes read from their own model
cache volume, so `spec.predictor.model.storageUri` moved from `pvc://nvidia-nim-pvc/` to
`pvc://nvidia-nim-pvc-dev/`. That single change covered every one of the
16 model shapes and left all 10 serving runtimes
byte-identical. ConfigHub previewed it first: the dry run named all
16 affected model shapes and the exact field it would update, and
it left the stored configuration unchanged.

The staging promotion was previewed first: the dry run reported one Unit and
left staging unchanged. The real promotion then copied the reviewed development
configuration to staging, and the two variants recorded the same canonical data.

The license boundary held for the whole run. Gated NGC images appear in every
variant as references only, the reviewed change left those references untouched,
nothing was pulled from `nvcr.io`, and no variant's data carries a literal
credential value.

The proof ran in the scratch organization `Cubby AI Inc`
on 2026-08-07T12:47:35.514Z. All three scratch Spaces and the temporary
registry were removed afterward.

## Limits

- This run used a temporary local registry; it does not prove public registry publication.
- This run started no Kubernetes cluster and installed no KServe. It does not prove serving, model loading, or any workload behavior.
- The scratch organization did not run the helm-catalog apply-policy Triggers, so this receipt does not prove policy execution.
- This receipt proves one retained-entry import, one reviewed model cache change across every model shape in a development variant, and one dev-to-staging promotion of that reviewed change.
- The development model cache volume is named in configuration only. This run created no PersistentVolumeClaim and does not prove that the volume exists.
