import { ItemPedido, Pedido, Produto } from '../domain/models';
import { ListPedidosQuery } from '../domain/commands';
export interface PedidoTransaction {
  lockCreationKey(key: string): Promise<{ requestHash: string; pedido: Pedido } | null>;
  saveCreationReplay(key: string, requestHash: string, pedido: Pedido): Promise<void>;
  lockProdutos(ids: string[]): Promise<Produto[]>;
  lockPedido(id: string): Promise<Pedido>;
  saveProdutos(produtos: Produto[]): Promise<void>;
  createPedido(
    status: Pedido['status'],
    total: number,
    itens: Partial<ItemPedido>[],
  ): Promise<Pedido>;
  savePedido(pedido: Pedido): Promise<Pedido>;
}
export abstract class PedidosStore {
  abstract transaction<T>(work: (transaction: PedidoTransaction) => Promise<T>): Promise<T>;
  abstract find(id: string): Promise<Pedido>;
  abstract list(query: ListPedidosQuery): Promise<[Pedido[], number]>;
}
