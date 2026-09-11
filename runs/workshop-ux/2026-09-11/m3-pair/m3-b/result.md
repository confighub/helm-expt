# Result

The Prometheus candidate changed only `spec.replicas` from 1 to 2.

Review artifacts:

- Before: `./trial/before.yaml`
- Candidate: `./trial/after.yaml`
- Comparison: `./trial/diff.json`
- Extra-change demonstration input: `./trial/after-with-extra.yaml`
- Extra-change comparison: `./trial/diff-extra.json`
- Full log: `./trial-log.md`

The comparison reports one changed `Deployment monitoring/prometheus-server` and one field at `/spec/replicas` (`1` → `2`). To notice an additional unrequested change, inspect every field in `changes[].fields`; the demonstration reports an extra `/spec/revisionHistoryLimit` (`10` → `11`) alongside the replica edit, which should be reported and stopped on.

This proves a local comparison only. It does not prove schema or admission validity, upstream merge preservation, target readiness/live drift, or application availability. No live or external operations were run. The next action is human review of `diff.json`.
