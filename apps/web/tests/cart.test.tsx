import { useEffect, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { CartDrawer, type CartItem } from '@/features/cart/cart-drawer';
import { apiBaseUrl } from '@/lib/api';
import { server } from '@/mocks/server';
import { seedProducts } from '@/mocks/data';

const product = { ...seedProducts[0], quantidade_estoque: 3 };
const initial: CartItem[] = [{ product, quantity: 1 }];
beforeEach(() => {
  window.sessionStorage.clear();
});

function mount(items: CartItem[] = initial) {
  const cleared = jest.fn();
  const removed = jest.fn();
  const changed = jest.fn();
  const continued = jest.fn();
  function Harness() {
    const [cart, setCart] = useState(items);
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={() => setOpen(true)}>Abrir carrinho novamente</button>
        <CartDrawer
          open={open}
          onOpenChange={setOpen}
          items={cart}
          onQuantityChange={(id, quantity) => {
            changed(id, quantity);
            setCart((current) =>
              current.map((item) => (item.product.id === id ? { ...item, quantity } : item)),
            );
          }}
          onRemove={(id) => {
            removed(id);
            setCart((current) => current.filter((item) => item.product.id !== id));
          }}
          onClear={() => {
            cleared();
            setCart([]);
          }}
          onContinueShopping={continued}
        />
      </>
    );
  }
  const view = render(<Harness />);
  return { cleared, removed, changed, continued, unmount: view.unmount };
}

const successOrder = {
  id: '0fb4e184-4fcf-42ac-8a38-3ecb143d2d89',
  status: 'Pendente',
  total_pedido_centavos: 34567,
  produtos: [],
  created_at: '2026-01-01T12:00:00.000Z',
  updated_at: '2026-01-01T12:00:00.000Z',
};

test('carrinho vazio oferece continuar comprando e fecha o diálogo', async () => {
  const user = userEvent.setup();
  const callbacks = mount([]);
  expect(screen.getByRole('dialog', { name: 'Seu carrinho' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Finalizar pedido' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Explorar produtos' }));
  expect(callbacks.continued).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('aumenta e diminui quantidade, limita pelo estoque e permite remover o item', async () => {
  const user = userEvent.setup();
  const callbacks = mount();
  const input = screen.getByRole('spinbutton', { name: `Quantidade de ${product.nome}` });
  await user.click(screen.getByRole('button', { name: `Aumentar quantidade de ${product.nome}` }));
  expect(input).toHaveValue(2);
  expect(callbacks.changed).toHaveBeenLastCalledWith(product.id, 2);
  await user.click(screen.getByRole('button', { name: `Diminuir quantidade de ${product.nome}` }));
  expect(input).toHaveValue(1);
  fireEvent.change(input, { target: { value: '4' } });
  expect(screen.getByRole('alert')).toHaveTextContent('quantidade inteira de 1 a 3');
  expect(screen.getByRole('button', { name: 'Finalizar pedido' })).toBeDisabled();
  expect(callbacks.changed).toHaveBeenLastCalledWith(product.id, 1);
  fireEvent.change(input, { target: { value: '3' } });
  expect(
    screen.getByRole('button', { name: `Aumentar quantidade de ${product.nome}` }),
  ).toBeDisabled();
  await user.click(screen.getByRole('button', { name: `Remover ${product.nome} do carrinho` }));
  expect(callbacks.removed).toHaveBeenCalledWith(product.id);
  expect(screen.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeInTheDocument();
});

test('rejeita quantidade fracionária sem alterar a quantidade do carrinho', () => {
  const callbacks = mount();
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1.5' } });
  expect(screen.getByRole('alert')).toHaveTextContent('quantidade inteira de 1 a 3');
  expect(screen.getByRole('button', { name: 'Finalizar pedido' })).toBeDisabled();
  expect(callbacks.changed).not.toHaveBeenCalled();
});

test('não envia um carrinho sem estoque', () => {
  mount([{ product: { ...product, quantidade_estoque: 0 }, quantity: 1 }]);
  expect(screen.getByRole('alert')).toHaveTextContent('sem estoque');
  expect(screen.getByRole('button', { name: 'Finalizar pedido' })).toBeDisabled();
});

test('envia o payload pendente uma vez, usa total do servidor e só então limpa o carrinho', async () => {
  let received: unknown;
  let requests = 0;
  server.use(
    http.post(`${apiBaseUrl}/pedidos`, async ({ request }) => {
      requests += 1;
      received = await request.json();
      await delay(80);
      return HttpResponse.json(successOrder, { status: 201 });
    }),
  );
  const user = userEvent.setup();
  const callbacks = mount();
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  expect(screen.getByRole('button', { name: 'Enviando pedido…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Fechar carrinho' })).toBeDisabled();
  expect(callbacks.cleared).not.toHaveBeenCalled();
  expect(await screen.findByRole('heading', { name: 'Pedido recebido!' })).toBeInTheDocument();
  expect(received).toEqual({
    produtos: [{ produto_id: product.id, quantidade: 1 }],
    status: 'Pendente',
  });
  expect(requests).toBe(1);
  expect(callbacks.cleared).toHaveBeenCalledTimes(1);
  expect(screen.getByText(successOrder.id)).toBeInTheDocument();
  expect(screen.getByText('Pendente')).toBeInTheDocument();
  expect(screen.getByText(/345,67/)).toBeInTheDocument();
  expect(screen.getByText(/Nenhuma cobrança foi realizada/)).toBeInTheDocument();
});

test('falha HTTP preserva itens, não repete POST automaticamente e permite tentativa explícita', async () => {
  let requests = 0;
  server.use(
    http.post(`${apiBaseUrl}/pedidos`, () => {
      requests += 1;
      return HttpResponse.json(
        {
          error: {
            code: 'ESTOQUE_INSUFICIENTE',
            message: 'O estoque disponível mudou.',
            details: [],
            request_id: 'request-test',
          },
        },
        { status: 409 },
      );
    }),
  );
  const user = userEvent.setup();
  const callbacks = mount();
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'O estoque disponível mudou. Seu carrinho foi mantido.',
  );
  expect(requests).toBe(1);
  expect(callbacks.cleared).not.toHaveBeenCalled();
  expect(screen.getByRole('spinbutton')).toHaveValue(1);
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  await waitFor(() => expect(requests).toBe(2));
});

test('falha de rede preserva o carrinho e não apresenta confirmação falsa', async () => {
  server.use(http.post(`${apiBaseUrl}/pedidos`, () => HttpResponse.error()));
  const user = userEvent.setup();
  const callbacks = mount();
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Confira sua conexão. Seu carrinho foi mantido.',
  );
  expect(callbacks.cleared).not.toHaveBeenCalled();
  expect(screen.queryByRole('heading', { name: 'Pedido recebido!' })).not.toBeInTheDocument();
});

test('resposta inválida mantém os itens em vez de afirmar que o pedido foi confirmado', async () => {
  server.use(
    http.post(`${apiBaseUrl}/pedidos`, () =>
      HttpResponse.json({ id: 'incompleto' }, { status: 201 }),
    ),
  );
  const user = userEvent.setup();
  const callbacks = mount();
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('A confirmação recebida não é válida');
  expect(callbacks.cleared).not.toHaveBeenCalled();
});

test('resposta perdida reutiliza a chave ao reabrir o carrinho e registra somente um pedido', async () => {
  const keys: Array<string | null> = [];
  const committed = new Map<string, typeof successOrder>();
  let loseResponse = true;
  server.use(
    http.post(`${apiBaseUrl}/pedidos`, ({ request }) => {
      const key = request.headers.get('Idempotency-Key');
      keys.push(key);
      if (!key) return new HttpResponse(null, { status: 400 });
      if (!committed.has(key)) committed.set(key, successOrder);
      if (loseResponse) {
        loseResponse = false;
        return HttpResponse.error();
      }
      return HttpResponse.json(committed.get(key), { status: 201 });
    }),
  );
  const user = userEvent.setup();
  const callbacks = mount();
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  await screen.findByRole('alert');
  expect(callbacks.cleared).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Fechar carrinho' }));
  await user.click(screen.getByRole('button', { name: 'Abrir carrinho novamente' }));
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  await screen.findByRole('heading', { name: 'Pedido recebido!' });
  expect(keys[0]).toMatch(/^[\da-f-]{36}$/);
  expect(keys[1]).toBe(keys[0]);
  expect(committed.size).toBe(1);
  expect(callbacks.cleared).toHaveBeenCalledTimes(1);
});

test('remontar com hidratação inicial vazia mantém a chave após uma falha incerta', async () => {
  const keys: Array<string | null> = [];
  server.use(
    http.post(`${apiBaseUrl}/pedidos`, ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key'));
      return keys.length === 1
        ? HttpResponse.error()
        : HttpResponse.json(successOrder, { status: 201 });
    }),
  );
  const user = userEvent.setup();
  const first = mount();
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  await screen.findByRole('alert');
  first.unmount();
  function HydratingCart() {
    const [items, setItems] = useState<CartItem[]>([]);
    useEffect(() => {
      setItems(initial);
    }, []);
    return (
      <CartDrawer
        open
        onOpenChange={() => {}}
        items={items}
        onQuantityChange={() => {}}
        onRemove={() => {}}
        onClear={() => setItems([])}
        onContinueShopping={() => {}}
      />
    );
  }
  render(<HydratingCart />);
  await user.click(await screen.findByRole('button', { name: 'Finalizar pedido' }));
  await screen.findByRole('heading', { name: 'Pedido recebido!' });
  expect(keys[1]).toBe(keys[0]);
});

test('alterar os itens ou concluir com sucesso gera uma nova chave para a próxima compra', async () => {
  const keys: Array<string | null> = [];
  server.use(
    http.post(`${apiBaseUrl}/pedidos`, ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key'));
      return keys.length === 1
        ? HttpResponse.error()
        : HttpResponse.json(successOrder, { status: 201 });
    }),
  );
  const user = userEvent.setup();
  const first = mount();
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: `Aumentar quantidade de ${product.nome}` }));
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  await screen.findByRole('heading', { name: 'Pedido recebido!' });
  expect(keys[1]).not.toBe(keys[0]);
  first.unmount();
  mount();
  await user.click(screen.getByRole('button', { name: 'Finalizar pedido' }));
  await screen.findByRole('heading', { name: 'Pedido recebido!' });
  expect(keys[2]).not.toBe(keys[1]);
});
