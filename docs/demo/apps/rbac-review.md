# Review and fix an RBAC permission

This example starts with a small application whose service account can read both
ConfigMaps and Secrets. It only needs the ConfigMaps. The extra Secret access is easy
to miss when RBAC is spread across rendered chart files.

The RBAC Review App follows a short path:

1. Read the Kubernetes objects already stored as configuration.
2. Report that the `report-reader` Role can read Secrets.
3. Propose one change: remove `secrets` from that Role.
4. Let a person review and approve the exact ConfigHub revision.
5. Publish the approved Space as a private ConfigHub release OCI.
6. Package the same approved objects as a portable OCI for the throwaway cluster.
7. Let Argo CD apply that OCI and check the real permission.

The [starting configuration](../../../examples/apps/rbac-review/before.yaml) contains:

```yaml
resources:
  - configmaps
  - secrets
verbs:
  - get
  - list
  - watch
```

The [reviewed correction](../../../examples/apps/rbac-review/after.yaml) keeps the
same objects and verbs but removes the resource that the service account does not
need:

```yaml
resources:
  - configmaps
```

The live proof stores both revisions in ConfigHub. The corrected revision cannot pass
the ConfigHub dry-run apply check until that exact revision is approved. After
approval, ConfigHub publishes its private release OCI.

The throwaway cluster belongs to a different organization, so the proof does not
copy a private OCI credential into it. Instead, the script packages the same approved
objects as a temporary portable OCI, pulls that package back, and compares all five
objects with the approved ConfigHub data. Argo CD then reconciles that portable
digest. The service account can still read ConfigMaps and can no longer list
Secrets.

`kubectl` creates only the deliberately unsafe starting state. It does not deliver
the correction. This example proves one namespaced review and correction on one
throwaway cluster. It does not yet prove a permanent public package, Flux delivery,
fleet-wide binding analysis, or a correction to a production chart.

Evidence:

- [Live result](../../../data/rbac-review-live-proof/summary.md)
- [Committed receipt](../../../runs/rbac-review-live-proof/receipt.yaml)
- [Catalog-wide RBAC report](../../../data/app-readiness/summary.md)
