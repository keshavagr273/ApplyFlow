import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center h-full bg-red-50 text-red-900 rounded-lg">
          <AlertTriangle size={48} className="text-red-500 mb-4 opacity-80" />
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <p className="text-xs opacity-80 max-w-xs break-words mb-4">
            {this.state.error?.message || 'An unexpected error occurred in the UI.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow transition-colors text-sm"
          >
            Reload Extension
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
