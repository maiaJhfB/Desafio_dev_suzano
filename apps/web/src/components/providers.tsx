'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import { apiMode, retryTransient } from '@/lib/api';
import { StoreProvider } from '@/features/store/store-provider';

type UIState = { productDialog: boolean; notification: string | null };
type UIAction =
  { type: 'open' } | { type: 'close' } | { type: 'notify'; message: string } | { type: 'dismiss' };

function reducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'open':
      return { ...state, productDialog: true };
    case 'close':
      return { ...state, productDialog: false };
    case 'notify':
      return { productDialog: false, notification: action.message };
    case 'dismiss':
      return { ...state, notification: null };
  }
}

const UIContext = createContext<{ state: UIState; dispatch: React.Dispatch<UIAction> } | null>(
  null,
);

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI deve ser usado dentro de AppProviders.');
  return context;
}

let mockStartup: Promise<unknown> | undefined;

export function AppProviders({
  children,
  skipMock = false,
}: {
  children: ReactNode;
  skipMock?: boolean;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: retryTransient,
            retryDelay: 400,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  const [state, dispatch] = useReducer(reducer, { productDialog: false, notification: null });
  const [ready, setReady] = useState(skipMock || apiMode === 'real');
  const [startupError, setStartupError] = useState(false);

  useEffect(() => {
    if (skipMock || apiMode === 'real') return;
    let active = true;
    mockStartup ??= import('@/mocks/browser').then(({ worker }) =>
      worker.start({
        onUnhandledRequest: 'bypass',
        quiet: true,
      }),
    );
    mockStartup
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setStartupError(true);
      });
    return () => {
      active = false;
    };
  }, [skipMock]);

  return (
    <QueryClientProvider client={queryClient}>
      <UIContext.Provider value={{ state, dispatch }}>
        {ready ? (
          <StoreProvider>{children}</StoreProvider>
        ) : (
          <div className="startup-screen" role={startupError ? 'alert' : 'status'}>
            <img src="/brand/suzano-colorido.svg" alt="Suzano" width={156} height={37} />
            <p>
              {startupError
                ? 'Não foi possível preparar o catálogo de demonstração.'
                : 'Preparando seu catálogo…'}
            </p>
            {startupError && (
              <button className="button button-primary" onClick={() => window.location.reload()}>
                Tentar novamente
              </button>
            )}
          </div>
        )}
      </UIContext.Provider>
    </QueryClientProvider>
  );
}
