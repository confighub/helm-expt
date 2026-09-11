# Fresh CLI setup smoke test

Tracked by #1897. This operator-run test downloaded a new cub v0.4.4 binary,
verified its SHA-256 against the GitHub release asset metadata, and used it
with an isolated CUB_CONFIG. PATH contained the trial binary, an explicit link
to the existing Node.js runtime, and system tools. The normal cub installation
was not used. No account, target, registry write or ConfigHub mutation was used.

The macOS arm64 release binary, pinned Workshop clone, plugin installation,
and Redis inspection all succeeded. result.json records the source URL, exact
asset hash, plugin checkout pin, exit codes and individual command durations.
Existing prerequisites were macOS, Git and Node.js. This is not a clean OS or
an unassisted/human UX trial. Download timing was not captured, so do not sum
command durations and label them total first-use setup time. The asset digest
check is not a signature verification.

The inspection reports 14 objects and the required redis namespace. It is a
local configuration check, not deployment, readiness or live proof. The original
stdout and stderr are retained with home/trial paths normalized and trailing
whitespace removed; retention.json binds original and retained file hashes.
The binary and cloned plugin are reproducible from their public pins and are
not duplicated here.

These results motivate linking missing prerequisites from the four Guides that
install the plugin directly. The other local Guides already link to their setup.
The official CLI setup page also describes an account workflow, while these
local exercises need no signup or login. The Guide clarification preserves that
boundary and keeps its existing pinned plugin setup.
