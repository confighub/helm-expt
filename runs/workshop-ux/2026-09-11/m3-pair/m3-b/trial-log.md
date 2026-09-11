# Trial log

Mission: change only Prometheus `spec.replicas` from 1 to 2 and retain a reviewable comparison.

Discovery: read `http://127.0.0.1:8767/site/index.html` in the supplied local site. It directed the operator to the local `cub config diff before.yaml after.yaml --json --out diff.json` route and to stop/report any change beyond the requested field.

Working directory: `./plugin`.

Inputs copied from `./plugin/examples/adapt/prometheus-before.yaml`:

- `./trial/before.yaml` (unchanged; SHA-256 `556cbf4cc1e0412d5bc0b10591b7db522e994287063cb79cd45fd375a9944ea8`)
- `./trial/after.yaml` (requested edit; SHA-256 `d6a536a143d74657625854851a427b6f3042c08fcc040ff1b3f9506665cf3d03`)

Command (exit 0): `CUB_CONFIG=./cli/config.yaml cub config diff ./trial/before.yaml ./trial/after.yaml --json --out ./trial/diff.json`

Observed result: one changed object, `apps/v1 Deployment monitoring/prometheus-server`; exactly one field `/spec/replicas`, before `1`, after `2`. The output is retained at `./trial/diff.json`.

Additional-change detection demonstration: `./trial/after-with-extra.yaml` adds an unrequested `/spec/revisionHistoryLimit` change from 10 to 11. The retained output `./trial/diff-extra.json` reports both `/spec/replicas` and `/spec/revisionHistoryLimit`; this is the signal to stop and report the extra change rather than repair or hide it. Command exit was 0 because differences are findings; the normal `git diff --no-index` comparison exits 1 when differences exist.

What this helped decide: the candidate is bounded to the requested replica edit, and the JSON field list provides a reviewable allowlist check for unintended edits.

Next action: a reviewer can inspect `diff.json` and, if accepted, carry the retained trial directory forward. No publish or deployment is implied.

Proven: local YAML object comparison, input hashes, exact changed object and field, and detection of an additional field change.

Unknown: Kubernetes schema/admission validity, upstream merge or protected-field preservation, target readiness/live drift, and application availability.

Not run: login, cluster, ConfigHub, registry, publishing, credentials, or live deployment.

Navigation/setup friction: initial repository status was unavailable from the trial workdir because it is not the shared git checkout; supplied plugin checkout and CLI config were otherwise directly usable. No command timing was recorded or inferred.
