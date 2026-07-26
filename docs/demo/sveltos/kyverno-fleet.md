# Sveltos Kyverno fleet example

This example shows where Sveltos fits in the ConfigHub model. The configuration is a
Sveltos `ClusterProfile` that selects staging clusters and asks Sveltos to install a
fixed Kyverno chart version.

ConfigHub would hold the reviewed `ClusterProfile` as desired configuration. A platform
team could make development, staging, and production variants, run policy and approval,
and promote the exact diff. Sveltos would remain responsible for selecting matching
clusters and reconciling the add-on.

The example is intentionally small:

- the chart source and version are explicit;
- the target clusters are selected by a label;
- drift detection is requested;
- the Helm values are part of the reviewed object.

Open [clusterprofile.yaml](../../../examples/sveltos/kyverno-fleet/clusterprofile.yaml)
to inspect the full object.

To seed a ConfigHub base Space from the file:

```bash
cub variant upload \
  --component kyverno-fleet \
  --variant staging \
  --layer system-configuration \
  ../../../examples/sveltos/kyverno-fleet/clusterprofile.yaml
```

This is an API-shaped example, not a live proof. The next step is a lane with a
management cluster, matching workload clusters, ConfigHub promotion, Sveltos
reconciliation, and observed results.
