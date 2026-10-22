import { StatusPedido } from './models';

export interface PaginationQuery {
  pagina: number;
  limite: number;
}
export interface CreateProdutoInput {
  nome: string;
  categoria: string;
  descricao: string;
  preco_centavos: number;
  quantidade_estoque: number;
  imagem_url?: string | null;
}
export type UpdateProdutoInput = Partial<CreateProdutoInput>;
export interface ListProdutosQuery extends PaginationQuery {
  nome?: string;
  categoria?: string;
  preco_min_centavos?: number;
  preco_max_centavos?: number;
  ordenar: 'nome' | 'preco' | 'criado_em';
  direcao: 'asc' | 'desc';
}
export interface ItemPedidoInput {
  produto_id: string;
  quantidade: number;
}
export interface CreatePedidoInput {
  produtos: ItemPedidoInput[];
  status?: StatusPedido.Pendente | StatusPedido.Concluido;
}
export interface UpdateStatusInput {
  status: StatusPedido.Concluido | StatusPedido.Cancelado;
}
export interface ListPedidosQuery extends PaginationQuery {
  status?: StatusPedido;
}
