import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders, useUI } from '@/components/providers';
import { ProductCard } from '@/components/product-card';
import { ProductDetail } from '@/features/store/product-detail';
import { addCartProduct } from '@/features/store/cart-state';
import { useStore } from '@/features/store/store-provider';
import { seedProducts } from '@/mocks/data';

const product = { ...seedProducts[0], quantidade_estoque: 1 };
beforeEach(() => {
  window.localStorage.clear();
});

function StoreStatus() {
  const { items } = useStore();
  const { state } = useUI();
  return (
    <>
      <span aria-label="Quantidade no carrinho">
        {items.reduce((sum, item) => sum + item.quantity, 0)}
      </span>
      <p role="status">{state.notification}</p>
    </>
  );
}

test('adição retorna o resultado real para estoque, limite de quantidade e produtos distintos', () => {
  const first = addCartProduct([], product);
  expect(first.result).toBe('added');
  const fullStock = addCartProduct(first.items, product);
  expect(fullStock.result).toBe('stock_limit');
  expect(fullStock.items).toBe(first.items);
  expect(addCartProduct([], { ...product, quantidade_estoque: 0 }).result).toBe('out_of_stock');
  expect(
    addCartProduct([{ product: { ...product, quantidade_estoque: 20000 }, quantity: 10000 }], {
      ...product,
      quantidade_estoque: 20000,
    }).result,
  ).toBe('quantity_limit');
  const fullCart = Array.from({ length: 100 }, (_, index) => ({
    product: { ...product, id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}` },
    quantity: 1,
  }));
  expect(addCartProduct(fullCart, product)).toEqual({ items: fullCart, result: 'item_limit' });
});

test('card informa limite de estoque sem anunciar uma segunda adição inexistente', async () => {
  const user = userEvent.setup();
  render(
    <AppProviders skipMock>
      <ProductCard product={product} />
      <StoreStatus />
    </AppProviders>,
  );
  const add = screen.getByRole('button', { name: `Adicionar ao carrinho ${product.nome}` });
  await user.click(add);
  expect(screen.getByRole('status')).toHaveTextContent('Produto adicionado ao carrinho.');
  await user.click(add);
  expect(screen.getByRole('status')).toHaveTextContent(
    'Você já adicionou todo o estoque disponível',
  );
  expect(screen.getByLabelText('Quantidade no carrinho')).toHaveTextContent('1');
});

test('card informa limite de 100 produtos sem alterar o carrinho restaurado', async () => {
  const saved = Array.from({ length: 100 }, (_, index) => ({
    product: { ...product, id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}` },
    quantity: 1,
  }));
  window.localStorage.setItem('suzano-store-cart-v1', JSON.stringify(saved));
  const user = userEvent.setup();
  render(
    <AppProviders skipMock>
      <ProductCard product={product} />
      <StoreStatus />
    </AppProviders>,
  );
  await user.click(screen.getByRole('button', { name: `Adicionar ao carrinho ${product.nome}` }));
  expect(screen.getByRole('status')).toHaveTextContent(
    'O carrinho aceita até 100 produtos diferentes.',
  );
  expect(screen.getByLabelText('Quantidade no carrinho')).toHaveTextContent('100');
});

test.each(['imagem', 'nome'])(
  'Escape nos detalhes restaura o foco ao botão de %s que abriu o modal',
  async (origin) => {
    const user = userEvent.setup();
    render(
      <AppProviders skipMock>
        <ProductCard product={product} />
        <ProductDetail />
      </AppProviders>,
    );
    const trigger = screen.getByRole('button', {
      name: origin === 'imagem' ? `Ver detalhes de ${product.nome}` : product.nome,
    });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: product.nome })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);

test('detalhes mantêm o modal e explicam por que a adição no limite não ocorreu', async () => {
  window.localStorage.setItem('suzano-store-cart-v1', JSON.stringify([{ product, quantity: 1 }]));
  const user = userEvent.setup();
  render(
    <AppProviders skipMock>
      <ProductCard product={product} />
      <ProductDetail />
    </AppProviders>,
  );
  await user.click(screen.getByRole('button', { name: `Ver detalhes de ${product.nome}` }));
  await user.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Você já adicionou todo o estoque disponível',
  );
  expect(screen.getByRole('dialog', { name: product.nome })).toBeInTheDocument();
});
