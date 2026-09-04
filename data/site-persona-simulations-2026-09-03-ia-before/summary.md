# Public-site persona simulations

Site tested: https://confighub.github.io/helm-expt/site/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after 5 clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 240 | 219 | 21 | 0 | 154/240 | 57/86 | 0 |
| GitOps operator responsible for delivery | 240 | 206 | 30 | 4 | 137/240 | 60/103 | 0 |
| Platform engineer managing environments and fleets | 240 | 223 | 16 | 1 | 172/240 | 45/68 | 0 |
| Security-minded release reviewer | 240 | 213 | 26 | 1 | 128/240 | 72/112 | 0 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 154 | 35 | 1 |
| navigation | 185 | 5 | 0 |
| action | 198 | 47 | 5 |
| recovery | 157 | 3 | 0 |
| conversion | 167 | 3 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| AICR | 19 | 1 | 0 |
| Helm | 686 | 59 | 5 |
| OCI | 43 | 16 | 1 |
| Timoni | 33 | 7 | 0 |
| YAML | 38 | 2 | 0 |
| mixed | 42 | 8 | 0 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| check lifecycle work before the next environment | 1 | 9 | 0 |
| follow a retained base through staging approval release and delivery | 1 | 8 | 1 |
| understand cub installer | 2 | 8 | 0 |
| distinguish object, OCI manifest, and release identities | 2 | 7 | 1 |
| understand Catalog versus my own case | 3 | 7 | 0 |
| review ordered stages and a partial fleet | 3 | 7 | 0 |
| check current evidence before approving a move | 3 | 7 | 0 |
| check which destination claims have live evidence | 4 | 6 | 0 |
| distinguish source, rendered, and ConfigHub release OCI | 5 | 5 | 0 |
| understand lifecycle work after an environment variant changes | 5 | 5 | 0 |
| publish rendered files as OCI | 6 | 4 | 0 |
| check a lifecycle-heavy upgrade against its destination | 6 | 1 | 3 |
| find a reviewed Timoni Redis configuration | 7 | 3 | 0 |
| render and inspect without applying | 7 | 2 | 1 |
| inspect the Timoni publication receipt | 7 | 3 | 0 |

## Navigation language

These are synthetic forced-choice trials, not observed preferences.

| Preferred label | Count |
| --- | ---: |
| Check my config | 38 |
| Investigate | 21 |
| Compare | 16 |
| Help with a chart | 4 |
| Ask | 1 |

The current label `Ask` was preferred in 1 of 80 synthetic trials. The page itself must explain that it builds a prompt for the visitor's own AI assistant; the navigation label does not have to carry that whole explanation.
