# Trial log

- Started at the local index and opened the Kubara Guide.
- Ran sandbox with the required `CUB_CONFIG` prefix; created `./platform`.
- Edited only the shop-web replica count (3 -> 2).
- Certified and rendered the changed platform; inspected the no-index diff (one line).
- Copied the complete platform to `incompatible`, changed only ExternalSecret API version, and retained the JSON refusal (exit 1).
- Help needed: none for the bounded local exercise.
- What this helped decide: the retained Kubara selection can be reviewed and handed off as files; certification catches an unsupported CRD version before delivery.
- Next: review generated objects and target-owned prerequisites, then wire GitOps and validate on a real target.
- Proven: local files, 135-object static composition, changed replica, refusal reason and hashes above.
- Unknown: target readiness, issuer/store existence, webhook behavior, GitOps reconciliation, app health/response.
- Not run: cluster creation, login, registry access or writes, publication, deployment.
