import { useEffect, useMemo } from 'react'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'

// The box, cut out of its surround: wherever nothing of the scene was drawn, the finished frame is made transparent, so
// whatever the host page has behind the canvas shows round the window (the site's hero puts its own background there;
// 14 Oct, the client: "can it not be there with the unicorn in the background?").
//
// It is the LAST effect, and it only writes alpha. The scene is still cleared to LOOK.bg and everything before this
// (the mirror and the floor's reflections of that surround, the bloom, the anti-aliasing against it) runs exactly as it
// does without it, so the window itself is the same picture to the pixel; the dark surround is simply not shown.
//
// "Nothing was drawn" is read from the depth buffer: a pixel still at the far plane. That is the box's true outline from
// any angle the camera can orbit to, with nothing to keep in step with the geometry. The beams and the dust do not write
// depth, and they are all inside the box. Coverage is averaged over the pixel and its four neighbours, which softens the
// outline by a pixel: the colour there was already anti-aliased against the dark surround, so the box keeps a hairline
// of its own shadow as an edge instead of a staircase.
//
// The canvas is premultiplied (the browser's default), hence the colour is scaled by the same coverage.

const frag = /* glsl */ `
float drawn(const in vec2 uv) { return step(readDepth(uv), 0.9999); }

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float m = (
    step(depth, 0.9999) +
    drawn(uv + vec2(texelSize.x, 0.0)) + drawn(uv - vec2(texelSize.x, 0.0)) +
    drawn(uv + vec2(0.0, texelSize.y)) + drawn(uv - vec2(0.0, texelSize.y))
  ) / 5.0;
  outputColor = vec4(inputColor.rgb * m, m);
}
`

class CutoutEffect extends Effect {
  constructor() {
    // SRC: this effect's result replaces the frame, alpha included (NORMAL would mix it with the opaque input).
    super('Cutout', frag, { blendFunction: BlendFunction.SRC, attributes: EffectAttribute.DEPTH })
  }
}

export function Cutout() {
  const effect = useMemo(() => new CutoutEffect(), [])
  useEffect(() => () => effect.dispose(), [effect])
  return <primitive object={effect} dispose={null} />
}
