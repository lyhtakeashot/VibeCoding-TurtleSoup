import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

const DefaultFallback = (
  <div className="min-h-screen flex items-center justify-center bg-ink-gradient">
    <div className="text-center space-y-4 px-4">
      <div className="text-4xl opacity-30">😵</div>
      <h1 className="text-xl font-display font-bold text-white/80">
        出了点问题
      </h1>
      <p className="text-white/50 text-sm">
        页面遇到了意外错误，请尝试刷新。
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-neon"
      >
        刷新页面
      </button>
    </div>
  </div>
);

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? DefaultFallback;
    return this.props.children;
  }
}
