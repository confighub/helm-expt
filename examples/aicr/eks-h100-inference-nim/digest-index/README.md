# One digest pins the whole training shape

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
`npm run aicr-digest-index:generate` and checked byte-for-byte by
`npm run aicr-digest-index:verify`. Do not edit it by hand.

The platform digest is:

```
sha256:cc4ea0fb2347d3c74d77642bb930aa3caa48d4115e4a3017fe95b140b025c4a2
```

That one value pins the exact upstream source (NVIDIA AICR v0.14.0,
commit `0479e45e3ee4ea04d3fff55fd9160843d161c03c`), the recipe criteria, the planned OCI member references,
and one immutable payload per rendered Argo CD Application:
19 waved components plus the `aicr-stack` root. Change any rendered byte
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
