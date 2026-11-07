import { Component, type ErrorInfo, type ReactNode } from 'react';
import { es } from '../i18n/es';
import { Button } from './ui';

/**
 * Catches a screen that fails while drawing, so the user sees a message and a
 * way out instead of a blank page. It does not catch failed requests: those are
 * shown by `useAction` and `QueryState`.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Screen failed to draw', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-bold">{es.crash.title}</h1>
        <p className="text-muted">{es.crash.body}</p>
        <Button onClick={() => window.location.reload()}>{es.crash.reload}</Button>
      </main>
    );
  }
}
