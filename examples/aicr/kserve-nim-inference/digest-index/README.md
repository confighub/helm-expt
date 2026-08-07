# One digest pins the retained inference shape

UNOFFICIAL/EXPERIMENTAL. This directory is compiled by
`npm run aicr-kserve-nim:generate` and checked byte-for-byte by
`npm run aicr-kserve-nim:verify`. Do not edit it by hand.

The platform digest is:

```
sha256:7a219c5b0fdef1860454f741d7089379b605d9a7c88d6a2a2ec1df5dbb90c720
```

That one value pins the retained upstream tree (NVIDIA nim-deploy, commit
`3ef33472b84da9f39131dff0326bf05ac1dc0fe6`, Apache-2.0), meaning 10 serving
runtimes, 16 model shapes, and 1 described model profile,
plus every support file by checksum. Change any retained byte and the digest
changes.

[platform-index.json](./platform-index.json) holds the full index. The gated
image references it lists are configuration data: the images live behind NGC
and are pulled only by a user's cluster with the user's own key and
entitlement. Nothing in this directory claims a registry push.

The boundary, stated plainly: this index proves config-plane retention only.
No NIM container ran, no model was fetched, nothing was pulled from nvcr.io,
and no GPU workload claim exists here. One NGC surface was read, and the entry
says which: the public catalog page for the described model profile supplied
the governing-terms names that the profile records with their read date.
