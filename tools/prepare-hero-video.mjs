// Prepares the hero's background video (HeroVideo) from the client's master.
//
//   node tools/prepare-hero-video.mjs <the master .mp4> [public/hero] [name]
//
// It needs ffmpeg (6 or later, with libx264 and libaom) on the PATH, or its path in FFMPEG.
//
// The master is a 4:3 loop, 8.8 s, sent at 3840x2872 and 82 Mbit/s: 89 MB. A hero background is that picture stretched
// over the first screen, and a first screen does not need, and should not be made to wait for, most of it. So the master
// becomes two SHAPES, each in two CODECS, and a still of each shape:
//
//   <name>-wide          the whole 4:3 frame at 1920x1436, for a landscape hero (it is cropped top and bottom by the
//                        browser to whatever the screen's shape is)
//   <name>-tall          the middle of the frame at 810x1440 (9:16), for a phone held upright: the hero there shows a
//                        narrow strip down the centre, and the sides it crops away are most of the bytes. It is the
//                        SAME picture at the same framing as the wide one in any box at least that narrow, which is
//                        the only place HeroVideo uses it: a saving, not a second composition.
//
//   .av1.mp4             AV1, for machines that decode it in hardware (HeroVideo asks the browser)
//   .mp4                 H.264, for every other machine: the one codec every device made in fifteen years decodes in
//                        hardware. About twice the bytes of the AV1 for the same picture.
//
//   .avif / .jpg         frame 0, the picture the hero shows until the video has its first frame, and for good on a
//                        visitor who has asked for no motion or to save data. The loop also STARTS on frame 0, so the
//                        still and the video's first frame are the same picture.
//
// The sound track (the master carries a silent one) is dropped. Nothing is re-timed and nothing is re-graded: the frames
// are the master's, scaled.
//
// How hard to compress was set by ear, as it were, against the copy the client named ("moon-walk-brighter", 1444x1080,
// 7 MB): the swirls are thousands of fine moving lines, the most expensive thing there is to encode, and every file
// below scores at least as close to the master as that copy does (SSIM over all 263 frames at 1920x1436; that copy 0.935).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const [src, dst = 'public/hero', name = 'moon-walk'] = process.argv.slice(2)
if (!src) {
  console.error('usage: node tools/prepare-hero-video.mjs <the master .mp4> [public/hero] [name]')
  process.exit(1)
}
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const mb = (n) => (n / 1e6).toFixed(2) + ' MB'

/** the two shapes: what is cut from the master's frame, and what it is scaled to */
const SHAPES = {
  // The whole frame.
  wide: { filter: 'scale=1920:1436:flags=lanczos', x264: 26, av1: 42 },
  // The middle, 9:16. Every phone's hero is narrower than that (the narrowest screens in use are 9:16 themselves, and
  // the hero is taller than the screen on touch devices: hero-banner.css).
  tall: { filter: 'crop=trunc(ih*9/32)*2:ih,scale=810:1440:flags=lanczos,setsar=1', x264: 27, av1: 42 },
}

function ffmpeg(args) {
  const run = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
  if (run.error) {
    console.error(`could not run ${FFMPEG}: ${run.error.message}`)
    process.exit(1)
  }
  if (run.status !== 0) process.exit(run.status ?? 1)
}

fs.mkdirSync(dst, { recursive: true })
const made = []
const out = (file) => {
  made.push(file)
  return path.join(dst, file)
}

for (const [shape, s] of Object.entries(SHAPES)) {
  const base = `${name}-${shape}`
  // A keyframe every two seconds: the loop's jump back to the start lands on one, and a seek never waits long.
  const common = ['-i', src, '-an', '-vf', s.filter, '-pix_fmt', 'yuv420p', '-g', '60']

  ffmpeg([
    ...common,
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(s.x264), '-profile:v', 'high',
    // The index at the front of the file, so it plays as it arrives.
    '-movflags', '+faststart',
    out(`${base}.mp4`),
  ])
  ffmpeg([
    ...common,
    '-c:v', 'libaom-av1', '-b:v', '0', '-crf', String(s.av1), '-cpu-used', '4', '-row-mt', '1', '-tiles', '2x2',
    '-movflags', '+faststart',
    out(`${base}.av1.mp4`),
  ])

  // Frame 0, as the still.
  const still = ['-i', src, '-an', '-vf', s.filter, '-frames:v', '1']
  ffmpeg([...still, '-q:v', '5', '-pix_fmt', 'yuvj420p', out(`${base}.jpg`)])
  ffmpeg([...still, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '30', '-cpu-used', '4', '-pix_fmt', 'yuv420p', out(`${base}.avif`)])
}

for (const file of made) {
  console.log(`${mb(fs.statSync(path.join(dst, file)).size).padStart(9)}  ${file}`)
}
console.log(`from ${mb(fs.statSync(src).size)} (${path.basename(src)})`)
