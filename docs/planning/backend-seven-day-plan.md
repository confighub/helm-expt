# Backend seven-day execution plan

Started 2026-09-06. This is an ordered, 42-task execution checklist, grouped into
seven workdays of six substantial tasks. A day is a work block, not a promise
that missing access or review will arrive on that date. Check off tasks only
when their deliverable exists; an open PR is implemented, not landed.

The outcome is a reproducible backend with accurate source availability,
useful successor configurations, reliable receipt bindings and understandable
verification failures. The operating rules remain in [AGENTS.md](../../AGENTS.md).
Each implementation block gets a small independently reviewable PR from main.
Do independent work when a task is blocked; do not stack unmerged branches.

## Day 1: verification baseline and review backlog

- [ ] B01. Land the AICR legacy provenance repair [#1770](https://github.com/confighub/helm-expt/pull/1770), preserving upstream bytes and checksum pins.
- [ ] B02. Land the Redis CI evidence refresh [#1771](https://github.com/confighub/helm-expt/pull/1771), then record the first remaining full-chain failure.
- [ ] B03. Fix [#1783](https://github.com/confighub/helm-expt/pull/1783): bind lifecycle identity and selection-dependent target facts; preserve Redis materialization bytes and add rejection tests.
- [ ] B04. Fix [#1785](https://github.com/confighub/helm-expt/pull/1785): validate deployed baseline policy before recording its digest and make catalog consumers select the same receipt.
- [ ] B05. Review and land the independent ready PRs, especially variant generators [#1765](https://github.com/confighub/helm-expt/pull/1765) and [#1775](https://github.com/confighub/helm-expt/pull/1775); resolve findings before merge.
- [ ] B06. Run the complete verification baseline after merges; classify failures against the existing known-red register, without adding new regressions to it.

## Day 2: precise source availability

- [ ] B07. Land [#1786](https://github.com/confighub/helm-expt/pull/1786), retaining anonymous direct-URL and OCI observations for the four pins in [#1381](https://github.com/confighub/helm-expt/issues/1381).
- [ ] B08. Inspect the seven-row refresh queue and check the actual source addresses used for each candidate; record version-specific results.
- [ ] B09. Distinguish fetch failure, authentication requirement, digest mismatch and successful pinned-byte retrieval in source evidence; never infer one from another.
- [ ] B10. Audit refresh and live scheduling consumers against those observations; fix demonstrated incorrect scheduling, preserving historical evidence.
- [ ] B11. Test that offline receipt verification requires no network and rejects source identity or digest substitution.
- [ ] B12. Reconcile #1381 with current evidence and successor readiness; record the retirement decision or its precise remaining prerequisites.

## Day 3: usable successor configurations

- [ ] B13. Turn the Redis credential map [#1772](https://github.com/confighub/helm-expt/pull/1772) into a reviewed useful base once its generator dependencies land.
- [ ] B14. Do the same for the RabbitMQ consolidation proof [#1773](https://github.com/confighub/helm-expt/pull/1773), preserving the required external credential contract.
- [ ] B15. Complete available PostgreSQL successor static lanes and document the boundary between operator installation and database provisioning ([#1376](https://github.com/confighub/helm-expt/issues/1376)).
- [ ] B16. Complete available MongoDB successor static lanes and artifact-specific licensing evidence ([#1378](https://github.com/confighub/helm-expt/issues/1378)).
- [ ] B17. Complete MySQL operator publication and derived evidence after registry reauthentication; keep [#1779](https://github.com/confighub/helm-expt/pull/1779) draft until its required gates pass.
- [ ] B18. Verify render, scan, install prerequisites, installer package and Helm equivalence for each selected successor scope; list missing receipts explicitly.

## Day 4: runtime and stack evidence

- [ ] B19. Obtain Kubara contexts and target clusters, confirm one serial live runner, and validate prerequisites before mutation ([#1759](https://github.com/confighub/helm-expt/issues/1759)).
- [ ] B20. Run the three registered red Kubara lanes serially; repair actual failures and preserve receipts.
- [ ] B21. Complete each stack's missing receipts while preserving the platform matrix and certified-bundle reader contracts.
- [ ] B22. Run successor installation and readiness checks where target prerequisites are available; distinguish controller health from database health.
- [ ] B23. Run bounded successor upgrade and rollback checks where supported, retaining exact before/after identities.
- [ ] B24. Regenerate dependent surfaces and remove known-red entries only for lanes whose receipts and verifiers now pass. If access is absent, finish offline preflight validation and proceed to Day 5.

## Day 5: receipt integrity

- [ ] B25. Audit producers for claims based on local intent rather than observed deployed state; prioritize policy and release receipts.
- [ ] B26. Audit consumers for hardcoded historical receipt paths and inconsistent selection of newer evidence.
- [ ] B27. Audit source, selection, namespace, configuration and target identity bindings across reusable proof helpers.
- [ ] B28. Add focused negative tests for demonstrated evidence-substitution gaps; avoid tests that merely reproduce implementation.
- [ ] B29. Verify historical receipts remain immutable and distinguish historical success from current-policy or current-source coverage.
- [ ] B30. Re-run affected gates and reconcile any changed catalog claims with the exact supporting receipts.

## Day 6: AICR, NIM, Timoni and delivery patterns

- [ ] B31. Land the source-backed AICR trust/mirror/skill comparison [#1781](https://github.com/confighub/helm-expt/pull/1781), resolving review findings for [#1450](https://github.com/confighub/helm-expt/issues/1450).
- [ ] B32. Complete remaining NIM artifact-specific terms research for [#1387](https://github.com/confighub/helm-expt/issues/1387), without downloading gated models or images.
- [ ] B33. Admit a meaningfully different Timoni module after the adapter repair lands; prove its own materialization and lifecycle facts ([#1588](https://github.com/confighub/helm-expt/issues/1588)).
- [ ] B34. Prove a multi-environment Timoni selection and identify remaining delivery evidence ([#1587](https://github.com/confighub/helm-expt/issues/1587)).
- [ ] B35. Reconcile remaining AICR configuration-plane work against existing receipts; do not redo completed work or claim H100 execution ([#1608](https://github.com/confighub/helm-expt/issues/1608)).
- [ ] B36. Land the Flux/Argo survey [#1778](https://github.com/confighub/helm-expt/pull/1778); map d2 layouts only after the maintainer supplies their list ([#1758](https://github.com/confighub/helm-expt/issues/1758)).

## Day 7: maintainability and final proof

- [ ] B37. Measure verification costs and identify demonstrated redundant work before changing the chain.
- [ ] B38. Improve failure messages for the highest-cost ambiguous failures, naming the source, receipt and recovery command.
- [ ] B39. Verify deterministic regeneration and dependency coverage for the changed evidence surfaces.
- [ ] B40. Run the full chain and relevant narrow gates on the integrated main baseline.
- [ ] B41. Reconcile issue and PR status with actual landed changes, receipts, runtime limits and unresolved findings.
- [ ] B42. Publish a concise completion record: completed task IDs, evidence links, gate results and the remaining human dependencies.

## Human dependencies and fallback work

The maintainer has authorized asking the website agent to review and merge ready
PRs. Findings must be fixed and applicable CI must pass before merge. The backend
stream continues to work on branches and does not push main.

| Dependency | Affected work | Independent work while waiting |
| --- | --- | --- |
| Review and merges | B01-B06, successor and Timoni follow-ups | Source audit, receipt integrity, NIM terms |
| Kubara contexts and clusters | B19-B24 | Offline preflight and static proof validation |
| Registry credentials for [#1699](https://github.com/confighub/helm-expt/issues/1699) and [#1639](https://github.com/confighub/helm-expt/issues/1639) | Associated registry lanes | Do not work around; continue public-source/static tasks |
| Registry reauthentication | B17 / #1779 | Other successor static lanes |
| d2 layout list | B36 | Non-d2 delivery patterns |
| Human reading of nine bot-protected NGC terms pages (#1387) | B32 | Keep terms unreviewed; audit structural reference and credential guards |
| H100 for [#1581](https://github.com/confighub/helm-expt/issues/1581) | GPU execution | Keep blocked; configuration-plane work only |

## Execution record

- 2026-09-06: B07 implemented in #1786. Four OCI downloads match retained archive
  digests; the four historical direct URLs still return 403. Offline successor
  verification passes; claim integrity reports zero hard findings and 17 warnings.
  Full verification stops at the separate AICR README-origin failure fixed by #1770.
- 2026-09-06: Review and merge request posted on
  [#1757](https://github.com/confighub/helm-expt/issues/1757#issuecomment-5561833733).
  #1783 and #1785 explicitly held for evidence-binding repairs; #1779 remains draft.
- 2026-09-06: B32 has an existing human dependency recorded on #1387: nine
  artifact-specific NGC terms pages require a person to read them. The existing
  reference and credential guards are already implemented; do not bypass access
  controls or substitute general terms for an artifact-specific review.
