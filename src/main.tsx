import React, {StrictMode, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface EBProps {
  children: ReactNode;
}
interface EBState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<EBProps, EBState> {
  public state: EBState;
  public props: EBProps;
  
  constructor(props: EBProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', wordBreak: 'break-all', fontFamily: 'monospace' }}>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Error Details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.error && this.state.error.stack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        // If an update is detected, tell installing worker to skip waiting immediately
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New version ready, taking control...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      },
      (err) => {
        console.log('ServiceWorker registration failed: ', err);
      }
    );
  });

  // When a new service worker version activates, trigger reload once to prevent chunk mismatches
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const hasReloaded = sessionStorage.getItem('sw_controller_reloaded');
    const now = Date.now();
    if (!hasReloaded || now - Number(hasReloaded) > 15000) {
      sessionStorage.setItem('sw_controller_reloaded', String(now));
      console.log('[SW] Controller changed to new version. Refreshing page...');
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
