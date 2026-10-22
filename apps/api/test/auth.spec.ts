import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import request from 'supertest';
import { setupApp } from '../src/app.setup';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { ADMIN_ID, JWT_AUDIENCE, JWT_ISSUER, readAuthConfig } from '../src/auth/auth.config';
import { LoginRateLimiter, LOGIN_RATE_MAX_IPS } from '../src/auth/login-rate-limit';
import { ProdutosController } from '../src/produtos/produtos.controller';
import { ProdutosService } from '../src/produtos/produtos.service';
import { PedidosController } from '../src/pedidos/pedidos.controller';
import { PedidosService } from '../src/pedidos/pedidos.service';
import { authEmail, authPassword, authSecret, configureAuthTests } from './auth-fixture';

const jwt = new JwtService();
function token(overrides: Record<string, unknown> = {}, options: JwtSignOptions = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = Object.fromEntries(
    Object.entries({
      sub: ADMIN_ID,
      email: authEmail,
      role: 'admin',
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      iat: now,
      exp: now + 900,
      ...overrides,
    }).filter(([, value]) => value !== undefined),
  );
  return jwt.signAsync(claims, { secret: authSecret, algorithm: 'HS256', ...options });
}
describe('JWT e configuração de autenticação', () => {
  let auth: AuthService;
  beforeAll(() => {
    configureAuthTests();
    auth = new AuthService(jwt, readAuthConfig());
  });
  it('emite token curto e aceita apenas sua identidade administrativa', async () => {
    const result = await auth.login(authEmail, authPassword);
    expect(result).toMatchObject({
      token_type: 'Bearer',
      expires_in: 900,
      user: { id: ADMIN_ID, email: authEmail, role: 'admin' },
    });
    expect(await auth.authenticate(`Bearer ${result.access_token}`)).toEqual(result.user);
    const decoded = jwt.decode(result.access_token);
    expect(decoded.exp - decoded.iat).toBe(900);
    expect(result).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('passwordSalt');
  });
  it.each([
    { email: 'outro@example.com', password: authPassword },
    { email: authEmail, password: 'incorreta' },
  ])('retorna erro genérico para credenciais incorretas', async (value) => {
    await expect(auth.login(value.email, value.password)).rejects.toMatchObject({
      message: 'Email ou senha inválidos.',
    });
  });
  it.each([undefined, '', 'Basic abc', 'Bearer inválido', 'Bearer a.b.', ['Bearer a.b.c']])(
    'rejeita cabeçalho ausente ou malformado',
    async (header) => {
      await expect(auth.authenticate(header)).rejects.toMatchObject({
        message: 'Não autorizado. Faça login novamente.',
      });
    },
  );
  it.each([
    { exp: 1 },
    { iss: 'outro-emissor' },
    { aud: 'outro-cliente' },
    { sub: 'outro-admin' },
    { role: 'cliente' },
    { email: 'outro@example.com' },
    { exp: Math.floor(Date.now() / 1000) + 3600 },
    { iat: Math.floor(Date.now() / 1000) + 60 },
  ])('rejeita claims fora do contrato administrativo: %j', async (claims) => {
    await expect(auth.authenticate(`Bearer ${await token(claims)}`)).rejects.toMatchObject({
      message: 'Não autorizado. Faça login novamente.',
    });
  });
  it('rejeita assinatura alterada, outra chave, algoritmo alternativo e token sem expiração', async () => {
    const parts = (await token()).split('.');
    parts[2] = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
    for (const value of [
      parts.join('.'),
      await token({}, { secret: 'outra-chave-comprida-de-teste' }),
      await token({}, { algorithm: 'HS384' }),
      await token({ exp: undefined }),
      await token({}, { noTimestamp: true }),
    ]) {
      await expect(auth.authenticate(`Bearer ${value}`)).rejects.toBeDefined();
    }
  });
  it('falha sem configuração válida, sem substituir por segredo padrão', () => {
    for (const changes of [
      { JWT_SECRET: undefined },
      { JWT_SECRET: 'curto' },
      { AUTH_ADMIN_EMAIL: 'inválido' },
      { AUTH_ADMIN_PASSWORD_HASH: 'senha-aberta' },
    ]) {
      expect(() => readAuthConfig({ ...process.env, ...changes })).toThrow();
    }
  });
});

describe('Limites de tentativas de login', () => {
  it('bloqueia a sexta tentativa e libera após a janela de um minuto', () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 5; i++) expect(limiter.consume('ip', 1000)).toBeUndefined();
    expect(limiter.consume('ip', 1000)).toBe(60);
    expect(limiter.consume('ip', 61000)).toBeUndefined();
  });
  it('limita a memória sem descartar bloqueios ativos e expira os registros', () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < LOGIN_RATE_MAX_IPS; i++)
      expect(limiter.consume(`ip${i}`, 0)).toBeUndefined();
    expect(limiter.consume('extra', 0)).toBe(60);
    expect(limiter.consume('extra', 60000)).toBeUndefined();
  });
});

@Module({
  imports: [AuthModule],
  controllers: [ProdutosController, PedidosController],
  providers: [
    {
      provide: ProdutosService,
      useValue: { list: () => ({ data: [] }), create: () => ({ id: ADMIN_ID }) },
    },
    {
      provide: PedidosService,
      useValue: {
        list: () => ({ data: [] }),
        create: () => ({
          replayed: false,
          pedido: {
            id: ADMIN_ID,
            status: 'Pendente',
            total_pedido_centavos: 1,
            itens: [],
            created_at: new Date(),
            updated_at: new Date(),
          },
        }),
      },
    },
  ],
})
class AuthHttpModule {}
describe('Fronteira HTTP pública e administrativa', () => {
  let app: INestApplication;
  let bearer: string;
  const api = () => request(app.getHttpServer());
  const order = {
    produtos: [{ produto_id: '10000000-0000-4000-8000-000000000001', quantidade: 1 }],
  };
  beforeAll(async () => {
    configureAuthTests();
    app = await NestFactory.create(AuthHttpModule, { logger: false, bodyParser: false });
    setupApp(app);
    await app.init();
    bearer = await token();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('login normaliza email, impede cache e me exige assinatura válida', async () => {
    const result = await api()
      .post('/api/v1/auth/login')
      .send({ email: authEmail.toUpperCase(), password: authPassword })
      .expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    const me = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${result.body.access_token}`)
      .expect(200);
    expect(me.body).toEqual({ id: ADMIN_ID, email: authEmail, role: 'admin' });
    expect(me.headers['cache-control']).toBe('no-store');
    await api().get('/api/v1/auth/me').expect(401);
  });
  it('protege todos os caminhos administrativos antes de executar regras de negócio', async () => {
    await api().get('/api/v1/produtos').expect(200);
    for (const response of [
      () => api().post('/api/v1/produtos').send({}),
      () => api().patch(`/api/v1/produtos/${ADMIN_ID}`).send({}),
      () => api().put(`/api/v1/produtos/${ADMIN_ID}`).send({}),
      () => api().delete(`/api/v1/produtos/${ADMIN_ID}`),
      () => api().get('/api/v1/pedidos'),
      () => api().get(`/api/v1/pedidos/${ADMIN_ID}`),
      () => api().patch(`/api/v1/pedidos/${ADMIN_ID}/status`).send({ status: 'Concluído' }),
    ]) {
      const result = await response().expect(401);
      expect(result.body.error.code).toBe('NAO_AUTORIZADO');
    }
    await api().get('/api/v1/pedidos').set('Authorization', `Bearer ${bearer}`).expect(200);
  });
  it('permite checkout pendente público e impede concluir sem JWT ou informar token inválido', async () => {
    await api().post('/api/v1/pedidos').send(order).expect(201);
    await api()
      .post('/api/v1/pedidos')
      .send({ ...order, status: 'Concluído' })
      .expect(401);
    await api()
      .post('/api/v1/pedidos')
      .set('Authorization', 'Bearer inválido')
      .send(order)
      .expect(401);
    await api()
      .post('/api/v1/pedidos')
      .set('Authorization', `Bearer ${bearer}`)
      .send({ ...order, status: 'Concluído' })
      .expect(201);
  });
  it('permite Authorization no preflight e responde Retry-After ao bloquear login', async () => {
    const preflight = await api()
      .options('/api/v1/produtos')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    expect(preflight.headers['access-control-allow-headers'].toLowerCase()).toContain(
      'authorization',
    );
    const spy = jest.spyOn(app.get(LoginRateLimiter), 'consume').mockReturnValueOnce(12);
    try {
      const result = await api()
        .post('/api/v1/auth/login')
        .send({ email: authEmail, password: authPassword })
        .expect(429);
      expect(result.headers['retry-after']).toBe('12');
    } finally {
      spy.mockRestore();
    }
  });
});
