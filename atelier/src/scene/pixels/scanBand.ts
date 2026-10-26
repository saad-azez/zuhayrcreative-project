import { Color, type Material } from 'three'
import { LOOK } from '../../look'

// The bright scan line: one set of uniforms shared by every material that carries the band, so a single write per frame
// moves the line across the voxels and across the true mark at once.
export const scanUniforms = {
  uScanY: { value: -10 },
  uScanColor: { value: new Color(LOOK.scan.color) },
  uScanGain: { value: LOOK.scan.lineGain },
}

/** Adds an emissive band where the material's world y is within 1.2 cm of the scan line. Works for plain and instanced meshes. */
export function addScanBand(mat: Material, key: string) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, scanUniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vScanWorldY;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 sw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            sw = instanceMatrix * sw;
          #endif
          vScanWorldY = (modelMatrix * sw).y;
        }`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uScanY;\nuniform vec3 uScanColor;\nuniform float uScanGain;\nvarying float vScanWorldY;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uScanColor * uScanGain * (1.0 - smoothstep(0.0, 0.02, abs(vScanWorldY - uScanY)));`)
  }
  mat.customProgramCacheKey = () => 'scan-' + key
}
