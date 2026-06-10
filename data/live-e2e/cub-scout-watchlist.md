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

These are not Helm-vs-installer semantic parity defects. They are rendered/live
target findings: the rendered objects include authored fields that the live API
does not preserve with the same shape on this target profile. The route is to
test the intended production Kubernetes version and feature-gate profile, model
the server normalization explicitly, or create a profile-specific recipe or
variant that does not claim those fields.

Machine-readable rows are in
[cub-scout-watchlist.csv](./cub-scout-watchlist.csv).
