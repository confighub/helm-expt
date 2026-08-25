# Configuration assessment stages

Generated from [`config-catalog/assessment-cases.yaml`](../../config-catalog/assessment-cases.yaml).

The same four questions apply to every configuration source:

1. **What do I have?** Inspect the source, snapshot, YAML, or OCI.
2. **What will it produce?** Render, build, compose, generate, or read the exact objects.
3. **Can this destination accept it?** Check the chosen destination before apply.
4. **Did it work?** Check the delivered revision and live result after deployment.

The first two questions do not need a cluster for sources that can be processed locally. The third needs destination facts but not a deployed candidate. The fourth needs a deployment. A missing prerequisite is reported as blocked or not run, not as a failed configuration or conformance result.

| Question | Format | Stage | Catalog match needed | Destination access needed | Deployment needed | Evidence | Result | Answer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| What do I have? | `kubernetes-yaml` | `inspection` | no | no | no | `completed` | `available` | The objects can be inventoried, fingerprinted, and compared without a Catalog entry, account, destination, or deployment. |
| What will it produce? | `helm` | `materialization` | no | no | no | `completed` | `pass` | Helm can render the exact candidate objects before a destination exists. The result can then be compared with defaults, Catalog configurations, or current objects. |
| Can this destination accept it? | `helm` | `destination` | no | yes | no | `completed` | `pass` | The selected destination can be checked for required APIs, CRDs, Secrets, policies, and controller behavior before the candidate is applied. |
| What do I have? | `aicr` | `inspection` | no | yes | no | `completed` | `available` | AICR snapshot and diff can compare existing GPU-node state without selecting a recipe, deploying a bundle, or matching a hardware row in the Catalog. |
| Did it work? | `aicr` | `post-deployment` | no | yes | yes | `blocked` | `not-run` | The expected-resources check cannot judge a deployment when the recipe-declared components are absent. Report the check as blocked, not as failed GPU conformance. |
| Did it work? | `configuration-oci` | `post-deployment` | no | yes | yes | `completed` | `pass` | The exact release was reconciled, the workload became ready, and one recorded model request returned successfully. |

These cases test the classification and its prerequisites. Each evidence link states its own scope; a fixture is not a live deployment receipt.
