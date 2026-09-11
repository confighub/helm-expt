# Result

The local recovery succeeded in `./platform`: the supplied baseline remains retained, and the changed stack certifies with 184 objects after exactly one intended manifest change, shop-web Deployment replicas 3 → 2. The rendered diff is retained in `platform/replica.diff` and the regenerated render is `platform/changed.yaml`.

The incompatible attempt is retained separately in `./incompatible`. Its only semantic change is the shop-web ExternalSecret API version `external-secrets.io/v1` → `external-secrets.io/v1beta1`. Certification refused it with exit 1 and `certified: false`: the bundled CRD serves `v1`, so `v1beta1` is `version-not-served`. The refusal is preserved in `incompatible/refusal.json`; it was not repaired or removed.

This helped decide that the static certifier catches an API version unsupported by the bundled CRD and that recovery should happen in a separate copy while retaining the failed attempt. Proven: local composition, CRD ordering, served-version compatibility for the recovered stack, exact replica diff, and refusal evidence. Unknown: target namespaces, ClusterIssuer/letsencrypt, ClusterSecretStore/platform-store, admission webhook runtime state, target availability, and application health. Not run: login, cluster, ConfigHub, registry, publishing, credentials, or GitOps delivery. Therefore this does not prove the app runs or complete the real-target GitOps acceptance gate.

Valid next step: after explicit target and delivery authorization, verify the required prerequisites and deliver the recovered `platform` stack to a suitable target; do not promote the incompatible copy.

Friction/help: the supplied handoff was already the changed workspace, so recovery consisted of validating its retained baseline and regenerating outputs before making the incompatible copy. The refusal JSON clearly identifies the unsupported version.
