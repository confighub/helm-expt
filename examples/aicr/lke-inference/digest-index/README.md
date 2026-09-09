# One digest pins the whole training shape

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
`npm run aicr-digest-index:generate` and checked byte-for-byte by
`npm run aicr-digest-index:verify`. Do not edit it by hand.

The platform digest is:

```
sha256:1bc958e67e8be82762d5d40c601ad0dda832b4b7f239c4a9f1ff5137db290277
```

That one value pins the exact upstream source (NVIDIA AICR v0.21.0,
commit `36f52ec9346b8ce4b6dcdb08f1d82f92c963bebe`), the recipe criteria, the planned OCI member references,
and one immutable payload per rendered Argo CD Application:
15 waved components plus the `aicr-stack` root. Change any rendered byte
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
