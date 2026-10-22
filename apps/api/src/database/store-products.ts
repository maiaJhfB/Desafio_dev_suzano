import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { isUUID } from 'class-validator';
import { CreateProdutoDto } from '../produtos/produtos.dto';

export type StoreProduct = CreateProdutoDto & { id: string };

/** Shared JSON is read at runtime so source and compiled seed use the same catalog. */
export function loadStoreProducts(
  fixturePath = resolve(__dirname, '../../../../packages/contracts/store-products.json'),
): StoreProduct[] {
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
    return { id, ...dto };
  });
  if (new Set(products.map((product) => product.id)).size !== products.length)
    throw new Error('O catálogo de demonstração contém identificadores repetidos.');
  return products;
}
