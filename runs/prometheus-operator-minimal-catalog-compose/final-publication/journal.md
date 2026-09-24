# Final published minimal Catalog composition and app resume acceptance

Date: 2026-09-24. This evidence was captured from the final published listing and the real ORAS client. The local index/listing used for selection rewrote only source URLs to branch-local fixture files; the public listing snapshot is retained alongside it. No mock transport, ConfigHub server, cluster, publication, or lifecycle-route execution was used.

## Commands

The commands were run with `WORKSHOP_PLUGIN` set to the pinned cub-workshop checkout, `CATALOG_ROOT` set to the checkout containing this run, and `TRIAL_ROOT` set to this run's temporary capture directory. ORAS was `/opt/homebrew/bin/oras` version 1.3.2 with `ORAS_BIN` unset.

```sh
unset ORAS_BIN
$WORKSHOP_PLUGIN/bin/cub-stack compose \
  --entry prometheus-community-kube-prometheus-stack-87-19-2-minimal \
  --name monitoring-catalog-final \
  --out $TRIAL_ROOT/composed \
  --catalog-index $TRIAL_ROOT/index.json --json
env -u ORAS_BIN $WORKSHOP_PLUGIN/bin/cub-stack check $TRIAL_ROOT/saved-app/stack.yaml --json
env -u ORAS_BIN $WORKSHOP_PLUGIN/bin/cub-stack sandbox $TRIAL_ROOT/saved-app/stack.yaml --workspace $TRIAL_ROOT/resumed
env -u ORAS_BIN $WORKSHOP_PLUGIN/bin/cub-stack check $TRIAL_ROOT/resumed/stack.yaml --json
```

Compose, saved-app check, resume sandbox, and resumed check each exited 0. Raw outputs, statuses, input hashes, output hashes, route hashes, and an environment summary are under `raw/`.

## Publication and source bindings

- Listing ID: `prometheus-community-kube-prometheus-stack-87-19-2-minimal`.
- Public listing snapshot: `input/public-listing.json`, SHA-256 `efbb46fe2357f60097dd1337747b6713092063abe3cf2e64c688df8ca816578a`.
- Local URL-rewritten listing: `input/local-listing.json`, SHA-256 `b4e1bd2b21e9f34ff5597d5f89405892d844bb8dffc2004f2b83d59edf3ef176`.
- Published manifest: `sha256:e35b0a38460604f3ab4725d513be1ad2b9bb19fe4d6fd6212ab7058d4f11e0e7`.
- Published layer: `sha256:f0ad279b50198e7a97d0a296284bded7916bf007fc9c531f50928fd6fdccb2cf`.
- Retained object set and `input/source-bundle.yaml`: SHA-256 `9947d9f86e3cabce7870b80560cda7ffd0381a909d253c43c6120f56c0b5a78c`.
- Certified receipt: `input/bundle-metadata.yaml`, SHA-256 `b405de9da8dbe3030904d6c759e55dad04e63d46b5134aa2a7fc811eb9912965`.
- Publication receipt: `runs/certified-bundles/catalog-prometheus-community-kube-prometheus-stack-87-19-2-minimal/publication-receipt.yaml`, SHA-256 `fb40e81321a0d0e1177826032e05677ee2e725487351c40d0fb7afa348000bd3`.

The selected reference was digest-pinned to the published manifest above. The real ORAS compose materialized the receipt-bound 24-object platform and preserved all three declared route companions as `declared-unexecuted` evidence.

## Results

The platform-only composed render and component have SHA-256 `79c198f9b49259743e27dc5031144f319fae8e384a63cc14042ae24f286a76d0`. The authored app was appended as a separate component; its source input SHA-256 is `4793e9da092150ffdd5b1c977a4e7b520eb7181701f30d1074638e4858a344af`.

Saved and resumed checks certified 27 objects: 24 platform objects plus 3 authored app objects. The resumed render SHA-256 is `1ef5c7bd44de72abef5b33b3003653c63d7bce0b5b16d0cf88815db6d27d070e`. The app Deployment, Service, and ServiceMonitor `candidate-metrics-app` remain present. The original platform component is byte-identical after save and resume.

Static checks passed for resource conflicts, 10 CRDs before 4 dependent custom resources, served API versions, and the app's Prometheus Operator dependency. Warnings remain that the `monitoring` namespace must already exist and two admission webhooks require caBundle provisioning.

The trial proves final digest-pinned publication materialization and receipt-bound retained bytes. It does not prove route execution, CRD establishment, webhook readiness, rollout, scraping, target availability, application health, GitOps delivery, or ConfigHub promotion.

## Archive slimming

The archive omits duplicate materialized platform renders/components, generated result files, and nested receipt/route evidence that are already represented by `input/source-bundle.yaml`, `input/bundle-metadata.yaml`, the three canonical route inputs, and raw command outputs. Exact omitted paths, SHA-256 values, and canonical retained paths are recorded in `omissions.json`. Runtime manifests and raw status claims were not edited; this is an archive reduction only.

The receipt input snapshot is archived as `input/bundle-metadata.yaml` to distinguish it from a new live observation. Derived YAML can have different serialization from its canonical input; omitted output hashes record the actual trial bytes, not a claim that source and output serialization are identical.
