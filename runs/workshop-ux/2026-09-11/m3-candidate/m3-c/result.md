# Prometheus replica edit review

Decision: the requested candidate is acceptable for this bounded local review. The only reported change is `Deployment monitoring/prometheus-server` at `/spec/replicas`, from `1` to `2`.

Next action: send the saved diff for human review before any rollout. This exercise does not approve, deploy, or publish the change.

Evidence:

- Primary receipt: `trial/diff.json` (`./trial/diff.json` in workspace archive), CLI exit code `0` at `trial/diff.exitcode` (`./trial/diff.exitcode` in workspace archive).
- Inputs: `trial/before.yaml` (`./trial/before.yaml` in workspace archive) and `trial/after.yaml` (`./trial/after.yaml` in workspace archive). Their SHA-256 values are `sha256:556cbf4cc1e0412d5bc0b10591b7db522e994287063cb79cd45fd375a9944ea8` and `sha256:d6a536a143d74657625854851a427b6f3042c08fcc040ff1b3f9506665cf3d03`.
- Relocation check: `moved/diff.json` (`./moved/diff.json` in workspace archive) matches the primary receipt byte-for-byte; comparison exit code `0` is at `moved/cmp.exitcode` (`./moved/cmp.exitcode` in workspace archive). Relocated command exit code is at `moved/diff.exitcode` (`./moved/diff.exitcode` in workspace archive).
- Original plugin input remains available at `plugin/examples/adapt/prometheus-before.yaml` (`./plugin/examples/adapt/prometheus-before.yaml` in workspace archive) and has the same before hash.

I checked how an additional unrequested change would be noticed by creating `trial/extra-after.yaml` (`./trial/extra-after.yaml` in workspace archive) with `revisionHistoryLimit 10 -> 11`, then running the same CLI with `--exit-code`. `trial/extra-diff.json` (`./trial/extra-diff.json` in workspace archive) reports both `/spec/replicas` and `/spec/revisionHistoryLimit`; the recorded exit code is `1` at `trial/extra.exitcode` (`./trial/extra.exitcode` in workspace archive). That candidate is rejected and was not repaired.

Limits: this is a local object comparison. It does not check Kubernetes schema or admission validity, upstream merge or protected-field preservation, target readiness or live drift, or application availability. No timing was measured; setup was supplied and excluded from evaluation. Friction was low: the Guide was discoverable from the local home page, and the installed `cub` command completed both comparisons without authentication, cluster, ConfigHub, registry, or credential access.
