# cub-scout Live Witness Watchlist

This watchlist records cases where ordinary local live checks pass, but the
stricter cub-scout witness finds a render/live mismatch that needs a capability,
target, or lifecycle decision.

The first rows are strict witness findings on kind Kubernetes 1.30:

- cert-manager workloads converge, but four rendered CRDs contain
  `spec.versions[0].selectableFields` that is absent from the live CRDs after
  apply.
- External Secrets workloads converge, but the rendered ExternalSecret CRD
  contains `spec.versions[0].selectableFields` that is absent from the live CRD
  after apply.
- Grafana workloads converge, but two rendered RBAC objects author empty
  `rules: []` arrays that the live RBAC objects do not preserve with the same
  shape after apply.

A follow-up capability witness proves the same rendered cert-manager and
External Secrets CRDs preserve `selectableFields` on `kind-kubernetes-1.35`:
[selectableFields witness](../capability-profile-witnesses/selectablefields/summary.md).
The Kubernetes 1.30 rows remain on this watchlist because support claims stay
profile-bound.

These are not Helm-vs-installer semantic parity defects. They are rendered/live
target findings: the rendered objects include authored fields that the live API
does not preserve with the same shape on this target profile. The route is to
test the intended production Kubernetes version and feature-gate profile, model
the server normalization explicitly, or create a profile-specific recipe or
variant that does not claim those fields.

Machine-readable rows are in
[cub-scout-watchlist.csv](./cub-scout-watchlist.csv).

Accepted normalization rules are recorded in
[normalization-rules.md](./normalization-rules.md). A strict witness block
should appear either in this watchlist or in that normalization log.
