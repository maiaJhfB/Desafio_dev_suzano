import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { AppProviders } from '@/components/providers';
import { Catalog } from '@/components/catalog';
import { apiBaseUrl } from '@/lib/api';
import { server } from '@/mocks/server';
import { seedProducts } from '@/mocks/data';

jest.mock('next/navigation', () => ({
  usePathname: () => '/produtos',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
const mount = () =>
  render(
    <AppProviders skipMock>
      <Catalog />
    </AppProviders>,
  );

test('lista os cinco atributos e muda de carregamento para catálogo', async () => {
  mount();
  expect(screen.getByRole('status', { name: 'Carregando produtos' })).toBeInTheDocument();
  const title = await screen.findByRole('heading', { name: seedProducts[0].nome });
  const card = title.closest('article')!;
  expect(within(card).getByText('Papel sulfite')).toBeInTheDocument();
  expect(within(card).getByText(seedProducts[0].descricao)).toBeInTheDocument();
  expect(within(card).getByText(/169,90/)).toBeInTheDocument();
  expect(within(card).getByRole('img', { name: seedProducts[0].nome })).toHaveAttribute(
    'src',
    expect.stringContaining('report-a4.png'),
  );
});
test('cadastro insere o produto na lista e anuncia sucesso', async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByRole('heading', { name: seedProducts[0].nome });
  await user.click(screen.getByRole('button', { name: 'Novo produto' }));
  await user.type(screen.getByLabelText('Nome do produto'), 'Produto de teste');
  await user.type(screen.getByLabelText('Categoria'), 'Casa');
  await user.type(screen.getByLabelText('Descrição'), 'Produto cadastrado via formulário.');
  await user.type(screen.getByLabelText('Preço', { exact: true }), '12,34');
  await user.type(screen.getByLabelText('URL da imagem'), 'https://example.com/a.png');
  await user.click(screen.getByRole('button', { name: 'Cadastrar produto' }));
  expect(
    await screen.findByText('“Produto de teste” foi cadastrado com sucesso.'),
  ).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Produto de teste' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('erro na gravação mantém os valores e permite tentar novamente', async () => {
  server.use(http.post(`${apiBaseUrl}/produtos`, () => HttpResponse.error()));
  const user = userEvent.setup();
  mount();
  await screen.findByRole('heading', { name: seedProducts[0].nome });
  await user.click(screen.getByRole('button', { name: 'Novo produto' }));
  await user.type(screen.getByLabelText('Nome do produto'), 'Preservado');
  await user.type(screen.getByLabelText('Categoria'), 'Casa');
  await user.type(screen.getByLabelText('Descrição'), 'Descrição');
  await user.type(screen.getByLabelText('Preço', { exact: true }), '1,00');
  await user.type(screen.getByLabelText('URL da imagem'), 'https://example.com/a.png');
  await user.click(screen.getByRole('button', { name: 'Cadastrar produto' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Seus dados foram mantidos');
  expect(screen.getByLabelText('Nome do produto')).toHaveValue('Preservado');
});
test('erro de leitura oferece nova tentativa e recupera o catálogo', async () => {
  let fail = true;
  server.use(
    http.get(`${apiBaseUrl}/produtos`, () =>
      fail
        ? new HttpResponse(null, { status: 503 })
        : HttpResponse.json({
            data: seedProducts.slice(0, 1),
            meta: { pagina: 1, limite: 12, total: 1, total_paginas: 1 },
          }),
    ),
  );
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('O catálogo fez uma pausa');
  fail = false;
  await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: seedProducts[0].nome })).toBeInTheDocument(),
  );
});
test('mensagem vazia distingue uma lista sem produtos', async () => {
  server.use(
    http.get(`${apiBaseUrl}/produtos`, async () => {
      await delay(10);
      return HttpResponse.json({
        data: [],
        meta: { pagina: 1, limite: 12, total: 0, total_paginas: 0 },
      });
    }),
  );
  mount();
  expect(await screen.findByText('Seu catálogo está esperando.')).toBeInTheDocument();
});
