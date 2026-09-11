# M5-D UX execution result

Guide discovery: `http://127.0.0.1:8768/site/index.html` links the local workshop Guides, including “Recover from a refusal” and “Save and resume”. The installed workflow is also retained at `trial/WORKFLOW.md`.

The untouched supplied handoff is at `handoff/`. I copied it to `trial/source-handoff/`, made the refusal attempt in `trial/incompatible/`, and recovered in the separate copy `recovery/platform/`.

The refusal command was run through the installed `cub` CLI with `CUB_CONFIG=./cli/config.yaml`:

```text
cub stack certify ./trial/incompatible/stack.yaml --json
exit 1
```

The retained result is trial/incompatible/refusal.json (`./trial/incompatible/refusal.json` in workspace archive). It proves static certification refused one unresolved custom-resource API: `external-secrets.io/v1beta1|ExternalSecret|shop|shop-web-db: version-not-served; externalsecrets.external-secrets.io serves v1`. No sandbox output was produced for the refused candidate. The exact one-line edit is trial/incompatible/api-version.diff (`./trial/incompatible/api-version.diff` in workspace archive); the failed candidate remains intact.

Recovery used the separate recovery/platform (`./recovery/platform/` in workspace archive) copy with the served `external-secrets.io/v1` restored. Certification exited 0 and sandbox exited 0. recovery/platform/result.json (`./recovery/platform/result.json` in workspace archive) proves `certified: true`; recovery/platform/recovered.yaml (`./recovery/platform/recovered.yaml` in workspace archive) is the recovered render. Its SHA-256 is `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`.

The supplied baseline render hash is `e9d86c644b65a8fca0936415cfb4bc16caa43db5e894b6694746abe1fff8a4a6`; the supplied changed render hash is `d99fcb68897125340ebed0e440de904ea991b349da35321eae121ed8f86070c3`. The recovered output matches the supplied changed render hash, showing the recovery retained the intended handoff candidate.

What helped decide: the local Guide points to refusal recovery, the installed README states certification checks exact CRD group/kind/served version, and the refusal receipt names the serving version. Next action would be review target prerequisites before delivery.

Proven: local static composition refusal and recovery; exact API-version edit; certified and rendered recovered bytes. Unknown: target availability, namespaces, ClusterIssuer `letsencrypt`, ClusterSecretStore `platform-store`, webhook CA readiness, repository binding, and application health. Not run: cluster contact, GitOps delivery, upload/publication, credentials or login.

Friction: the supplied workspace was already composed, so I preserved it and used copies rather than recreating or overwriting it. No timing is inferred.
