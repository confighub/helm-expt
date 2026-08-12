# 1. SCORE TABLE

Twelve in-catalog charts, five boolean hazard fields, 60 cells per arm.

| Field | Arm A (shell) | Arm B (catalog + shell) | Arm C (catalog only) | Majority-class baseline |
|---|---|---|---|---|
| hooks | 12/12 (100%) | 12/12 (100%) | 12/12 (100%) | 91.7% |
| lookup | 12/12 (100%) | 12/12 (100%) | 12/12 (100%) | 66.7% |
| webhooks | 10/12 (83.3%) | 12/12 (100%) | 12/12 (100%) | 58.3% |
| generated_secrets | 12/12 (100%) | 12/12 (100%) | 12/12 (100%) | 58.3% |
| crd_evidence | 12/12 (100%) | 12/12 (100%) | 12/12 (100%) | 91.7% |
| **Booleans overall** | **58/60 = 96.7%** | **60/60 = 100%** | **60/60 = 100%** | 73.3% |
| safeToFlatten | 12/12 | 12/12 | 12/12 | 12/12 (degenerate) |
| Minutes spent | 16 | 22 | 19 | — |
| Minutes per chart (18 charts) | 0.89 | 1.22 | 1.06 | — |

Object count, scored on the nine charts where ground truth records a number, plus the three where truth records null and the correct behaviour is to abstain.

| | Exact on the 9 determinable | Correct abstention on the 3 null | Notes |
|---|---|---|---|
| Arm A | 1/9 | 1/3 | wrong on 8, every one high by exactly its own hook-annotated document count |
| Arm B | 9/9 | 1/3 | asserted 70 for consul and 9 for grafana where truth abstains |
| Arm C | 9/9 | 2/3 | asserted 9 for grafana where truth abstains, and said so explicitly |

Arm A's eight object-count misses are not eight independent errors. A reported total rendered documents; the catalog counts non-hook documents. Subtract the hook count B measured for each chart and all eight of A's numbers become exact (132−7=125, 80−11=69, 131−7=124, 44−4=40, 46−4=42, 24−4=20, 53−4=49, 44−3=41). A knew the charts. A did not know the counting convention.

Arm A's only two boolean misses are kyverno webhooks and longhorn webhooks. In both cases A wrote in its own method note that the webhook configurations are registered by the controller at runtime rather than rendered, then answered "present" anyway. Both were the charts A marked medium confidence. Confidence was calibrated; the answer was not.

# 2. THE DECISION

Arm A reached 96.7% of Arm B's boolean accuracy in 0.89 minutes per chart. The threshold was 90% in under five minutes. **The first branch fired, and it fired by a wide margin on both terms. On this question set the corpus is a convenience.** The second branch did not fire and was never close; A did not land below 60% on the quirk questions, it landed at 96.7%.

The money moves to signing and custody.

Two facts qualify what the test measured, and neither rescues the corpus.

The test barely discriminates. Four of the five fields are saturated at 100% for all three arms. The entire A-versus-B gap is two cells in one field, and both are the same error. safeToFlatten carries zero information because every truth row is "no" and every arm said "no" 60 times out of 60.

The catalog arms were slower, not faster. B took 22 minutes and C took 19 against A's 16. The corpus did not buy speed on this task.

# 3. ARM C VERSUS ARM A

C beats A, 60/60 against 58/60, and abstains better on object counts (2/3 versus 1/3). By the pre-registered rule, the data is worth shipping.

Hold that result loosely. The margin is two cells, 3.3 percentage points. C self-reported contamination on six rows and partial contamination on a seventh, so more than half of C's in-catalog score is not a clean read. Scoring C's clean rows alone gives 30/30, so contamination did not manufacture the win, but it means the win rests on six charts.

The more useful signal sits outside the score. Where A diverges from B and C, it diverges on house convention rather than chart fact. A miscounted objects because it used a different counting rule. A called minio/operator and strimzi safe-to-flatten because it does not know that shipping CRDs alone puts a chart in flatten-with-routes. Those are schema and doctrine, not evidence. A shell reproduces the evidence in under a minute per chart. It cannot reproduce the convention.

# 4. THE OUT-OF-CATALOG SIX

The six are actually five. Both B and C independently found that minio/operator@7.1.1 is in the catalog under the repo alias `minio-operator`, at the exact version, and both read its verdict and receipt. That row is a coverage bug in the test, not an out-of-catalog probe, and it is the row where A's answer diverges from both catalog arms on safeToFlatten.

Across the six, the three arms agree unanimously on 25 of 30 hazard cells (83.3%). Pairwise, A-B agree on 28/30 (93%), A-C on 26/30 (87%), B-C on 26/30 (87%).

The five disagreements are all C alone against A and B, and C flagged low confidence on every one of them.

- elasticsearch hooks: B present, A and C absent. B's "present" traces to a `helm.sh/hook` string inside values.yaml, which is a scan-pattern artifact.
- elasticsearch generated_secrets: C absent, A and B present after actually rendering.
- crossplane crd_evidence: A present on runtime reasoning, B and C absent at chart level. This is a definitional split, not a factual one.
- temporal lookup and airflow lookup: C absent from general knowledge, A and B present after rendering. C wrote that the airflow lookup answer was its weakest and it would not defend it.

The two arms degraded very differently, and the split is exactly the shell. B kept its shell, rendered everything, and produced answers indistinguishable in method from A, including object counts for five of six. C had no shell, abstained on five of six object counts, fell back to nearest-neighbour extrapolation and general knowledge, and produced every disagreement in the set.

So coverage is not a real barrier when the shell is present. It is a hard barrier when the corpus is all you have. The catalog-plus-shell arm did not degrade to A's level, it degraded to A's method. The catalog-only arm degraded below A.

# 5. LEAKAGE

The probe came back clean and specific. No recall of the repository, no file, no receipt schema, no chart verdict, no count. No version-pinned recall of kube-prometheus-stack 87.19.2, only family-level knowledge about the chart line, offered with explicit uncertainty about which parts apply at that version. The probe correctly said it should not be treated as an independent witness to the repo.

That result cuts against the corpus, not for it. If A had scored 96.7% because it had memorised the answers, the score would be an artifact and the corpus would still hold value against unseen charts. A scored 96.7% by rendering. The capability is live, general, and version-independent, which means it applies to charts published tomorrow just as well as to these twelve.

For timelines, this removes the usual decay argument. There is no window during which the corpus is ahead of the models and after which it is not. The reproduction cost was already under a minute per chart on the day of the test. Nothing about waiting improves the corpus's position, and the option value of holding the data unshipped is close to zero.

# 6. WHAT THIS MEANS

A shell-equipped agent with no corpus reproduced the catalog's hazard verdicts at 96.7% in 53 seconds per chart, so the recorded facts are not the asset and never were. Every place the bare agent lost, it lost on convention rather than on evidence, which means what the catalog actually owns is the counting rule, the lane definitions, and the chain of custody that makes a verdict citable. Ship the data, stop funding its production, and spend the money on signing and custody where the reproduction cost is not already zero.