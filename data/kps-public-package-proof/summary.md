# Anonymous kube-prometheus-stack package proof

This test starts with a new local home directory and an empty Docker credential file. It pulls the public kube-prometheus-stack package without a ConfigHub account or registry login.

The pulled package matches the 22-file source package exactly at tree digest `3e21f4c3592513d442b3954b3cb9166c4f2c60074e085f1b4f9d46e7b487ba05`. It renders 123 manifest objects and 2 Secret objects. It also contains all nine chart-specific lifecycle files: the ten CRDs, the admission certificate and patch Jobs, their temporary RBAC, the two runner scripts, and the action and generation records.

Public OCI manifest: `sha256:d2da5e6ee7bb7cebe256d494b67a05911b940d1a1c69793886a9e99e60112b85`.

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
