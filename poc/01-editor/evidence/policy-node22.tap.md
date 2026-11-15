# Unit test log · Node 22 (synthetic policy only)

```text
# Environment: Linux sandbox; Node v22.16.0; npm 10.9.2
# Isolated dependency-free copy of source/test (not a GitHub clean checkout)
# Run: node --test tests/policy.test.mjs
TAP version 13
# Subtest: TC01: mark contract includes all six immutable attributes
ok 1 - TC01: mark contract includes all six immutable attributes
  ---
  duration_ms: 1.331598
  type: 'test'
  ...
# Subtest: TC01: all six source values explicitly recognized
ok 2 - TC01: all six source values explicitly recognized
  ---
  duration_ms: 0.18785
  type: 'test'
  ...
# Subtest: TC01: gap never gets an invented audio offset
ok 3 - TC01: gap never gets an invented audio offset
  ---
  duration_ms: 0.102332
  type: 'test'
  ...
# Subtest: TC01: missing never gets an invented audio offset
ok 4 - TC01: missing never gets an invented audio offset
  ---
  duration_ms: 0.075743
  type: 'test'
  ...
# Subtest: TC01: unavailable never gets an invented audio offset
ok 5 - TC01: unavailable never gets an invented audio offset
  ---
  duration_ms: 0.245074
  type: 'test'
  ...
# Subtest: TC01: missing source, negative, NaN and undefined offset cannot link
ok 6 - TC01: missing source, negative, NaN and undefined offset cannot link
  ---
  duration_ms: 0.147659
  type: 'test'
  ...
# Subtest: TC02: fast typing within same word coalesces across repeated inserts
ok 7 - TC02: fast typing within same word coalesces across repeated inserts
  ---
  duration_ms: 0.798416
  type: 'test'
  ...
# Subtest: TC02: 2-minute no-Enter synthetic word/cadence creates many anchors
ok 8 - TC02: 2-minute no-Enter synthetic word/cadence creates many anchors
  ---
  duration_ms: 0.726689
  type: 'test'
  ...
# Subtest: TC02: group closed on punctuation/space and after max age
ok 9 - TC02: group closed on punctuation/space and after max age
  ---
  duration_ms: 0.330972
  type: 'test'
  ...
# Subtest: TC04: Unicode Vietnamese combining marks are in word
ok 10 - TC04: Unicode Vietnamese combining marks are in word
  ---
  duration_ms: 0.688864
  type: 'test'
  ...
# Subtest: TC04: short same-word accent replacement keeps original anchor
ok 11 - TC04: short same-word accent replacement keeps original anchor
  ---
  duration_ms: 0.211294
  type: 'test'
  ...
# Subtest: TC04: Backspace+Insert without composition can keep anchor
ok 12 - TC04: Backspace+Insert without composition can keep anchor
  ---
  duration_ms: 0.089173
  type: 'test'
  ...
# Subtest: TC04: paste and punctuation cannot look like accent mutation
ok 13 - TC04: paste and punctuation cannot look like accent mutation
  ---
  duration_ms: 0.078827
  type: 'test'
  ...
# Subtest: TC05: historical correction inherits only when local word revision
ok 14 - TC05: historical correction inherits only when local word revision
  ---
  duration_ms: 0.16176
  type: 'test'
  ...
# Subtest: TC06: insertion from unrelated cursor/context does not group
ok 15 - TC06: insertion from unrelated cursor/context does not group
  ---
  duration_ms: 0.077225
  type: 'test'
  ...
# Subtest: TC06: playback pause and seek cause new grouping boundary
ok 16 - TC06: playback pause and seek cause new grouping boundary
  ---
  duration_ms: 0.084235
  type: 'test'
  ...
# Subtest: TC07: same-meeting valid source retained, foreign recording rejected
ok 17 - TC07: same-meeting valid source retained, foreign recording rejected
  ---
  duration_ms: 0.089072
  type: 'test'
  ...
# Subtest: TC08: group matches ALL attributes, not only offset
ok 18 - TC08: group matches ALL attributes, not only offset
  ---
  duration_ms: 0.110855
  type: 'test'
  ...
# Subtest: TC09: timeSpan attrs do not depend on bold/italic text marks
ok 19 - TC09: timeSpan attrs do not depend on bold/italic text marks
  ---
  duration_ms: 0.387195
  type: 'test'
  ...
# Subtest: TC10: paste unlinked allowed, never assigns source audio
ok 20 - TC10: paste unlinked allowed, never assigns source audio
  ---
  duration_ms: 0.096043
  type: 'test'
  ...
# Subtest: TC10: malformed or unknown provenance cannot link
ok 21 - TC10: malformed or unknown provenance cannot link
  ---
  duration_ms: 0.069202
  type: 'test'
  ...
# Subtest: TC11: no incorrect coalescing across changes in any identity dimension
ok 22 - TC11: no incorrect coalescing across changes in any identity dimension
  ---
  duration_ms: 0.098587
  type: 'test'
  ...
# Subtest: TC11: metrics and P95 counted from JSON not DOM assumptions
ok 23 - TC11: metrics and P95 counted from JSON not DOM assumptions
  ---
  duration_ms: 0.179306
  type: 'test'
  ...
# Subtest: TC03 trace privacy: printable keys are redacted while IME control signals remain
ok 24 - TC03 trace privacy: printable keys are redacted while IME control signals remain
  ---
  duration_ms: 0.118606
  type: 'test'
  ...
1..24
# tests 24
# suites 0
# pass 24
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 103.38852
Exit status: 0
```
