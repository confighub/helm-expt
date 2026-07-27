# Sveltos Kyverno fleet

This example shows how ConfigHub and Sveltos can divide the work of managing a
platform component across a cluster fleet.

ConfigHub stores the reviewed configuration, its variants, policy checks, and
promotion history. Sveltos runs on a management cluster, selects workload
clusters by label, and installs the declared add-on. Teams can change the
configuration once in ConfigHub instead of running an upgrade command against
each cluster.

This Space requires approval before apply because it changes cluster-wide
admission policy, even though this example targets staging.

## What to inspect

Open the `clusterprofile` Unit first. It contains one Sveltos
`ClusterProfile` with four decisions:

- select clusters labeled `environment=staging`;
- install Kyverno chart version `3.8.1`;
- run three admission-controller replicas;
- keep the cluster aligned with `ContinuousWithDriftDetection`.

The chart version and values are fixed in the reviewed object. A cluster only
needs the staging label to receive this configuration.

## What the live tests showed

The test used Sveltos v1.12.0 with separate kind management and workload
clusters. ConfigHub stored the `ClusterProfile` under the catalog's standard
checks. The exact object exported from ConfigHub was applied to the management
cluster.

In the first run, Sveltos selected the staging workload cluster, installed Kyverno 3.8.1, and
reported the Helm feature as `Provisioned`. All four Kyverno deployments became
available. The test then changed the admission-controller replica count from
three to one on the workload cluster. Sveltos restored it to three.

A second run removed the manual delivery step. ConfigHub blocked the
`ClusterProfile` until its exact revision was approved and published its private
release. A local no-server step packaged the approved data as a portable OCI. The
package was pulled back without a ConfigHub account and compared with the approved
data. Argo CD reconciled that OCI digest on the management cluster, then Sveltos
installed Kyverno and repaired the same replica change.

## What remains

The second run installed Sveltos directly from a pinned upstream manifest and used
a temporary registry for the portable OCI. Both runs used one workload cluster. A
permanent package and a promotion wave across several clusters still need their own
tests.

## Repeat and verify

The [website guide](https://confighub.github.io/helm-expt/site/d/docs/demo/sveltos/kyverno-fleet.html)
explains the commands and results. The
[source profile](https://github.com/confighub/helm-expt/blob/main/examples/sveltos/kyverno-fleet/clusterprofile.yaml),
[source lock](https://github.com/confighub/helm-expt/blob/main/examples/sveltos/kyverno-fleet/source-lock.yaml),
and
[live receipt](https://github.com/confighub/helm-expt/blob/main/examples/sveltos/kyverno-fleet/live-receipt.yaml)
record the first result. The
[OCI delivery summary](https://confighub.github.io/helm-expt/site/d/data/sveltos-oci-delivery-proof/summary.html)
and
[OCI delivery receipt](https://github.com/confighub/helm-expt/blob/main/runs/sveltos-oci-delivery-proof/receipt.yaml)
record the automated handoff.
