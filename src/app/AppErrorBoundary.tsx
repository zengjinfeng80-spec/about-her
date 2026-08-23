import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="status-screen">
      <p>页面加载失败，请重新加载。</p>
      <button className="primary-button" onClick={() => window.location.reload()}>重新加载</button>
    </main>;
  }
}
