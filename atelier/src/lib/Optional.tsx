import { Component, type ReactNode } from 'react'

/**
 * Keeps one scene piece's failure (a 404'd model or texture, a decode error) to that piece: it renders nothing and logs once,
 * and the rest of the window still goes live. Without it any failed asset unmounts the whole canvas.
 */
export class Optional extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn(`[shop] "${this.props.name}" failed to load and is left out:`, err)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
