# Published minimal Catalog compose and authored app resume trial (real ORAS)

Date: 2026-09-24

This is the corrected rerun of the published minimal Catalog selection trial. The routed workspace materialization used the real `/opt/homebrew/bin/oras` executable through cub-workshop's `resolveBundleDetails`, with no `ORAS_BIN` override or mock transport. `cub stack compose` therefore issued a real digest-pinned `oras pull` for the published reference below. It performed no publish, cluster, ConfigHub server, or lifecycle-route execution.

## Environment and commands

```sh
# Set WORKSHOP_PLUGIN to the pinned checkout and TRIAL_ROOT to the trial directory.
unset ORAS_BIN
command -v oras                 # /opt/homebrew/bin/oras
oras version                    # 1.3.2+Homebrew
$WORKSHOP_PLUGIN/bin/cub-stack compose \
  --entry prometheus-community-kube-prometheus-stack-87-19-2-minimal \
  --name monitoring-catalog-real-oras \
  --out $TRIAL_ROOT/composed \
  --catalog-index /private/tmp/monitoring-catalog-compose-trial-20260924/index.json --json
env -u ORAS_BIN $WORKSHOP_PLUGIN/bin/cub-stack check $TRIAL_ROOT/saved-app/stack.yaml --json
env -u ORAS_BIN $WORKSHOP_PLUGIN/bin/cub-stack sandbox $TRIAL_ROOT/saved-app/stack.yaml --workspace $TRIAL_ROOT/resumed
env -u ORAS_BIN $WORKSHOP_PLUGIN/bin/cub-stack check $TRIAL_ROOT/resumed/stack.yaml --json
```

A derived environment summary is retained in `environment-summary.json`; private machine paths are omitted; raw compose/check output is in the trial directory. All four operation statuses are 0: `compose_exit=0`, `saved_check_exit=0`, `resume_sandbox_exit=0`, `resumed_check_exit=0`.

The local catalog fixture only rewrote source URLs in `/private/tmp`; it did not alter the published bundle identity. Original branch-derived listing SHA-256 is `83d6b4e903ceaac2398638c62938e8e0fc929c8deb9df53cf7de53b3bc95adc2`, local fixture listing SHA-256 is `f63fd7de5f553173a6af083ae484859e4d638d4ce137502de46a791eae253fa7`, and the local index SHA-256 is `0af4d4cb8d83ed4798c7b0462fcaf091318448808ef03cb7551e4e9a1c6aeae6`.

## Published identity and results

- Published literal-config reference: `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-prometheus-community-kube-prometheus-stack-87-19-2-minimal:latest@sha256:64c5effcc27fef20acefccca7e5f62fbb623287b663d0486d900c0062b7643b3`.
- Published manifest digest: `sha256:64c5effcc27fef20acefccca7e5f62fbb623287b663d0486d900c0062b7643b3`.
- Published receipt SHA-256: `9fc0bbfcab0587d4a6c84bc3ad1a69b9d5c1c27528f049c94d66263100e29778`.
- Exact retained minimal object SHA-256: `9947d9f86e3cabce7870b80560cda7ffd0381a909d253c43c6120f56c0b5a78c`.
- Authored app input SHA-256: `4793e9da092150ffdd5b1c977a4e7b520eb7181701f30d1074638e4858a344af`.

Real ORAS compose materialized a certified 24-object platform workspace with platform render/component SHA-256 `79c198f9b49259743e27dc5031144f319fae8e384a63cc14042ae24f286a76d0`. A separate authored app component was appended to the saved workspace. Saved check and fresh resumed check both certified 27 objects with final render SHA-256 `1ef5c7bd44de72abef5b33b3003653c63d7bce0b5b16d0cf88815db6d27d070e`. The platform component stayed byte-identical after the append and resume. The app Deployment, Service, and ServiceMonitor `candidate-metrics-app` remain present.

Static checks passed for conflicts, CRD ordering (10 before 4 dependent custom resources), served API versions, and app dependency. Warnings remained that the `monitoring` namespace must preexist and two admission webhooks require caBundle provisioning.

## Boundaries

The real ORAS pull proves the published digest could be materialized by this CLI invocation and that the receipt-bound retained object matched the resulting workspace. It does not prove route execution, CRD establishment, webhook readiness, app rollout, scraping, GitOps delivery, target availability, application health, or ConfigHub promotion. Lifecycle companions remain `declared-unexecuted` evidence only.
