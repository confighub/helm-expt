# Check a configuration, keep the answer

Config Workshop helps with a configuration that is new, uncertain, or different
from one already in the Catalog. The most common starting point is a Helm chart
and values written or changed by an AI assistant:

> Here is the chart and values my AI produced. Compare them with the chart
> defaults, the Catalog, and what I run now. Tell me what matters, then give me
> a reviewed result I can keep.

The same workflow also accepts rendered Kubernetes YAML, an OCI bundle, an AICR
recipe, or configuration exported from an existing deployment.

## Questions this workflow should answer

| Question | What a useful answer contains |
| --- | --- |
| I set a value. Why did the rendered object not change? | If Helm ignored the setting, check first for a misspelled or wrong values path. Render with and without that value. Identify the correct path or report that the chart does not expose the field. |
| AI wrote these values. What did they actually change? | Compare the candidate with chart defaults, a matching Catalog configuration, and optionally the current deployment. Show exact object and field changes. Check credentials, permissions, images, storage, hooks, and CRDs. |
| Can I upgrade this chart without breaking production? | Render both versions with the same release context. Compare objects, values, hooks, CRDs, immutable fields, storage, and required Secrets. Include the current Helm release record when it is available. |
| The chart does not expose the field I need. Must I fork it? | Show the rendered object and the missing field. Keep the chart unchanged when a reviewed post-render edit is enough. Check that edit for overlap when the chart is upgraded. |
| How should Argo CD or Flux handle this chart's hooks and CRDs? | List each hook, CRD, and setup job in execution order. State who runs it, what must already exist, and which controller path has actually been tested. |
| Can I roll back to exactly what ran before? | Look for a retained rendered revision or OCI digest. Restore those exact objects when they exist. Separate Kubernetes configuration from database migrations and other external effects. |
| How is this candidate different from production? | Compare the two exact object sets and their source records. Keep desired-configuration differences separate from live-cluster drift. |
| Where does this vulnerable image run, and how can I update it safely? | Search the supplied estate or ConfigHub records, show every affected environment and cluster, test the candidate, and promote it through a limited rollout wave. |

## One answer shape

Every investigation should return the same useful result:

1. The exact Kubernetes objects that were inspected.
2. The source, version, values, namespace, release name, and capabilities used
   to produce them, when those facts are available.
3. A comparison with the relevant default, Catalog configuration, prior
   version, desired configuration, or live result.
4. Required Secrets, CRDs, hooks, APIs, storage, setup jobs, and other target
   requirements.
5. Checks that ran, findings they produced, and important checks that did not
   run.
6. One recommended next action.
7. A `ConfigurationReview` record that links the inspected objects to the
   question, source, comparison, and findings.

The result may remain as local files. It may also be packaged as OCI. When a
team needs shared history, variants, approvals, promotion, or delivery, the
same objects and review record can be stored in ConfigHub.

## The three public jobs

**Catalog** answers questions already investigated for a named source and
version. It provides retained packages, useful configurations, setup
requirements, checks, and known limits.

**Check my config** investigates a new chart, version, values set, OCI bundle,
or existing deployment. The browser can inspect rendered YAML without sending
it to a server. For Helm rendering and deeper comparisons, it builds a prompt
for the user's local AI assistant.

The page does not run an AI service. A user may work with their own Claude,
Codex, or other assistant. The assistant can run the local investigation,
explain findings, propose a corrected candidate, or complete the ConfigHub
handoff. The user still checks the exact files, commands, diffs, and evidence.
The page supplies a separate handoff prompt that tells the assistant to verify
the downloaded file digests, preserve the accepted objects, stop for Secrets,
ask before writing to ConfigHub, and read the stored result back.

**ConfigHub** retains an accepted answer. It stores the exact objects and a
non-deployable review Unit, then lets a team make variants, review diffs,
promote changes, publish releases, and compare desired configuration with live
observations.

## From an investigation to the Catalog

A public investigation does not become a known-good configuration merely
because it rendered. A maintainer must reproduce it, check the source and
inputs, classify its setup work, record the result, and decide whether to add
or refuse the case. Accepted cases become new versioned Catalog entries. A new
review never silently replaces an older retained version.

Private charts and values remain private. Their review records can still be
kept locally or in the user's ConfigHub organization, but they are not public
Catalog candidates.

## Limits

A browser check does not run Helm, contact a cluster, test an admission
webhook, execute a hook, or prove that a workload became healthy. It is useful
for object inventory, straightforward configuration checks, and a first
comparison. The review record names its method so later tools do not mistake a
browser check for live evidence.

An AI answer is advice until its commands, objects, diffs, and cited evidence
have been checked. Missing evidence stays marked as not checked.
