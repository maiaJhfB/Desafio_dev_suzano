'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { hasFilters } from '@/lib/filters';
import { moneyInput, parseMoney } from '@/lib/money';
import { storeCategories } from '@/features/store/categories';
import type { ProductFilters } from '@/lib/types';

interface ToolbarProps {
  filters: ProductFilters;
  onChange: (patch: Partial<ProductFilters>, replace?: boolean) => void;
  onClear: () => void;
}
export function CatalogToolbar({ filters, onChange, onClear }: ToolbarProps) {
  const [minimum, setMinimum] = useState(moneyInput(filters.preco_min_centavos));
  const [maximum, setMaximum] = useState(moneyInput(filters.preco_max_centavos));
  const [priceError, setPriceError] = useState('');
  useEffect(() => {
    setMinimum(moneyInput(filters.preco_min_centavos));
    setMaximum(moneyInput(filters.preco_max_centavos));
    setPriceError('');
  }, [filters.preco_min_centavos, filters.preco_max_centavos]);
  function applyPrices(event: React.FormEvent) {
    event.preventDefault();
    const min = minimum.trim() ? parseMoney(minimum) : undefined;
    const max = maximum.trim() ? parseMoney(maximum) : undefined;
    if (min === null || max === null) {
      setPriceError('Use valores em reais, como 129,90.');
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError('O preço mínimo deve ser menor ou igual ao máximo.');
      return;
    }
    setPriceError('');
    onChange({ preco_min_centavos: min, preco_max_centavos: max });
  }
  return (
    <aside className="filter-panel" aria-label="Filtros de produtos">
      <div className="filter-sidebar-title">
        <h2>Filtrar por</h2>
        {hasFilters(filters) && (
          <button className="clear-filters" onClick={onClear}>
            Limpar filtros <X size={13} />
          </button>
        )}
      </div>
      <div className="category-filter">
        <h3>Categorias</h3>
        <button
          className={!filters.categoria ? 'selected' : ''}
          onClick={() => onChange({ categoria: undefined })}
        >
          Todos os produtos
        </button>
        {storeCategories.map((category) => (
          <button
            key={category.name}
            className={filters.categoria === category.name ? 'selected' : ''}
            onClick={() => onChange({ categoria: category.name })}
          >
            {category.name}
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        ))}
      </div>
      <form className="price-filter" onSubmit={applyPrices} noValidate>
        <h3>Preço</h3>
        <div className="price-inputs">
          <input
            aria-label="Preço mínimo"
            placeholder="Mínimo"
            inputMode="decimal"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
            aria-invalid={!!priceError}
            aria-describedby={priceError ? 'price-error' : undefined}
          />
          <span aria-hidden="true">—</span>
          <input
            aria-label="Preço máximo"
            placeholder="Máximo"
            inputMode="decimal"
            value={maximum}
            onChange={(event) => setMaximum(event.target.value)}
            aria-invalid={!!priceError}
            aria-describedby={priceError ? 'price-error' : undefined}
          />
        </div>
        <button className="button button-secondary" type="submit">
          Aplicar filtros
          <ArrowRight size={14} />
        </button>
        {priceError && (
          <p id="price-error" className="field-error" role="alert">
            {priceError}
          </p>
        )}
      </form>
      <div className="sidebar-note">
        <span className="sidebar-leaf" aria-hidden="true">
          ↗
        </span>
        <strong>
          O futuro se renova
          <br />
          nas suas escolhas.
        </strong>
        <p>Conheça produtos das linhas de papéis, embalagens e higiene da Suzano.</p>
        <a href="https://www.suzano.com.br/produtos-e-marcas" target="_blank" rel="noreferrer">
          Conheça a Suzano <ArrowRight size={14} />
        </a>
      </div>
    </aside>
  );
}
