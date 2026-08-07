# Certified bundle receipts

One receipt shape covers a bundle from every producer. These four reference receipts prove it: the catalog's flattened traefik render, a Kubara component definition, a bundle eks-inference published to its own registry, and the Sveltos example's literal ClusterProfile. The spec lives at docs/reference/certified-bundle-spec.md and the schema at schemas/certified-bundle-receipt.schema.json.

| producer | bundle | contents | lane | status | receipt |
| --- | --- | --- | --- | --- | --- |
| config-workshop-catalog | catalog-traefik-traefik-41.0.2-default | rendered-config | flatten-with-routes | certified | data/certified-bundles/receipts/catalog/traefik-traefik-41.0.2-default/receipt.yaml |
| kubara | kubara-current-platform-metrics-server | component-definition | safe-to-flatten | certified | data/certified-bundles/receipts/kubara/current-platform-metrics-server/receipt.yaml |
| eks-inference | eks-inference-gpu-runtime | rendered-config | safe-to-flatten | provisional | data/certified-bundles/receipts/eks-inference/gpu-runtime/receipt.yaml |
| sveltos-example | sveltos-kyverno-fleet-clusterprofile | literal-config | born-flattened | certified | data/certified-bundles/receipts/sveltos/kyverno-fleet-clusterprofile/receipt.yaml |

A provisional verdict states what current evidence supports and names its open questions in the receipt. The flattening-safety audit certifies lanes; a lane moves when its receipt changes, never by hand.

The eks-inference receipt certifies an artifact this repository did not build. Its witness under witnesses/eks-inference-gpu-runtime records the pulled digests, and every extracted file hashed identically to the producer's committed render.

The Kubara receipt reads the byte-faithful mirror under examples/kubara. Its canonicalHome block pins the maintained copy in kubara-confighub, so removing the mirror re-points the generator instead of breaking it silently.

Regenerate with `npm run certified-bundles`. Verify with `npm run certified-bundles:verify`.
