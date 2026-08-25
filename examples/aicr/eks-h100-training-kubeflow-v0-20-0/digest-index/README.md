# One digest pins the whole training shape

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
`npm run aicr-digest-index:generate` and checked byte-for-byte by
`npm run aicr-digest-index:verify`. Do not edit it by hand.

The platform digest is:

```
sha256:969e73550ef853489c201d336701ba6a3d53224bb899ae0a75dce31ce60f1241
```

That one value pins the exact upstream source (NVIDIA AICR v0.20.0,
commit `b8a6eadb2d6f7e5b62dcb93446874f383940de0f`), the recipe criteria, the 2 committed OCI transport manifests,
and one immutable payload per rendered Argo CD Application:
16 waved components plus the `aicr-stack` root. Change any rendered byte
anywhere in the shape and the digest changes.

[platform-index.json](./platform-index.json) holds the full index. Each member row
names its payload file under [payloads/](./payloads/) and the OCI reference the
payload uses or would use. Nothing in this directory claims a registry push by
itself. The OCI receipt records verified local layouts. Public publication has not run.

This follows the pattern the Kubara importer proved: per-component immutable
payloads plus one digest-bound index, compiled offline from committed bytes.

The boundary, stated plainly: this index proves config-plane mechanics only.
No GPU workload ran to produce or verify it. Workload-plane claims stay absent
rather than implied.
