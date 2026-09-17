import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isDevMode } from '@/lib/devMode';
import { rawErrorText } from '@/lib/errors';
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
        <div className="plate w-full max-w-md p-2">
          <ErrorState
            title="Something went wrong"
            description="We couldn’t load this screen. Your data is safe — nothing has been changed."
          />
          {/* The screen a person sees says nothing technical. With development
              mode on, the error that actually happened is right here — which is
              the point of having the switch on the live site rather than only
              in a local build. */}
          {isDevMode() && (
            <pre className="mx-6 mb-5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[rgb(var(--hairline)/0.08)] px-3 py-2 text-[11.5px] leading-relaxed text-muted">
              {rawErrorText(this.state.error)}
              {this.state.error?.stack ? `\n\n${this.state.error.stack}` : ''}
            </pre>
          )}

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
