# Workshop UX trial preparation

Status: first bounded assistant inspection cohort recorded, 2026-09-11.
[Results and limitations](../../runs/workshop-ux/2026-09-11/m1-first-cohort/README.md)
include two excluded harness pilots and two corrected-snapshot attempts.
Browser, human, executable missions M2–M6 and live-chat API trials are not run.
This is the test protocol for the [execution plan](./workshop-execution-plan.md),
not a replacement roadmap or a new proof of deployment.

The mission is to make configurations, charts, apps and stacks easy to find,
inspect, compose, adapt and retain, with the same evidence boundaries for a
person using cub and an assistant using tools. A useful anonymous local result
is a successful outcome. Signup is not a success requirement. A supplied GPU
snapshot is not a live fleet; shell access is not a hosted API.

## Release prerequisites

Demo-history enforcement (#1883), Prometheus preservation binding (#1885) and
the execution checkpoint (#1884) are merged. The effective-values binding fix
is #1887: require its nine exact-head CI checks and merge before accepting a
new trial baseline. Legacy input-binding reconciliation remains #1886; its
scope is not covered by the common proof-kit fix.

Do not run a serious trial against a moving deployment. After the Guide setup
fixes and this protocol land, record that merge SHA as the website revision,
require the matching Publish site run to succeed, and serve that revision's
complete tracked repository snapshot locally for the controlled comparison,
opening `site/index.html`. Serving `site/` alone breaks relative evidence links;
verify those routes before starting the clocks. The public website can be a
separate discovery trial only after its deployed revision is established.

## Environment lock

The initial reference snapshot below is immutable. It is a reference, **not the
final post-fix trial release**. Complete the final lock before starting clocks;
never silently mix this snapshot with newer site pages or Catalog data.

| Item | Reference pin or requirement |
| --- | --- |
| Website and Catalog repository | `0925476402fb829d0bc76a0fce5324ae8396cccf` |
| Catalog file | `data/base-variant-records/records.json` |
| Catalog SHA-256 | `faf5d12d7222da1c278bd6f93f7e2725f0d3f716b275c31bfc4806327a0274f0` |
| Site generation timestamp | `2026-09-04T11:23:58.207Z` |
| Guide plugin source | `confighub/cub-workshop@56e261a87dc3b060a86474bc796d379dd9bb7f3d` |
| Guide plugin version | `0.6.21`; install the pinned checkout, not a floating plugin release |
| cub client | `v0.4.4`, commit `dd78f3bc92acd7fe258ecc68b65abeee0a282509` |
| Node reference runtime | `v25.9.0` |
| Exact inspection selection | `bitnami-redis-25-5-3-default` |
| Configuration digest | `175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e` |
| Historical evidence | `runs/workshop-guides/2026-09-11/receipt.json`; checked by `scripts/verify-workshop-demonstration-history.mjs` |

For each trial retain: repository and plugin SHAs, Catalog byte hash, cub client
version, Node version, OS, browser version, assistant client/model/version,
approval policy, start/end UTC, task ID, interface, initial directory and output
manifest. Use roles and trial IDs, not personal names. Sanitize credentials and
home directory prefixes. Record deviations as a separate cohort.

The newer plugin checkout is not automatically the Guide runtime. A version
upgrade requires a new lock and a preparation smoke check. Do not install into
another user's active plugin environment: prepare a dedicated test environment
with the ordinary supported installation mechanism.

## Clean sessions and cohorts

Run the same six missions through (a) a person using the website and cub and
(b) a fresh coding-assistant session using the website and command tools. Keep
setup and mission time separate. Start each mission with a fresh working
directory and no prior outputs. For the resume mission only, transfer its
explicit artifact bundle into a second fresh session.

Start assistants without this conversation, reviewer answer keys, prior trial
transcripts or repository task memory. Keep normal approvals. Record any
unavoidable inherited instructions. Use a fresh browser profile with empty
local storage; do not clear a person's existing profile. No authentication,
cluster or registry access is required for this cohort. If an interface needs
access unavailable in its environment, record a blocked trial; do not emulate
its actions with another interface and label that a completed trial.

The live-chat API cohort is blocked on #1861. Do not substitute a shell command
and score it as an API call. Independent agent capacity is also a prerequisite;
a quota refusal is an environment block, not a product failure or permission to
bypass provider controls.

## Participant briefs

Give only the chosen brief, the pinned website entry URL and the allowed local
working directory. Let participants discover the relevant Guide. For executable
missions provide the pinned plugin checkout, or measure its documented setup as
a separate first-use cohort. Do not include the answer key below in the prompt.
Allow 20 minutes per mission, plus up to 15 minutes for first-use setup. These
are initial observation limits, not claimed product completion times.

| ID | Brief |
| --- | --- |
| M1 Find and inspect | Find the Redis 25.5.3 default configuration. Save the exact record and explain what it installs, where its settings come from, what has been checked and what remains untested. Explain where the next edit belongs. |
| M2 Compose | Build a local platform with GitOps services and a shop app using the retained Kubara selection. Keep the materialized configuration and explain what would still be required to run it on a real target. |
| M3 Adapt | Change only the Prometheus example's replica count from one to two. Keep a reviewable comparison. Show how you would notice an additional, unrequested change. |
| M4 Match | Compare the supplied GPU workload with the supplied Node facts. Also try one insufficient-GPU case and one missing-GPU-fact case. Save all outcomes and explain what each establishes. |
| M5 Refusal | Starting from the composed workspace, try an ExternalSecret API version the bundled CRD does not serve. Keep the refusal, explain it, and recover in a separate copy without concealing the failed attempt. |
| M6 Save and resume | Hand the complete reviewed local workspace to a fresh session in a different directory. Resume checking it, identify its source and prior result, and explain whether anything has been deployed or made authoritative. |

## Reviewer answer key and evidence

| Mission | Guide and acceptance evidence |
| --- | --- |
| M1 | [Catalog inspection](../../examples/workshop-catalog-inspection/README.md): lookup exit 0, `found`, 14 objects, exact configuration digest, full record plus Catalog and selected-record hashes. Destination/post-deployment remain not-run. Wrong pin returns exit 4 and no record. This is a repository adapter, not an invented cub command. |
| M2 | [Compose](../user/workshop-compose-guide.md): 184 objects, retained stack/components/render/result; static certification leaves target prerequisites unverified. No ConfigHub objects, delivery or health claim. |
| M3 | [Adapt](../user/workshop-adapt-guide.md): Deployment `monitoring/prometheus-server`, `/spec/replicas` 1 to 2, both input hashes; ordinary exit 0, `--exit-code` exit 1. Separate candidate changing revisionHistoryLimit 10 to 5 yields two fields and a review hold, not automatic approval. |
| M4 | [Match](../user/workshop-match-guide.md): candidate/mismatch/unknown exits 0/1/3; original facts retained; GPU 2 to 1 produces mismatch; omission produces unknown. `liveChecked` remains false. No scheduling, free-capacity or inference claim. |
| M5 | [Compose refusal](../user/workshop-compose-guide.md): `external-secrets.io/v1beta1` is not served; exit 1 and `certified: false`. Preserve incompatible workspace and refusal; restore supported v1 in a new copy and recertify to a new result. Never overwrite the failure or claim live recovery. |
| M6 | [Compose resume](../user/workshop-compose-guide.md) and [Adapt resume](../user/workshop-adapt-guide.md): move all component/input files, preserve baseline hashes and receipts, rerun from moved paths to new outputs. A copied manifest alone is insufficient. A fresh session's execution is required; a same-session directory move alone does not establish independent continuation. |

The retained demonstration verifies historical artifacts. It is not a fresh
participant run, a verbatim copy-and-paste usability study, or a new assistant
session attestation. Reviewers must keep those evidence categories separate.

## Guide completion accounting

The local walkthroughs have direct and assistant instructions, setup,
saved outputs, expected nonzero results, boundaries and continuation. Adapt and
Match setup now explicitly prepares files even when reusing an installed
checkout. All six missions have a local path above. Guide admission and the
entire planned portfolio are **not all complete**.

The site contract's 20 “guide pages” include home/hub pages; that count must not
be reported as 20 completed portfolio Guides. The portfolio now includes the explicit Flux onboarding follow-up, for
14 Guides/Paths. Account for every one before any broader completion claim:

| Portfolio item | Preparation coverage and remaining acceptance |
| --- | --- |
| G-E1 Inspect | M1 runnable draft; accountable owner and independent admission remain #1869. |
| G-E2 Ignored value | [Values Guide](../user/workshop-values-guide.md) supplies a controlled teaching-chart experiment, typo/correct-key comparison and positive control; admission remains. |
| G-E3 Add a field | [Field and restore Guide](../user/workshop-field-restore-guide.md) covers a label addition with preserved source and object-replacement review hold; arbitrary schema acceptance and admission remain. |
| G-E4 AI change | M3 tests visible unexpected edits; independent fresh assistant execution and admission remain. |
| G-M1 Compare | M3 runnable local comparison; accepted-configuration authority remains outside this cohort. |
| G-M5 Resume | M6 defined; independent continuation evidence must come from the trial. |
| G-M2 Upgrade | [Upgrade Guide](../user/workshop-upgrade-guide.md) completes local candidate review with a named hold; protected team intent and live promotion still require their own evidence. |
| G-M3 Hooks and CRDs | [Lifecycle Guide](../user/workshop-lifecycle-guide.md) covers hook inspection, served-API refusal and a complete review checklist; hook execution and target ordering remain live work. |
| G-M4 Restore | [Field and restore Guide](../user/workshop-field-restore-guide.md) covers exact local byte restoration; data-safe successful live rollback is not established by it. |
| P-COMPOSE | M2/M5/M6 cover local platform plus apps; Kubara target/context evidence remains #1759. |
| P-GPU | M4 covers supplied facts; H100 runtime and model access remain #1581. |
| P-GPU-FLEET | Fleet CRD/source-of-record and four separate confidence proofs remain #1582. |
| P-ARGO | Tree, child/generated objects and authority handover remain #1870. |
| P-FLUX | Existing Kustomization/HelmRelease onboarding and authority handover remain #1893. |

Do not upgrade portfolio statuses from this table. Each needs its own reviewed
Guide, owner and evidence under #1869. Serious **local** UX can evaluate the
six runnable missions; a claim that every planned Guide is finished must wait
for the remaining rows. Record missing walkthroughs as backlog, not as a pass.

## Scoring and decision rules

Record raw measurements first; never replace them with a composite average.

| Measure | Record and score |
| --- | --- |
| Useful-result time | Seconds from brief to first saved, correct, reviewable result; setup seconds separately. Timeouts retain elapsed time and no success time. |
| Setup friction | Commands attempted, failed attempts, restarts and undocumented steps. 2 = documented setup works; 1 = one recoverable undocumented step; 0 = blocked or multiple undocumented steps. |
| Help needed | Count interventions and their exact wording. 2 = none; 1 = navigation hint only; 0 = procedural or corrective help. |
| Correctness | 2 = all mission evidence and boundaries correct; 1 = incomplete artifact without false claim; 0 = wrong result, lost evidence or unauthorized action. |
| Evidence understanding | 2 = distinguishes proven, unknown and not-run; 1 = ambiguous but correct when asked neutrally; 0 = claims runtime/approval/provenance the evidence does not establish. |
| Mission understanding | Ask “What did this help you decide, and what would you do next?” Retain the answer verbatim; 2 = specific useful decision and valid next step, 1 = partial, 0 = mistaken purpose. |

A mission passes only with correctness 2 and evidence understanding 2, a saved
result, and no prohibited action. Correct refusal/unknown is a useful result.
Flag any false deployment/safety claim, destructive recovery, pin substitution
or silent loss of evidence as a critical finding regardless of speed. Report
setup friction and assistance alongside pass rate; do not hide them in it.

Before expanding to serious runs: resolve preparation smoke failures; complete
the final environment lock; confirm participant/agent capacity; keep answer
keys separate. After an initial pair of trials per available interface, fix
critical findings before scaling. Compare interfaces on the same missions and
pins; publish denominators, blocks and assisted completions separately. The first retained cohort does not establish a completion-time benchmark or
population pass rate. Collect clocks outside participant-written logs and
verify required artifacts before accepting a completion claim. Record shared
checkout status before and after each trial to catch misplaced outputs. Require
absolute output paths in participant tool calls; prompt-only directory isolation
is not a filesystem sandbox.


## Check a saved inspection handoff

Before accepting an M1 completion, the reviewer runs the read-only checker
against the locked Catalog and the participant's absolute output directory:

```sh
node scripts/check-workshop-ux-handoff.mjs \
  --trial-dir "$UX_TRIAL_DIR" \
  --catalog data/base-variant-records/records.json \
  --catalog-sha256 faf5d12d7222da1c278bd6f93f7e2725f0d3f716b275c31bfc4806327a0274f0 \
  --record-name bitnami-redis-25-5-3-default
```

Set `UX_TRIAL_DIR` to the assigned absolute directory first. This requires
`record.json` from the existing lookup adapter, `result.md`, and `trial-log.md`
in that directory. The checker rejects missing or symlinked artifacts,
a different Catalog pin, and a modified or wrong selected record. Exit 0 means
the files and identity checks passed; exit 1 means an incomplete or mismatched
handoff; exit 2 means invalid arguments. It does not validate the prose, prove
elapsed time, detect every outside-directory write, or award a UX pass.

Record the dispatch and final-artifact observation times outside the agent's
log. Compare shared-checkout status with the pre-trial baseline and inspect
unexpected files before accepting completion. Preserve misplaced artifacts as
such rather than moving them into the required handoff and calling it a pass.
For the next M1 cohort, explicitly include the three required filenames and
identity requirement in the brief; keep the answer key separate. This changes
the brief, so report it as a new cohort rather than pooling the results.

Run the checker's negative cases with
`node --test scripts/check-workshop-ux-handoff.test.mjs` before using a changed
checker. Reviewers still score evidence understanding and next actions.
