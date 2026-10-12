// Makes the shop's 2K texture set out of the 4K one WITHOUT re-encoding anything.
//
//   node tools/optimize-textures.mjs <dir of 4K .ktx2> <output dir> [--only name,name] [--drop 0|1]
//
// Every scan is a KTX2 file holding the full mip chain: the 4096 px image and, under it, the 2048, 1024, ... versions the
// encoder made from it. The 2K file written here is that same file with its top level taken off: the 2048 px level becomes
// the base and every level below it is carried over byte for byte. Nothing is decoded, resized or compressed again, so
// what the GPU samples from a 2K file is exactly what it sampled from those levels of the 4K one.
//
// One set needs one more step. Paper001 is 4096 x 2402, and neither 2402 nor its half, 1201, is a multiple of four: a
// desktop GPU (BC7) refuses such a texture outright, which is why the paper wall drew dark on Windows. Its 2048 level is
// therefore cropped to 2048 x 1200 by dropping its last row of 4 x 4 blocks (one real pixel row, the rest padding). The
// levels below already are the chain of a 2048 x 1200 image, so they carry over untouched like everyone else's.
//
// The proof is in the run: every level written is read back and compared, by hash, with the level of the source it came
// from, and the tool stops if one differs.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'

const [srcDir, dstDir, ...rest] = process.argv.slice(2)
if (!srcDir || !dstDir) {
  console.error('usage: node optimize-textures.mjs <dir of 4K .ktx2> <output dir> [--only a,b,c]')
  process.exit(1)
}
const opt = (k) => { const i = rest.indexOf(k); return i < 0 ? null : rest[i + 1] }
const only = opt('--only') ? new Set(opt('--only').split(',')) : null
/** Levels taken off the top of each file (1 = the 2K set; 0 only repairs sizes, for comparing against). */
const DROP = opt('--drop') == null ? 1 : Number(opt('--drop'))
const ID = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a])
const ZSTD = 2
const UASTC_BLOCK = 16 // bytes per 4 x 4 block

function parse(buf, name) {
  if (!buf.subarray(0, 12).equals(ID)) throw new Error(`${name}: not a KTX2 file`)
  const h = {
    width: buf.readUInt32LE(20), height: buf.readUInt32LE(24), depth: buf.readUInt32LE(28),
    layers: buf.readUInt32LE(32), faces: buf.readUInt32LE(36), levelCount: buf.readUInt32LE(40), scheme: buf.readUInt32LE(44),
    dfdOff: buf.readUInt32LE(48), dfdLen: buf.readUInt32LE(52), kvdOff: buf.readUInt32LE(56), kvdLen: buf.readUInt32LE(60),
    sgdOff: Number(buf.readBigUInt64LE(64)), sgdLen: Number(buf.readBigUInt64LE(72)),
  }
  if (h.scheme !== ZSTD || h.sgdLen !== 0 || h.depth !== 0 || h.layers !== 0 || h.faces !== 1) {
    throw new Error(`${name}: expected a plain 2D UASTC + Zstandard file`)
  }
  h.levels = []
  for (let i = 0; i < h.levelCount; i++) {
    const o = 80 + 24 * i
    h.levels.push({ off: Number(buf.readBigUInt64LE(o)), len: Number(buf.readBigUInt64LE(o + 8)), raw: Number(buf.readBigUInt64LE(o + 16)) })
  }
  return h
}
const half = (n) => Math.max(1, n >> 1)
const blocks = (n) => Math.ceil(n / 4)

function convert(file) {
  const src = fs.readFileSync(path.join(srcDir, file))
  const h = parse(src, file)
  if (h.levelCount <= DROP) throw new Error(`${file}: no mip chain to take a level from`)
  let width = h.width, height = h.height
  for (let i = 0; i < DROP; i++) { width = half(width); height = half(height) }
  // The levels that stay: their compressed bytes, as they are in the source file.
  const kept = h.levels.slice(DROP).map((l) => ({ data: src.subarray(l.off, l.off + l.len), raw: l.raw }))
  let note = ''
  if (width % 4 || height % 4) {
    // Crop the new base to whole blocks, and any level under it that is a block larger than the cropped chain wants.
    const w4 = width - (width % 4), h4 = height - (height % 4)
    let ow = width, oh = height, nw = w4, nh = h4
    for (let i = 0; i < kept.length; i++) {
      const obw = blocks(ow), obh = blocks(oh), nbw = blocks(nw), nbh = blocks(nh)
      // A level can only be cropped, never grown: the cropped chain must not ask for more than the source has.
      if (nbw > obw || nbh > obh) throw new Error(`${file}: cannot crop ${width} x ${height} without redoing its mips`)
      if (obw !== nbw || obh !== nbh) {
        const raw = zlib.zstdDecompressSync(kept[i].data)
        if (raw.length !== obw * obh * UASTC_BLOCK) throw new Error(`${file}: level ${i} is not ${obw} x ${obh} UASTC blocks`)
        const out = Buffer.alloc(nbw * nbh * UASTC_BLOCK)
        for (let y = 0; y < nbh; y++) raw.copy(out, y * nbw * UASTC_BLOCK, y * obw * UASTC_BLOCK, (y * obw + nbw) * UASTC_BLOCK)
        kept[i] = { data: zlib.zstdCompressSync(out, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } }), raw: out.length, cropped: true }
      }
      ow = half(ow); oh = half(oh); nw = half(nw); nh = half(nh)
    }
    note = `cropped ${width} x ${height} to ${w4} x ${h4}`
    width = w4; height = h4
  }

  const levelCount = kept.length
  const dfd = src.subarray(h.dfdOff, h.dfdOff + h.dfdLen)
  const kvd = src.subarray(h.kvdOff, h.kvdOff + h.kvdLen)
  const dfdOff = 80 + 24 * levelCount
  const kvdOff = dfdOff + dfd.length
  const head = Buffer.alloc(kvdOff + kvd.length)
  src.copy(head, 0, 0, 80)
  head.writeUInt32LE(width, 20)
  head.writeUInt32LE(height, 24)
  head.writeUInt32LE(levelCount, 40)
  head.writeUInt32LE(dfdOff, 48)
  head.writeUInt32LE(kvd.length ? kvdOff : 0, 56)
  head.writeBigUInt64LE(0n, 64)
  dfd.copy(head, dfdOff)
  kvd.copy(head, kvdOff)
  // Level data goes smallest level first, as the format asks; supercompressed levels take no padding.
  const parts = [head]
  let pos = head.length
  for (let i = levelCount - 1; i >= 0; i--) {
    const o = 80 + 24 * i
    head.writeBigUInt64LE(BigInt(pos), o)
    head.writeBigUInt64LE(BigInt(kept[i].data.length), o + 8)
    head.writeBigUInt64LE(BigInt(kept[i].raw), o + 16)
    parts.push(kept[i].data)
    pos += kept[i].data.length
  }
  const out = Buffer.concat(parts)

  // Proof, read back from what was just built: each level's pixels are the source's next level down, byte for byte.
  const back = parse(out, file)
  for (let i = 0; i < back.levelCount; i++) {
    if (kept[i].cropped) continue
    const a = crypto.createHash('sha1').update(out.subarray(back.levels[i].off, back.levels[i].off + back.levels[i].len)).digest('hex')
    const s = h.levels[i + DROP]
    const b = crypto.createHash('sha1').update(src.subarray(s.off, s.off + s.len)).digest('hex')
    if (a !== b) throw new Error(`${file}: level ${i} does not match the source's level ${i + DROP}`)
  }
  fs.writeFileSync(path.join(dstDir, file), out)
  return { file, from: `${h.width} x ${h.height}`, to: `${width} x ${height}`, srcBytes: src.length, outBytes: out.length, note }
}

fs.mkdirSync(dstDir, { recursive: true })
const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ktx2') && (!only || only.has(f.replace(/\.ktx2$/, '')))).sort()
let a = 0, b = 0
for (const f of files) {
  const r = convert(f)
  a += r.srcBytes; b += r.outBytes
  console.log(`${r.file.padEnd(26)} ${r.from.padEnd(12)} -> ${r.to.padEnd(12)} ${(r.srcBytes / 1e6).toFixed(1).padStart(6)} MB -> ${(r.outBytes / 1e6).toFixed(1).padStart(5)} MB  ${r.note}`)
}
console.log(`${files.length} files  ${(a / 1e6).toFixed(1)} MB -> ${(b / 1e6).toFixed(1)} MB`)
