import { Pedido } from '../domain/models';
export function presentPedido(pedido: Pedido) {
  const { itens, ...rest } = pedido;
  return {
    ...rest,
    produtos: itens.map(
      ({
        id,
        produto_id,
        nome_produto,
        preco_unitario_centavos,
        quantidade,
        subtotal_centavos,
      }) => ({
        id,
        produto_id,
        nome_produto,
        preco_unitario_centavos,
        quantidade,
        subtotal_centavos,
      }),
    ),
  };
}
