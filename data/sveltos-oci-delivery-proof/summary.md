# ConfigHub delivers a Sveltos fleet profile

This run starts with one reviewed Sveltos `ClusterProfile`. It selects workload
clusters labeled `environment=staging`, installs Kyverno 3.8.1, and asks for three
admission-controller replicas.

ConfigHub stored the exact profile under the system-configuration policy. Its
dry-run apply was blocked until the exact revision was approved. ConfigHub then
published its private release OCI.

The proof also packaged the approved profile as a temporary portable OCI. Argo CD
on the management cluster reconciled that exact digest. Sveltos selected the
registered staging workload cluster, installed Kyverno, and reported the Helm
feature as `Provisioned`.

This run uses ConfigHub for the stored review and approval. Packaging the approved
object as a portable OCI is a local `work -> OCI` step, and pulling that temporary
package needs no ConfigHub account. Those are composable choices: the public tools
can also build or inspect OCI packages without putting ConfigHub in the flow.

The test then changed the admission-controller deployment from three replicas to
one. Sveltos restored it to three.

| Check | Result |
| --- | --- |
| ConfigHub apply before approval | blocked |
| ConfigHub apply after approval | allowed |
| Private ConfigHub release | `sha256:0fe432df7c1e6411056867b0b2ec23e4a500fab73c0d728850afe30a9dd8b9c6` |
| Portable OCI pulled back and compared | Pass |
| Argo CD | Synced and Healthy; digest matched |
| Approved fields in the live profile | Pass; 7 controller-added path(s) recorded |
| Sveltos cluster selection | `hx-sveltos-work-20260727033439` |
| Sveltos Helm result | Provisioned |
| Kyverno deployments available | 4/4 |
| Replica drift repaired | 1 -> 3 |
| Cleanup | Pass |

## What this proves

The reviewed fleet object can move from ConfigHub through OCI and Argo CD to a
Sveltos management cluster without being copied with `kubectl`. Sveltos then owns
cluster selection, Helm installation, and drift repair.

## Limits

Sveltos itself was installed directly as a pinned prerequisite on the management
cluster. The portable OCI used a temporary registry. This was one staging workload
cluster, not a multi-cluster promotion wave, and it proves this Kyverno profile
rather than every Sveltos feature.

- [Reviewed ClusterProfile](../../examples/sveltos/kyverno-fleet/clusterprofile.yaml)
- [Pinned source versions](../../examples/sveltos/kyverno-fleet/source-lock.yaml)
- [Committed receipt](../../runs/sveltos-oci-delivery-proof/receipt.yaml)
