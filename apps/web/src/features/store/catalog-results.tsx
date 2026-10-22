import type { UseQueryResult } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, SearchX, X } from 'lucide-react';
import { hasFilters } from '@/lib/filters';
import type { ProductFilters, ProductPage } from '@/lib/types';
import { ProductCard, ProductSkeleton } from '@/components/product-card';
const sortOptions = [
  { value: 'criado_em:desc', label: 'Mais recentes' },
  { value: 'nome:asc', label: 'Nome: A a Z' },
  { value: 'nome:desc', label: 'Nome: Z a A' },
  { value: 'preco:asc', label: 'Menor preço' },
  { value: 'preco:desc', label: 'Maior preço' },
];
interface CatalogResultsProps {
  filters: ProductFilters;
  query: UseQueryResult<ProductPage, Error>;
  onChange: (patch: Partial<ProductFilters>, replace?: boolean) => void;
  onClear: () => void;
}
export function CatalogResults({ filters, query, onChange, onClear }: CatalogResultsProps) {
  const data = query.data;
  const pages = data
    ? Array.from(
        new Set([
          1,
          filters.pagina - 1,
          filters.pagina,
          filters.pagina + 1,
          data.meta.total_paginas,
        ]),
      )
        .filter((page) => page > 0 && page <= data.meta.total_paginas)
        .sort((a, b) => a - b)
    : [];
  return (
    <section
      className="catalog-results"
      aria-label="Produtos cadastrados"
      aria-busy={query.isFetching}
    >
      <div className="results-header">
        <div>
          <h2>
            {filters.categoria ??
              (filters.nome ? `Resultados para “${filters.nome}”` : 'Encontre sua próxima escolha')}
          </h2>
          <p aria-live="polite">
            {query.isLoading
              ? 'Buscando produtos…'
              : query.isError
                ? 'Não foi possível atualizar o catálogo.'
                : `${data?.meta.total ?? 0} produtos encontrados`}
            {query.isFetching && !query.isLoading ? ' · Atualizando…' : ''}
          </p>
        </div>
        <div className="sort-field">
          <label htmlFor="sort-products">Ordenar por</label>
          <select
            id="sort-products"
            value={`${filters.ordenar}:${filters.direcao}`}
            onChange={(event) => {
              const [ordenar, direcao] = event.target.value.split(':');
              onChange({
                ordenar: ordenar as ProductFilters['ordenar'],
                direcao: direcao as ProductFilters['direcao'],
              });
            }}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {hasFilters(filters) && (
        <div className="result-chips">
          {filters.nome && <span>“{filters.nome}”</span>}
          {filters.categoria && <span>{filters.categoria}</span>}
          <button onClick={onClear}>
            Limpar filtros
            <X size={12} />
          </button>
        </div>
      )}
      {query.isLoading ? (
        <div className="product-grid" role="status" aria-label="Carregando produtos">
          {Array.from({ length: 6 }, (_, index) => (
            <ProductSkeleton key={index} />
          ))}
        </div>
      ) : query.isError ? (
        <div className="empty-state error-state" role="alert">
          <AlertCircle size={36} />
          <h3>O catálogo fez uma pausa.</h3>
          <p>Não conseguimos carregar os produtos. Tente mais uma vez.</p>
          <button
            className="button button-primary"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw size={17} />
            Tentar novamente
          </button>
        </div>
      ) : !data?.data.length ? (
        <div className="empty-state">
          <SearchX size={40} />
          <h3>
            {hasFilters(filters) ? 'Nenhum produto por aqui.' : 'Seu catálogo está esperando.'}
          </h3>
          <p>
            {hasFilters(filters)
              ? 'Experimente outro nome ou ajuste a faixa de preço.'
              : 'Novos produtos estarão disponíveis em breve.'}
          </p>
          {hasFilters(filters) && (
            <button className="button button-secondary" onClick={onClear}>
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className={`product-grid${query.isPlaceholderData ? ' updating' : ''}`}>
          {data.data.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
      {!!data?.meta.total && !query.isError && (
        <div className="pagination">
          <p>
            Mostrando{' '}
            <strong>
              {(data.meta.pagina - 1) * data.meta.limite + 1}–
              {Math.min(data.meta.pagina * data.meta.limite, data.meta.total)}
            </strong>{' '}
            de {data.meta.total} produtos
          </p>
          <nav aria-label="Paginação">
            <button
              aria-label="Página anterior"
              disabled={filters.pagina <= 1 || query.isPlaceholderData}
              onClick={() => onChange({ pagina: filters.pagina - 1 })}
            >
              <ChevronLeft size={18} />
            </button>
            {pages.map((page, index) => (
              <span key={page}>
                {index > 0 && page - pages[index - 1] > 1 && <span>…</span>}
                <button
                  aria-label={`Página ${page}`}
                  aria-current={page === filters.pagina ? 'page' : undefined}
                  disabled={query.isPlaceholderData}
                  onClick={() => onChange({ pagina: page })}
                >
                  {page}
                </button>
              </span>
            ))}
            <button
              aria-label="Próxima página"
              disabled={filters.pagina >= data.meta.total_paginas || query.isPlaceholderData}
              onClick={() => onChange({ pagina: filters.pagina + 1 })}
            >
              <ChevronRight size={18} />
            </button>
          </nav>
        </div>
      )}
    </section>
  );
}
