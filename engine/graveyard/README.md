# graveyard — superseded implementations, kept for provenance

Nothing here is on any live path. A file lands here when a working replacement exists and the old one
would otherwise keep being read, audited, or cited as if it were current.

**Do not fix things in this directory.** If a limitation here matters, it matters in the replacement.

| file | was | replaced by | why |
|---|---|---|---|
| `medicham-v2-singles.js` | MEDICHAM v2 | `engine/medicham2-browser.js` | 1v1 sequential singles in a DOUBLES format, a hardcoded 14-move priority list, unseeded `Math.random`, no team sheets, no megas. v3's own header states the reason it was replaced: v2 "was a 1v1 OHKO chain, which collapses to speed-deterministic 0/100 results." |

Its only consumer was `engine/ditto.js`, which now points at the v3 engine.
