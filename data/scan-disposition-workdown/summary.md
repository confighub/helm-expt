# Scan Disposition Workdown

This generated workdown turns external scan findings into production-review
routes. It is a bridge between raw scan output and production disposition
receipts.

The purpose is to avoid treating every warning as the same kind of work.
Some warnings should be fixed in the installer base. Some require a new
hardened base. Some are expected for infrastructure charts and need explicit
acceptance before production support is claimed.

## Current Reading

~~~text
top-20 scanned charts:        20
high-priority scan rows:      4
rows with latest-tag issues:  0
production-supported rows:    0
production-review-ready rows: 20
production-blocked rows:      0
~~~

## Priority Counts

| Priority | Charts |
| --- | ---: |
| standard | 11 |
| medium | 5 |
| high | 4 |

## Disposition Routes

| Route | Charts | Meaning |
| --- | ---: | --- |
| `accept-or-patch-pdb-policy` | 6 | PDB behavior needs an explicit accept-or-patch decision. |
| `add-resource-policy` | 5 | Resource requests/limits need a production policy or production base. |
| `harden-security-context` | 5 | Pod/container security settings need hardening or explicit acceptance. |
| `accept-or-split-privileged-infrastructure` | 4 | Privileged infrastructure behavior is likely intentional and must be accepted or split into a narrower base. |

## High-Priority Rows

| Chart | Findings | Top checks | Route | Support security decision | Suggested action |
| --- | ---: | --- | --- | --- | --- |
| `prometheus-community/kube-prometheus-stack@85.3.3` | 54 | dangling-service:14;unset-cpu-requirements:12;unset-memory-requirements:12;no-read-only-root-fs:6;sensitive-host-mounts:6;host-network:2;host-pid:2 | `accept-or-split-privileged-infrastructure` | accepted-for-target-scope | support security decision recorded; use the accepted target scope or create a hardened base for stricter environments |
| `longhorn/longhorn@1.11.2` | 48 | no-read-only-root-fs:10;run-as-non-root:10;unset-cpu-requirements:10;unset-memory-requirements:10;dangling-service:4;privilege-escalation-container:2;privileged-container:2 | `accept-or-split-privileged-infrastructure` | - | record an explicit security acceptance for the supported scope or create a narrower hardened base where the chart supports it |
| `prometheus-community/prometheus@29.8.0` | 27 | unset-cpu-requirements:8;unset-memory-requirements:8;no-read-only-root-fs:6;sensitive-host-mounts:3;host-network:1;host-pid:1 | `accept-or-split-privileged-infrastructure` | - | record an explicit security acceptance for the supported scope or create a narrower hardened base where the chart supports it |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | 16 | no-read-only-root-fs:6;run-as-non-root:6;privilege-escalation-container:2;privileged-container:2 | `accept-or-split-privileged-infrastructure` | - | record an explicit security acceptance for the supported scope or create a narrower hardened base where the chart supports it |

## Files

| File | Purpose |
| --- | --- |
| `workdown.csv` | Spreadsheet-ready scan disposition route for each top-20 chart. |
| `../external-scan-lane/chart-workdown.csv` | Raw chart-level scan grouping used as input. |
| `../production-disposition/next-actions.csv` | Production disposition queue joined into this workdown. |

## Rule

No chart becomes production-supported because a scan warning merely exists in a
spreadsheet. Each warning must be fixed, accepted, or made a variant blocker in
a production disposition receipt bound to the rendered object set.
