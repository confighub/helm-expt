# Result

Completed the local workshop trial in `platform/` and retained the incompatible refusal in `incompatible/`.

The supplied `handoff/` was preserved. Its baseline render hash is `e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6` (3 replicas); the recovered changed render hash is `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3` (2 replicas). The only recovery diff is the `shop-web` Deployment replica count, 3 to 2.

The separate `incompatible/` copy changes only the ExternalSecret API to `external-secrets.io/v1beta1`. Certification exited 1 and recorded `certified:false` in incompatible/refusal.json (`./incompatible/refusal.json` in workspace archive), because the bundled `externalsecrets.external-secrets.io` CRD serves `v1` only. The failed attempt is visible and unrepaired.

Target namespaces, issuer, secret store, webhook readiness, target API availability, workload convergence, and application response were not checked. This static local certification does not prove the app runs. Full command evidence and exit codes are in trial-log.md (`./trial-log.md` in workspace archive).
