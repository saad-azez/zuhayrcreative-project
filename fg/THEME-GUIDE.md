# 🎨 Theme Customization Guide — Crimson Waves

> For AI agents & developers: every color value to change when retheming `water-ripples-gpgpu.html`

---

## 1. Water Texture Gradient (`makeTexture()`)

**File:** Inside `<script type="module">`, function `makeTexture()` — vertical gradient from top→bottom of water surface.

| Stop         | Current (Dark Maroon) | Change to |
| ------------ | --------------------- | --------- |
| `0` (top)    | `#4A1010`             | ⬅         |
| `0.3`        | `#2E0808`             | ⬅         |
| `0.55`       | `#1A0404`             | ⬅         |
| `0.8`        | `#0E0202`             | ⬅         |
| `1` (bottom) | `#060101`             | ⬅         |

---

## 2. Scene Background

**JS:** `scene.background = new THREE.Color(0x040101)`

---

## 3. Water Material Colors

**JS:** `const uniforms = { ... }`

| Uniform    | Current    | Change |
| ---------- | ---------- | ------ |
| `diffuse`  | `0xaa6650` | ⬅      |
| `specular` | `0x664840` | ⬅      |
| `opacity`  | `0.9`      | ⬅      |

---

## 4. Lighting

**JS:** Inside `// ── Lights ──`

| Light       | Color      | Intensity |
| ----------- | ---------- | --------- |
| `l1` (main) | `0xffaa77` | `2.5`     |
| `l2` (fill) | `0xaa4422` | `0.4`     |
| `l3` (back) | `0x662211` | `0.15`    |
| Ambient     | `0x220404` | `0.35`    |

---

## 5. Renderer Tone

**JS:**

- `renderer.toneMapping = THREE.ACESFilmicToneMapping`
- `renderer.toneMappingExposure = 0.9`

---

## 6. Bloom (Post-Processing)

**JS:** `new UnrealBloomPass(..., strength, radius, threshold)`

| Param     | Current |
| --------- | ------- |
| Strength  | `0.4`   |
| Radius    | `0.2`   |
| Threshold | `0.0`   |

---

## 7. Water Fragment Shader (inline GLSL)

**JS:** `const waterFrag = \`...\``

### Fresnel Rim Colors

```glsl
// Dark → light edge colors
vec3 fresnelCol = mix(vec3(0.25, 0.08, 0.05), vec3(0.6, 0.3, 0.15), fresnel);
```

- Dark color: `(R, G, B) = (0.25, 0.08, 0.05)`
- Light color: `(R, G, B) = (0.6, 0.3, 0.15)`

### Crest Glow

```glsl
col += vec3(0.25, 0.08, 0.04) * crest * 0.12;
```

- Crest color: `(R, G, B) = (0.25, 0.08, 0.04)`

---

## 8. Sparkle Particles

**JS:** In `createSparkles()` fragment shader:

```glsl
gl_FragColor = vec4(1.0, 0.6, 0.35, a * 0.7);
```

- Color: `(R, G, B) = (1.0, 0.6, 0.35)`
- Alpha multiplier: `0.7`

---

## 9. Loading Veil (CSS)

| Property                  | Current                                    |
| ------------------------- | ------------------------------------------ |
| `#veil` background        | `#0a0202`                                  |
| `#veil-label` color       | `rgba(100, 40, 40, 0.6)`                   |
| `#progress-track` bg      | `rgba(60, 20, 20, 0.15)`                   |
| `#progress-fill` gradient | `linear-gradient(90deg, #4A1515, #8A3A22)` |

---

## 10. Banner Overlay (CSS)

### `.banner-content`

| Property         | Current                  |
| ---------------- | ------------------------ |
| Background       | `rgba(10, 2, 2, 0.35)`   |
| Border           | `rgba(60, 20, 20, 0.25)` |
| Box-shadow color | `rgba(180, 40, 40, ...)` |

### `.banner-content::before` (animated glow)

| Property       | Current                  |
| -------------- | ------------------------ |
| Conic gradient | `rgba(60, 20, 20, 0.05)` |

### `.banner-badge`

| Property   | Current                   |
| ---------- | ------------------------- |
| Text color | `rgba(120, 50, 50, 0.95)` |
| Border     | `rgba(60, 20, 20, 0.35)`  |
| Background | `rgba(60, 20, 20, 0.1)`   |

### `.banner-title` (gradient text)

```
linear-gradient(135deg, #c8a088 0%, #4a1010 45%, #1a0404 75%, #060101 100%)
```

### `.banner-divider`

```
linear-gradient(90deg, transparent, rgba(60, 20, 20, 0.6), transparent)
```

### `.feature-item::before` (diamond bullet)

- Color: `rgba(60, 20, 20, 0.7)`

### `.scroll-arrow`

- Color: `rgba(60, 20, 20, 0.55)`

---

## 11. Corner Decorations (SVG)

**HTML:** 4 `<svg>` elements with:

```
stroke="rgba(50,15,15,0.6)"
```

---

## 12. Mobile Override

**CSS `@media (max-width: 768px)`:**
| Property | Current |
|----------|---------|
| `.banner-content` bg | `rgba(10, 2, 2, 0.55)` |

---

## Quick Theme Presets

### 🔴 Maroon (Current)

```
Texture: #4A1010 → #2E0808 → #1A0404 → #0E0202 → #060101
Scene: 0x040101
Diffuse: 0xaa6650
Lights: 0xffaa77 / 0xaa4422 / 0x662211
```

### 🔵 Ocean Blue (Example)

```
Texture: #0A2A4A → #061A3A → #041028 → #020818 → #010408
Scene: 0x020610
Diffuse: 0x6080aa
Lights: 0x88ccff / 0x4488cc / 0x224466
```

### 🟢 Forest Green (Example)

```
Texture: #0A2A1A → #061A10 → #041008 → #020804 → #010402
Scene: 0x020803
Diffuse: 0x60aa70
Lights: 0x88ff88 / 0x44aa44 / 0x226622
```

### 🟣 Royal Purple (Example)

```
Texture: #2A0A2A → #1A061A → #100410 → #080208 → #040104
Scene: 0x060106
Diffuse: 0xaa60aa
Lights: 0xcc88ff / 0x8844aa / 0x442266
```
