'use client';

import { createContext, useContext } from 'react';
import type { AdminUser, LoginCredentials } from '@/lib/auth';

export interface AuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  loginOpen: boolean;
  message: string;
  requestAdmin: (action?: () => void, trigger?: HTMLElement) => void;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  closeLogin: () => void;
  logout: () => void;
  restoreLoginFocus: () => void;
}
export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
