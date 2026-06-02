# Quirk Review Queue — the Level-2 residue, made actionable

Every `needs-operator-decision` disposition across the catalog's `helm-pain-report.yaml` files. These are the
quirks that are **disclosed** (so the chart is Level-2 supported) but **not yet reviewed/handled**. This queue
classifies them so they can be worked down honestly — it does NOT resolve them (that is per-chart SME/build work;
auto-resolving would be cosmetic).

## Headline

```text
flagged quirks: 239
charts affected: 92
  standard (confirm a catalog-wide home): 76
  build    (build a variant, then handle):  13
  sme      (genuine per-chart human call):   150
```

## Work it down in this order

### 1. Standard — quickest wins (confirm the known ConfigHub home applies)

_Resolution: confirm the catalog-wide ConfigHub home applies (CRD lifecycle / scan+admission gate / operate policy / ingress policy)_

| Category | Flags | Charts |
| --- | ---: | ---: |
| `crds` | 32 | 32 |
| `stateful-storage` | 12 | 12 |
| `webhooks` | 11 | 11 |
| `crd-policy` | 5 | 5 |
| `ui-ingress-policy` | 3 | 3 |
| `apiservice` | 3 | 3 |
| `replicaset-topology` | 1 | 1 |
| `edge-ingress-policy` | 1 | 1 |
| `storage-config` | 1 | 1 |
| `object-storage-policy` | 1 | 1 |
| `query-ingress-policy` | 1 | 1 |
| `mesh-gateway-policy` | 1 | 1 |
| `service-exposure` | 1 | 1 |
| `storage-retention` | 1 | 1 |
| `component-selection` | 1 | 1 |
| `provider-integration` | 1 | 1 |

### 2. Build — needs a concrete variant first

_Resolution: build the variant that handles it (existing-secret base, rotation variant) then re-disposition_

| Category | Flags | Charts |
| --- | ---: | ---: |
| `secret-material` | 12 | 12 |
| `sync-secret-rotation` | 1 | 1 |

### 3. SME — genuine per-chart judgment (could be benign or a real blocker)

_Resolution: per-chart human call: confirm safe (lifecycle policy / explicit extension owner) OR mark an honest blocker_

| Category | Flags | Charts |
| --- | ---: | ---: |
| `tpl-extension-slots` | 62 | 62 |
| `extension-slots` | 57 | 57 |
| `lifecycle-policy` | 27 | 27 |
| `chart-deprecation` | 2 | 2 |
| `gitops-handoff` | 1 | 1 |
| `platform-variant` | 1 | 1 |

## Honesty note
A chart stays **Level-2 supported** while these sit at `needs-operator-decision` — the quirk is disclosed, not
silent. Moving a flag to *handled* (with evidence) or *blocker* (with reason) is what upgrades it to **reviewed**.
Re-run `npm run quirk-queue:generate` after pain reports change to re-measure the residue.
