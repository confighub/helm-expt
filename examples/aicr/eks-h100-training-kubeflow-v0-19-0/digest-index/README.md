# One digest pins the whole training shape

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
`npm run aicr-digest-index:generate` and checked byte-for-byte by
`npm run aicr-digest-index:verify`. Do not edit it by hand.

The platform digest is:

```
sha256:6dd6fd925a36d217eb08f1563e921bb8e89a83f1cbbfad31f88a6bcc1b0e44f2
```

That one value pins the exact upstream source (NVIDIA AICR v0.19.0,
commit `f1f63463f7fae6dea608c89f92975b0dbc27c59c`), the recipe criteria, the 2 committed OCI transport manifests,
and one immutable payload per rendered Argo CD Application:
16 waved components plus the `aicr-stack` root. Change any rendered byte
anywhere in the shape and the digest changes.

[platform-index.json](./platform-index.json) holds the full index. Each member row
names its payload file under [payloads/](./payloads/) and the OCI reference the
payload uses or would use. Nothing in this directory claims a registry push by
itself. The OCI receipts next to this directory record the publication that was observed.

This follows the pattern the Kubara importer proved: per-component immutable
payloads plus one digest-bound index, compiled offline from committed bytes.

The boundary, stated plainly: this index proves config-plane mechanics only.
No GPU workload ran to produce or verify it. Workload-plane claims stay absent
rather than implied.
