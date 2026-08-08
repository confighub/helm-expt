# NIM operator config-plane delivery proof

**UNOFFICIAL/EXPERIMENTAL.** Generated from the committed receipt. Rerun with
`npm run aicr-nim-operator-delivery:run`; check the committed result without
a cluster using `npm run aicr-nim-operator-delivery:verify`.

The AICR-native inference entry installs the NIM operator, and this proof
covers the surface an operator team writes against. The
2 retained definitions were established on a throwaway
kind cluster, and the catalog's authored NIMService was accepted with its
gated image reference intact.

One check here is unusual and worth naming. The definitions are retained at
`v3.1.0`, and the entry's own rendered Application
installs operator chart `3.1.0`. The proof
refuses to run unless those agree, because definitions that drift from the
component they describe would accept shapes the deployed operator rejects.

The operator itself was never installed. With nothing reconciling a
NIMService, the run scheduled 0 pods and recorded
0 image-pull events naming the gated registry,
which is how the config-plane boundary and the licensing boundary hold at the
same time.

## Limits

- This proof shows a real API server accepting the shapes a NIM deployment writes, against the operator's own definitions. It does not prove serving, model loading, or any workload behavior.
- The NIM operator was deliberately not installed. With it, a NIMService would attempt to pull a gated image, which the licensing boundary forbids this project from doing.
- The example resource is authored, not retained. It exercises the definition; it is not a recommended deployment.
- Two of the operator's nine definitions are retained, the two a NIM deployment writes.
