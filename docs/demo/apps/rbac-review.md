# Review and fix an RBAC permission

This example starts with a small application whose service account can read both
ConfigMaps and Secrets. It only needs the ConfigMaps. The extra Secret access is easy
to miss when RBAC is spread across rendered chart files.

The RBAC Review App follows a short path:

1. Read the Kubernetes objects already stored as configuration.
2. Report that the `report-reader` Role can read Secrets.
3. Propose one change: remove `secrets` from that Role.
4. Let a person review and approve the exact ConfigHub revision.
5. Apply the approved data to an isolated cluster and check the real permission.

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
approval, the proof applies the stored ConfigHub data to a throwaway cluster. The
service account can still read ConfigMaps and can no longer list Secrets.

This first proof deliberately uses a manual handoff from the approved ConfigHub Unit
to `kubectl`. It proves the review, approval, stored data, and Kubernetes permission
change. It does not yet prove automated ConfigHub delivery, a fleet-wide binding
analysis, or a correction to a production chart.

Evidence:

- [Live result](../../../data/rbac-review-live-proof/summary.md)
- [Committed receipt](../../../runs/rbac-review-live-proof/receipt.yaml)
- [Catalog-wide RBAC report](../../../data/app-readiness/summary.md)
