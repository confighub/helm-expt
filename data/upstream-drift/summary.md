# When upstream republishes a version

A version string is supposed to name one artifact. These charts are the ones where a publisher reused a version string for different bytes, which the witness sweep found by verifying every fetched package against the hash its recipe locks.

| chart | version | decision | retained bytes | republished bytes |
| --- | --- | --- | --- | --- |
| fairwinds-stable/goldilocks | 10.3.0 | retained-exact | `9498a6f49cde` | `3e51ce8032b0` |
| fairwinds-stable/vpa | 4.11.0 | retained-exact | `28b48002bf80` | `2751f4ad7d3b` |

## What retained-exact means here

The catalog keeps the bytes it locked. Every proof it holds for these charts, the rendered objects, the package receipt, and the published installer package, was produced from those bytes, so re-pinning would leave that evidence describing an artifact nobody reviewed. The lock stays, and the drift is recorded rather than resolved silently.

- **fairwinds-stable/goldilocks 10.3.0.** The catalog keeps the bytes it locked. Its rendered objects, package receipt, and published installer package were all produced from them, so re-pinning would invalidate that evidence without changing what any consumer already installed.
- **fairwinds-stable/vpa 4.11.0.** The catalog keeps the bytes it locked, for the same reason as its sibling chart: the recorded proofs describe those bytes, and a silent re-pin would leave them describing something else.

## The republished bytes are available too

Retaining does not mean hiding the newer artifact. Each republished package is recorded with its digest and a witness of what it contains, so a consumer can inspect it, compare it, and fetch it deliberately. Verify the digest on arrival: the version string will not distinguish it from the retained one.

### fairwinds-stable/goldilocks 10.3.0

```sh
helm pull goldilocks --repo https://charts.fairwinds.com/stable --version 10.3.0
# expect sha256 3e51ce8032b0217d667b7e9084d36c76262b4ea566151f8fa47d422cbbd475db
```

Its contents are witnessed at `data/flattening-safety/witnesses/fairwinds-stable-goldilocks-10.3.0-republished.yaml` across 103 scanned files. The retained bytes keep their evidence at `recipes/fairwinds-stable/goldilocks/10.3.0/publication/installer-package-receipt.yaml`.

### fairwinds-stable/vpa 4.11.0

```sh
helm pull vpa --repo https://charts.fairwinds.com/stable --version 4.11.0
# expect sha256 2751f4ad7d3bc9114f79f03106e91676ae8cdbf3fe55a832159c8ae3b51c0c45
```

Its contents are witnessed at `data/flattening-safety/witnesses/fairwinds-stable-vpa-4.11.0-republished.yaml` across 58 scanned files. The retained bytes keep their evidence at `recipes/fairwinds-stable/vpa/4.11.0/publication/installer-package-receipt.yaml`.

The flattening evidence view counts catalog entries, so it reads the retained witness and skips the republished one. Counting both would report one entry twice.

Regenerate with `npm run upstream-drift`. Verify with `npm run upstream-drift:verify`.
