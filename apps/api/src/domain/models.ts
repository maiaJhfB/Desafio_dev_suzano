export enum StatusPedido {
  Pendente = 'Pendente',
  Concluido = 'Concluído',
  Cancelado = 'Cancelado',
}

export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  preco_centavos: number;
  quantidade_estoque: number;
  imagem_url: string | null;
  created_at: Date;
  updated_at: Date;
  excluido_em: Date | null;
}

export interface ItemPedido {
  id: string;
  pedido_id: string;
  produto_id: string;
  nome_produto: string;
  preco_unitario_centavos: number;
  quantidade: number;
  subtotal_centavos: number;
}

export interface Pedido {
  id: string;
  status: StatusPedido;
  total_pedido_centavos: number;
  itens: ItemPedido[];
  created_at: Date;
  updated_at: Date;
}
