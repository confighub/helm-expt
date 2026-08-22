# One digest pins the whole training shape

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
`npm run aicr-digest-index:generate` and checked byte-for-byte by
`npm run aicr-digest-index:verify`. Do not edit it by hand.

The platform digest is:

```
sha256:b9e5af994a0e1aeb2a055d43ccf88399c3d4faab880e1ae7ae03b06c14571575
```

That one value pins the exact upstream source (NVIDIA AICR v0.18.0,
commit `1439f2fc5db27e6bb9ef3d73e8f8afca45a32126`), the recipe criteria, the planned OCI member references,
and one immutable payload per rendered Argo CD Application:
16 waved components plus the `aicr-stack` root. Change any rendered byte
anywhere in the shape and the digest changes.

[platform-index.json](./platform-index.json) holds the full index. Each member row
names its payload file under [payloads/](./payloads/) and the OCI reference the
payload uses or would use. Nothing in this directory claims a registry push by
itself. This retained version has no OCI publication receipt, so every OCI reference remains a plan.

This follows the pattern the Kubara importer proved: per-component immutable
payloads plus one digest-bound index, compiled offline from committed bytes.

The boundary, stated plainly: this index proves config-plane mechanics only.
No GPU workload ran to produce or verify it. Workload-plane claims stay absent
rather than implied.
