// The one function the embed uses (embed.tsx: ending troika's text workers on the way out).
declare module 'troika-worker-utils' {
  export function terminateWorker(workerId: string): void
}
