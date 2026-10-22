import { test, expect } from '@playwright/test';
import { mockAdminCredentials, openProductFormAsAdmin, submitAdminLogin } from './auth-helpers';

// Administrative credentials and bearer responses are not attached to traces or screenshots.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('login administrativo permite cadastro, logout e expiração da sessão ao recarregar', async ({
  page,
}) => {
  await page.goto('/produtos');
  await openProductFormAsAdmin(page, mockAdminCredentials);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Acesso administrativo', exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Acesso administrativo', exact: true }).click();
  await submitAdminLogin(page, mockAdminCredentials);
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Acesso administrativo', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Novo produto', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Acesso administrativo', exact: true }),
  ).toBeVisible();
});
