# Anonymous kube-prometheus-stack package proof

This test starts with a new local home directory and an empty Docker credential file. It pulls the public kube-prometheus-stack package without a ConfigHub account or registry login.

The pulled package matches the 16-file source package exactly at tree digest `b9f068ffa850824473349204d1e19dd52b0645c6b8729d841101a9fca95bc158`. It renders 123 manifest objects and 2 Secret objects. It also contains all nine chart-specific lifecycle files: the ten CRDs, the admission certificate and patch Jobs, their temporary RBAC, the two runner scripts, and the action and generation records.

Public OCI manifest: `sha256:bc8b2b5a3b92e2e5e44638dd8da9ae49b2cfb5edccbe664208c8251585148679`.

Result: **pass**.

## What this proves

- The published package can be pulled with no ConfigHub account and no Google registry login.
- The public package is the same package that was generated and checked in this repository.
- A user receives both the rendered configuration and the files needed for this chart's CRD and admission-webhook setup.

## What remains

- This proof checks anonymous pull, package integrity, render output, and the presence of the chart-specific lifecycle files.
- The separate lifecycle route receipt records the fresh-cluster execution of those files.
- Argo CD and Flux execution remain separate controller proofs.

Receipt: [`runs/kps-public-package-proof/receipt.yaml`](../../runs/kps-public-package-proof/receipt.yaml).
