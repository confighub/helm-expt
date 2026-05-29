# Variant Creation Artifact

This document proposes the artifact Jesper is asking for: something a component
author can create to drive ConfigHub server-side variant creation, similar in
spirit to creating an installer package.

The proposed artifact is:

```text
VariantCreationPlan
```

Public phrase:

```text
variant blueprint
```

## Why This Exists

`cub install` recipes answer:

```text
How do we turn a chart/component source into reviewed ConfigHub Units?
```

`cub variant create` answers:

```text
How do we clone an existing reviewed ConfigHub space into a new
environment/region/customer/target variant?
```

The missing object is the component-author guidance between those two:

```text
When a new server-side variant is cloned, what should the user review,
fill in, relink, transform, scan, approve, or leave alone?
```

## Scope Rule

The scope should not be wider than Helm's operational scope.

Infrastructure provisioning, data replication, cloud API setup, secret-manager
uploads, and other external actions stay outside the artifact unless they are
represented as ConfigHub Units, target facts, placeholders, or explicit
preflight requirements.

The artifact should drive server-side ConfigHub changes. It should not require
shell scripts, Git checkout state, or out-of-band imperative code.

## Relationship To Existing Concepts

| Existing concept | Role |
| --- | --- |
| `cub install` package | Produces the base ConfigHub Units from a component source. |
| ConfigHub space | The component base or already-reviewed source variant. |
| `cub variant create` | Clones the source space, units, links, triggers, permissions, target, labels, and selected metadata. |
| Placeholders | Mark values that must be supplied or resolved in the variant. |
| `NeedsProvides` links | Automatic or disambiguated value binding where paths line up. |
| `TransformPaths` links | Explicit extraction/transformation from one or more upstream values into downstream fields. |
| Functions / invocations | Component-specific yq, Starlark, or CEL helpers, checks, and mutations. |
| Filters / views | UX guidance for which units or fields matter during customization. |
| Target facts | Target-specific facts available to triggers, functions, parameters, and gates. |
| MutationSources | Proof of which paths were changed by a function/link/dry run. |
| Gates / checks | Proof that placeholders are filled, schemas validate, policies pass, and target requirements are satisfied. |

## Artifact Shape

The artifact should live as a ConfigHub Unit in the component's base space, and
may also be committed beside a catalog recipe for review.

Example file location in this repo:

```text
recipes/<repo>/<chart>/<version>/variant-creation-plan.yaml
```

Example ConfigHub Unit:

```text
kind: AppConfig
name: variant-creation-plan
schemaType: confighub.variant-creation-plan/v1alpha1
```

Sketch:

```yaml
apiVersion: confighub.com/v1alpha1
kind: VariantCreationPlan
metadata:
  name: redis-server-side-variants
spec:
  source:
    spaceSelector:
      labels:
        Component: Redis
        Variant: default

  clone:
    copyUnits: true
    copyLinks: true
    copyOutgoingLinks: ask
    copyIncomingLinks: false
    copyTriggers: true
    copyPermissions: true
    setTarget: ask
    labels:
      Variant: required
      Environment: optional
      Region: optional

  parameters:
    unit: redis-variant-parameters
    schemaRef: confighub.redis.variant-parameters/v1
    placeholdersMustBeResolved: true

  placeholders:
    - unitSelector:
        labels:
          Component: Redis
      paths:
        - metadata.namespace
        - spec.template.spec.containers.?name:container=redis.image

  transformPaths:
    - name: namespace-from-parameters
      from:
        unit: redis-variant-parameters
        path: spec.namespace
      to:
        unitSelector:
          labels:
            Component: Redis
        path: metadata.namespace
      expression:
        type: go-template
        value: "{{ .value }}"

  functions:
    optional:
      - set-resource-requests
      - set-image-tag
    requiredChecks:
      - vet-format
      - vet-placeholders
      - vet-jsonschema

  views:
    - redis-customization
    - redis-secrets
    - redis-networking

  gates:
    beforeApprove:
      - no-unresolved-placeholders
      - schema-valid
      - links-resolved
      - target-facts-satisfied
```

This is intentionally declarative. It names ConfigHub-native objects and paths,
not shell commands.

## What The Author Provides

A component author should provide:

| Artifact | Purpose |
| --- | --- |
| `VariantCreationPlan` Unit | The server-side variant blueprint. |
| Parameter Unit with placeholders | Values users are expected to provide or resolve. |
| Optional schema reference | Validation for the parameter Unit or component-specific config. |
| TransformPaths links | Explicit, inspectable field propagation. |
| Saved function invocations | Common mutations/checks that are useful but not automatic. |
| Filters/views | UI guidance for customization and review. |
| Gates/checks | Required validation before approval/apply. |
| Docs/URLs as annotations | Human guidance attached to spaces or units. |

## Workflow

1. Component author publishes a base space with Units, links, triggers,
   permissions, filters, views, functions, docs, and a `VariantCreationPlan`.
2. User runs `cub variant create` or uses the UI to clone the space.
3. ConfigHub applies clone options: target, CVT labels, permissions, gates, and
   selected outgoing links.
4. ConfigHub opens the plan-guided workflow:

   ```text
   fill placeholders
   review outgoing links
   choose target facts
   apply TransformPaths links
   run optional mutations
   run required checks
   inspect diff
   approve/apply
   ```

5. ConfigHub records what changed through link bindings, function summaries,
   mutation sources, revision history, checks, and receipts.

## Why TransformPaths Matters

`NeedsProvides` is good when a producer path naturally fills a consumer path.
`TransformPaths` is better for variant creation because customization often
needs one or more upstream values to shape one downstream value.

Examples:

```text
environment + region -> namespace
domain + component -> ingress host
target facts + policy -> secret reference
parameters + image policy -> image reference
```

The paths are explicit, so ConfigHub can detect when an upstream or downstream
change would break a binding.

## Placeholders Are The UX Handle

Placeholders should mark fields that need user or target input.

The plan should not invent a second parameter system when a Unit with
placeholder values already gives ConfigHub:

```text
versioning
schema validation
clone behavior
links
triggers
functions
views
gates
revision history
```

For external values such as AWS account IDs, bucket names, KMS keys, database
endpoints, or secret-manager references, prefer typed ConfigHub Units or
target facts over package-specific values.

## Proof And Safety

A server-side variant is credible only if ConfigHub can show:

```text
what was cloned
which links were copied or changed
which placeholders remained or were filled
which TransformPaths ran
which functions mutated which paths
which target facts were used
which checks passed
which unit diffs resulted
which approvals/applies happened
```

This means the artifact should be designed around path-level evidence:

```text
TransformPaths
NeedsProvides bindings
MutationSources
revision diffs
function summaries
check results
receipts
```

## Relation To Helm-Expt

For Helm-derived catalog entries:

```text
recipe/package variants handle render-time choices
VariantCreationPlan handles post-upload server-side customization
```

Use recipe/package variants for:

```text
CRDs on/off
generated Secret vs existing Secret
HA/storage mode
ingress/TLS shape that changes rendered objects
cloud-specific Helm values
anything requiring a new Helm render
```

Use `VariantCreationPlan` plus `cub variant create` for:

```text
staging/prod clone
region/customer clone
target binding
space labels and gates
placeholder filling
TransformPaths link review
post-clone Unit mutations
component-specific views/functions/checks
```

## Open Questions For Brian And Jesper

1. Should `VariantCreationPlan` be a first-class kind, or an AppConfig Unit with
   a registered schema type?
2. Should the plan be attached to a space, a Unit, or both?
3. Should clone-time UI render the plan as a wizard, checklist, or review page?
4. Should `cub variant create` accept `--plan <unit-or-file>`?
5. Should TransformPaths links be created by the plan directly, or should the
   plan only reference pre-created links in the base space?
6. What should be required before approval: no placeholders, all required
   links resolved, all required checks passed, or target facts satisfied?
7. How do we distinguish optional helper functions from required validation
   functions?
8. What receipt object records clone-time choices and post-clone mutations?

## Short Pitch

```text
An installer package creates the base component.
A VariantCreationPlan tells ConfigHub how to safely clone and customize it.
```

Or:

```text
Do not ask users to write scripts after clone.
Ship the customization workflow as data in the base space.
```
