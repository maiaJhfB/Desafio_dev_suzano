import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DomainError } from '../domain/errors';
import { ItemPedido, Pedido, Produto } from '../database/entities';
import {
  Pedido as PedidoModel,
  Produto as ProdutoModel,
  ItemPedido as ItemPedidoModel,
} from '../domain/models';
import { ListPedidosQuery } from '../domain/commands';
import { PedidosStore, PedidoTransaction } from './pedidos.ports';

type StoredPedido = Pick<Pedido, 'id' | 'status' | 'total_pedido_centavos'> & {
  created_at: string;
  updated_at: string;
  itens: Pick<
    ItemPedido,
    | 'id'
    | 'pedido_id'
    | 'produto_id'
    | 'nome_produto'
    | 'preco_unitario_centavos'
    | 'quantidade'
    | 'subtotal_centavos'
  >[];
};

function snapshotPedido(pedido: PedidoModel): StoredPedido {
  return {
    id: pedido.id,
    status: pedido.status,
    total_pedido_centavos: pedido.total_pedido_centavos,
    created_at: pedido.created_at.toISOString(),
    updated_at: pedido.updated_at.toISOString(),
    itens: pedido.itens.map((item) => ({
      id: item.id,
      pedido_id: pedido.id,
      produto_id: item.produto_id,
      nome_produto: item.nome_produto,
      preco_unitario_centavos: item.preco_unitario_centavos,
      quantidade: item.quantidade,
      subtotal_centavos: item.subtotal_centavos,
    })),
  };
}

class PostgresPedidoTransaction implements PedidoTransaction {
  constructor(private readonly manager: EntityManager) {}
  async lockCreationKey(key: string) {
    // A transaction-scoped lock also serializes first use, when no ledger row exists yet.
    await this.manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `pedido:create:${key}`,
    ]);
    const rows: { request_hash: string; resposta: StoredPedido }[] = await this.manager.query(
      'SELECT request_hash, resposta FROM pedido_idempotencia WHERE chave = $1',
      [key],
    );
    const row = rows[0];
    if (!row) return null;
    const pedido = this.manager.getRepository(Pedido).create({
      ...row.resposta,
      created_at: new Date(row.resposta.created_at),
      updated_at: new Date(row.resposta.updated_at),
    });
    return { requestHash: row.request_hash, pedido };
  }
  async saveCreationReplay(key: string, requestHash: string, pedido: PedidoModel) {
    await this.manager.query(
      'INSERT INTO pedido_idempotencia (chave, request_hash, pedido_id, resposta) VALUES ($1, $2, $3, $4::jsonb)',
      [key, requestHash, pedido.id, JSON.stringify(snapshotPedido(pedido))],
    );
  }
  lockProdutos(ids: string[]) {
    return this.manager
      .getRepository(Produto)
      .createQueryBuilder('p')
      .where('p.id IN (:...ids)', { ids })
      .orderBy('p.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
  }
  async lockPedido(id: string) {
    // Load items separately: FOR UPDATE on nullable side of an outer join is invalid in PostgreSQL.
    const pedido = await this.manager
      .getRepository(Pedido)
      .createQueryBuilder('pedido')
      .where('pedido.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
    if (!pedido) throw new DomainError('ORDER_NOT_FOUND', 'Pedido não encontrado.');
    pedido.itens = await this.manager
      .getRepository(ItemPedido)
      .find({ where: { pedido_id: id }, order: { id: 'ASC' } });
    return pedido;
  }
  async saveProdutos(produtos: ProdutoModel[]) {
    for (const produto of [...produtos].sort((a, b) => a.id.localeCompare(b.id)))
      await this.manager.getRepository(Produto).save(produto);
  }
  createPedido(status: PedidoModel['status'], total: number, itens: Partial<ItemPedidoModel>[]) {
    const repository = this.manager.getRepository(Pedido);
    return repository.save(repository.create({ status, total_pedido_centavos: total, itens }));
  }
  savePedido(pedido: PedidoModel) {
    return this.manager.getRepository(Pedido).save(pedido);
  }
}
@Injectable()
export class PostgresPedidosStore extends PedidosStore {
  constructor(private readonly source: DataSource) {
    super();
  }
  transaction<T>(work: (transaction: PedidoTransaction) => Promise<T>) {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      await manager.query("SET LOCAL lock_timeout = '5s'");
      await manager.query("SET LOCAL statement_timeout = '10s'");
      return work(new PostgresPedidoTransaction(manager));
    });
  }
  async find(id: string) {
    const pedido = await this.source
      .getRepository(Pedido)
      .findOne({ where: { id }, relations: { itens: true } });
    if (!pedido) throw new DomainError('ORDER_NOT_FOUND', 'Pedido não encontrado.');
    return pedido;
  }
  list(query: ListPedidosQuery) {
    return this.source.getRepository(Pedido).findAndCount({
      where: query.status ? { status: query.status } : {},
      relations: { itens: true },
      order: { created_at: 'DESC', id: 'DESC' },
      skip: (query.pagina - 1) * query.limite,
      take: query.limite,
    });
  }
}
