import { PaginationQuery } from './commands';
export function page<T>(data: T[], total: number, query: PaginationQuery) {
  return {
    data,
    meta: {
      pagina: query.pagina,
      limite: query.limite,
      total,
      total_paginas: Math.ceil(total / query.limite),
    },
  };
}
