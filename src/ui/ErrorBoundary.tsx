import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ClickHouse Universe crashed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error">
          <p className="eyebrow">NAVIGATION FAILURE</p>
          <h1>The universe became unstable.</h1>
          <p>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()}>Reload star charts</button>
        </main>
      );
    }
    return this.props.children;
  }
}
