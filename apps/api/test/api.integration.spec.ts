import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { databaseOptions } from '../src/database/data-source';
import { randomUUID } from 'node:crypto';
import { authEmail, authPassword, configureAuthTests } from './auth-fixture';

const databaseUrl = process.env.TEST_DATABASE_URL;
// Explicit opt-in and a dedicated database are mandatory: never clean the development database.
if (!databaseUrl)
  throw new Error(
    'Defina TEST_DATABASE_URL para executar a integração PostgreSQL. O banco precisa ter sufixo _test.',
  );
if (!decodeURIComponent(new URL(databaseUrl).pathname).endsWith('_test'))
  throw new Error('TEST_DATABASE_URL precisa apontar para banco com sufixo _test.');
describe('API + PostgreSQL — integração e concorrência', () => {
  let app: INestApplication;
  let source: DataSource;
  let adminToken: string;
  const api = () => {
    const client = request(app.getHttpServer());
    const authorize = (test: request.Test) => test.set('Authorization', `Bearer ${adminToken}`);
    return {
      get: (url: string) => authorize(client.get(url)),
      post: (url: string) => authorize(client.post(url)),
      patch: (url: string) => authorize(client.patch(url)),
      put: (url: string) => authorize(client.put(url)),
      delete: (url: string) => authorize(client.delete(url)),
      options: (url: string) => authorize(client.options(url)),
    };
  };
  const payload = (overrides: Record<string, unknown> = {}) => ({
    nome: 'Produto de teste',
    categoria: 'Teste',
    descricao: 'Descrição do produto',
    preco_centavos: 1999,
    quantidade_estoque: 10,
    ...overrides,
  });
  const create = async (overrides: Record<string, unknown> = {}) => {
    const response = await api().post('/api/v1/produtos').send(payload(overrides)).expect(201);
    expect(response.headers.location).toBe(`/api/v1/produtos/${response.body.id}`);
    return response.body;
  };
  beforeAll(async () => {
    configureAuthTests();
    if (!databaseUrl || !decodeURIComponent(new URL(databaseUrl).pathname).endsWith('_test'))
      throw new Error('TEST_DATABASE_URL precisa apontar para banco com sufixo _test.');
    process.env.DATABASE_URL = databaseUrl;
    source = new DataSource({ ...databaseOptions(), url: databaseUrl } as ReturnType<
      typeof databaseOptions
    >);
    await source.initialize();
    await source.runMigrations();
    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    setupApp(app);
    await app.init();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: authEmail, password: authPassword })
      .expect(200);
    adminToken = login.body.access_token;
  });
  beforeEach(async () => {
    await source.query(
      'TRUNCATE TABLE pedido_idempotencia, itens_pedido, pedidos, produtos CASCADE',
    );
  });
  afterAll(async () => {
    await app?.close();
    if (source?.isInitialized) await source.destroy();
  });
  it('expõe health, documentação e identificador correlacionável', async () => {
    const response = await api().get('/api/v1/health/ready').expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[\da-f-]{36}$/);
    expect(response.body.database).toBe('ok');
    await api().get('/api/v1/health/live').expect(200);
    const docs = await api().get('/docs-json').expect(200);
    expect(docs.body.paths['/api/v1/produtos']).toBeDefined();
  });
  it('mantém catálogo e pendente públicos sem permitir escrita administrativa ou leitura de pedidos', async () => {
    const product = await create({ quantidade_estoque: 5 });
    const guest = () => request(app.getHttpServer());
    await guest().get('/api/v1/produtos').expect(200);
    await guest().post('/api/v1/produtos').send(payload()).expect(401);
    const body = { produtos: [{ produto_id: product.id, quantidade: 1 }] };
    await guest()
      .post('/api/v1/pedidos')
      .send({ ...body, status: 'Concluído' })
      .expect(401);
    expect(await source.query('SELECT count(*)::int AS total FROM pedidos')).toEqual([
      { total: 0 },
    ]);
    const order = await guest().post('/api/v1/pedidos').send(body).expect(201);
    await guest().get('/api/v1/pedidos').expect(401);
    await guest().get(`/api/v1/pedidos/${order.body.id}`).expect(401);
    await guest()
      .patch(`/api/v1/pedidos/${order.body.id}/status`)
      .send({ status: 'Concluído' })
      .expect(401);
    await guest()
      .post('/api/v1/pedidos')
      .set('Authorization', 'Bearer inválido')
      .send(body)
      .expect(401);
    expect((await api().get(`/api/v1/produtos/${product.id}`)).body.quantidade_estoque).toBe(5);
    expect((await api().get('/api/v1/pedidos')).body.meta.total).toBe(1);
  });
  it('rejeita campos extras, decimais, números como texto, UUID inválido e cancelamento na criação', async () => {
    for (const invalid of [
      { preco_centavos: 1.1 },
      { preco_centavos: '100' },
      { quantidade_estoque: -1 },
      { nome: '   ' },
      { nome: null },
      { extra: true },
      { imagem_url: 'javascript:alert(1)' },
      { imagem_url: 'https://user:pass@example.com/image.png' },
    ]) {
      const response = await api().post('/api/v1/produtos').send(payload(invalid)).expect(400);
      expect(response.body.error.code).toBe('VALIDACAO_INVALIDA');
      expect(response.body.error.request_id).toBe(response.headers['x-request-id']);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: expect.any(String), reason: expect.any(String) }),
        ]),
      );
    }
    await api().get('/api/v1/produtos/invalid').expect(400);
    await api().post('/api/v1/pedidos').send({ produtos: [], status: 'Cancelado' }).expect(400);
    const malformed = await api()
      .post('/api/v1/produtos')
      .set('Content-Type', 'application/json')
      .send('{broken')
      .expect(400);
    expect(malformed.body.error.code).toBe('VALIDACAO_INVALIDA');
    await api()
      .post('/api/v1/produtos')
      .send(payload({ descricao: 'x'.repeat(110000) }))
      .expect(413);
  });
  it('rejeita arrays aninhados nos itens e status null com erro de validação', async () => {
    const item = { produto_id: randomUUID(), quantidade: 1 };
    for (const invalid of [
      { produtos: [[]] },
      { produtos: [[item]] },
      { produtos: [null] },
      { produtos: null },
      { produtos: [item], status: null },
    ]) {
      const response = await api().post('/api/v1/pedidos').send(invalid).expect(400);
      expect(response.body.error.code).toBe('VALIDACAO_INVALIDA');
      expect(response.body.error.details.length).toBeGreaterThan(0);
    }
    expect((await api().get('/api/v1/pedidos')).body.meta.total).toBe(0);
  });
  it('executa CRUD com soft delete e não retorna o marcador interno', async () => {
    const product = await create({ preco_centavos: 0 });
    expect(product.created_at).toBeDefined();
    expect(product.excluido_em).toBeUndefined();
    const patched = await api()
      .patch(`/api/v1/produtos/${product.id}`)
      .send({ nome: 'Atualizado', imagem_url: null })
      .expect(200);
    expect(patched.body.nome).toBe('Atualizado');
    await api().patch(`/api/v1/produtos/${product.id}`).send({ preco_centavos: null }).expect(400);
    await api().patch(`/api/v1/produtos/${product.id}`).send({}).expect(400);
    await api().delete(`/api/v1/produtos/${product.id}`).expect(204);
    await api().get(`/api/v1/produtos/${product.id}`).expect(404);
    expect(
      (await source.query('SELECT excluido_em FROM produtos WHERE id = $1', [product.id]))[0]
        .excluido_em,
    ).not.toBeNull();
  });
  it('busca literal case insensitive, filtra preços e pagina com ordenação determinística', async () => {
    await create({ nome: '100% Natural', preco_centavos: 500 });
    await create({ nome: '100x Natural', preco_centavos: 700 });
    await create({ nome: 'beta', preco_centavos: 900 });
    const search = await api()
      .get('/api/v1/produtos')
      .query({ nome: '100%', ordenar: 'nome' })
      .expect(200);
    expect(search.body.data).toHaveLength(1);
    const filtered = await api()
      .get('/api/v1/produtos')
      .query({
        preco_min_centavos: 600,
        preco_max_centavos: 900,
        ordenar: 'preco',
        direcao: 'asc',
        limite: 1,
      })
      .expect(200);
    expect(filtered.body.data[0].preco_centavos).toBe(700);
    expect(filtered.body.meta).toEqual({ pagina: 1, limite: 1, total: 2, total_paginas: 2 });
    await api()
      .get('/api/v1/produtos')
      .query({ preco_min_centavos: 1000, preco_max_centavos: 1 })
      .expect(400);
  });
  it('valida estoque pendente sem reservar e calcula o total com preços do servidor', async () => {
    const product = await create({ quantidade_estoque: 3 });
    const response = await api()
      .post('/api/v1/pedidos')
      .send({ produtos: [{ produto_id: product.id, quantidade: 2 }] })
      .expect(201);
    expect(response.body.total_pedido_centavos).toBe(3998);
    expect(response.body.produtos[0]).toMatchObject({
      produto_id: product.id,
      nome_produto: product.nome,
      preco_unitario_centavos: 1999,
      subtotal_centavos: 3998,
    });
    expect((await api().get(`/api/v1/produtos/${product.id}`)).body.quantidade_estoque).toBe(3);
    await api()
      .post('/api/v1/pedidos')
      .send({ produtos: [{ produto_id: product.id, quantidade: 4 }] })
      .expect(409);
    await api()
      .post('/api/v1/pedidos')
      .send({ produtos: [{ produto_id: product.id, quantidade: 1 }], total_pedido_centavos: 1 })
      .expect(400);
    await api()
      .post('/api/v1/pedidos')
      .send({
        produtos: [
          { produto_id: product.id, quantidade: 1 },
          { produto_id: product.id.toUpperCase(), quantidade: 1 },
        ],
      })
      .expect(400);
  });
  it('combina categoria exata, busca e faixa de preço sem incluir outras categorias', async () => {
    const selected = await create({
      nome: 'Papel Report A4',
      categoria: 'Papel para imprimir',
      preco_centavos: 2990,
    });
    await create({
      nome: 'Papel Report A3',
      categoria: 'Papel para imprimir',
      preco_centavos: 5990,
    });
    await create({ nome: 'Papel Report A4', categoria: 'Embalagens', preco_centavos: 2990 });
    const filtered = await api()
      .get('/api/v1/produtos')
      .query({
        categoria: 'Papel para imprimir',
        nome: 'report',
        preco_min_centavos: 2000,
        preco_max_centavos: 4000,
      })
      .expect(200);
    expect(filtered.body.data.map((product: { id: string }) => product.id)).toEqual([selected.id]);
    expect(filtered.body.meta.total).toBe(1);
    const partial = await api().get('/api/v1/produtos').query({ categoria: 'Papel' }).expect(200);
    expect(partial.body.data).toEqual([]);
    const caseSensitive = await api()
      .get('/api/v1/produtos')
      .query({ categoria: 'papel para imprimir' })
      .expect(200);
    expect(caseSensitive.body.data).toEqual([]);
    await api().get('/api/v1/produtos').query({ categoria: '   ' }).expect(400);
    await api()
      .get('/api/v1/produtos')
      .query({ categoria: 'x'.repeat(81) })
      .expect(400);
  });
  it('rejeita checkout com estoque insuficiente sem criar pedido nem reservar os demais itens', async () => {
    const available = await create({ quantidade_estoque: 8 });
    const scarce = await create({ quantidade_estoque: 1 });
    const response = await api()
      .post('/api/v1/pedidos')
      .send({
        status: 'Pendente',
        produtos: [
          { produto_id: available.id, quantidade: 2 },
          { produto_id: scarce.id, quantidade: 2 },
        ],
      })
      .expect(409);
    expect(response.body.error.code).toBe('ESTOQUE_INSUFICIENTE');
    expect((await api().get(`/api/v1/produtos/${available.id}`)).body.quantidade_estoque).toBe(8);
    expect((await api().get(`/api/v1/produtos/${scarce.id}`)).body.quantidade_estoque).toBe(1);
    expect((await api().get('/api/v1/pedidos')).body.meta.total).toBe(0);
  });
  it('mantém snapshots ao editar/excluir produto e cancela sem devolver estoque', async () => {
    const product = await create();
    const order = (
      await api()
        .post('/api/v1/pedidos')
        .send({ produtos: [{ produto_id: product.id, quantidade: 2 }] })
        .expect(201)
    ).body;
    await api()
      .patch(`/api/v1/produtos/${product.id}`)
      .send({ preco_centavos: 9000, nome: 'Novo nome' })
      .expect(200);
    await api().delete(`/api/v1/produtos/${product.id}`).expect(204);
    const history = await api().get(`/api/v1/pedidos/${order.id}`).expect(200);
    expect(history.body.total_pedido_centavos).toBe(3998);
    expect(history.body.produtos[0].nome_produto).toBe(product.nome);
    const failed = await api()
      .patch(`/api/v1/pedidos/${order.id}/status`)
      .send({ status: 'Concluído' })
      .expect(409);
    expect(failed.body.error.code).toBe('PRODUTO_INDISPONIVEL');
    await api()
      .patch(`/api/v1/pedidos/${order.id}/status`)
      .send({ status: 'Cancelado' })
      .expect(200);
    await api()
      .patch(`/api/v1/pedidos/${order.id}/status`)
      .send({ status: 'Cancelado' })
      .expect(200);
    await api()
      .patch(`/api/v1/pedidos/${order.id}/status`)
      .send({ status: 'Concluído' })
      .expect(409);
  });
  it('duas compras concorrentes disputando a última unidade deixam uma única vencedora', async () => {
    const product = await create({ quantidade_estoque: 1 });
    const body = { status: 'Concluído', produtos: [{ produto_id: product.id, quantidade: 1 }] };
    // Hold the winning transaction open so the other request contends for the row lock.
    await source.query(
      `CREATE OR REPLACE FUNCTION test_delay_stock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.15); RETURN NEW; END; $$`,
    );
    await source.query(
      'CREATE TRIGGER test_delay_stock_trigger BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION test_delay_stock()',
    );
    try {
      const responses = await Promise.all([
        api().post('/api/v1/pedidos').send(body),
        api().post('/api/v1/pedidos').send(body),
      ]);
      expect(responses.map((value) => value.status).sort()).toEqual([201, 409]);
      expect((await api().get(`/api/v1/produtos/${product.id}`)).body.quantidade_estoque).toBe(0);
      expect((await source.query('SELECT count(*)::integer AS count FROM pedidos'))[0].count).toBe(
        1,
      );
    } finally {
      await source.query('DROP TRIGGER test_delay_stock_trigger ON produtos');
      await source.query('DROP FUNCTION test_delay_stock()');
    }
  });
  it('duas conclusões simultâneas do mesmo pedido baixam estoque uma vez', async () => {
    const product = await create({ quantidade_estoque: 5 });
    const order = (
      await api()
        .post('/api/v1/pedidos')
        .send({ produtos: [{ produto_id: product.id, quantidade: 2 }] })
        .expect(201)
    ).body;
    const responses = await Promise.all([
      api().patch(`/api/v1/pedidos/${order.id}/status`).send({ status: 'Concluído' }),
      api().patch(`/api/v1/pedidos/${order.id}/status`).send({ status: 'Concluído' }),
    ]);
    expect(responses.map((value) => value.status)).toEqual([200, 200]);
    expect((await api().get(`/api/v1/produtos/${product.id}`)).body.quantidade_estoque).toBe(3);
  });
  it('repete a resposta original mesmo após alterar produtos e concluir o pedido', async () => {
    const product = await create({ quantidade_estoque: 2 });
    const second = await create({ quantidade_estoque: 3 });
    const key = randomUUID();
    const body = {
      produtos: [
        { produto_id: product.id, quantidade: 2 },
        { produto_id: second.id, quantidade: 1 },
      ],
    };
    const first = await api()
      .post('/api/v1/pedidos')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    expect(first.headers['idempotency-replayed']).toBe('false');
    await api()
      .patch(`/api/v1/produtos/${product.id}`)
      .send({ preco_centavos: 9000, nome: 'Nome alterado' })
      .expect(200);
    await api()
      .patch(`/api/v1/pedidos/${first.body.id}/status`)
      .send({ status: 'Concluído' })
      .expect(200);
    const replay = await api()
      .post('/api/v1/pedidos')
      .set('Idempotency-Key', key.toUpperCase())
      .send({ status: 'Pendente', produtos: [...body.produtos].reverse() })
      .expect(201);
    expect(replay.body).toEqual(first.body);
    expect(replay.headers.location).toBe(first.headers.location);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect((await api().get(`/api/v1/pedidos/${first.body.id}`)).body.status).toBe('Concluído');
    expect((await api().get(`/api/v1/produtos/${product.id}`)).body.quantidade_estoque).toBe(0);
    expect((await api().get('/api/v1/pedidos')).body.meta.total).toBe(1);
  });
  it('rejeita reutilizar uma chave com produtos, quantidade ou status diferentes', async () => {
    const product = await create({ quantidade_estoque: 5 });
    const second = await create({ quantidade_estoque: 5 });
    const key = randomUUID();
    await api()
      .post('/api/v1/pedidos')
      .set('Idempotency-Key', key)
      .send({ produtos: [{ produto_id: product.id, quantidade: 1 }] })
      .expect(201);
    for (const changed of [
      { produtos: [{ produto_id: product.id, quantidade: 2 }] },
      { produtos: [{ produto_id: second.id, quantidade: 1 }] },
      { status: 'Concluído', produtos: [{ produto_id: product.id, quantidade: 1 }] },
    ]) {
      const response = await api()
        .post('/api/v1/pedidos')
        .set('Idempotency-Key', key)
        .send(changed)
        .expect(409);
      expect(response.body.error.code).toBe('CHAVE_IDEMPOTENCIA_CONFLITANTE');
    }
    expect((await api().get('/api/v1/pedidos')).body.meta.total).toBe(1);
    expect((await api().get(`/api/v1/produtos/${product.id}`)).body.quantidade_estoque).toBe(5);
  });
  it('duas requisições concorrentes com a mesma chave criam e baixam estoque uma única vez', async () => {
    const product = await create({ quantidade_estoque: 1 });
    const key = randomUUID();
    const body = { status: 'Concluído', produtos: [{ produto_id: product.id, quantidade: 1 }] };
    await source.query(
      `CREATE OR REPLACE FUNCTION test_delay_stock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.15); RETURN NEW; END; $$`,
    );
    await source.query(
      'CREATE TRIGGER test_delay_stock_trigger BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION test_delay_stock()',
    );
    try {
      const responses = await Promise.all([
        api().post('/api/v1/pedidos').set('Idempotency-Key', key).send(body),
        api().post('/api/v1/pedidos').set('Idempotency-Key', key).send(body),
      ]);
      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      expect(responses.map((response) => response.headers['idempotency-replayed']).sort()).toEqual([
        'false',
        'true',
      ]);
      expect(responses[0].body).toEqual(responses[1].body);
      expect((await api().get(`/api/v1/produtos/${product.id}`)).body.quantidade_estoque).toBe(0);
      expect((await source.query('SELECT count(*)::integer AS count FROM pedidos'))[0].count).toBe(
        1,
      );
      expect(
        (await source.query('SELECT count(*)::integer AS count FROM pedido_idempotencia'))[0].count,
      ).toBe(1);
    } finally {
      await source.query('DROP TRIGGER test_delay_stock_trigger ON produtos');
      await source.query('DROP FUNCTION test_delay_stock()');
    }
  });
  it('não consome a chave em erro de estoque e permite corrigir e tentar novamente', async () => {
    const product = await create({ quantidade_estoque: 0 });
    const key = randomUUID();
    const body = { produtos: [{ produto_id: product.id, quantidade: 1 }] };
    await api().post('/api/v1/pedidos').set('Idempotency-Key', key).send(body).expect(409);
    expect(
      (await source.query('SELECT count(*)::integer AS count FROM pedido_idempotencia'))[0].count,
    ).toBe(0);
    await api().patch(`/api/v1/produtos/${product.id}`).send({ quantidade_estoque: 1 }).expect(200);
    const success = await api()
      .post('/api/v1/pedidos')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    expect(success.headers['idempotency-replayed']).toBe('false');
    expect((await api().get('/api/v1/pedidos')).body.meta.total).toBe(1);
  });
  it('valida o cabeçalho e permite Idempotency-Key no preflight CORS', async () => {
    const product = await create();
    const body = { produtos: [{ produto_id: product.id, quantidade: 1 }] };
    for (const invalid of ['', 'invalid-key', `${randomUUID()},${randomUUID()}`]) {
      await api().post('/api/v1/pedidos').set('Idempotency-Key', invalid).send(body).expect(400);
    }
    expect((await api().get('/api/v1/pedidos')).body.meta.total).toBe(0);
    const response = await api()
      .options('/api/v1/pedidos')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key')
      .expect(204);
    expect(response.headers['access-control-allow-headers'].toLowerCase()).toContain(
      'idempotency-key',
    );
  });
  it('faz rollback de toda a baixa de estoque se persistir pedido falhar', async () => {
    const product = await create({ quantidade_estoque: 5 });
    const second = await create({ quantidade_estoque: 7 });
    const key = randomUUID();
    const body = {
      status: 'Concluído',
      produtos: [
        { produto_id: product.id, quantidade: 2 },
        { produto_id: second.id, quantidade: 3 },
      ],
    };
    await source.query(
      `CREATE OR REPLACE FUNCTION test_reject_order() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected test failure'; END; $$`,
    );
    await source.query(
      'CREATE TRIGGER test_reject_order_trigger BEFORE INSERT ON pedidos FOR EACH ROW EXECUTE FUNCTION test_reject_order()',
    );
    try {
      await api().post('/api/v1/pedidos').set('Idempotency-Key', key).send(body).expect(500);
      expect((await api().get(`/api/v1/produtos/${product.id}`)).body.quantidade_estoque).toBe(5);
      expect((await api().get(`/api/v1/produtos/${second.id}`)).body.quantidade_estoque).toBe(7);
      expect((await source.query('SELECT count(*)::integer AS count FROM pedidos'))[0].count).toBe(
        0,
      );
      expect(
        (await source.query('SELECT count(*)::integer AS count FROM pedido_idempotencia'))[0].count,
      ).toBe(0);
    } finally {
      await source.query('DROP TRIGGER test_reject_order_trigger ON pedidos');
      await source.query('DROP FUNCTION test_reject_order()');
    }
    await api().post('/api/v1/pedidos').set('Idempotency-Key', key).send(body).expect(201);
    expect((await api().get(`/api/v1/produtos/${product.id}`)).body.quantidade_estoque).toBe(3);
    expect((await api().get(`/api/v1/produtos/${second.id}`)).body.quantidade_estoque).toBe(4);
  });
});
