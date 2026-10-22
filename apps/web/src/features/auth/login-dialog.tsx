'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, LockKeyhole, X } from 'lucide-react';
import { apiMode } from '@/lib/api';
import { loginSchema, type LoginCredentials } from '@/lib/auth';
import { useAuth } from './auth-context';

export function LoginDialog() {
  const auth = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  useEffect(() => {
    if (!auth.loginOpen) {
      reset({ email: '', password: '' });
      setError('');
    }
  }, [auth.loginOpen, reset]);
  async function submit(credentials: LoginCredentials) {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await auth.signIn(credentials);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Não foi possível entrar. Tente novamente.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog.Root
      open={auth.loginOpen}
      onOpenChange={(open) => {
        if (!open && !pending) auth.closeLogin();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content auth-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            auth.restoreLoginFocus();
          }}
        >
          <div className="dialog-header">
            <span className="dialog-icon">
              <LockKeyhole size={24} aria-hidden="true" />
            </span>
            <Dialog.Close
              className="icon-button"
              aria-label="Fechar acesso administrativo"
              disabled={pending}
            >
              <X size={21} aria-hidden="true" />
            </Dialog.Close>
            <Dialog.Title>Acesso administrativo</Dialog.Title>
            <Dialog.Description>
              Entre para gerenciar os produtos. A loja e o carrinho continuam disponíveis sem login.
            </Dialog.Description>
          </div>
          <form className="product-form auth-form" onSubmit={handleSubmit(submit)} noValidate>
            {auth.message && (
              <p className="auth-session-notice" role="status">
                {auth.message}
              </p>
            )}
            <div className="field">
              <label htmlFor="admin-email">E-mail</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                maxLength={254}
                {...register('email')}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'admin-email-error' : undefined}
              />
              {errors.email && (
                <span id="admin-email-error" className="field-error">
                  {errors.email.message}
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="admin-password">Senha</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                maxLength={1024}
                {...register('password')}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'admin-password-error' : undefined}
              />
              {errors.password && (
                <span id="admin-password-error" className="field-error">
                  {errors.password.message}
                </span>
              )}
            </div>
            {apiMode === 'mock' && (
              <p className="auth-demo-hint">
                Apenas nesta demonstração: <strong>admin@suzano.local</strong>
                <br />
                Senha: <strong>SuzanoDemo!2026</strong>
              </p>
            )}
            {error && (
              <p className="form-api-error" role="alert">
                {error}
              </p>
            )}
            <p className="auth-memory-note">
              A sessão dura até 15 minutos e encerra ao recarregar a página.
            </p>
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button className="button button-secondary" type="button" disabled={pending}>
                  Cancelar
                </button>
              </Dialog.Close>
              <button className="button button-primary" type="submit" disabled={pending}>
                {pending && <LoaderCircle className="spin" size={17} aria-hidden="true" />}
                {pending ? 'Entrando…' : 'Entrar'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
