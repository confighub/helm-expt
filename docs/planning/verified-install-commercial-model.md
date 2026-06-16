# helm-expt: the verified-install commercial model

Planning doc. Status: draft for discussion. Companion to the serverless design doc and the robust-sceptic plan.

## 1. The question, scoped honestly

Can customers feel safer using "our" Helm, the catalog plus `cub install`, than standard `helm install`? Yes, and the case is strong, but only if the claim is scoped exactly. What we can make true: the customer knows precisely what they are installing, that it has not been altered, what was found when it was scanned, what it needs from the cluster, what it did when it landed, and whether it is still what they installed. What we cannot claim: that the software inside the images is safe, that scanner findings equal exploitability, or that a signature makes a chart trustworthy. The signature proves origin and integrity; the scan receipts carry the findings; the judgment stays with the customer. Holding that line is what separates a security product from security theater, and the sceptic plan's claims register is the enforcement mechanism.

## 2. The security deltas versus `helm install`

Nine concrete differences, each with its mechanism and its current status in the repo.

**D1. There is an artifact to scan before install.** With standard Helm, the thing that will actually be applied does not exist until render time, so security teams scan templates (noisy, incomplete) or build their own render pipelines (often with the wrong flags and values). In the catalog model the exact object set per variant exists as data before anyone installs it. The scan target is the deliverable itself. This is the single biggest structural delta and everything else builds on it.

**D2. Scanning is done at the factory and verified at the door.** Each variant is scanned at publication: manifest-level policy tools and image-level vulnerability scanners, with the results recorded in a signed scan receipt naming the tool, tool version, policy bundle, and date. The customer's install verifies the signature instead of re-running the pipeline, and can re-run everything locally when they want to, because the zero-dependency clone-and-verify design preserves the no-trust-required option. The cost of scanning moves from every customer on every install to once per variant per catalog refresh, which is also the commercial engine (section 4).

**D3. Image inventory and digest pinning.** Charts routinely reference images by mutable tag. The catalog resolves images to digests at render (the image-digest workdown and the kube-prometheus-stack digest-resolution lane exist in the tree), so each variant carries an exact, immutable image inventory. That inventory is the basis for an SBOM per variant and for the CVE question: which of my installs contains image X. Serverless answers per cluster from the in-cluster receipts; the Server answers fleet-wide.

**D4. An integrity chain with teeth.** Cosign signature on the artifact, signature verification at install, and (required before commercial claims, per the sceptic plan) a key ceremony plus a public transparency log. Compare standard Helm: provenance files exist and are almost universally unused. Tamper-evidence from catalog to cluster is a delta customers can test themselves.

**D5. Preflight facts instead of insecure fallbacks.** The facts check refuses loudly when a required Secret or StorageClass is missing, where charts otherwise fall back to generated defaults or broken half-installs. The pain report surfaces weak securityContext, mutable tags, and privileged settings per variant, before apply rather than in a post-incident audit.

**D6. No render at install time.** Standard Helm executes template logic at install, including cluster reads via lookup, on the operator's machine with the operator's credentials. The catalog model applies pre-rendered, signed data: no template execution, no render-time cluster reads, a strictly smaller surface at the moment of highest privilege.

**D7. An audit trail by default.** Every install writes a receipt (inventory, digest, variant, facts used) into the cluster, even serverless. Drift is a one-command check against that record. Signed in, the receipt also lands in the ledger with identity, and authority on every change. The serverless tier gives integrity; the Server tier adds accountability.

**D8. Hardened variants with explicit provenance of deviation.** A hardened variant (restricted securityContext, no privileged, pinned digests, network policies on) is just another named base, and the value-source map shows exactly how it differs from upstream, field by field. "Hardened, and here is precisely what we changed" is a claim standard Helm cannot express, because the deviation lives in values archaeology.

**D9. Faster, calmer CVE response.** When a CVE lands, the catalog re-renders the affected variants against patched images, signs, and publishes; the customer's `cub upgrade` shows the exact object diff before applying. The response to a CVE becomes a verified artifact swap with a visible diff, not a values-file scramble. The Bitnami precedent (free images withdrawn, secure images paywalled) demonstrated both that customers will pay for maintained, vetted artifacts and that they fear depending on unmaintained ones; we sell the vetted configuration plus its proof, which is one layer up from images and includes them by digest.

## 3. The scanning story, concretely

Since scanning is the named use case, the specifics:

- **What runs:** manifest scanners (policy engines over the rendered objects: privilege, capabilities, network exposure, deprecated APIs) and image scanners (CVEs over the digest-pinned inventory). Tools are pluggable; the receipt names them.
- **Where:** at the factory on every publication and refresh, and locally on demand, same harness, so a customer's security team can reproduce any number on the receipt.
- **The artifact:** a scan receipt per variant per version: tool, version, policy bundle, date, findings with severities, and waived findings with named justifications (the same named-rule discipline as live normalization, because an unwaived-versus-waived distinction is what auditors actually ask for).
- **The genuinely novel UX: scan diff across versions.** Because both the old and new variants exist as data, an upgrade can answer "what new findings does this version introduce and which old ones does it fix" as a first-class diff. Standard Helm users cannot ask this question without building the comparison pipeline themselves. This belongs in the `cub upgrade` transcript next to the object diff.
- **Later, not now:** VEX-style statements ("CVE X in image Y does not affect variant Z because the component is disabled") are the natural extension, since the variant's effective configuration is known. Heavier analysis, real value, do not promise it yet.

## 3b. Environment attestation

The environment-determinism matrix built for the sceptic plan is part of the
commercial safety story. A catalog artifact should not only say "this rendered
once"; it should say which render context was tested.

For the free public catalog, this means one supported platform profile per
variant, with the recorded Helm version, Kubernetes capability profile, flag
profile, timezone, locale, and relevant environment facts.

For paid or managed support, this can expand into a support matrix:

```text
variant x Kubernetes version x controller profile x policy profile x platform
```

The commercial claim should stay narrow:

```text
supported for these declared profiles
not universally safe for every cluster shape
```

This matters because many Helm failures are not pure render failures. They are
target-fit failures: missing APIs, webhook readiness, storage class behavior,
load balancer assumptions, image availability, or lifecycle prerequisites. The
environment matrix, target facts, and live receipts are how those assumptions
become visible.

## 4. The commercial model

The tiers map onto the boundaries the repo already drew (product-support-tiers, maintenance SLA, and the serverless design's upsell walls):

- **Free: the public catalog.** Top-N charts, proof-grade for recorded variants, community-paced refresh, full local verifiability. This tier is the trust engine and must stay genuinely good; the sceptic plan's never-degrade-local rule applies.
- **Paid: the catalog subscription.** What is bought is the SLA, not the bits: guaranteed refresh cadence against upstream, a CVE-response turnaround commitment (re-render, re-scan, re-sign within a stated window), the attestation pack per variant (SBOM, scan receipts, digest inventory, signatures), and hardened variants. The patch-SLA and old-version-support lanes already named in the support-tiers doc live here. This is exactly the artifact-subscription business the Bitnami affair validated, with proof attached.
- **Paid: the private catalog.** The same machinery pointed at the customer's own world: org pins, private values and overlays, wrapper charts, internal charts run through the same render-scan-sign pipeline, private refresh SLAs. The support-tiers doc already marks this column as the commercial one.
- **The Server tier.** Where the per-install story becomes an estate story: fleet-wide CVE queries, authority on every change, the ledger, gates before apply, continuous observation. This is the upsell from the serverless doc, and security is its sharpest wedge, because "where do I run this image and who changed that field" are the two questions a security team asks weekly that scattered receipts cannot answer.

The pricing logic underneath: factory scanning amortizes a cost every customer currently pays separately and badly; the subscription sells that amortization plus the SLA; the Server sells the queries. Each tier's security claim is backed by a receipt the tier below can verify, which keeps the funnel honest.

The broader commercial packaging work is tracked in
[issue #949](https://github.com/confighub/helm-expt/issues/949). That issue keeps
three paid lanes explicit without forcing them into first-run user docs:

- **Helm remediation and legacy patch lane:** old approved chart versions,
  CVE-oriented object patches, image digest updates, RBAC/securityContext fixes,
  deprecated API patches, webhook/cert mitigations, rollback evidence, and patch
  SLAs.
- **Config lifecycle intelligence:** upgrade risk, hook/lifecycle routes,
  annotated diffs, evidence packs, and exact rendered configuration variants.
- **Managed integrations:** Argo, Flux, Kargo or promotion waves, bulk scan and
  patch, AICR, NIM, and possible BYO AI/cloud sandbox integrations.

Those are commercial lanes, not free-catalog claims. Each should map to a
receipt, claims-register row, or explicit future/no-claim status before launch
copy mentions it as a product capability.

## 5. What makes the safety claim defensible

The difference between this and security marketing is that every safety statement is receipt-backed, re-runnable, and scoped:

- Every claim in the sales material maps to a row in the claims register (sceptic plan T1). No receipt, no claim.
- Everything is reproducible by the customer: clone-and-verify is the standing answer to "why should we believe your scan."
- External reproduction (sceptic plan T6) and the signing infrastructure (key ceremony, transparency log) are prerequisites for the paid security tiers, not nice-to-haves. Selling a security promise on a single-party-verified, ceremony-less key invites the exact headline the sceptic plan exists to prevent.
- The refuse-to-claim page is a sales asset. The vendor that states plainly what it does not promise is more believable on what it does. Put it in the deck.

## 6. Honest limits and open questions

- Scanner findings are not exploitability; the receipts report, the customer judges. Say so in the product.
- We inherit upstream chart and image quality; the catalog makes it visible, it does not make it good.
- Key compromise is the catastrophic scenario; the ceremony and transparency log are on the critical path to charging money for any of this.
- Indemnification and liability posture for the paid tiers is a business decision flagged here, not answered.
- Compliance positioning: promise evidence (receipts that map to change-management and integrity controls), never certification. Auditor-friendly is the claim; audit-passing is the customer's.
