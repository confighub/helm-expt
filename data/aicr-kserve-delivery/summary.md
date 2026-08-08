# KServe NIM config-plane delivery proof

**UNOFFICIAL/EXPERIMENTAL.** Generated from the committed receipt. Rerun with
`npm run aicr-kserve-delivery:run`; check the committed result without a
cluster using `npm run aicr-kserve-delivery:verify`.

The inference entry's retained documents met a real Kubernetes API server. All
26 of them (10 serving
runtimes and 16 model shapes) traveled as one
OCI artifact and were pulled back byte-faithful. They met a throwaway kind
cluster carrying KServe v0.20.0 custom resource definitions.
25 were accepted and stored unchanged, and
1 was refused by the API server.

Only the definitions were installed, never the controller. That is what keeps
the proof honest: with nothing reconciling an InferenceService, no pod is
scheduled, no NIM image is pulled, and no NGC surface is contacted. The run
confirmed it rather than assuming it, finding 0 workload
pods and 0 image-pull events naming the gated
registry.

## Finding

Upstream ships one document a Kubernetes API server cannot accept. ClusterServingRuntime llama-3.3-nemotron-super-49b-v1_2xgpu_1.8.2 carries underscores in metadata.name, which is not an RFC 1123 subdomain. The proof confirmed the refusal rather than assuming it, and the entry retains the document unchanged because retention records what upstream published, defects included.

The entry's committed platform digest at the time of the run was
`sha256:7a219c5b0fdef1860454f741d7089379b605d9a7c88d6a2a2ec1df5dbb90c720`. The cluster, registry, and working files were
removed afterward.

## Limits

- This proof shows a real API server validating and storing the retained documents against real KServe definitions. It does not prove serving, model loading, or any workload behavior.
- The KServe controller was deliberately not installed. With it, an InferenceService would attempt to pull a gated NIM image, which the licensing boundary forbids this project from doing.
- This run used a temporary local registry; it does not prove public registry publication.
- No ConfigHub organization was involved; the import and reviewed-change story is the separate variant proof receipt.
