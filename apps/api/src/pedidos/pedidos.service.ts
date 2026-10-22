import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DomainError } from '../domain/errors';
import { page } from '../domain/pagination';
import { ItemPedido, Produto, StatusPedido } from '../domain/models';
import { CreatePedidoInput, ListPedidosQuery, UpdateStatusInput } from '../domain/commands';
import { PedidosStore } from './pedidos.ports';

@Injectable()
export class PedidosService {
  constructor(private readonly store: PedidosStore) {}
  async list(query: ListPedidosQuery) {
    const [data, total] = await this.store.list(query);
    return page(data, total, query);
  }
  find(id: string) {
    return this.store.find(id);
  }
  create(dto: CreatePedidoInput, idempotencyKey?: string) {
    return this.store.transaction(async (transaction) => {
      const requested = [...dto.produtos].sort((a, b) => a.produto_id.localeCompare(b.produto_id));
      if (new Set(requested.map((item) => item.produto_id)).size !== requested.length)
        throw new DomainError('DUPLICATE_PRODUCT', 'Não repita produtos no mesmo pedido.');
      const status = dto.status ?? StatusPedido.Pendente;
      const requestHash = createHash('sha256')
        .update(
          JSON.stringify({
            status,
            produtos: requested.map(({ produto_id, quantidade }) => ({ produto_id, quantidade })),
          }),
        )
        .digest('hex');
      if (idempotencyKey !== undefined) {
        const replay = await transaction.lockCreationKey(idempotencyKey);
        if (replay) {
          if (replay.requestHash !== requestHash)
            throw new DomainError(
              'IDEMPOTENCY_KEY_CONFLICT',
              'Esta Idempotency-Key já foi utilizada para outro pedido.',
              [
                {
                  field: 'Idempotency-Key',
                  reason: 'Reutilize a chave apenas para repetir a mesma solicitação.',
                },
              ],
            );
          return { pedido: replay.pedido, replayed: true };
        }
      }
      const produtos = await transaction.lockProdutos(requested.map((item) => item.produto_id));
      this.validateStock(requested, produtos);
      let total = 0;
      const itens: Partial<ItemPedido>[] = requested.map((item) => {
        const produto = produtos.find((value) => value.id === item.produto_id)!;
        const subtotal = produto.preco_centavos * item.quantidade;
        total += subtotal;
        if (!Number.isSafeInteger(total))
          throw new DomainError(
            'ORDER_TOTAL_TOO_LARGE',
            'O total do pedido excede o limite permitido.',
          );
        return {
          produto_id: produto.id,
          nome_produto: produto.nome,
          preco_unitario_centavos: produto.preco_centavos,
          quantidade: item.quantidade,
          subtotal_centavos: subtotal,
        };
      });
      if (status === StatusPedido.Concluido) {
        this.decreaseStock(requested, produtos);
        await transaction.saveProdutos(produtos);
      }
      const pedido = await transaction.createPedido(status, total, itens);
      if (idempotencyKey !== undefined)
        await transaction.saveCreationReplay(idempotencyKey, requestHash, pedido);
      return { pedido, replayed: false };
    });
  }
  updateStatus(id: string, dto: UpdateStatusInput) {
    return this.store.transaction(async (transaction) => {
      const pedido = await transaction.lockPedido(id);
      if (pedido.status === dto.status) return pedido;
      if (pedido.status !== StatusPedido.Pendente)
        throw new DomainError(
          'INVALID_ORDER_TRANSITION',
          'Um pedido finalizado não pode mudar de status.',
        );
      if (dto.status === StatusPedido.Concluido) {
        const requested = pedido.itens.map((item) => ({
          produto_id: item.produto_id,
          quantidade: item.quantidade,
        }));
        const produtos = await transaction.lockProdutos(requested.map((item) => item.produto_id));
        this.validateStock(requested, produtos, true);
        this.decreaseStock(requested, produtos);
        await transaction.saveProdutos(produtos);
      }
      pedido.status = dto.status;
      return transaction.savePedido(pedido);
    });
  }
  private validateStock(
    requested: { produto_id: string; quantidade: number }[],
    produtos: Produto[],
    completing = false,
  ) {
    for (const item of requested) {
      const produto = produtos.find((value) => value.id === item.produto_id);
      if (!produto)
        throw new DomainError(
          completing ? 'PRODUCT_UNAVAILABLE' : 'PRODUCT_NOT_FOUND',
          'Um produto do pedido não está disponível.',
          { produto_id: item.produto_id },
        );
      if (produto.quantidade_estoque < item.quantidade)
        throw new DomainError('INSUFFICIENT_STOCK', `Estoque insuficiente para ${produto.nome}.`, {
          produto_id: produto.id,
          disponivel: produto.quantidade_estoque,
          solicitado: item.quantidade,
        });
    }
  }
  private decreaseStock(
    requested: { produto_id: string; quantidade: number }[],
    produtos: Produto[],
  ) {
    for (const item of requested)
      produtos.find((produto) => produto.id === item.produto_id)!.quantidade_estoque -=
        item.quantidade;
  }
}
