import { useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { delay, http, HttpResponse } from 'msw';
import { AppProviders } from '@/components/providers';
import { apiBaseUrl, listProducts } from '@/lib/api';
import { defaultFilters } from '@/lib/filters';
import { seedProducts } from '@/mocks/data';
import { server } from '@/mocks/server';

test('consulta antiga lenta não sobrescreve a busca mais recente', async () => {
  let started!: () => void;
  const firstRequest = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finished!: () => void;
  const oldCompleted = new Promise<void>((resolve) => {
    finished = resolve;
  });
  server.use(
    http.get(`${apiBaseUrl}/produtos`, async ({ request }) => {
      const name = new URL(request.url).searchParams.get('nome');
      if (name === 'antigo') {
        started();
        await delay(200);
        finished();
      }
      return HttpResponse.json({
        data: [{ ...seedProducts[0], nome: name }],
        meta: { pagina: 1, limite: 12, total: 1, total_paginas: 1 },
      });
    }),
  );
  function Search() {
    const [nome, setNome] = useState('antigo');
    const filters = { ...defaultFilters, nome };
    const query = useQuery({
      queryKey: ['produtos', filters],
      queryFn: ({ signal }) => listProducts(filters, signal),
    });
    return (
      <>
        <button onClick={() => setNome('novo')}>Nova busca</button>
        <p>{query.data?.data[0].nome}</p>
      </>
    );
  }
  render(
    <AppProviders skipMock>
      <Search />
    </AppProviders>,
  );
  await firstRequest;
  fireEvent.click(screen.getByText('Nova busca'));
  expect(await screen.findByText('novo')).toBeInTheDocument();
  await oldCompleted;
  expect(screen.getByText('novo')).toBeInTheDocument();
  expect(screen.queryByText('antigo')).not.toBeInTheDocument();
});
