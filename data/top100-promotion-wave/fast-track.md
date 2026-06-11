# Top-100 Promotion Fast Track

This generated slice identifies the simplest rows in the first top-100
promotion wave. These charts already have two-cluster kind parity, multiple
variants, clean scan/gate state, and no hook/CRD/webhook lifecycle class in the
current source-feature model.

They are not catalog-supported. They are the first rows where the remaining
promotion work is narrow enough to be reviewed quickly.

## Summary

~~~text
fast-track rows: 2
required next proof: ConfigHub/live lanes plus storage and rollback policy
~~~

## Rows

| Chart | Recommended base | Why this row is first | Remaining required work |
| --- | --- | --- | --- |
| `elastic/logstash@8.5.1` | `default` | clean scan/gate; two-cluster kind parity; no hook/CRD/webhook lifecycle class | write storage and rollback policy<br>complete ConfigHub proof lane<br>complete local live observation<br>complete GitOps/OCI live observation<br>complete live Helm-vs-ConfigHub parity<br>record target-scoped support decision |
| `prometheus-community/alertmanager@1.37.0` | `default` | clean scan/gate; two-cluster kind parity; no hook/CRD/webhook lifecycle class | write storage and rollback policy<br>complete ConfigHub proof lane<br>complete local live observation<br>complete GitOps/OCI live observation<br>complete live Helm-vs-ConfigHub parity<br>record target-scoped support decision |

## How To Use This

1. Open the per-chart catalog page.
2. Confirm the recommended base is the user-facing base to promote.
3. Write the storage and rollback policy.
4. Run the missing ConfigHub, local live, GitOps/OCI, and live parity lanes for
   the selected base.
5. Record a target-scoped support decision.
6. Only then consider catalog status changes.

## Boundaries

- Fast-track means low promotion residue, not production support.
- Storage behavior still needs operator review.
- The `ha` variants remain candidates until they get their own selected live
  evidence.
- If populated extension slots change the object set, create a new reviewed
  base rather than treating the change as a derived variant.

## Files

| File | Use |
| --- | --- |
| [fast-track.csv](./fast-track.csv) | Spreadsheet row per fast-track candidate. |
| [fast-track-reviews/README.md](./fast-track-reviews/README.md) | Review packet index for the fast-track candidates. |
| [fast-track-reviews/review-packets.csv](./fast-track-reviews/review-packets.csv) | Spreadsheet form of the review packet status. |
| [wave.csv](./wave.csv) | Full first promotion wave. |
| [work-orders.md](./work-orders.md) | Full work-order list for the first promotion wave. |
