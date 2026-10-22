import { test, expect } from '@playwright/test';

test('compra integrada registra preços do servidor e mantém estoque enquanto pendente', async ({
  page,
  request,
}) => {
  const name = `Checkout Suzano ${Date.now()}`;
  const created = await request.post('http://localhost:3001/api/v1/produtos', {
    data: {
      nome: name,
      categoria: 'Papel sulfite',
      descricao: 'Produto isolado para validar o checkout integrado.',
      preco_centavos: 1999,
      quantidade_estoque: 3,
      imagem_url: 'http://localhost:3000/store/report-a4.png',
    },
  });
  expect(created.status()).toBe(201);
  const product = await created.json();
  let orderId: string | undefined;
  try {
    await page.goto(`/produtos?nome=${encodeURIComponent(name)}`);
    await page.getByRole('button', { name: `Adicionar ao carrinho ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Carrinho, 1 itens', exact: true }).click();
    const cart = page.getByRole('dialog', { name: 'Seu carrinho' });
    await cart.getByRole('button', { name: `Aumentar quantidade de ${name}` }).click();
    const submitted = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/pedidos') && response.request().method() === 'POST',
    );
    await cart.getByRole('button', { name: 'Finalizar pedido', exact: true }).click();
    const response = await submitted;
    expect(response.status()).toBe(201);
    const order = await response.json();
    orderId = order.id;
    expect(order).toMatchObject({
      status: 'Pendente',
      total_pedido_centavos: 3998,
      produtos: [{ produto_id: product.id, quantidade: 2, preco_unitario_centavos: 1999 }],
    });
    await expect(cart.getByRole('heading', { name: 'Pedido recebido!' })).toBeVisible();
    const persisted = await request.get(`http://localhost:3001/api/v1/pedidos/${order.id}`);
    expect((await persisted.json()).total_pedido_centavos).toBe(3998);
    const stock = await request.get(`http://localhost:3001/api/v1/produtos/${product.id}`);
    expect((await stock.json()).quantidade_estoque).toBe(3);
  } finally {
    if (orderId)
      await request.patch(`http://localhost:3001/api/v1/pedidos/${orderId}/status`, {
        data: { status: 'Cancelado' },
      });
    await request.delete(`http://localhost:3001/api/v1/produtos/${product.id}`);
  }
});

test('cadastro real persiste no PostgreSQL depois de recarregar', async ({ page, request }) => {
  const name = `Persistência E2E ${Date.now()}`;
  let id: string | undefined;
  try {
    await page.goto('/produtos');
    await expect(page.getByText('Conectado ao seu catálogo', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Novo produto' }).click();
    await page.getByLabel('Nome do produto', { exact: true }).fill(name);
    await page.getByLabel('Categoria', { exact: true }).fill('Teste');
    await page.getByLabel('Descrição', { exact: true }).fill('Verificação de persistência real.');
    await page.getByLabel('Preço', { exact: true }).fill('0,01');
    await page
      .getByLabel('URL da imagem', { exact: true })
      .fill('http://localhost:3000/images/vase.svg');
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/produtos') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Cadastrar produto', exact: true }).click();
    const response = await saved;
    expect(response.status()).toBe(201);
    id = (await response.json()).id;
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    const persisted = await request.get(`http://localhost:3001/api/v1/produtos/${id}`);
    expect((await persisted.json()).preco_centavos).toBe(1);
  } finally {
    if (id)
      expect((await request.delete(`http://localhost:3001/api/v1/produtos/${id}`)).status()).toBe(
        204,
      );
  }
});
