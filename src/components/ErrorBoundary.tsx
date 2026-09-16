import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button';
import { ErrorState } from './ui/States';

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a failure in one screen never leaves the user
 * staring at a blank page or a stack trace.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this is where the report would be sent.
    console.error('Aureal caught a render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface-base p-2 shadow-card">
          <ErrorState
            title="Something went wrong"
            description="We couldn’t load this screen. Your data is safe — nothing has been changed."
          />
          <div className="flex justify-center gap-2 pb-6">
            <Button onClick={() => this.setState({ error: null })}>Try again</Button>
            <Button variant="primary" onClick={() => window.location.assign('/')}>
              Go to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
