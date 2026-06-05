
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import * as idb from 'idb-keyval';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const idbStorage = {
  getItem: async (key: string) => await idb.get(key),
  setItem: async (key: string, value: any) => await idb.set(key, value),
  removeItem: async (key: string) => await idb.del(key),
};

const persister = createAsyncStoragePersister({
  storage: idbStorage,
});

// Global listener for PWA install prompt
(window as any).deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).deferredInstallPrompt = e;
});

// Expose queryClient globally for real-time invalidation from App.tsx listeners
(window as any).queryClient = queryClient;

import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
const updateSW = registerSW({
  onNeedRefresh() {
    // We could prompt user, but auto update is fine for now
    updateSW();
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', fontFamily: 'sans-serif' }}>
          <h1>Something went wrong.</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '10px', padding: '8px 16px', cursor: 'pointer' }}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import { UploadProvider } from './contexts/UploadContext';
import { Toaster } from 'sonner';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <UploadProvider>
          <Toaster position="top-center" richColors theme="system" />
          <App />
        </UploadProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
