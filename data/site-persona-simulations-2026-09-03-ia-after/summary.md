# Public-site persona simulations

Site tested: http://localhost:8765/

This is synthetic usability testing, not human-subject research. Four deterministic walkers represent ordinary technical users. Each walker follows only visible internal links, stops after 5 clicks, and succeeds only when a live page contains the required facts plus a relevant action. Language trials are simulated preferences and are reported separately.

## Results

| Persona | Runs | Success | Partial | Fail | Answered on starting page | Useful first click when navigation was needed | Median clicks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Application developer using AI-written configuration | 240 | 225 | 15 | 0 | 155/240 | 59/85 | 0 |
| GitOps operator responsible for delivery | 240 | 201 | 38 | 1 | 138/240 | 58/102 | 0 |
| Platform engineer managing environments and fleets | 240 | 222 | 17 | 1 | 173/240 | 42/67 | 0 |
| Security-minded release reviewer | 240 | 205 | 31 | 4 | 130/240 | 71/110 | 0 |

## By category

| Category | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| comprehension | 157 | 31 | 2 |
| navigation | 181 | 9 | 0 |
| action | 199 | 47 | 4 |
| recovery | 152 | 8 | 0 |
| conversion | 164 | 6 | 0 |

## Cross-format

| Input format | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| AICR | 19 | 1 | 0 |
| Helm | 687 | 59 | 4 |
| OCI | 42 | 17 | 1 |
| Timoni | 30 | 10 | 0 |
| YAML | 37 | 3 | 0 |
| mixed | 38 | 11 | 1 |

## Goals that still need work

| Goal | Success | Partial | Fail |
| --- | ---: | ---: | ---: |
| check lifecycle work before the next environment | 1 | 9 | 0 |
| distinguish object, OCI manifest, and release identities | 2 | 7 | 1 |
| understand Catalog versus my own case | 3 | 7 | 0 |
| follow a retained base through staging approval release and delivery | 3 | 6 | 1 |
| check current evidence before approving a move | 3 | 7 | 0 |
| distinguish source, rendered, and ConfigHub release OCI | 4 | 6 | 0 |
| review ordered stages and a partial fleet | 4 | 6 | 0 |
| check which destination claims have live evidence | 4 | 4 | 2 |
| check a lifecycle-heavy upgrade against its destination | 5 | 5 | 0 |
| understand lifecycle work after an environment variant changes | 5 | 5 | 0 |
| handle an object removed during upgrade | 5 | 5 | 0 |
| distinguish source and intent records from deployable objects | 5 | 4 | 1 |
| publish rendered files as OCI | 6 | 4 | 0 |
| find a reviewed Timoni Redis configuration | 7 | 3 | 0 |
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
