# Kubara plus app: command audit

This is block 1 of the Workshop execution plan (#1844), with the first regression
check for #1845. It records existing behavior before changing the plugin or claiming
a complete demo. No cluster, ConfigHub mutation, publication or AI trial ran.

## Recorded result

[Receipt and source hashes](../../runs/workshop-kubara-app/2026-09-09/receipt.json)
record CLI v0.4.4 and workshop plugin v0.6.13. Seventy-nine installed plugin files
matched cub-workshop commit `a673979468657bd616f391f914ab1c0f77fdcf71` byte for byte.
The plugin's seeded bundle cache was used; this is not a clean-install trial.

| Operation | Observed result | What it establishes |
| --- | --- | --- |
| `cub stack certify kubara-shop-first-try` | Exit 1, REJECTED, 91 objects. | Detects the nginx/Traefik class mismatch and missing Prometheus operator. |
| `cub stack certify kubara-shop-platform` | Exit 0, CERTIFIED, 135 objects. | Existing composition checks pass, with namespace and webhook prerequisites visible. |
| `cub stack sandbox kubara-shop-platform --out rendered.yaml` | Exit 0, retained 135-object render. | Produces local materialized configuration; it does not deploy it. |
| Backend served-version check | One incompatible API. | The rendered ExternalSecret uses a version its bundled CRD does not serve. |

The exact stdout, compressed render and four authored source snapshots are retained
beside the receipt. Published component references remain digest-pinned in those
snapshots. The verifier checks retained file hashes before examining the render.

## The first blocker

`shop/shop-web-db` uses `external-secrets.io/v1beta1`. The included CRD
`externalsecrets.external-secrets.io` declares `v1` served and `v1beta1` unserved.
The current plugin checks the CRD group/order and the presence of external-secrets;
it does not check the exact served group/kind/version. Its CERTIFIED output must not
be interpreted as readiness to apply this stack. See #1845.

The backend check detects this mismatch. An in-memory change to `v1` clears only
that check; the archived source remains unchanged. Unknown APIs are not validated
by this checker, and duplicate definitions are ambiguous rather than merged into
an apparent pass. This is a static check, not Kubernetes discovery or admission.

## Remaining gaps for the first demo

| Gap | Concrete next step | Owner |
| --- | --- | --- |
| Unserved ExternalSecret version | Correct the app fixture and check exact served versions in the prototype. Retain both the regression and corrected result. | CLI/plugin repository, with this backend reproducer. |
| No namespaces in the render | Supply or verify cert-manager, external-secrets, kube-system, shop and traefik on the selected target. | Scenario and target setup. |
| Certificate references absent `ClusterIssuer/letsencrypt` | Name the issuer setup and DNS/domain assumptions; observe issuance before claiming HTTPS. | Scenario and target setup. |
| ExternalSecret references absent `ClusterSecretStore/platform-store` | Provide the store and authorized remote secret, or select a demo without that requirement. Do not invent credentials. | Scenario and maintainer. |
| Repaired scenario changes app requirements | The original ServiceMonitor is removed and an ExternalSecret added. Make that requirement change explicit; it is not preservation of the original monitoring intent. | Scenario and assistant contract. |
| Web container behavior unobserved | Check its startup command, listener and application response on the selected target. | Live demo. |
| CLI/AI continuity untested | Exercise a clean installation, interruption/resume and both assistant routes; do not infer them from these local commands. | Journey integration. |

Static preparation continues independently of registry and GPU credentials. Live
qualification needs the selected Kubara target/context and approval. The direct
command workflow must work before an assistant is judged on completing it.

## Reproduce and verify

With the recorded CLI/plugin version installed, run the three commands in the table.
The first command is expected to fail. The published OCI sources or the plugin's
seeded cache must be available. Compare source hashes and the complete rendered
SHA-256 to the receipt before interpreting a rerun as equivalent.

The offline repository gate needs no plugin, registry or cluster:

```sh
npm run kubara:app-scenario:verify
```

It checks the retained bytes and the known mismatch, plus a served-version repair,
exact-kind matching, absent definitions and duplicate-CRD ambiguity. A passing gate
means the defect is faithfully recorded and detected, not that the stack is ready.
The next product change must repair the plugin and obtain a new receipt, without
rewriting this historical observation.
