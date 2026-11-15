# Unit test log · Node 22 (synthetic policy only)

```text
# Environment: Linux sandbox; Node v22.16.0; npm 10.9.2
# Isolated dependency-free copy of source/test (not a GitHub clean checkout)
# Run: node --test tests/policy.test.mjs
TAP version 13
# Subtest: TC01: mark contract includes all six immutable attributes
ok 1 - TC01: mark contract includes all six immutable attributes
  ---
  duration_ms: 1.326161
  type: 'test'
  ...
# Subtest: TC01: all six source values explicitly recognized
ok 2 - TC01: all six source values explicitly recognized
  ---
  duration_ms: 0.173257
  type: 'test'
  ...
# Subtest: TC01: gap never gets an invented audio offset
ok 3 - TC01: gap never gets an invented audio offset
  ---
  duration_ms: 0.105327
  type: 'test'
  ...
# Subtest: TC01: missing never gets an invented audio offset
ok 4 - TC01: missing never gets an invented audio offset
  ---
  duration_ms: 0.069474
  type: 'test'
  ...
# Subtest: TC01: unavailable never gets an invented audio offset
ok 5 - TC01: unavailable never gets an invented audio offset
  ---
  duration_ms: 0.180838
  type: 'test'
  ...
# Subtest: TC01: missing source, negative, NaN and undefined offset cannot link
ok 6 - TC01: missing source, negative, NaN and undefined offset cannot link
  ---
  duration_ms: 0.158786
  type: 'test'
  ...
# Subtest: TC02: fast typing within same word coalesces across repeated inserts
ok 7 - TC02: fast typing within same word coalesces across repeated inserts
  ---
  duration_ms: 1.189918
  type: 'test'
  ...
# Subtest: TC02: 2-minute no-Enter synthetic word/cadence creates many anchors
ok 8 - TC02: 2-minute no-Enter synthetic word/cadence creates many anchors
  ---
  duration_ms: 0.646691
  type: 'test'
  ...
# Subtest: TC02: group closed on punctuation/space and after max age
ok 9 - TC02: group closed on punctuation/space and after max age
  ---
  duration_ms: 0.268298
  type: 'test'
  ...
# Subtest: TC04: Unicode Vietnamese combining marks are in word
ok 10 - TC04: Unicode Vietnamese combining marks are in word
  ---
  duration_ms: 1.235676
  type: 'test'
  ...
# Subtest: TC04: short same-word accent replacement keeps original anchor
ok 11 - TC04: short same-word accent replacement keeps original anchor
  ---
  duration_ms: 0.225355
  type: 'test'
  ...
# Subtest: TC04: Backspace+Insert without composition can keep anchor
ok 12 - TC04: Backspace+Insert without composition can keep anchor
  ---
  duration_ms: 0.094641
  type: 'test'
  ...
# Subtest: TC04: paste and punctuation cannot look like accent mutation
ok 13 - TC04: paste and punctuation cannot look like accent mutation
  ---
  duration_ms: 0.078036
  type: 'test'
  ...
# Subtest: TC05: historical correction inherits only when local word revision
ok 14 - TC05: historical correction inherits only when local word revision
  ---
  duration_ms: 0.159557
  type: 'test'
  ...
# Subtest: TC06: insertion from unrelated cursor/context does not group
ok 15 - TC06: insertion from unrelated cursor/context does not group
  ---
  duration_ms: 1.212121
  type: 'test'
  ...
# Subtest: TC06: playback pause and seek cause new grouping boundary
ok 16 - TC06: playback pause and seek cause new grouping boundary
  ---
  duration_ms: 0.085557
  type: 'test'
  ...
# Subtest: TC07: same-meeting valid source retained, foreign recording rejected
ok 17 - TC07: same-meeting valid source retained, foreign recording rejected
  ---
  duration_ms: 0.088742
  type: 'test'
  ...
# Subtest: TC08: group matches ALL attributes, not only offset
ok 18 - TC08: group matches ALL attributes, not only offset
  ---
  duration_ms: 0.160399
  type: 'test'
  ...
# Subtest: TC09: timeSpan attrs do not depend on bold/italic text marks
ok 19 - TC09: timeSpan attrs do not depend on bold/italic text marks
  ---
  duration_ms: 0.383239
  type: 'test'
  ...
# Subtest: TC10: paste unlinked allowed, never assigns source audio
ok 20 - TC10: paste unlinked allowed, never assigns source audio
  ---
  duration_ms: 0.091516
  type: 'test'
  ...
# Subtest: TC10: malformed or unknown provenance cannot link
ok 21 - TC10: malformed or unknown provenance cannot link
  ---
  duration_ms: 0.070435
  type: 'test'
  ...
# Subtest: TC11: no incorrect coalescing across changes in any identity dimension
ok 22 - TC11: no incorrect coalescing across changes in any identity dimension
  ---
  duration_ms: 0.093569
  type: 'test'
  ...
# Subtest: TC11: metrics and P95 counted from JSON not DOM assumptions
ok 23 - TC11: metrics and P95 counted from JSON not DOM assumptions
  ---
  duration_ms: 0.196342
  type: 'test'
  ...
1..23
# tests 23
# suites 0
# pass 23
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 82.044229
Exit status: 0
```