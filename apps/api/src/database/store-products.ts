import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { isUUID } from 'class-validator';
import { CreateProdutoDto } from '../produtos/produtos.dto';

export type StoreProduct = CreateProdutoDto & { id: string };

function storePublicOrigin(value: string): string {
  const invalidOrigin = () =>
    new Error(
      'STORE_PUBLIC_ORIGIN deve ser uma origem HTTP(S) sem credenciais, caminho, query ou fragmento.',
    );
  if (!/^https?:\/\//i.test(value) || value.length > 2048 || value !== value.trim())
    throw invalidOrigin();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw invalidOrigin();
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash)
    throw invalidOrigin();
  return parsed.origin;
}

function remapLocalImage(
  imageUrl: string | null | undefined,
  origin: string,
): string | null | undefined {
  if (!imageUrl) return imageUrl;
  const parsed = new URL(imageUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) return imageUrl;
  return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Shared JSON is read at runtime so source and compiled seed use the same catalog. */
export function loadStoreProducts(
  fixturePath = resolve(__dirname, '../../../../packages/contracts/store-products.json'),
  publicOrigin = process.env.STORE_PUBLIC_ORIGIN ?? 'http://localhost:3000',
): StoreProduct[] {
  const origin = storePublicOrigin(publicOrigin);
  const raw: unknown = JSON.parse(readFileSync(fixturePath, 'utf8').replace(/^\uFEFF/, ''));
  if (!Array.isArray(raw) || !raw.length)
    throw new Error('O catálogo de demonstração precisa conter produtos.');
  const products = raw.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error('Produto inválido no catálogo de demonstração.');
    const { id, ...payload } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !isUUID(id) || !id.startsWith('10000000-0000-4000-8000-'))
      throw new Error('Identificador inválido no catálogo de demonstração.');
    const dto = plainToInstance(CreateProdutoDto, payload);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
      throw new Error(`Produto inválido no catálogo de demonstração: ${id}.`);
    dto.imagem_url = remapLocalImage(dto.imagem_url, origin);
    if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
      throw new Error(`URL configurada fora dos limites do produto de demonstração: ${id}.`);
    return { id, ...dto };
  });
  if (new Set(products.map((product) => product.id)).size !== products.length)
    throw new Error('O catálogo de demonstração contém identificadores repetidos.');
  return products;
}
