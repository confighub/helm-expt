# Static disruption review

This first slice of [#1660](https://github.com/confighub/helm-expt/issues/1660) classifies configuration hazards; it does not predict observed disruption or certify safety.

Three cases mutate a retained GPU Operator Deployment synthetically, one compares it unchanged, and one compares the CRD-only selection of two committed Helm bases. No source chart was rerendered and no cluster was used.

| Case | Input scope | Changed objects | Categories | Verdict |
| --- | --- | --- | --- | --- |
| operator-image-change | synthetic-mutation-of-retained-render | 1 | recreate-workload | review-required |
| deployment-selector-change | synthetic-mutation-of-retained-render | 1 | recreate-workload; replace-immutable-field | review-required |
| metadata-only-change | synthetic-mutation-of-retained-render | 1 | unclassified | review-required |
| unchanged-config | synthetic-mutation-of-retained-render | 0 | none | no-config-change |
| retained-crd-removal | retained-base-pair | 10 | crd-or-apiversion-change; unclassified | review-required |

The [machine report](./report.json) binds source file hashes and per-object before/after hashes to changed JSON Pointer paths. It omits field values. [Unit tests](../../tests/config-disruption-review.test.mjs) exercise strategy changes, custom resources, API changes, duplicate inputs and secret-value exclusion.

Run `npm run disruption-review:generate` to regenerate and `npm run disruption-review:verify` to check the report and adversarial cases offline. These are repository proof commands, not new cub commands.

Remaining work: domain-specific driver/drain and dependency-order classification, integration into upgrade/promote previews and live-chat adapters, real target preflight, interruption/continuity measurements, and separate data-safe and successful rollback evidence. An unchanged or unclassified diff is never a runtime safety verdict.
