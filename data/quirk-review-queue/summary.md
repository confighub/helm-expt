# Quirk Review Queue — the Level-2 residue, made actionable

Every `needs-operator-decision` disposition across the catalog's `helm-pain-report.yaml` files. These are the
quirks that are **disclosed** (so the chart is Level-2 supported) but **not yet reviewed/handled**. This queue
classifies them so they can be worked down honestly — it does NOT resolve them (that is per-chart SME/build work;
auto-resolving would be cosmetic).

## Headline

```text
flagged quirks: 248
charts affected: 109
  standard (confirm a catalog-wide home): 82
  build    (build a variant, then handle):  20
  sme      (genuine per-chart human call):   146
```

## Work it down in this order

### 1. Standard — quickest wins (confirm the known ConfigHub home applies)

_Resolution: confirm the catalog-wide ConfigHub home applies (CRD lifecycle / scan+admission gate / operate policy / ingress policy)_

| Category | Flags | Charts |
| --- | ---: | ---: |
| `crds` | 32 | 32 |
| `stateful-storage` | 14 | 14 |
| `crd-policy` | 11 | 11 |
| `replicaset-topology` | 3 | 3 |
| `edge-ingress-policy` | 3 | 3 |
| `ui-ingress-policy` | 3 | 3 |
| `apiservice` | 3 | 3 |
| `storage-retention` | 2 | 2 |
| `component-selection` | 2 | 2 |
| `storage-config` | 1 | 1 |
| `object-storage-policy` | 1 | 1 |
| `object-store-runtime-prerequisite` | 1 | 1 |
| `query-ingress-policy` | 1 | 1 |
| `namespace-references` | 1 | 1 |
| `mesh-gateway-policy` | 1 | 1 |
| `service-exposure` | 1 | 1 |
| `operate-policy` | 1 | 1 |
| `provider-integration` | 1 | 1 |

### 2. Build — needs a concrete variant first

_Resolution: build the variant that handles it (existing-secret base, rotation variant) then re-disposition_

| Category | Flags | Charts |
| --- | ---: | ---: |
| `secret-material` | 14 | 14 |
| `credentials-secrets` | 5 | 5 |
| `sync-secret-rotation` | 1 | 1 |

### 3. SME — genuine per-chart judgment (could be benign or a real blocker)

_Resolution: per-chart human call: confirm safe (lifecycle policy / explicit extension owner) OR mark an honest blocker_

| Category | Flags | Charts |
| --- | ---: | ---: |
| `extension-slots` | 69 | 69 |
| `tpl-extension-slots` | 66 | 66 |
| `tpl` | 6 | 6 |
| `gitops-handoff` | 2 | 2 |
| `chart-deprecation` | 2 | 2 |
| `platform-variant` | 1 | 1 |

## Honesty note
A chart stays **Level-2 supported** while these sit at `needs-operator-decision` — the quirk is disclosed, not
silent. Moving a flag to *handled* (with evidence) or *blocker* (with reason) is what upgrades it to **reviewed**.
Re-run `npm run quirk-queue:generate` after pain reports change to re-measure the residue.
