import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Produto } from '../database/entities';
import { CreateProdutoInput, ListProdutosQuery, UpdateProdutoInput } from '../domain/commands';
import { DomainError } from '../domain/errors';
import { ProdutosStore } from './produtos.ports';

@Injectable()
export class ProdutosRepository extends ProdutosStore {
  constructor(@InjectRepository(Produto) private readonly repository: Repository<Produto>) {
    super();
  }
  async list(query: ListProdutosQuery) {
    const builder = this.repository.createQueryBuilder('produto');
    if (query.nome)
      builder.andWhere("produto.nome ILIKE :nome ESCAPE '\\'", {
        nome: `%${query.nome.replace(/[\\%_]/g, '\\$&')}%`,
      });
    if (query.categoria !== undefined)
      builder.andWhere('produto.categoria = :categoria', { categoria: query.categoria });
    if (query.preco_min_centavos !== undefined)
      builder.andWhere('produto.preco_centavos >= :min', { min: query.preco_min_centavos });
    if (query.preco_max_centavos !== undefined)
      builder.andWhere('produto.preco_centavos <= :max', { max: query.preco_max_centavos });
    const fields = {
      nome: 'LOWER(produto.nome)',
      preco: 'produto.preco_centavos',
      criado_em: 'produto.created_at',
    };
    const direction = query.direcao.toUpperCase() as 'ASC' | 'DESC';
    return builder
      .orderBy(fields[query.ordenar], direction)
      .addOrderBy('produto.id', direction)
      .skip((query.pagina - 1) * query.limite)
      .take(query.limite)
      .getManyAndCount();
  }
  async find(id: string) {
    const produto = await this.repository.findOneBy({ id });
    if (!produto) throw new DomainError('PRODUCT_NOT_FOUND', 'Produto não encontrado.');
    return produto;
  }
  async create(dto: CreateProdutoInput) {
    const { excluido_em: _deleted, ...produto } = await this.repository.save(
      this.repository.create({ ...dto, imagem_url: dto.imagem_url ?? null }),
    );
    return produto;
  }
  async update(id: string, dto: UpdateProdutoInput) {
    // A single UPDATE acquires a row lock and cannot resurrect a concurrently deleted product.
    const result = await this.repository
      .createQueryBuilder()
      .update(Produto)
      .set(dto)
      .where('id = :id AND excluido_em IS NULL', { id })
      .returning('*')
      .execute();
    if (!result.affected) throw new DomainError('PRODUCT_NOT_FOUND', 'Produto não encontrado.');
    const { excluido_em: _deleted, ...produto } = result.raw[0] as Produto;
    return produto;
  }
  async remove(id: string) {
    const result = await this.repository
      .createQueryBuilder()
      .softDelete()
      .where('id = :id AND excluido_em IS NULL', { id })
      .execute();
    if (!result.affected) throw new DomainError('PRODUCT_NOT_FOUND', 'Produto não encontrado.');
  }
}
