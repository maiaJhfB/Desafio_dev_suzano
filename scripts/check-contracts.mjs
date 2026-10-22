import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

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
let id;
try {
  const created = await fetch(`${base}/produtos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: 'Produto contrato',
      categoria: 'Casa',
      descricao: 'Descrição.',
      preco_centavos: 1,
      quantidade_estoque: 0,
      imagem_url: 'https://example.com/a.png',
    }),
  });
  if (created.status !== 201) throw new Error(`Cadastro HTTP ${created.status}`);
  const product = await created.json();
  id = product.id;
  validate('ProdutoResponseDto', product);
  const list = await fetch(`${base}/produtos?nome=Produto%20contrato&limite=1`);
  validate('ProdutosPageResponseDto', await list.json());
  const invalid = await fetch(`${base}/produtos?preco_min_centavos=100&preco_max_centavos=1`);
  if (invalid.status !== 400) throw new Error('Faixa inválida não foi rejeitada.');
  validate('ErrorResponseDto', await invalid.json());
  console.log('Contrato real: produto, paginação e erros válidos contra OpenAPI.');
} finally {
  if (id) await fetch(`${base}/produtos/${id}`, { method: 'DELETE' });
}
