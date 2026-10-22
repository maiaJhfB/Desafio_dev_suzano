import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This script only owns a random, disposable project. It never accepts another project name.
if (process.env.CI !== 'true' && !process.argv.includes('--local'))
  throw new Error('Execute o smoke em CI ou use --local para criar um projeto descartável.');
const root = fileURLToPath(new URL('../', import.meta.url));
const project = `suzano-smoke-${randomUUID().slice(0, 8)}`;
const artifacts = path.join(root, 'tmp', 'docker-smoke', project);
const apiOrigin = 'http://127.0.0.1:13001';
const webOrigin = 'http://127.0.0.1:13000';
const adminEmail = 'smoke-admin@suzano.local';
const adminPassword = randomBytes(24).toString('base64url');
const jwtSecret = randomBytes(48).toString('base64url');
const passwordSalt = randomBytes(16);
const passwordDigest = scryptSync(adminPassword, passwordSalt, 64, {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});
const adminHash = `scrypt$${passwordSalt.toString('hex')}$${passwordDigest.toString('hex')}`;
const privateValues = [
  jwtSecret,
  adminPassword,
  adminHash,
  process.env.AUTH_TEST_ADMIN_PASSWORD,
  process.env.CONTRACT_ADMIN_PASSWORD,
].filter(Boolean);
let adminToken;
function redact(value) {
  let result = String(value);
  for (const secret of privateValues) result = result.split(secret).join('[REDACTED]');
  return result.replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]');
}
const environment = {
  ...process.env,
  COMPOSE_PROJECT_NAME: project,
  DB_PORT: '15432',
  API_PORT: '13001',
  WEB_PORT: '13000',
  CORS_ORIGIN: webOrigin,
  NEXT_PUBLIC_API_BASE_URL: `${apiOrigin}/api/v1`,
  STORE_PUBLIC_ORIGIN: webOrigin,
  JWT_SECRET: jwtSecret,
  AUTH_ADMIN_EMAIL: adminEmail,
  AUTH_ADMIN_PASSWORD_HASH: adminHash,
};
const prefix = ['compose', '--project-name', project, '--file', path.join(root, 'compose.yaml')];
await mkdir(artifacts, { recursive: true });

function docker(args, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      cwd: root,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let outputLine = '';
    let errorLine = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (!quiet) {
        outputLine += chunk;
        const lines = outputLine.split('\n');
        outputLine = lines.pop();
        for (const line of lines) process.stdout.write(`${redact(line)}\n`);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (!quiet) {
        errorLine += chunk;
        const lines = errorLine.split('\n');
        errorLine = lines.pop();
        for (const line of lines) process.stderr.write(`${redact(line)}\n`);
      }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (!quiet && outputLine) process.stdout.write(redact(outputLine));
      if (!quiet && errorLine) process.stderr.write(redact(errorLine));
      if (code === 0) resolve(stdout);
      else reject(new Error(redact(`docker ${args.join(' ')} falhou (${code}).\n${stderr}`)));
    });
  });
}
const compose = (args, options) => docker([...prefix, ...args], options);
const record = (name, value) =>
  writeFile(
    path.join(artifacts, name),
    redact(typeof value === 'string' ? value : JSON.stringify(value, null, 2)),
  );

async function api(endpoint, { method = 'GET', body, status = 200, admin = false } = {}) {
  const response = await fetch(`${apiOrigin}/api/v1${endpoint}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(admin ? { Authorization: `Bearer ${adminToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, status, `${method} ${endpoint}: HTTP ${response.status}`);
  return status === 204 ? null : response.json();
}

async function verifyRuntime(service) {
  const uid = await compose(['exec', '-T', service, 'node', '-p', 'process.getuid()'], {
    quiet: true,
  });
  assert.notEqual(uid.trim(), '0', `${service} precisa executar sem root.`);
  assert.match(uid.trim(), /^\d+$/);
}

async function verifyApi() {
  const health = await api('/health/ready');
  assert.equal(health.database, 'ok');
  const catalog = await api('/produtos?limite=100');
  assert.equal(catalog.meta.total, 16);
  assert.match(catalog.data[0].nome, /Report/);
  await api('/produtos', { method: 'POST', body: {}, status: 401 });
  await api('/pedidos', { status: 401 });
  const session = await api('/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: adminPassword },
  });
  assert.ok(
    typeof session.access_token === 'string' && session.access_token.length > 0,
    'Login deve devolver uma sessão válida.',
  );
  assert.equal(session.token_type, 'Bearer');
  assert.equal(session.expires_in, 900);
  adminToken = session.access_token;
  privateValues.push(adminToken);
  assert.equal((await api('/auth/me', { admin: true })).role, 'admin');
  const product = await api('/produtos', {
    method: 'POST',
    status: 201,
    admin: true,
    body: {
      nome: 'Produto do smoke Docker',
      categoria: 'Teste',
      descricao: 'Registro descartável da CI.',
      preco_centavos: 12345,
      quantidade_estoque: 5,
    },
  });
  await api(`/produtos/${product.id}`, {
    method: 'PATCH',
    body: { preco_centavos: 10990 },
    admin: true,
  });
  await api('/pedidos', {
    method: 'POST',
    status: 401,
    body: { produtos: [{ produto_id: product.id, quantidade: 1 }], status: 'Concluído' },
  });
  const order = await api('/pedidos', {
    method: 'POST',
    status: 201,
    body: {
      produtos: [{ produto_id: product.id, quantidade: 2 }],
      status: 'Pendente',
    },
  });
  assert.equal(order.total_pedido_centavos, 21980);
  assert.equal((await api(`/produtos/${product.id}`)).quantidade_estoque, 5);
  await api(`/pedidos/${order.id}`, { status: 401 });
  await api(`/pedidos/${order.id}/status`, {
    method: 'PATCH',
    body: { status: 'Concluído' },
    admin: true,
  });
  await api(`/pedidos/${order.id}/status`, {
    method: 'PATCH',
    body: { status: 'Concluído' },
    admin: true,
  });
  assert.equal((await api(`/produtos/${product.id}`)).quantidade_estoque, 3);
  await api(`/produtos/${product.id}`, { method: 'DELETE', status: 204, admin: true });
  await api(`/produtos/${product.id}`, { status: 404 });
  assert.equal(
    (await api(`/pedidos/${order.id}`, { admin: true })).produtos[0].nome_produto,
    product.nome,
  );
  await record('api-order.json', order);
}

async function verifyBrowser() {
  const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.DOCKER_SMOKE_BROWSER_CHANNEL,
  });
  try {
    // A mock accidentally shipped in the image cannot satisfy this browser check.
    const context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1366, height: 1000 },
      locale: 'pt-BR',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${webOrigin}/produtos`);
    const card = page.locator('article').first();
    await card.waitFor();
    const name = (await card.getByRole('heading').first().innerText()).trim();
    assert.match(name, /Report/);
    const productImages = page.locator('article img');
    assert.equal(await productImages.count(), 12, 'Os cards devem exibir imagens dos produtos.');
    for (const image of await productImages.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(async (element) => {
        await element.decode();
        if (!element.naturalWidth) throw new Error('A imagem do produto não carregou.');
      });
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.screenshot({ path: path.join(artifacts, 'loja-docker.png'), fullPage: true });
    await card.getByRole('button', { name: `Adicionar ao carrinho ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Carrinho, 1 itens', exact: true }).click();
    const cart = page.getByRole('dialog', { name: 'Seu carrinho', exact: true });
    const received = page.waitForResponse(
      (response) =>
        response.url() === `${apiOrigin}/api/v1/pedidos` && response.request().method() === 'POST',
    );
    await cart.getByRole('button', { name: 'Finalizar pedido', exact: true }).click();
    const response = await received;
    assert.equal(response.status(), 201);
    const order = await response.json();
    await cart.getByRole('heading', { name: 'Pedido recebido!', exact: true }).waitFor();
    assert.equal(order.status, 'Pendente');
    assert.equal((await api(`/pedidos/${order.id}`, { admin: true })).id, order.id);
    await page.screenshot({ path: path.join(artifacts, 'pedido-docker.png') });
    await cart.getByRole('button', { name: 'Continuar comprando', exact: true }).click();
    await page.getByRole('button', { name: 'Novo produto', exact: true }).click();
    const loginDialog = page.getByRole('dialog', { name: 'Acesso administrativo', exact: true });
    await loginDialog.waitFor();
    assert.equal(await loginDialog.getByLabel('E-mail', { exact: true }).inputValue(), '');
    assert.equal(await loginDialog.getByLabel('Senha', { exact: true }).inputValue(), '');
    await page.screenshot({ path: path.join(artifacts, 'login-docker.png') });
    await loginDialog.getByLabel('E-mail', { exact: true }).fill(adminEmail);
    await loginDialog.getByLabel('Senha', { exact: true }).fill(adminPassword);
    await loginDialog.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('dialog', { name: 'Novo produto', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.getByRole('button', { name: 'Acesso administrativo', exact: true }).waitFor();
    assert.deepEqual(errors, [], 'A loja não deve apresentar erros JavaScript.');
    await record('browser-order.json', order);
    await context.close();
  } finally {
    await browser.close();
  }
}

let failure;
try {
  await docker(['version']);
  await record('compose.yaml', await compose(['config', '--no-interpolate'], { quiet: true }));
  await compose(['build', '--pull']);
  await compose(['up', '--detach', '--wait', '--wait-timeout', '180']);
  await compose(['exec', '-T', 'api', 'node', 'dist/database/seed.js']);
  await verifyRuntime('api');
  await verifyRuntime('web');
  await compose(
    [
      'exec',
      '-T',
      'api',
      'node',
      '-e',
      "try { require.resolve('typescript'); process.exit(1); } catch { process.exit(0); }",
    ],
    { quiet: true },
  );
  const ui = await fetch(`${webOrigin}/produtos`, { signal: AbortSignal.timeout(10000) });
  assert.equal(ui.status, 200);
  assert.match(await ui.text(), /Suzano/);
  const docs = await fetch(`${apiOrigin}/docs-json`, { signal: AbortSignal.timeout(10000) });
  assert.equal(docs.status, 200);
  assert.ok((await docs.json()).paths['/api/v1/produtos']);
  await verifyApi();
  await verifyBrowser();
  await record('result.json', {
    status: 'passed',
    project,
    checked: [
      'build',
      'migrations',
      'seed',
      'health',
      'non-root',
      'production-dependencies',
      'jwt-login',
      'browser-admin-login-logout',
      'protected-routes',
      'crud',
      'stock',
      'product-images',
      'browser-checkout',
    ],
  });
  console.log(`Smoke Docker aprovado: ${project}`);
} catch (error) {
  failure = error;
  await record('result.json', { status: 'failed', project, error: String(error) });
} finally {
  try {
    await record(
      'containers.json',
      await compose(['ps', '--all', '--format', 'json'], { quiet: true }),
    );
  } catch {
    /* Keep the original failure if Docker could not start. */
  }
  try {
    await record('compose.log', await compose(['logs', '--no-color'], { quiet: true }));
  } catch {
    /* Logs are best effort. */
  }
  // No user-supplied names, external volumes or shared project are accepted for this teardown.
  assert.match(project, /^suzano-smoke-[a-f0-9]{8}$/);
  try {
    await compose(['down', '--volumes', '--remove-orphans']);
  } catch (error) {
    failure ??= error;
  }
  if (failure) await record('result.json', { status: 'failed', project, error: String(failure) });
}
if (failure) throw failure;
