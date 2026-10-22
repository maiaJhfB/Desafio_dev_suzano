import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

let email = process.env.CONTRACT_ADMIN_EMAIL;
let password = process.env.CONTRACT_ADMIN_PASSWORD;
if ((!email || !password) && !process.env.CI) {
  const saved = await readFile('tmp/admin-access.json', 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  if (saved && typeof saved.email === 'string' && typeof saved.password === 'string') {
    email ??= saved.email;
    password ??= saved.password;
  }
}
if (!email || !password)
  throw new Error(
    'Configure CONTRACT_ADMIN_EMAIL e CONTRACT_ADMIN_PASSWORD para verificar o contrato administrativo.',
  );
const schema = JSON.parse(await readFile('docs/openapi.json', 'utf8'));
const ajv = new Ajv({ strict: false });
addFormats(ajv);
const base = process.env.CONTRACT_API_URL || 'http://localhost:3001/api/v1';
function validate(name, payload) {
  const check = ajv.compile({
    components: schema.components,
    $ref: `#/components/schemas/${name}`,
  });
  if (!check(payload)) throw new Error(JSON.stringify(check.errors));
}
async function request(endpoint, { method = 'GET', body, status = 200, token } = {}) {
  const response = await fetch(`${base}${endpoint}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (response.status !== status)
    throw new Error(`${method} ${endpoint}: HTTP ${response.status}.`);
  return status === 204 ? undefined : response.json();
}
const session = await request('/auth/login', { method: 'POST', body: { email, password } });
validate('LoginResponseDto', session);
if (typeof session.access_token !== 'string' || !session.access_token)
  throw new Error('Login não retornou uma sessão válida.');
const token = session.access_token;
const unauthorized = await request('/produtos', { method: 'POST', body: {}, status: 401 });
validate('ErrorResponseDto', unauthorized);
const me = await request('/auth/me', { token });
validate('AdminUserResponseDto', me);
let id;
try {
  const product = await request('/produtos', {
    method: 'POST',
    status: 201,
    token,
    body: {
      nome: 'Produto contrato',
      categoria: 'Casa',
      descricao: 'Descrição.',
      preco_centavos: 1,
      quantidade_estoque: 0,
      imagem_url: 'https://example.com/a.png',
    },
  });
  id = product.id;
  validate('ProdutoResponseDto', product);
  validate('ProdutosPageResponseDto', await request('/produtos?nome=Produto%20contrato&limite=1'));
  validate(
    'ErrorResponseDto',
    await request('/produtos?preco_min_centavos=100&preco_max_centavos=1', { status: 400 }),
  );
  console.log(
    'Contrato real: login, autorização, produto, paginação e erros válidos contra OpenAPI.',
  );
} finally {
  if (id) await request(`/produtos/${id}`, { method: 'DELETE', status: 204, token });
}
