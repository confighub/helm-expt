# UX mission result

The Prometheus example was copied into the trial and changed from `spec.replicas: 1` to `spec.replicas: 2`. The original plugin input was not edited.

Reviewable artifacts:

- Before: `./trial/prometheus-before.yaml`
- Requested candidate: `./trial/prometheus-after.yaml`
- Requested diff receipt: `./trial/replica-change.json`
- Simulated extra-change candidate: `./trial/prometheus-extra.yaml`
- Extra-change diff receipt: `./trial/extra-change.json`
- Full commands, outputs, errors, and exit codes: `./trial-log.md`

`cub config diff` reported one changed Deployment and exactly one field, `/spec/replicas`, with before `1` and after `2`; it exited 1 because a difference exists. To test how an unrequested change would be noticed, I made a separate candidate with `terminationGracePeriodSeconds: 301`. Its receipt reported both `/spec/replicas` and `/spec/template/spec/terminationGracePeriodSeconds`, making the extra change visible for review.

This helped decide that the JSON diff receipt is the review gate: accept the requested candidate only when its changed-field list contains the intended replica path alone. The next action would be human review of that receipt before sharing or applying the candidate.

Proven: local YAML comparison, object identity, changed field paths and values, candidate and baseline hashes, and detection of an additional field change.

Unknown: Kubernetes schema/admission validity, upstream merge or protected-field preservation, target readiness/live drift, and application availability.

Not run: cluster, ConfigHub, registry, publishing, login, credentials, or live deployment checks.

Setup/navigation friction: the local index was reachable with `curl`; the plugin was already supplied and usable. The first shell edit attempt had a path typo and was corrected by applying the edit to the copied candidate; the final retained log contains the substantive command evidence.
