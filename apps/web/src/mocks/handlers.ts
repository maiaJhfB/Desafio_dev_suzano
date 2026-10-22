import { http, HttpResponse, delay } from 'msw';
import { z } from 'zod';
import { apiBaseUrl } from '@/lib/api';
import { seedProducts } from './data';
import type { Produto } from '@/lib/types';
import type { Order } from '@/lib/orders';

let products: Produto[] = structuredClone(seedProducts);
const orders = new Map<string, Order>();
const orderAttempts = new Map<string, { signature: string; order: Order }>();
export const mockAdminCredentials = { email: 'admin@suzano.local', password: 'SuzanoDemo!2026' };
const adminTokens = new Map<string, number>();
let loginAttempts = { count: 0, resetAt: 0 };
const adminUser = {
  id: '20000000-0000-4000-8000-000000000001',
  email: mockAdminCredentials.email,
  role: 'admin' as const,
};
function isAdmin(request: Request): boolean {
  const token = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
  return !!token && (adminTokens.get(token) ?? 0) > Date.now();
}
function unauthorized() {
  return HttpResponse.json(
    {
      error: {
        code: 'NAO_AUTORIZADO',
        message: 'Não autorizado. Faça login novamente.',
        details: [],
        request_id: crypto.randomUUID(),
      },
    },
    { status: 401 },
  );
}
export function resetMockProducts(): void {
  products = structuredClone(seedProducts);
  orders.clear();
  orderAttempts.clear();
  adminTokens.clear();
  loginAttempts = { count: 0, resetAt: 0 };
}
const optionalCents = z.coerce.number().int().min(0).max(100000000).optional();
const querySchema = z
  .object({
    nome: z.string().trim().max(120).optional(),
    categoria: z.string().trim().min(1).max(80).optional(),
    preco_min_centavos: optionalCents,
    preco_max_centavos: optionalCents,
    ordenar: z.enum(['nome', 'preco', 'criado_em']).default('criado_em'),
    direcao: z.enum(['asc', 'desc']).default('desc'),
    pagina: z.coerce.number().int().min(1).max(1000000).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(12),
  })
  .strict()
  .refine(
    (value) =>
      value.preco_min_centavos === undefined ||
      value.preco_max_centavos === undefined ||
      value.preco_min_centavos <= value.preco_max_centavos,
    'Faixa de preço inválida.',
  );
const createSchema = z
  .object({
    nome: z.string().trim().min(1).max(120),
    categoria: z.string().trim().min(1).max(80),
    descricao: z.string().trim().min(1).max(2000),
    preco_centavos: z.number().int().min(0).max(100000000),
    quantidade_estoque: z.number().int().min(0).max(1000000),
    imagem_url: z
      .string()
      .max(2048)
      .url()
      .refine((value) => {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
      })
      .nullable()
      .optional(),
  })
  .strict();
function invalid(details: { field: string; reason: string }[]) {
  return HttpResponse.json(
    {
      error: {
        code: 'VALIDACAO_INVALIDA',
        message: 'Confira os dados informados.',
        details,
        request_id: crypto.randomUUID(),
      },
    },
    { status: 400 },
  );
}
export const handlers = [
  http.post(`${apiBaseUrl}/auth/login`, async ({ request }) => {
    const now = Date.now();
    if (loginAttempts.resetAt <= now) loginAttempts = { count: 0, resetAt: now + 60000 };
    if (loginAttempts.count >= 5)
      return HttpResponse.json(
        {
          error: {
            code: 'LIMITE_TENTATIVAS',
            message: 'Muitas tentativas de login. Tente novamente mais tarde.',
            details: [],
            request_id: crypto.randomUUID(),
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, Math.ceil((loginAttempts.resetAt - now) / 1000))),
          },
        },
      );
    loginAttempts.count++;
    const input = z
      .object({
        email: z.string().trim().toLowerCase().email().max(254),
        password: z.string().min(1).max(1024),
      })
      .strict()
      .safeParse(await request.json().catch(() => null));
    if (!input.success)
      return invalid([{ field: 'request', reason: 'Informe e-mail e senha válidos.' }]);
    if (
      input.data.email !== mockAdminCredentials.email ||
      input.data.password !== mockAdminCredentials.password
    )
      return HttpResponse.json(
        {
          error: {
            code: 'CREDENCIAIS_INVALIDAS',
            message: 'Email ou senha inválidos.',
            details: [],
            request_id: crypto.randomUUID(),
          },
        },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    const access_token = `mock-admin-${crypto.randomUUID()}`;
    adminTokens.set(access_token, now + 900000);
    return HttpResponse.json(
      { access_token, token_type: 'Bearer', expires_in: 900, user: adminUser },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }),
  http.get(`${apiBaseUrl}/auth/me`, ({ request }) =>
    isAdmin(request)
      ? HttpResponse.json(adminUser, { headers: { 'Cache-Control': 'no-store' } })
      : unauthorized(),
  ),
  http.get(`${apiBaseUrl}/produtos`, async ({ request }) => {
    await delay(160);
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success)
      return invalid(
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          reason: issue.message,
        })),
      );
    const filters = parsed.data;
    const matching = products.filter(
      (product) =>
        (!filters.categoria || product.categoria === filters.categoria) &&
        product.nome
          .toLocaleLowerCase('pt-BR')
          .includes((filters.nome ?? '').toLocaleLowerCase('pt-BR')) &&
        (filters.preco_min_centavos === undefined ||
          product.preco_centavos >= filters.preco_min_centavos) &&
        (filters.preco_max_centavos === undefined ||
          product.preco_centavos <= filters.preco_max_centavos),
    );
    matching.sort((a, b) => {
      let comparison: number;
      if (filters.ordenar === 'preco') comparison = a.preco_centavos - b.preco_centavos;
      else if (filters.ordenar === 'nome')
        comparison = a.nome
          .toLocaleLowerCase('pt-BR')
          .localeCompare(b.nome.toLocaleLowerCase('pt-BR'), 'pt-BR');
      else comparison = a.created_at.localeCompare(b.created_at);
      return (comparison || a.id.localeCompare(b.id)) * (filters.direcao === 'asc' ? 1 : -1);
    });
    const start = (filters.pagina - 1) * filters.limite;
    return HttpResponse.json({
      data: matching.slice(start, start + filters.limite),
      meta: {
        pagina: filters.pagina,
        limite: filters.limite,
        total: matching.length,
        total_paginas: Math.ceil(matching.length / filters.limite),
      },
    });
  }),
  http.post(`${apiBaseUrl}/produtos`, async ({ request }) => {
    if (!isAdmin(request)) return unauthorized();
    await delay(250);
    let input: unknown;
    try {
      input = await request.json();
    } catch {
      return invalid([{ field: 'request', reason: 'JSON inválido.' }]);
    }
    const parsed = createSchema.safeParse(input);
    if (!parsed.success)
      return invalid(
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          reason: issue.message,
        })),
      );
    const now = new Date().toISOString();
    const product: Produto = {
      ...parsed.data,
      imagem_url: parsed.data.imagem_url ?? null,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    products.unshift(product);
    return HttpResponse.json(product, {
      status: 201,
      headers: { Location: `${apiBaseUrl}/produtos/${product.id}` },
    });
  }),
  http.post(`${apiBaseUrl}/pedidos`, async ({ request }) => {
    await delay(350);
    const schema = z
      .object({
        produtos: z
          .array(
            z
              .object({
                produto_id: z.string().uuid(),
                quantidade: z.number().int().min(1).max(10000),
              })
              .strict(),
          )
          .min(1)
          .max(100),
        status: z.enum(['Pendente', 'Concluído']).default('Pendente'),
      })
      .strict();
    const body = await request.json().catch(() => null);
    if (
      (request.headers.has('Authorization') ||
        (body && typeof body === 'object' && body.status === 'Concluído')) &&
      !isAdmin(request)
    )
      return unauthorized();
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return invalid(
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          reason: issue.message,
        })),
      );
    if (
      new Set(parsed.data.produtos.map((item) => item.produto_id)).size !==
      parsed.data.produtos.length
    )
      return invalid([{ field: 'produtos', reason: 'Não repita produtos no pedido.' }]);
    const key = request.headers.get('Idempotency-Key')?.toLowerCase();
    if (key !== undefined && !z.string().uuid().safeParse(key).success)
      return invalid([{ field: 'Idempotency-Key', reason: 'Use uma chave UUID válida.' }]);
    const signature = JSON.stringify({
      status: parsed.data.status,
      produtos: [...parsed.data.produtos].sort((a, b) => a.produto_id.localeCompare(b.produto_id)),
    });
    const previous = key ? orderAttempts.get(key) : undefined;
    if (previous) {
      if (previous.signature !== signature)
        return HttpResponse.json(
          {
            error: {
              code: 'CHAVE_IDEMPOTENCIA_CONFLITANTE',
              message: 'Esta chave já foi usada para outro pedido.',
              details: [],
              request_id: crypto.randomUUID(),
            },
          },
          { status: 409 },
        );
      return HttpResponse.json(previous.order, {
        status: 201,
        headers: {
          Location: `${apiBaseUrl}/pedidos/${previous.order.id}`,
          'Idempotency-Replayed': 'true',
        },
      });
    }
    for (const item of parsed.data.produtos) {
      const product = products.find((product) => product.id === item.produto_id);
      if (!product || product.quantidade_estoque < item.quantidade)
        return HttpResponse.json(
          {
            error: {
              code: product ? 'ESTOQUE_INSUFICIENTE' : 'PRODUTO_NAO_ENCONTRADO',
              message: product
                ? `Estoque insuficiente para ${product.nome}.`
                : 'Produto indisponível.',
              details: [],
              request_id: crypto.randomUUID(),
            },
          },
          { status: product ? 409 : 404 },
        );
    }
    const entries = parsed.data.produtos.map((item) => {
      const product = products.find((product) => product.id === item.produto_id)!;
      return {
        id: crypto.randomUUID(),
        produto_id: product.id,
        nome_produto: product.nome,
        quantidade: item.quantidade,
        preco_unitario_centavos: product.preco_centavos,
        subtotal_centavos: product.preco_centavos * item.quantidade,
      };
    });
    const now = new Date().toISOString();
    const order: Order = {
      id: crypto.randomUUID(),
      status: parsed.data.status,
      produtos: entries,
      total_pedido_centavos: entries.reduce((sum, item) => sum + item.subtotal_centavos, 0),
      created_at: now,
      updated_at: now,
    };
    if (order.status === 'Concluído')
      for (const item of entries)
        products.find((product) => product.id === item.produto_id)!.quantidade_estoque -=
          item.quantidade;
    orders.set(order.id, order);
    if (key) orderAttempts.set(key, { signature, order });
    return HttpResponse.json(order, {
      status: 201,
      headers: { Location: `${apiBaseUrl}/pedidos/${order.id}`, 'Idempotency-Replayed': 'false' },
    });
  }),
  http.get(`${apiBaseUrl}/pedidos/:id`, ({ params, request }) => {
    if (!isAdmin(request)) return unauthorized();
    const order = orders.get(String(params.id));
    return order
      ? HttpResponse.json(order)
      : HttpResponse.json(
          {
            error: {
              code: 'PEDIDO_NAO_ENCONTRADO',
              message: 'Pedido não encontrado.',
              details: [],
              request_id: crypto.randomUUID(),
            },
          },
          { status: 404 },
        );
  }),
  http.all(`${apiBaseUrl}/*`, () =>
    HttpResponse.json(
      {
        error: {
          code: 'NAO_ENCONTRADO',
          message: 'Rota não implementada na demonstração.',
          details: [],
          request_id: crypto.randomUUID(),
        },
      },
      { status: 404 },
    ),
  ),
];
