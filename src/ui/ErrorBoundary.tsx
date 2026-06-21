import { Component, type ComponentChildren } from "preact";

export class ErrorBoundary extends Component<{ children: ComponentChildren }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    return this.state.error
      ? <div class="ble-pane-error" role="alert">Panel failed: {this.state.error.message}</div>
      : this.props.children;
  }
}
