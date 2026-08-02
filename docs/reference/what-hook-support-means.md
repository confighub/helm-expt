# What "Hook Support" Means Here

**UNOFFICIAL/EXPERIMENTAL**

A Helm hook is work that must happen at a particular time. Matching Helm's
rendered YAML does not show that a migration ran before an upgrade, or that a
setup Job completed before a workload started.

For every top-100 chart with hooks, the catalog records one status called a
**disposition**. It says what we know, what the user still has to do, and which
evidence supports that answer. The records are in
[`data/hook-disposition/`](../../data/hook-disposition/summary.md), and a
verifier fails if a hook-bearing chart has no disposition.

## The Dispositions

| Disposition | What it claims | What it does not claim |
| --- | --- | --- |
| `observed` | A live test ran the recorded hook work and saved the result. | That the same result applies to other configurations, chart versions, or clusters. |
| `routed` | The required work and a proposed method are recorded, with the rendered hook objects and either a rehearsal or an exact blocker. | That ConfigHub runs the work automatically, or that the work succeeded on a live cluster. |
| `per-target` | The correct method depends on the target cluster. | That one method covers every target. |
| `refused` | The catalog does not support this hook behavior and records why. | Any successful install claim for that behavior. |
| `recipe-needed` | The chart does not yet have a maintained catalog configuration to which the hook work can be attached. | That the chart itself is faulty. This is unfinished catalog work. |

## Three Rules That Keep This Honest

1. **Hooks from subcharts count.** The `dependency_source` column names the
   subchart that provides a hook, such as Kong inside Kubernetes Dashboard.
   Checking only the top-level chart would miss that work.
2. **Conditional hooks need both renders.** The evidence under
   `data/hook-disposition/evidence/` renders the default configuration and the
   hook-enabled configuration, then records both digests. This shows whether
   the values actually create the hook objects.
3. **A blocked test is still useful.** Kafka and MinIO reached real target
   requirements, then stopped because pinned upstream image tags no longer
   resolved. The receipts keep the exact pull errors and identify the next
   choice: use an image override, add a digest-pinned configuration, or test a
   newer chart version.

## Where The Evidence Lives

- Disposition table: [`data/hook-disposition/top100-hook-dispositions.csv`](../../data/hook-disposition/top100-hook-dispositions.csv)
- Worked render evidence and blocker receipts: `data/hook-disposition/evidence/<chart>/`
- Maintained live receipts: [`data/hook-lifecycle/`](../../data/hook-lifecycle/summary.md)
- Route candidates awaiting recipes: [`data/hook-route-candidates/`](../../data/hook-route-candidates/summary.md)
