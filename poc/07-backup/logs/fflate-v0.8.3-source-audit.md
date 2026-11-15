# fflate 0.8.3 ZIP writer audit (15 Nov 2026)

Source: `https://github.com/101arrowz/fflate/blob/v0.8.3/src/index.ts`
Git blob SHA returned by GitHub connector: `8460f8d29ec0a9597ccc0895dabcf933a33df9b3`.

This is static source inspection of the **exact v0.8.3 tag**, not a runtime/package benchmark:

- ZIP `wzh()` uses `wbytes()` for CRC, compressed size, uncompressed size and Central Directory offsets (classic 4-byte fields).
- ZIP `wzf()` uses `wbytes(..., offset 8)` / `wbytes(..., offset 10)` to emit legacy EOCD entry counts in **adjacent 2-byte slots**. `wbytes` shifts via `>>>=8`; a count over 0xffff can overwrite neighboring fields rather than creating ZIP64 metadata. The directory size/offset are classic 32-bit slots.
- `Zip.e()` calls `wzf()` for legacy EOCD and never writes ZIP64 EOCD/locator.
- `Zip.add()` appends classic 16-byte data descriptors with 32-bit compressed/uncompressed sizes.

**Consequence:** do not use `Zip` + `ZipPassThrough` to export a .mochop with a ZIP32 boundary violation, including one audio entry >4GiB or >=65,535 entries. This does not imply that fflate's ZIP64 *parsing* is absent, nor that it fails all 512MiB/2GiB exports. The actual candidate package remains NOT_RUN because npm registry is unreachable from this container.

Guard in `candidates.mjs`: `ClassicZip32Budget` checks entry count up front (max 65,534; 0xffff is the ZIP64 sentinel), outgoing total archive bytes including Central Directory with limit 0xfffffffe, aborts the sink and rejects on overflow. Do not keep/share the partial output. `test-candidates-unit.mjs` uses an injected **mock Zip producer** to prove guard invocation without loading the unavailable npm package. These tests are not a proxy for fflate throughput, ZIP64 interoperability or browser backpressure.
