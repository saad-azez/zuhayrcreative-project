import {
  HERO_SCENE_IMAGES,
  UNICORN_ASSETS_ORIGIN,
  UNICORN_SDK_URL,
} from "@/app/lib/unicorn";
import { HERO_VARIANT_JS } from "@/app/lib/heroVariant";

/**
 * The GPU question, answered in the document head — and the scene's resource
 * hints, asked for only if the answer is yes.
 *
 * The hints used to be emitted while SERVER rendering, which cannot know what
 * the visitor's machine can do, so a browser with no GPU was told to fetch
 * the SDK and 1.09MB of scene images for scenes that lib/gpu.ts then refused
 * to start. Measured on a throttled phone with software rendering, that waste
 * cost 1.4s of LCP on its own.
 *
 * Asking after hydration instead would fix the waste and lose the point of
 * the hints: on a slow phone hydration is many seconds in, and the hero scene
 * is what the loader waits for. So the question is settled here, in a blocking
 * inline script, before the parser has reached the body — roughly a
 * millisecond for a 1x1 context that is handed straight back — and the hints
 * go out at once for the machines that will actually use them.
 *
 * The hero scene's images are only hinted when that scene is mounted. Three
 * hero backgrounds are being compared (lib/heroVariant.ts), and under the
 * video those images were a megabyte fetched at the top of the load for a
 * scene that is not there. (The shop's box stands on the scene.)
 *
 * The answer is left on `window.__gpu` for lib/gpu.ts, so the probe is run
 * once per page rather than once per caller. If anything here throws, the
 * answer is yes: a visitor with a working GPU must never lose the scenes to a
 * probe that misfired.
 */
export const GPU_PROBE = `(function(){try{
var c=document.createElement("canvas"),o={failIfMajorPerformanceCaveat:true},
g=c.getContext("webgl2",o)||c.getContext("webgl",o),ok=!!g;
if(g){var e=g.getExtension("WEBGL_debug_renderer_info"),
n=e?String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)||""):"";
if(n&&/swiftshader|llvmpipe|software|basic render|mesa offscreen|subzero/i.test(n))ok=false;
var l=g.getExtension("WEBGL_lose_context");if(l)l.loseContext();}
window.__gpu=ok;
if(ok){var h=document.head,add=function(rel,href,as,cross,pri){
var k=document.createElement("link");k.rel=rel;k.href=href;
if(as)k.as=as;if(cross)k.crossOrigin="anonymous";if(pri)k.fetchPriority=pri;
h.appendChild(k)};
add("preload",${JSON.stringify(UNICORN_SDK_URL)},"script");
add("preconnect",${JSON.stringify(UNICORN_ASSETS_ORIGIN)},null,true);
if(${HERO_VARIANT_JS}!=="video")${JSON.stringify(HERO_SCENE_IMAGES)}.forEach(function(u){add("preload",u,"image",true,"low")});}
}catch(err){window.__gpu=true}})()`;
