import { solveMetallicDepth } from "./metallicPaintSolve";

/**
 * Runs MetallicPaint's depth solve off the main thread (see
 * metallicPaintSolve.ts for what it costs there). One message in, one out;
 * both pixel buffers are transferred, not copied.
 *
 * Typed by hand rather than with the "webworker" lib, which clashes with the
 * DOM lib the rest of the project compiles against.
 */
type Job = { id: number; rgba: Uint8ClampedArray; width: number; height: number };
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

scope.onmessage = (e) => {
  const { id, rgba, width, height } = e.data;
  const out = solveMetallicDepth(rgba, width, height);
  scope.postMessage({ id, out }, [out.buffer]);
};
