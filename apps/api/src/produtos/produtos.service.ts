import { Injectable } from '@nestjs/common';
import { DomainError } from '../domain/errors';
import { page } from '../domain/pagination';
import { ProdutosStore } from './produtos.ports';
import { CreateProdutoInput, ListProdutosQuery, UpdateProdutoInput } from '../domain/commands';
@Injectable()
export class ProdutosService {
  constructor(private readonly repository: ProdutosStore) {}
  async list(query: ListProdutosQuery) {
    if (
      query.preco_min_centavos !== undefined &&
      query.preco_max_centavos !== undefined &&
      query.preco_min_centavos > query.preco_max_centavos
    )
      throw new DomainError(
        'INVALID_PRICE_RANGE',
        'O preço mínimo deve ser menor ou igual ao máximo.',
      );
    const [data, total] = await this.repository.list(query);
    return page(data, total, query);
  }
  find(id: string) {
    return this.repository.find(id);
  }
  create(dto: CreateProdutoInput) {
    return this.repository.create(dto);
  }
  update(id: string, dto: UpdateProdutoInput) {
    if (Object.keys(dto).length === 0)
      throw new DomainError('EMPTY_UPDATE', 'Informe pelo menos um campo para atualizar.');
    return this.repository.update(id, dto);
  }
  remove(id: string) {
    return this.repository.remove(id);
  }
}
