import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { fallback: (error: Error, reset: () => void) => ReactNode; children: ReactNode; onError?: (e: Error) => void };
type State = { error: Error | null };

/** Keeps a crashing app (or failed lazy chunk) from blanking the desktop. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error);
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }
  reset = () => this.setState({ error: null });
  override render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}
