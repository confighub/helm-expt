# Timoni Flux AIO 2.9.4-0

This static Timoni record retains the public Flux All-In-One module as a CRD-heavy controller example. The source is pinned to manifest digest `sha256:2fdfc00b5a1b59017f63ec0ab78be8b013fa7d542a57d6f1a6db4df64eab5a5a` and was built locally with Timoni 0.34.0.

The default build produced 21 Kubernetes objects: a namespace, quota, service account, cluster RBAC, one controller deployment, and 15 Flux CustomResourceDefinitions. Typed configuration is recorded in `config-schema.cue`, selected values in `selected-values.cue`, and the exact build output and inventory are under `rendered/`.

CRD establishment and controller readiness remain destination lifecycle work. This record does not claim cluster admission, controller health, multi-environment delivery, support promotion, or public configuration publication.

Source: https://github.com/stefanprodan/flux-aio
Module: `oci://ghcr.io/stefanprodan/modules/flux-aio@sha256:2fdfc00b5a1b59017f63ec0ab78be8b013fa7d542a57d6f1a6db4df64eab5a5a`
