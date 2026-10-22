import { test, expect, type Page } from '@playwright/test';

async function addFirstProduct(page: Page): Promise<string> {
  const card = page.locator('article').first();
  await expect(card).toBeVisible();
  const productName = (await card.getByRole('heading').first().innerText()).trim();
  expect(productName).toBe('Papel Report Premium A4 75g — 5 pacotes');
  await card
    .getByRole('button', { name: `Adicionar ao carrinho ${productName}`, exact: true })
    .click();
  return productName;
}

test('carrinho preserva quantidade ao recarregar e finaliza um pedido pendente', async ({
  page,
}) => {
  await page.goto('/produtos');
  const productName = await addFirstProduct(page);
  await page.getByRole('button', { name: 'Carrinho, 1 itens', exact: true }).click();

  const cart = page.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  await expect(cart.getByRole('heading', { name: productName, exact: true })).toBeVisible();
  const quantity = cart.getByRole('spinbutton', {
    name: `Quantidade de ${productName}`,
    exact: true,
  });
  await expect(quantity).toHaveValue('1');
  await cart
    .getByRole('button', { name: `Aumentar quantidade de ${productName}`, exact: true })
    .click();
  await expect(quantity).toHaveValue('2');
  await cart.getByRole('button', { name: 'Fechar carrinho', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Carrinho, 2 itens', exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Carrinho, 2 itens', exact: true }).click();
  await expect(
    cart.getByRole('spinbutton', { name: `Quantidade de ${productName}`, exact: true }),
  ).toHaveValue('2');
  const receivedOrder = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/pedidos' &&
      response.request().method() === 'POST',
  );
  await cart.getByRole('button', { name: 'Finalizar pedido', exact: true }).click();
  const response = await receivedOrder;
  expect(response.status()).toBe(201);
  const requestBody = response.request().postDataJSON();
  expect(requestBody).toMatchObject({ status: 'Pendente', produtos: [{ quantidade: 2 }] });
  expect(requestBody.produtos).toHaveLength(1);
  const order = await response.json();
  expect(order.status).toBe('Pendente');
  expect(order.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i);
  await expect(cart.getByRole('heading', { name: 'Pedido recebido!', exact: true })).toBeVisible();
  await expect(cart.getByText(order.id, { exact: true })).toBeVisible();
  await expect(
    cart.getByText('Nenhuma cobrança foi realizada. Pedidos pendentes não reservam estoque.', {
      exact: true,
    }),
  ).toBeVisible();
  await cart.getByRole('button', { name: 'Continuar comprando', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Carrinho, 0 itens', exact: true })).toBeVisible();
});

test('loja e carrinho cabem em 360 px e restauram o foco ao fechar', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/produtos');
  await addFirstProduct(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const overflowingNavigation = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('header, nav')).filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && (bounds.left < -1 || bounds.right > window.innerWidth + 1);
      }).length,
  );
  expect(overflowingNavigation).toBe(0);

  const cartButton = page.getByRole('button', { name: 'Carrinho, 1 itens', exact: true });
  await cartButton.click();
  const cart = page.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  await expect(cart).toBeVisible();
  const bounds = await cart.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-1);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(361);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(cart.getByRole('button', { name: 'Finalizar pedido', exact: true })).toBeVisible();
  const quantity = cart.getByRole('spinbutton').first();
  await quantity.fill('0');
  await expect(cart.getByRole('alert')).toContainText('Informe uma quantidade inteira');
  await expect(cart.getByRole('button', { name: 'Finalizar pedido', exact: true })).toBeDisabled();
  await quantity.fill('1');
  await expect(cart.getByRole('button', { name: 'Finalizar pedido', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(cart).toHaveCount(0);
  await expect(cartButton).toBeFocused();
});

test('detalhes do produto permitem adicionar ao carrinho e revisar a quantidade', async ({
  page,
}) => {
  await page.goto('/produtos');
  const productName = 'Papel Report Premium A4 75g — 5 pacotes';
  const card = page.locator('article').first();
  await expect(card.getByRole('heading', { name: productName, exact: true })).toBeVisible();
  await card.getByRole('button', { name: `Ver detalhes de ${productName}`, exact: true }).click();
  const details = page.getByRole('dialog', { name: productName, exact: true });
  await expect(details.getByRole('heading', { name: productName, exact: true })).toBeVisible();
  await expect(
    details.getByText('Preço e apresentação de demonstração. Nenhuma cobrança será realizada.', {
      exact: true,
    }),
  ).toBeVisible();
  await details.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click();
  await expect(details).toHaveCount(0);
  const cart = page.getByRole('dialog', { name: 'Seu carrinho', exact: true });
  await expect(cart.getByRole('heading', { name: productName, exact: true })).toBeVisible();
  await expect(
    cart.getByRole('spinbutton', { name: `Quantidade de ${productName}`, exact: true }),
  ).toHaveValue('1');
});

test('detalhes restauram o foco por teclado ao título e à imagem de origem', async ({ page }) => {
  await page.goto('/produtos');
  const card = page.locator('article').first();
  const name = 'Papel Report Premium A4 75g — 5 pacotes';
  const triggers = [
    card.getByRole('button', { name, exact: true }),
    card.getByRole('button', { name: `Ver detalhes de ${name}`, exact: true }),
  ];
  for (const trigger of triggers) {
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name, exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});
