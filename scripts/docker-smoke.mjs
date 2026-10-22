import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This script only owns a random, disposable CI project. It never accepts another project name.
if (process.env.CI !== 'true')
  throw new Error('O smoke Docker deve rodar em CI, em um projeto descartável.');
const root = fileURLToPath(new URL('../', import.meta.url));
const project = `suzano-smoke-${randomUUID().slice(0, 8)}`;
const artifacts = path.join(root, 'tmp', 'docker-smoke', project);
const apiOrigin = 'http://127.0.0.1:13001';
const webOrigin = 'http://127.0.0.1:13000';
const environment = {
  ...process.env,
  COMPOSE_PROJECT_NAME: project,
  DB_PORT: '15432',
  API_PORT: '13001',
  WEB_PORT: '13000',
  CORS_ORIGIN: webOrigin,
  NEXT_PUBLIC_API_BASE_URL: `${apiOrigin}/api/v1`,
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
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (!quiet) process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (!quiet) process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`docker ${args.join(' ')} falhou (${code}).\n${stderr}`)),
    );
  });
}
const compose = (args, options) => docker([...prefix, ...args], options);
const record = (name, value) =>
  writeFile(
    path.join(artifacts, name),
    typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  );

async function api(endpoint, { method = 'GET', body, status = 200 } = {}) {
  const response = await fetch(`${apiOrigin}/api/v1${endpoint}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
  const product = await api('/produtos', {
    method: 'POST',
    status: 201,
    body: {
      nome: 'Produto do smoke Docker',
      categoria: 'Teste',
      descricao: 'Registro descartável da CI.',
      preco_centavos: 12345,
      quantidade_estoque: 5,
    },
  });
  await api(`/produtos/${product.id}`, { method: 'PATCH', body: { preco_centavos: 10990 } });
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
  await api(`/pedidos/${order.id}/status`, { method: 'PATCH', body: { status: 'Concluído' } });
  await api(`/pedidos/${order.id}/status`, { method: 'PATCH', body: { status: 'Concluído' } });
  assert.equal((await api(`/produtos/${product.id}`)).quantidade_estoque, 3);
  await api(`/produtos/${product.id}`, { method: 'DELETE', status: 204 });
  await api(`/produtos/${product.id}`, { status: 404 });
  assert.equal((await api(`/pedidos/${order.id}`)).produtos[0].nome_produto, product.nome);
  await record('api-order.json', order);
}

async function verifyBrowser() {
  const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true });
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
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.screenshot({ path: path.join(artifacts, 'loja-docker.png') });
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
    assert.equal((await api(`/pedidos/${order.id}`)).id, order.id);
    await page.screenshot({ path: path.join(artifacts, 'pedido-docker.png') });
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
  await record('compose.yaml', await compose(['config'], { quiet: true }));
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
      'crud',
      'stock',
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
