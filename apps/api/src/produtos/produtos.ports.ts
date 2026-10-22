import { Produto } from '../domain/models';
import { CreateProdutoInput, ListProdutosQuery, UpdateProdutoInput } from '../domain/commands';
export abstract class ProdutosStore {
  abstract list(query: ListProdutosQuery): Promise<[Produto[], number]>;
  abstract find(id: string): Promise<Produto>;
  abstract create(dto: CreateProdutoInput): Promise<Omit<Produto, 'excluido_em'>>;
  abstract update(id: string, dto: UpdateProdutoInput): Promise<Omit<Produto, 'excluido_em'>>;
  abstract remove(id: string): Promise<void>;
}
