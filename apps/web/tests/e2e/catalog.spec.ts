import { test, expect, type Page } from '@playwright/test';
import { mockAdminCredentials, openProductFormAsAdmin } from './auth-helpers';

test.use({ trace: 'off' });

async function create(page: Page, name: string) {
  await openProductFormAsAdmin(page, mockAdminCredentials);
  await page.getByLabel('Nome do produto', { exact: true }).fill(name);
  await page.getByLabel('Categoria', { exact: true }).fill('Casa');
  await page.getByLabel('Descrição', { exact: true }).fill('Uma nova escolha para o catálogo.');
  await page.getByLabel('Preço', { exact: true }).fill('12,34');
  await page
    .getByLabel('URL da imagem', { exact: true })
    .fill('http://localhost:3000/images/vase.svg');
  await page.getByRole('button', { name: 'Cadastrar produto', exact: true }).click();
}

test('busca, combina faixa inclusiva, ordena, pagina e restaura pelo histórico', async ({
  page,
}) => {
  await page.goto('/produtos');
  await expect(page.locator('article')).toHaveCount(12);
  await page.getByRole('button', { name: 'Próxima página' }).click();
  await expect(page.locator('article')).toHaveCount(4);
  await page.getByLabel('Encontre um produto').fill('Papel Report');
  await expect(page.locator('article')).toHaveCount(4);
  await expect(page).not.toHaveURL(/pagina=2/);
  await page.getByLabel('Preço mínimo', { exact: true }).fill('169,90');
  await page.getByLabel('Preço máximo', { exact: true }).fill('219,90');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await page.getByLabel('Ordenar por').selectOption('preco:asc');
  await expect(page.locator('article').first()).toContainText('Papel Report Premium A4 75g');
  await expect(page.locator('article')).toHaveCount(2);
  await page.getByLabel('Ordenar por').selectOption('nome:desc');
  await expect(page.locator('article').first()).toContainText('Papel Report Premium A4 90g');
  await page
    .getByRole('complementary', { name: 'Filtros de produtos' })
    .getByRole('button', { name: 'Limpar filtros', exact: true })
    .click();
  await expect(page.locator('article')).toHaveCount(12);
  await expect(page.getByLabel('Ordenar por')).toHaveValue('criado_em:desc');
  await page.goBack();
  await expect(page.getByLabel('Encontre um produto')).toHaveValue('Papel Report');
  await expect(page.locator('article')).toHaveCount(2);
});

test.describe('cadastro autenticado no modo mock', () => {
  // Login request/response bodies must never be retained in traces.
  test('cadastro limpa filtros e demonstração reinicia ao recarregar', async ({ page }) => {
    await page.goto('/produtos?nome=inexistente&preco_max_centavos=1');
    await expect(page.getByText('Nenhum produto por aqui.')).toBeVisible();
    await create(page, 'Produto E2E');
    await expect(page.getByText('“Produto E2E” foi cadastrado com sucesso.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Produto E2E', exact: true })).toBeVisible();
    await expect(page).toHaveURL('/produtos');
    await page.reload();
    await expect(page.locator('article')).toHaveCount(12);
    await expect(page.getByRole('heading', { name: 'Produto E2E', exact: true })).toHaveCount(0);
  });
});

test('layout 360px não transborda e diálogo preserva foco pelo teclado', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/produtos');
  await expect(page.locator('article')).toHaveCount(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const button = page.getByRole('button', { name: 'Novo produto' });
  await button.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('catálogo com seed fixo @visual', async ({ page }) => {
  await page.goto('/produtos');
  await expect(page.locator('article')).toHaveCount(12);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((image) => image.decode().catch(() => {})));
  });
  await expect(page).toHaveScreenshot('catalogo.png', { fullPage: true });
});
