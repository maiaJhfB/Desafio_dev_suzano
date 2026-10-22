import type { ProductFilters } from './types';

export const defaultFilters: ProductFilters = {
  nome: '',
  categoria: undefined,
  preco_min_centavos: undefined,
  preco_max_centavos: undefined,
  ordenar: 'criado_em',
  direcao: 'desc',
  pagina: 1,
  limite: 12,
};

function positiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1000000 ? parsed : fallback;
}

function cents(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 100000000 ? parsed : undefined;
}

export function parseFilters(params: URLSearchParams): ProductFilters {
  const ordenar = params.get('ordenar');
  const precoMin = cents(params.get('preco_min_centavos'));
  const precoMax = cents(params.get('preco_max_centavos'));
  const invalidRange = precoMin !== undefined && precoMax !== undefined && precoMin > precoMax;
  return {
    nome: (params.get('nome') ?? '').trim().slice(0, 120),
    categoria: (params.get('categoria') ?? '').trim().slice(0, 80) || undefined,
    preco_min_centavos: invalidRange ? undefined : precoMin,
    preco_max_centavos: invalidRange ? undefined : precoMax,
    ordenar: ordenar === 'nome' || ordenar === 'preco' ? ordenar : 'criado_em',
    direcao: params.get('direcao') === 'asc' ? 'asc' : 'desc',
    pagina: positiveInteger(params.get('pagina'), 1),
    limite: 12,
  };
}

/** One representation per filter set; defaults are omitted from the shareable URL. */
export function serializeFilters(filters: ProductFilters, forApi = false): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.nome) params.set('nome', filters.nome.trim());
  if (filters.categoria) params.set('categoria', filters.categoria);
  if (filters.preco_min_centavos !== undefined)
    params.set('preco_min_centavos', String(filters.preco_min_centavos));
  if (filters.preco_max_centavos !== undefined)
    params.set('preco_max_centavos', String(filters.preco_max_centavos));
  if (filters.ordenar !== defaultFilters.ordenar || forApi) params.set('ordenar', filters.ordenar);
  if (filters.direcao !== defaultFilters.direcao || forApi) params.set('direcao', filters.direcao);
  if (filters.pagina !== 1 || forApi) params.set('pagina', String(filters.pagina));
  if (forApi) params.set('limite', String(filters.limite));
  return params;
}

export const hasFilters = (filters: ProductFilters): boolean =>
  !!filters.nome ||
  !!filters.categoria ||
  filters.preco_min_centavos !== undefined ||
  filters.preco_max_centavos !== undefined;
