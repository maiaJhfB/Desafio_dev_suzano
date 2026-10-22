import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const mockAdminCredentials = {
  email: 'admin@suzano.local',
  password: 'SuzanoDemo!2026',
};

export function realAdminCredentials() {
  let email = process.env.AUTH_ADMIN_EMAIL;
  let password = process.env.AUTH_TEST_ADMIN_PASSWORD;
  if ((!email || !password) && !process.env.CI) {
    try {
      const saved: unknown = JSON.parse(
        readFileSync(resolve(__dirname, '../../../../tmp/admin-access.json'), 'utf8'),
      );
      if (
        saved &&
        typeof saved === 'object' &&
        'email' in saved &&
        typeof saved.email === 'string' &&
        'password' in saved &&
        typeof saved.password === 'string'
      ) {
        email ??= saved.email;
        password ??= saved.password;
      }
    } catch {
      /* Explicit environment credentials remain available for CI and custom accounts. */
    }
  }
  if (!email || !password)
    throw new Error('Configure AUTH_ADMIN_EMAIL e AUTH_TEST_ADMIN_PASSWORD para o E2E integrado.');
  return { email, password };
}

export async function submitAdminLogin(
  page: Page,
  credentials: { email: string; password: string },
) {
  const dialog = page.getByRole('dialog', { name: 'Acesso administrativo', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('E-mail', { exact: true }).fill(credentials.email);
  await dialog.getByLabel('Senha', { exact: true }).fill(credentials.password);
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click();
}

export async function openProductFormAsAdmin(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.getByRole('button', { name: 'Novo produto', exact: true }).click();
  await submitAdminLogin(page, credentials);
  await expect(page.getByRole('dialog', { name: 'Novo produto', exact: true })).toBeVisible();
}

/** Keep credentials and bearer tokens out of Playwright request traces and failure call logs. */
export async function realAdminApi() {
  const base = process.env.E2E_API_URL ?? 'http://localhost:3001/api/v1';
  const credentials = realAdminCredentials();
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    signal: AbortSignal.timeout(10000),
  });
  if (login.status !== 200) throw new Error(`Login administrativo retornou HTTP ${login.status}.`);
  const { access_token: token } = await login.json();
  if (typeof token !== 'string' || !token) throw new Error('Login não retornou uma sessão válida.');
  return async (
    endpoint: string,
    {
      method = 'GET',
      body,
      status = 200,
    }: { method?: string; body?: unknown; status?: number } = {},
  ) => {
    const response = await fetch(`${base}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    if (response.status !== status)
      throw new Error(`API administrativa ${method} ${endpoint} retornou HTTP ${response.status}.`);
    return status === 204 ? undefined : response.json();
  };
}
