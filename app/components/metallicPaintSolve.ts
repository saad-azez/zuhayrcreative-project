/**
 * MetallicPaint's depth field, as a pure function of the image's pixels.
 *
 * Kept free of the DOM so the same code runs in metallicPaint.worker.ts and,
 * where a worker cannot be had, on the main thread. It is 200 sweeps of an
 * over-relaxed Poisson solve across up to 1000x1000 pixels — measured at
 * ~1.1s of main-thread time at a 4x CPU throttle, landing the moment the
 * footer mounted, which is exactly where the page was felt to lag.
 *
 * `rgba` is read and not modified; the result is a fresh RGBA buffer: the
 * depth as grey, the source's alpha kept.
 */
export function solveMetallicDepth(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const size = width * height;
  const alphaValues = new Float32Array(size);
  const shapeMask = new Uint8Array(size);
  const boundaryMask = new Uint8Array(size);

  for (let i = 0; i < size; i++) {
    const idx = i * 4;
    const r = rgba[idx],
      g = rgba[idx + 1],
      b = rgba[idx + 2],
      a = rgba[idx + 3];
    const isBackground = (r > 250 && g > 250 && b > 250 && a === 255) || a < 5;
    alphaValues[i] = isBackground ? 0 : a / 255;
    shapeMask[i] = alphaValues[i] > 0.1 ? 1 : 0;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!shapeMask[idx]) continue;
      if (
        x === 0 ||
        x === width - 1 ||
        y === 0 ||
        y === height - 1 ||
        !shapeMask[idx - 1] ||
        !shapeMask[idx + 1] ||
        !shapeMask[idx - width] ||
        !shapeMask[idx + width]
      ) {
        boundaryMask[idx] = 1;
      }
    }
  }

  // Only the interior is ever updated, so list it once rather than testing
  // every pixel of the frame on each of the 200 sweeps. Same visiting order
  // (row by row), so the result is bit-for-bit what the full scan gave.
  let interiorCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (shapeMask[idx] && !boundaryMask[idx]) interiorCount++;
    }
  }
  const interior = new Uint32Array(interiorCount);
  for (let y = 1, n = 0; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (shapeMask[idx] && !boundaryMask[idx]) interior[n++] = idx;
    }
  }

  const u = new Float32Array(size);
  const ITERATIONS = 200;
  const C = 0.01;
  const omega = 1.85;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let k = 0; k < interiorCount; k++) {
      const idx = interior[k];
      const sum =
        (shapeMask[idx + 1] ? u[idx + 1] : 0) +
        (shapeMask[idx - 1] ? u[idx - 1] : 0) +
        (shapeMask[idx + width] ? u[idx + width] : 0) +
        (shapeMask[idx - width] ? u[idx - width] : 0);
      const newVal = (C + sum) / 4;
      u[idx] = omega * newVal + (1 - omega) * u[idx];
    }
  }

  let maxVal = 0;
  for (let i = 0; i < size; i++) if (u[i] > maxVal) maxVal = u[i];
  if (maxVal === 0) maxVal = 1;

  const out = new Uint8ClampedArray(size * 4);
  for (let i = 0; i < size; i++) {
    const px = i * 4;
    const depth = u[i] / maxVal;
    const gray = Math.round(255 * (1 - depth * depth));
    out[px] = out[px + 1] = out[px + 2] = gray;
    out[px + 3] = Math.round(alphaValues[i] * 255);
  }
  return out;
}
