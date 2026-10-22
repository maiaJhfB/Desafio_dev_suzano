import type { components } from '@catalogo/contracts';

export type Produto = components['schemas']['ProdutoResponseDto'];

export interface CriarProduto {
  nome: string;
  categoria: string;
  descricao: string;
  preco_centavos: number;
  quantidade_estoque: number;
  imagem_url: string;
}

export interface ProductFilters {
  nome: string;
  categoria?: string;
  preco_min_centavos?: number;
  preco_max_centavos?: number;
  ordenar: 'nome' | 'preco' | 'criado_em';
  direcao: 'asc' | 'desc';
  pagina: number;
  limite: number;
}

export type ProductPage = components['schemas']['ProdutosPageResponseDto'];

export type ErrorEnvelope = components['schemas']['ErrorResponseDto'];
