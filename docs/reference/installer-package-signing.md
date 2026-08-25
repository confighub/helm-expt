# Verifying Catalog Package Signatures

Every published Config Workshop installer package is signed at its exact OCI
manifest digest. This lets a user check that the package was signed by the
catalog publisher and that the manifest has not changed.

The signing identity is:

```text
helm-expt-package-signer@nth-fort-499605-q5.iam.gserviceaccount.com
```

It is a dedicated Google service account. The publisher uses a short-lived
Google identity token with Sigstore. The repository does not contain a private
signing key, a service-account key file, or a registry credential.

## Verify A Package

Install `cosign` v3.1.3, then use the immutable reference and the two annotations
from the package's catalog record. For Redis 25.5.3, the command has this shape:

```sh
cosign verify \
  --certificate-identity helm-expt-package-signer@nth-fort-499605-q5.iam.gserviceaccount.com \
  --certificate-oidc-issuer https://accounts.google.com \
  --annotations confighub.com/package-path=packages/bitnami/redis/25.5.3 \
  --annotations confighub.com/package-sha256=<package-sha256> \
  europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis@sha256:<manifest-digest>
```

The generated package catalog and each chart-version page provide the complete
command with the recorded digests filled in.

## Verify The Catalog Index

The downloadable package index is dated and signed separately. This checks
that the list of package references, manifest digests, package signatures, and
commands is the list published by Config Workshop:

```sh
curl -fsSLo packages.json \
  https://raw.githubusercontent.com/confighub/helm-expt/main/data/installer-oci-packages/packages.json
curl -fsSLo packages.sigstore.json \
  https://raw.githubusercontent.com/confighub/helm-expt/main/runs/installer-oci-index-signature/packages.sigstore.json

cosign verify-blob \
  --bundle packages.sigstore.json \
  --certificate-identity helm-expt-package-signer@nth-fort-499605-q5.iam.gserviceaccount.com \
  --certificate-oidc-issuer https://accounts.google.com \
  packages.json
```

The index date comes from the newest package publication or signature receipt.
It does not change merely because a generator was rerun.

## What A Valid Signature Shows

A successful verification shows that:

- the named service account signed the exact OCI manifest digest;
- the signed payload records the expected package path and package SHA-256;
- the registry still serves the signature attached to that digest;
- Sigstore accepted the Google identity and recorded the signing event.

It does not show that a selected preset is suitable for a particular cluster.
It also does not prove that a hook, CRD, Secret, setup Job, or later rollout will
succeed. Use the chart page for the render checks, lifecycle instructions,
destination requirements, and live receipts that answer those questions.

## Repository Evidence

Each signed package has five committed files under
`runs/installer-oci-signatures/<package>/<version>/`:

- `signature.sigstore.json`: the Sigstore verification bundle written while
  signing the immutable manifest;
- `signature-payload.json`: the exact signed image payload, including the OCI
  manifest digest and the package annotations;
- `verification.json`: the result of running `cosign verify` against the public
  registry with the expected identity, issuer, and annotations;
- `payload-verification.txt`: the result of running `cosign verify-blob` over
  the committed payload and bundle;
- `signature-receipt.yaml`: the binding from the package publication receipt to
  those four files.

The generated index is at
[`data/installer-package-signatures/summary.md`](../../data/installer-package-signatures/summary.md).
The receipt schema is
[`schemas/installer-package-signature-receipt.schema.json`](../../schemas/installer-package-signature-receipt.schema.json).

The repository consistency gate checks that every published package has exactly
one signature receipt and that all paths, digests, annotations, identities, and
file hashes agree. The cryptographic gate then runs Cosign over every committed
payload and bundle:

```sh
npm run installer-oci:signatures:verify
npm run installer-oci:signatures:self-test
npm run installer-oci:signatures:verify-crypto
npm run installer-oci:signatures:crypto-self-test
```

The consistency self-test changes the digest, signer, bundle hash, and
transparency-log material in turn. The cryptographic self-test changes the
signed payload bytes and requires Cosign to reject them. The public `cosign
verify` command above remains the direct check against the registry attachment.

The index has the same consistency checks:

```sh
npm run installer-oci:index-signature:verify
npm run installer-oci:index-signature:self-test
npm run installer-oci:index-signature:verify-crypto
npm run installer-oci:index-signature:crypto-self-test
```

The index signature files are committed under
`runs/installer-oci-index-signature/`. Its receipt schema is
[`schemas/installer-oci-index-signature-receipt.schema.json`](../../schemas/installer-oci-index-signature-receipt.schema.json).

## Maintainer Procedure

One-time Google Cloud setup:

```sh
PROJECT=nth-fort-499605-q5
LOCATION=europe-west1
REPOSITORY=helm-expt
SIGNER=helm-expt-package-signer@$PROJECT.iam.gserviceaccount.com
OPERATOR=$(gcloud config get account)

gcloud iam service-accounts create helm-expt-package-signer \
  --project "$PROJECT" \
  --display-name "helm-expt package signer"

gcloud artifacts repositories add-iam-policy-binding "$REPOSITORY" \
  --project "$PROJECT" \
  --location "$LOCATION" \
  --member "serviceAccount:$SIGNER" \
  --role roles/artifactregistry.writer

gcloud iam service-accounts add-iam-policy-binding "$SIGNER" \
  --project "$PROJECT" \
  --member "user:$OPERATOR" \
  --role roles/iam.serviceAccountTokenCreator

```

The service account has package-write access only on the public catalog
repository. The operator may mint a short-lived token for that account. No
service-account key file is created.

Test impersonation before signing:

```sh
gcloud auth print-identity-token \
  --impersonate-service-account "$SIGNER" \
  --include-email \
  --audiences sigstore >/dev/null
```

The live signing command is deliberately separate from ordinary generation:

```sh
npm run installer-oci:sign:plan

HELM_EXPT_ALLOW_REGISTRY_SIGNING=1 \
  npm run installer-oci:sign -- \
  --package packages/bitnami/redis/25.5.3
```

Maintainer signing is pinned to `cosign` v3.1.3. A different version is refused
until the repository contract and self-tests are reviewed for that version.

The operator must be able to impersonate the dedicated signer. The script asks
for a short-lived identity token for Sigstore and a short-lived access token for
Artifact Registry. It places both in a private temporary Docker configuration
and identity-token file, then removes the directory before the command exits.
`SIGSTORE_ID_TOKEN` and `HELM_EXPT_REGISTRY_ACCESS_TOKEN` may instead be supplied
by a controlled CI system. Neither token belongs in Git.

After signing, regenerate the two indexes and the public site:

```sh
npm run installer-oci:signatures:generate
npm run installer-oci:catalog

HELM_EXPT_ALLOW_INDEX_SIGNING=1 \
  npm run installer-oci:index-signature:sign

npm run installer-oci:catalog
npm run site:generate
```

Do not sign a tag. The script always signs the immutable manifest digest from
the existing publication receipt.
