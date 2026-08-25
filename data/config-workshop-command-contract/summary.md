# The same three jobs on the website and command line

1. **I need a configuration. How should I run this?**
2. **I have a configuration. Is it right?**
3. **I have an accepted configuration. Can I promote it?**

Source-specific tools do the first stage. `cub check` checks the exact
Kubernetes objects locally. `workshop-result.json` keeps the source, exact file
hash, canonical object-set hash, findings, omitted checks, and next action.
ConfigHub begins when the accepted result must be retained, shared, varied,
promoted, released, or compared with a live system.

| Example | Source | Objects | Accepted object-set hash |
| --- | --- | ---: | --- |
| Helm values written with AI | helm | 5 | `sha256:502d8c85470455fa4152f8d0abb9d1582552e830148e90335e9649cbfd42f397` |
| Existing Kubernetes YAML | kubernetes-yaml | 4 | `sha256:4c7fac59248636842c560c5fcb2076bf9ffe2ed2e4576ff754b51c8dc21fed6c` |

The object-set hash uses `cub-scan-canonical-json-v1`. A file
hash identifies exact bytes. The object-set hash identifies the Kubernetes
objects across file names and document order. OCI and ConfigHub records keep
their own identities.

The Helm example materializes, checks, retains, varies, and promotes one reviewed
NGINX result. The exact command proof stops before release publication and delivery;
those checks remain separate. The Kubernetes YAML example records materialization
as a no-op and uses the same check and result contract. Its managed promotion has
not run.

- [Complete generated commands and statuses](command-map.json)
- [Helm WorkshopResult](helm/workshop-result.json)
- [Kubernetes YAML WorkshopResult](kubernetes-yaml/workshop-result.json)
- [Live NGINX retention and promotion proof](live-promotion.md)

Run `npm run workshop:commands:run-local` to execute the released Helm and
`cub check` commands in a temporary directory and compare the resulting object
set with this committed record.

## Boundaries

- cub check is local advisory evidence. ConfigHub validation remains a separate managed control.
- A promotion command is a preview until destination checks and the promotion itself have run.
- Helm materialization does real work. Literal Kubernetes YAML is already materialized, so that stage is recorded as a no-op.
- The public OCI digest, exact file hash, canonical object-set hash, and ConfigHub data hash have different roles.
