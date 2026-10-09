# One digest pins the whole training shape

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
`npm run aicr-digest-index:generate` and checked byte-for-byte by
`npm run aicr-digest-index:verify`. Do not edit it by hand.

The platform digest is:

```
sha256:9b4f1697ddf535248757ba3ab53f4a7472852b2af0480bdd3a9a76115dd60799
```

That one value pins the exact upstream source (NVIDIA AICR v1.0.0,
commit `82bccef69855c70e151f8b5e6ed9d04d70a30f81`), the recipe criteria, the planned OCI member references,
and one immutable payload per rendered Argo CD Application:
14 waved components plus the `aicr-stack` root. Change any rendered byte
anywhere in the shape and the digest changes.

[platform-index.json](./platform-index.json) holds the full index. Each member row
names its payload file under [payloads/](./payloads/) and the OCI reference the
payload uses or would use. Nothing in this directory claims a registry push by
itself. This index does not say whether the entry's OCI artifacts are published. A publication counts only when a tracked receipt under `runs/aicr-mirror-artifacts/h200-eks-training` records it.

This follows the pattern the Kubara importer proved: per-component immutable
payloads plus one digest-bound index, compiled offline from committed bytes.

The boundary, stated plainly: this index proves config-plane mechanics only.
No GPU workload ran to produce or verify it. Workload-plane claims stay absent
rather than implied.
