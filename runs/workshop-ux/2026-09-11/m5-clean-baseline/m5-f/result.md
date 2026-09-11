# M5-F result

The supplied Kubara handoff was tested through the installed `cub` CLI. An `ExternalSecret` using unsupported `external-secrets.io/v1beta1` was refused with exit code 1 because the bundled CRD serves only `v1`. The failed input and receipt remain at `./trial/` and `./refusal.json`.

A separate recovery copy changed that instance to `external-secrets.io/v1`. Certification then exited 0 and sandbox exited 0, producing `./recovery-rendered.yaml`. Full commands, exit codes, evidence locations, and scope limits are recorded in trial-log.md (`./trial-log.md` in workspace archive).

The trial proves local composition compatibility only. It does not prove target availability, live delivery, or application health.
