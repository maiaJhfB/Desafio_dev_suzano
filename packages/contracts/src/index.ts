export type { paths, components, operations } from './generated';
export type OrderStatus = 'Pendente' | 'Concluído' | 'Cancelado';
export interface Page<T> {
  data: T[];
  meta: { pagina: number; limite: number; total: number; total_paginas: number };
}
