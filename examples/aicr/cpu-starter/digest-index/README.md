# One digest pins the derived starter

UNOFFICIAL/EXPERIMENTAL. Compiled by `npm run aicr-cpu-starter:generate`;
checked byte-for-byte by `npm run aicr-cpu-starter:verify`. Do not edit by
hand.

The platform digest is:

```
sha256:d4c19c203ba379690c8de8716b29712b14d69006ae928136f410f634a4a80564
```

That one value pins the upstream source pins, the derivation source
(sha256:3f9ec2a69619682d151937fe77d3bba21c336f598678e05f2fdd4d53ba142f2e), the selection rules with every
exclusion and reason, the recorded cloud residues, and one immutable payload
per derived member. Each payload names the training-entry payload hash it
derives from, so the chain from AICR v0.14.0 through the
training index to this starter is checkable end to end.

The boundary, stated plainly: config-plane only. The starter needs no GPU,
and no live run is claimed here.
