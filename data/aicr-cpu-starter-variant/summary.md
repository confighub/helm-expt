# CPU starter ConfigHub variant proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the scratch proof with `npm run aicr-starter-variant:run`;
verify it without external access with `npm run aicr-starter-variant:verify`.

ConfigHub imported the derived CPU starter (7 Argo CD
Applications) as a base variant from a temporary OCI reference and kept it
byte-faithful: the base Unit's canonical data matched the committed starter
files exactly. The starter's committed platform digest at the time of the run
was `sha256:d4c19c203ba379690c8de8716b29712b14d69006ae928136f410f634a4a80564`, itself derived from the training
entry's `sha256:3f9ec2a69619682d151937fe77d3bba21c336f598678e05f2fdd4d53ba142f2e`.

Development and staging variants were created from the base, and the one
recorded cloud residue was overridden as a reviewed change in development:
the Prometheus storage class moved from `gp3` to
`standard`. ConfigHub's dry run named the affected Application and
left the stored configuration unchanged; the real change touched exactly
1 Application (`kube-prometheus-stack`).

The staging promotion was previewed first: the dry run reported one Unit and
left staging unchanged. The real promotion then copied the reviewed
development configuration to staging, and the two variants recorded the same
canonical data.

The proof ran in the scratch organization `Cubby AI Inc`
on 2026-08-07T09:36:56.677Z. All three scratch Spaces and the temporary
registry were removed afterward.

## Limits

- This run used a temporary local registry; it does not prove public registry publication.
- This run started no Kubernetes cluster. It does not prove Argo CD delivery, application health, or any workload behavior.
- The scratch organization did not run the helm-catalog apply-policy Triggers, so this receipt does not prove policy execution.
- This receipt proves one derived-starter import, one reviewed storage-class override in a development variant, and one dev-to-staging promotion of that reviewed change.
