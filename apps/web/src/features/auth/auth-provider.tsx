'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { loginAdmin, type AdminUser, type LoginCredentials } from '@/lib/auth';
import {
  clearAdminSession,
  getAdminAccessToken,
  onAdminSessionInvalidated,
  setAdminSession,
} from '@/lib/admin-session';
import { AuthContext } from './auth-context';
import { LoginDialog } from './login-dialog';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ user: AdminUser; expiresAt: number } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [message, setMessage] = useState('');
  const pendingAction = useRef<(() => void) | undefined>(undefined);
  const returnFocus = useRef<HTMLElement | null>(null);
  const shouldRestoreFocus = useRef(true);

  useEffect(
    () =>
      onAdminSessionInvalidated((reason) => {
        setSession(null);
        setMessage(
          reason === 'logout'
            ? ''
            : 'Sua sessão expirou ou foi encerrada. Entre novamente para continuar.',
        );
      }),
    [],
  );

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => clearAdminSession('expired'),
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);

  const requestAdmin = useCallback(
    (action?: () => void, trigger?: HTMLElement) => {
      if (getAdminAccessToken() && session) {
        action?.();
        return;
      }
      pendingAction.current = action;
      returnFocus.current =
        trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      shouldRestoreFocus.current = true;
      setLoginOpen(true);
    },
    [session],
  );

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const response = await loginAdmin(credentials);
    const expiresAt = Date.now() + response.expires_in * 1000;
    setAdminSession(response.access_token, expiresAt);
    setSession({ user: response.user, expiresAt });
    setMessage('');
    const action = pendingAction.current;
    pendingAction.current = undefined;
    shouldRestoreFocus.current = !action;
    setLoginOpen(false);
    action?.();
  }, []);

  const closeLogin = useCallback(() => {
    pendingAction.current = undefined;
    shouldRestoreFocus.current = true;
    setLoginOpen(false);
  }, []);
  const logout = useCallback(() => {
    clearAdminSession('logout');
    closeLogin();
  }, [closeLogin]);
  const restoreLoginFocus = useCallback(() => {
    if (shouldRestoreFocus.current && returnFocus.current?.isConnected)
      returnFocus.current.focus({ preventScroll: true });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        isAuthenticated: !!session,
        loginOpen,
        message,
        requestAdmin,
        signIn,
        closeLogin,
        logout,
        restoreLoginFocus,
      }}
    >
      {children}
      <LoginDialog />
    </AuthContext.Provider>
  );
}
