"use client";

import { useEffect, useRef } from "react";
import "@/app/styles/veronica-flame.css";
import { releaseCanvasContext } from "@/app/lib/webglContexts";

/**
 * Veronica's flame button, from WRAITH (VeronicaFlame.tsx / FlameChip.tsx and
 * the .cmd-avatar CSS, sent by the client on 5 Oct): a WebGL pixel flame —
 * fbm noise, 3.2px dissolving pixel cells, a crimson ramp, rising embers — in
 * a dark glass tile with a turning chrome sheen ring. It is the corner dock's
 * AI button.
 *
 * Shader, palette, easing and frame timing are WRAITH's, unchanged. Changed
 * for this site only where it has to be: the props are read through a ref
 * written in an effect (the React Compiler forbids writing a ref during
 * render), the context is released when the canvas unmounts (the dock mounts
 * it only while the pad is open), and a span variant (VeronicaTile) exists to
 * sit inside a button that already is one.
 */

export type VeronicaState = "idle" | "listening" | "thinking" | "speaking";

export interface VeronicaFlameProps {
  /** Which animation: idle (low steady flame), listening (rises with `level`), thinking (pulses at ~1 Hz), speaking (rises with `level`). */
  state?: VeronicaState;
  /** 0..1 loudness: the mic while listening, her voice envelope while speaking. When omitted, a syllable-like
   *  envelope is synthesised for "speaking" and a gentle one for "listening" so it moves without audio. */
  level?: number;
  onClick?: () => void;
  /** Size of the square button in px (WRAITH uses 46, or 40 on phones). */
  size?: number;
  title?: string;
}

/* The ZH Command pixel flame (2D), ported as Veronica's avatar in the
 * command bar. Same fbm, same ramp, same dissolving pixel edge — the
 * flame height follows Veronica's activity. */
const FS = /* glsl */ `precision highp float;
uniform float iTime; uniform vec2 iResolution; uniform float uAct; uniform float uDpr;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
float flameAt(vec2 uv,float asp){
  vec2 f=vec2((uv.x-.5)*min(asp,2.6),uv.y);float t=iTime*(.9+uAct*1.2);
  float n1=fbm(vec2(f.x*8.,f.y*4.-t));float n2=fbm(vec2(f.x*16.+4.,f.y*6.-t*1.7));
  float h=.34+uAct*.62;
  float fy=f.y-(n1-.5)*.28-(n2-.5)*.08;
  float vmask=1.-smoothstep(h*.35,h,fy);
  return pow(clamp(vmask*(.55+.8*n1),0.,1.),1.2);}
vec3 ramp(float fl){vec3 c=vec3(.220,0.,.055);c=mix(c,vec3(.502,0.,.125),smoothstep(.20,.55,fl));c=mix(c,vec3(.769,.004,.051),smoothstep(.50,1.,fl));c=mix(c,vec3(1.,.35,.32),smoothstep(.93,1.,fl)*uAct);return c*fl;}
void main(){
  vec2 res=iResolution;vec2 uv=gl_FragCoord.xy/res;float asp=res.x/res.y;
  float fs=flameAt(uv,asp);
  float cell=3.2*uDpr;vec2 cid=floor(gl_FragCoord.xy/cell);vec2 cuv=fract(gl_FragCoord.xy/cell);
  vec2 cc=(cid+.5)*cell/res;float fp=flameAt(cc,asp);
  float lvl=floor(min(fp*1.15,1.)*5.+.5)/5.;
  float gap=step(.1,cuv.x)*step(cuv.x,.9)*step(.1,cuv.y)*step(cuv.y,.9);
  float flick=.8+.2*step(.5,hash(cid+floor(iTime*6.)));
  float dissolve=smoothstep(.9,.35,fs);
  float fl=mix(fs,lvl*gap*flick,dissolve);
  vec3 col=ramp(fl);
  vec2 eg=vec2(cid.x,floor(gl_FragCoord.y/cell-iTime*2.2));float eh=hash(eg*1.37+3.1);
  float above=flameAt(vec2(cc.x,cc.y-.16),asp)*(1.-fp);
  float ember=step(.8,eh)*smoothstep(.05,.3,above)*gap;
  col+=mix(vec3(.6,0.,.12),vec3(1.,.08,.1),hash(eg+7.))*ember*(.7+.3*sin(iTime*3.+eh*20.));
  gl_FragColor=vec4(col,clamp(fl*.9+ember*.7,0.,1.));
}`;

/* The activity signal: the same targets and the same easing as WRAITH's
 * live.activity (rise 6/s, fall 2/s). */
function targetFor(state: VeronicaState, level: number, tSec: number): number {
  return Math.max(
    0.08,
    state === "listening" ? 0.3 + level * 0.9 : 0,
    state === "thinking" ? 0.62 + 0.12 * Math.sin(tSec * 6) : 0,
    state === "speaking" ? 0.5 + level * 0.55 : 0,
  );
}

/* A stand-in for the voice envelope when no `level` is given. */
function fakeLevel(state: VeronicaState, tSec: number): number {
  if (state === "speaking") return Math.max(0, Math.min(1, 0.55 + 0.35 * Math.sin(tSec * 11) * Math.sin(tSec * 3.1) + 0.15 * Math.sin(tSec * 23)));
  if (state === "listening") return Math.max(0, Math.min(1, 0.35 + 0.3 * Math.sin(tSec * 5) * Math.sin(tSec * 1.7)));
  return 0;
}

/* The flame canvas: WRAITH's FlameChip. */
export function FlameChip({ className, state = "idle", level }: { className?: string; state?: VeronicaState; level?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const input = useRef({ state, level });
  useEffect(() => {
    input.current = { state, level };
  }, [state, level]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return;
    const sh = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}"));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p); gl.useProgram(p);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const U = (n: string) => gl.getUniformLocation(p, n);
    const uT = U("iTime"), uR = U("iResolution"), uA = U("uAct");
    const dpr = Math.min(2, devicePixelRatio || 1);
    gl.uniform1f(U("uDpr"), dpr);
    let raf = 0; const t0 = performance.now();
    /* its size, told us when it changes — reading clientWidth every frame asked the page for a fresh
     * layout sixty times a second */
    let cw = cv.clientWidth, ch = cv.clientHeight;
    const ro = new ResizeObserver(([e]) => { cw = e.contentRect.width; ch = e.contentRect.height; });
    ro.observe(cv);
    let activity = 0, last = t0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const tSec = (now - t0) / 1000;
      const { state: st, level: lv } = input.current;
      const target = targetFor(st, lv ?? fakeLevel(st, tSec), tSec);
      activity += (target - activity) * Math.min(1, dt * (target > activity ? 6 : 2));
      const w = Math.floor(cw * dpr), h = Math.floor(ch * dpr);
      if (!w || !h) return;      // not on screen: nothing to draw
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(uR, w, h);
      gl.uniform1f(uT, tSec);
      gl.uniform1f(uA, activity);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      // Hand the context back once the canvas has really left the page: this
      // page runs several WebGL scenes, and browsers cap how many contexts
      // live at once. Not on a rehearsal unmount (React's dev double effect,
      // canvas still in the page) — the remount asks the SAME canvas for its
      // context and would be handed the dead one.
      releaseCanvasContext(cv);
    };
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/* The button: WRAITH's `cmd-avatar` button holding the flame. */
export function VeronicaFlame({ state = "idle", level, onClick, size, title = "Veronica" }: VeronicaFlameProps) {
  return (
    <button type="button" className="cmd-avatar" data-state={state} title={title} aria-label="Veronica" onClick={onClick}
      style={size ? { width: size, height: size } : undefined}>
      <FlameChip className="cmd-flame" state={state} level={level} />
    </button>
  );
}

/* The same tile as a span, for a slot that is already a button (the dock's
 * AI slot) — a button may not hold another. */
export function VeronicaTile({ state = "idle", level, className = "" }: { state?: VeronicaState; level?: number; className?: string }) {
  return (
    <span className={`cmd-avatar ${className}`} data-state={state} aria-hidden="true">
      <FlameChip className="cmd-flame" state={state} level={level} />
    </span>
  );
}

export default VeronicaFlame;
