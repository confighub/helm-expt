# Published minimal Catalog compose and authored app resume trial

Date: 2026-09-24

This trial used the published minimal listing generated in the isolated branch-derived catalog tree. It did not contact the OCI registry, ConfigHub server, Kubernetes cluster, or any live route. The local index and listing were rewritten only in `/private/tmp` so branch-local source bytes could be selected offline; the original branch-derived listing was preserved separately and its hash is recorded below.

## Inputs and exact identities

```sh
# Set WORKSHOP_PLUGIN to the pinned plugin checkout and TRIAL_ROOT to the prepared trial directory.
$WORKSHOP_PLUGIN/bin/cub-stack compose \
  --entry prometheus-community-kube-prometheus-stack-87-19-2-minimal \
  --name monitoring-catalog-compose \
  --out $TRIAL_ROOT/composed \
  --catalog-index $TRIAL_ROOT/index.json --json
$WORKSHOP_PLUGIN/bin/cub-stack check $TRIAL_ROOT/saved-app/stack.yaml --json
$WORKSHOP_PLUGIN/bin/cub-stack sandbox $TRIAL_ROOT/saved-app/stack.yaml --workspace $TRIAL_ROOT/resumed
$WORKSHOP_PLUGIN/bin/cub-stack check $TRIAL_ROOT/resumed/stack.yaml --json
```

- cub-workshop: 0.6.50, source SHA `ace677618705d278b5b859fcd508b2c2ba77a864`.
- Selected branch-derived Catalog listing: `prometheus-community-kube-prometheus-stack-87-19-2-minimal`.
- Original listing SHA-256: `83d6b4e903ceaac2398638c62938e8e0fc929c8deb9df53cf7de53b3bc95adc2`.
- Local offline listing SHA-256: `f63fd7de5f553173a6af083ae484859e4d638d4ce137502de46a791eae253fa7`; only source URLs were changed to local fixture paths.
- Published bundle manifest: `sha256:64c5effcc27fef20acefccca7e5f62fbb623287b663d0486d900c0062b7643b3`.
- Published literal-config reference recorded by the listing: `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-prometheus-community-kube-prometheus-stack-87-19-2-minimal:latest@sha256:64c5effcc27fef20acefccca7e5f62fbb623287b663d0486d900c0062b7643b3`.
- Receipt SHA-256: `9fc0bbfcab0587d4a6c84bc3ad1a69b9d5c1c27528f049c94d66263100e29778`.
- Retained minimal object SHA-256: `sha256:9947d9f86e3cabce7870b80560cda7ffd0381a909d253c43c6120f56c0b5a78c`.
- Authored app source SHA-256: `4793e9da092150ffdd5b1c977a4e7b520eb7181701f30d1074638e4858a344af`.

The local fixture retained the published receipt and exact retained object bytes. Route declarations were preserved in the composed/resumed workspace as declared-unexecuted evidence; their hashes are CRD ordering `b53323974f719c6e97d0c1311cdcc1112d718c9d20cd52a0c8532bdf69e00158`, lifecycle `43dc6c8ad1266ecb744075cfdf55bdf91bc7833d6366ae3b3ec4029eb3349d75`, and webhook CA `efa6fc777f0e1caa6b26b3d5437384eef573b317e34a23f0bd7a4a51f00f7aea`.

## Results

`cub stack compose` exited 0 and produced a receipt-bound editable workspace. Its platform-only rendered/component SHA-256 was `79c198f9b49259743e27dc5031144f319fae8e384a63cc14042ae24f286a76d0`, with 24 objects.

The app was appended as a separate authored component in `saved-app`; its static `stack check` exited 0 and certified 27 objects (24 platform + 3 app). Checks passed for resource conflicts, CRD ordering (10 CRDs before 4 dependent custom resources), served API versions, and the app's Prometheus Operator dependency. Warnings remained that the `monitoring` namespace must exist and two webhooks need a caBundle supplied by a reconciler.

`cub stack sandbox` of the saved app workspace exited 0 and produced a 27-object render with SHA-256 `1ef5c7bd44de72abef5b33b3003653c63d7bce0b5b16d0cf88815db6d27d070e`. A fresh-process check of the resumed workspace exited 0 with the same 27-object certified static result. The authored Deployment, Service, and ServiceMonitor `candidate-metrics-app` remain present.

The original retained platform component stayed byte-identical across compose, save, and resume: `79c198f9b49259743e27dc5031144f319fae8e384a63cc14042ae24f286a76d0` at each stage. The original composed manifest SHA is `c07e8574987fc8954163106074b8cf86c76a0b27d4b37910035590c5c4ef03a5`; the saved app manifest is an additive change with SHA `8832cf054321ebcc53fdb734be4cbe9e241ea45fd40e840e5482dfb6a701eb27`.

## Boundaries

The CLI verified the published receipt metadata, retained object digest, exact chart/version, and route declarations. It did not pull the OCI reference or execute any route. Target availability, application health, CRD establishment, webhook certificate readiness, rollout, scrape behavior, GitOps delivery, and runtime promotion remain untested.

## Verification correction

The statement above that composition did not contact the registry was inaccurate: routed materialization calls ORAS. The explicit real-ORAS rerun, its environment and captured outputs are retained in [real-oras/journal.md](real-oras/journal.md). No mock transport was used for the original monitoring trial.
