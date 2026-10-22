import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import specification from '../../../docs/openapi.json';
import { apiBaseUrl, createProduct, listProducts } from '@/lib/api';
import { defaultFilters } from '@/lib/filters';
import { authorizeMock } from './auth-helpers';

const ajv = new Ajv({ strict: false });
addFormats(ajv);
function matches(name: string, value: unknown) {
  const validate = ajv.compile({
    components: specification.components,
    $ref: `#/components/schemas/${name}`,
  });
  expect({ valid: validate(value), errors: validate.errors }).toEqual({
    valid: true,
    errors: null,
  });
}

test('mock respeita schemas OpenAPI da API real e filtros antes da paginação', async () => {
  const result = await listProducts({
    ...defaultFilters,
    nome: 'PAPEL REPORT',
    categoria: 'Papel sulfite',
    preco_min_centavos: 16990,
    preco_max_centavos: 21990,
    ordenar: 'preco',
    direcao: 'asc',
    limite: 1,
  });
  matches('ProdutosPageResponseDto', result);
  expect(result.meta).toMatchObject({ total: 2, total_paginas: 2, limite: 1 });
  expect(result.data[0].nome).toBe('Papel Report Premium A4 75g — 5 pacotes');
  await authorizeMock();
  const created = await createProduct({
    nome: 'Produto contrato',
    categoria: 'Casa',
    descricao: 'Descrição.',
    preco_centavos: 1,
    quantidade_estoque: 0,
    imagem_url: 'https://example.com/a.png',
  });
  matches('ProdutoResponseDto', created);
});
test('mock rejeita campos extras, valores inválidos e rota fora do contrato', async () => {
  const token = await authorizeMock();
  const response = await fetch(`${apiBaseUrl}/produtos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      nome: 'X',
      categoria: 'Casa',
      descricao: 'X',
      preco_centavos: '1',
      quantidade_estoque: 0,
      imagem_url: 'https://u:p@example.com/a.png',
      total: 10,
    }),
  });
  expect(response.status).toBe(400);
  const body = await response.json();
  matches('ErrorResponseDto', body);
  expect(body.error.code).toBe('VALIDACAO_INVALIDA');
  expect(
    (await fetch(`${apiBaseUrl}/produtos?preco_min_centavos=100&preco_max_centavos=1`)).status,
  ).toBe(400);
  expect((await fetch(`${apiBaseUrl}/inexistente`)).status).toBe(404);
});

test('mock repete o mesmo pedido por chave e rejeita payload diferente ou chave inválida', async () => {
  const products = await listProducts(defaultFilters);
  const product = products.data.find((value) => value.quantidade_estoque > 1)!;
  const key = window.crypto.randomUUID();
  const send = (quantity: number, idempotencyKey = key) =>
    fetch(`${apiBaseUrl}/pedidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        produtos: [{ produto_id: product.id, quantidade: quantity }],
        status: 'Pendente',
      }),
    });
  const first = await send(1);
  const order = await first.json();
  matches('PedidoResponseDto', order);
  expect(first.status).toBe(201);
  expect(first.headers.get('Idempotency-Replayed')).toBe('false');
  const replay = await send(1);
  expect(replay.status).toBe(201);
  expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
  expect(await replay.json()).toEqual(order);
  const conflicting = await send(2);
  expect(conflicting.status).toBe(409);
  const body = await conflicting.json();
  matches('ErrorResponseDto', body);
  expect(body.error.code).toBe('CHAVE_IDEMPOTENCIA_CONFLITANTE');
  expect((await send(1, 'invalida')).status).toBe(400);
});
