import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { AppProviders } from '@/components/providers';
import { Catalog } from '@/components/catalog';
import { apiBaseUrl, createProduct } from '@/lib/api';
import { getAdminProfile, loginAdmin } from '@/lib/auth';
import { getAdminAccessToken, clearAdminSession } from '@/lib/admin-session';
import { mockAdminCredentials } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import { seedProducts } from '@/mocks/data';
import { authorizeMock } from './auth-helpers';

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
async function signIn(
  user: ReturnType<typeof userEvent.setup>,
  password = mockAdminCredentials.password,
) {
  await user.type(screen.getByLabelText('E-mail'), mockAdminCredentials.email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}
test('login inválido mantém a tela, sem sessão nem dados de autenticação no storage', async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Acesso administrativo' }));
  await signIn(user, 'incorreta');
  expect(await screen.findByRole('alert')).toHaveTextContent('Email ou senha inválidos.');
  expect(getAdminAccessToken()).toBeNull();
  expect(screen.getByLabelText('Senha')).toHaveValue('incorreta');
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Acesso administrativo' })).toHaveFocus();
});
test('login libera o formulário e logout elimina a sessão apenas mantida em memória', async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Novo produto' }));
  await signIn(user);
  await screen.findByLabelText('Nome do produto');
  const token = getAdminAccessToken();
  expect(token).not.toBeNull();
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(token);
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(
    mockAdminCredentials.password,
  );
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Sair' }));
  expect(getAdminAccessToken()).toBeNull();
  await expect(
    createProduct({
      ...seedProducts[0],
      imagem_url: seedProducts[0].imagem_url ?? 'https://example.com/a.png',
    }),
  ).rejects.toMatchObject({ status: 401 });
});
test('expiração invalida a sessão e exige novo login', async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Acesso administrativo' }));
  await signIn(user);
  await screen.findByRole('button', { name: 'Sair' });
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 901000);
  try {
    act(() => {
      expect(getAdminAccessToken()).toBeNull();
    });
  } finally {
    clock.mockRestore();
  }
  await user.click(screen.getByRole('button', { name: 'Novo produto' }));
  expect(await screen.findByRole('dialog', { name: 'Acesso administrativo' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou');
});
test('401 preserva os campos, pede login e não repete a gravação automaticamente', async () => {
  let calls = 0;
  server.use(
    http.post(`${apiBaseUrl}/produtos`, async () => {
      calls++;
      return calls === 1
        ? HttpResponse.json(
            {
              error: {
                code: 'NAO_AUTORIZADO',
                message: 'Entre novamente.',
                details: [],
                request_id: '',
              },
            },
            { status: 401 },
          )
        : HttpResponse.json({ ...seedProducts[0], nome: 'Preservado' }, { status: 201 });
    }),
  );
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Novo produto' }));
  await signIn(user);
  await screen.findByLabelText('Nome do produto');
  await user.type(screen.getByLabelText('Nome do produto'), 'Preservado');
  await user.type(screen.getByLabelText('Categoria', { exact: true }), 'Casa');
  await user.type(screen.getByLabelText('Descrição', { exact: true }), 'Descrição preservada');
  await user.type(screen.getByLabelText('Preço', { exact: true }), '1,00');
  await user.type(screen.getByLabelText('URL da imagem'), 'https://example.com/a.png');
  await user.click(screen.getByRole('button', { name: 'Cadastrar produto' }));
  await screen.findByLabelText('E-mail');
  await signIn(user);
  expect(await screen.findByLabelText('Nome do produto')).toHaveValue('Preservado');
  expect(calls).toBe(1);
  await user.click(screen.getByRole('button', { name: 'Cadastrar produto' }));
  await screen.findByText('“Preservado” foi cadastrado com sucesso.');
  expect(calls).toBe(2);
});
test('perfil exige Bearer válido e resposta de login malformada não cria sessão', async () => {
  await authorizeMock();
  expect(await getAdminProfile()).toMatchObject({
    email: mockAdminCredentials.email,
    role: 'admin',
  });
  clearAdminSession();
  await expect(getAdminProfile()).rejects.toMatchObject({ status: 401 });
  server.use(
    http.post(`${apiBaseUrl}/auth/login`, () => HttpResponse.json({ access_token: 'incomplete' })),
  );
  await expect(loginAdmin(mockAdminCredentials)).rejects.toThrow('resposta de autenticação');
  expect(getAdminAccessToken()).toBeNull();
});
