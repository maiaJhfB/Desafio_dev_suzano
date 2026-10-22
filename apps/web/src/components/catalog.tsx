'use client';

import { useCallback, useEffect, useRef } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { listProducts } from '@/lib/api';
import { defaultFilters } from '@/lib/filters';
import { useProductFilters } from '@/hooks/use-product-filters';
import { CartDrawer } from '@/features/cart/cart-drawer';
import { ProductDetail } from '@/features/store/product-detail';
import { useStore } from '@/features/store/store-provider';
import { CatalogToolbar } from './catalog-toolbar';
import { StoreHeader } from '@/features/store/store-header';
import {
  StoreHero,
  StoreBenefits,
  StoreCategories,
  StoreBrandBanner,
} from '@/features/store/store-landing';
import { StoreFooter } from '@/features/store/store-footer';
import { CatalogResults } from '@/features/store/catalog-results';
import { ProductForm } from './product-form';
import { useUI } from './providers';

export function Catalog() {
  const { state, dispatch } = useUI();
  const store = useStore();
  const { filters, changeFilters } = useProductFilters();
  const addButton = useRef<HTMLButtonElement>(null);
  const cartButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const cartWasOpen = useRef(false);
  const query = useQuery({
    queryKey: ['produtos', filters],
    queryFn: ({ signal }) => listProducts(filters, signal),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const cartCount = store.items.reduce((sum, item) => sum + item.quantity, 0);
  const clearFilters = () => changeFilters(defaultFilters);
  const search = useCallback((nome: string) => changeFilters({ nome }), [changeFilters]);
  function chooseCategory(categoria?: string) {
    changeFilters({ ...defaultFilters, categoria });
  }
  function explore() {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
  }
  useEffect(() => {
    if (wasOpen.current && !state.productDialog) addButton.current?.focus({ preventScroll: true });
    wasOpen.current = state.productDialog;
  }, [state.productDialog]);
  useEffect(() => {
    if (cartWasOpen.current && !store.cartOpen) cartButton.current?.focus();
    cartWasOpen.current = store.cartOpen;
  }, [store.cartOpen]);
  useEffect(() => {
    if (data && !query.isPlaceholderData && filters.pagina > Math.max(1, data.meta.total_paginas))
      changeFilters({ pagina: Math.max(1, data.meta.total_paginas) }, true);
  }, [data, query.isPlaceholderData, filters.pagina, changeFilters]);

  return (
    <>
      <a href="#catalogo" className="skip-link">
        Pular para o catálogo
      </a>
      <StoreHeader
        name={filters.nome}
        onSearch={search}
        cartCount={cartCount}
        cartButtonRef={cartButton}
        onOpenCart={() => store.setCartOpen(true)}
        onChooseCategory={chooseCategory}
        onExplore={explore}
      />

      <main>
        <StoreHero onClearFilters={clearFilters} onExplore={explore} />
        <div className="store-container">
          <StoreBenefits />
          <StoreCategories
            category={filters.categoria}
            onChooseCategory={chooseCategory}
            onClearFilters={clearFilters}
            onExplore={explore}
          />
          <section className="store-catalog" id="catalogo" aria-label="Catálogo de produtos">
            <div className="catalog-breadcrumb">
              <button onClick={clearFilters}>Início</button>
              <ChevronRight size={12} />
              <span>{filters.categoria ?? 'Todos os produtos'}</span>
            </div>
            <div className="catalog-layout">
              <CatalogToolbar filters={filters} onChange={changeFilters} onClear={clearFilters} />
              <CatalogResults
                filters={filters}
                query={query}
                onChange={changeFilters}
                onClear={clearFilters}
              />
            </div>
          </section>
          <StoreBrandBanner />
        </div>
      </main>
      <StoreFooter
        onChooseCategory={chooseCategory}
        onExplore={explore}
        addButtonRef={addButton}
        onCreateProduct={() => dispatch({ type: 'open' })}
      />
      <ProductForm
        onCreated={() => {
          changeFilters(defaultFilters);
          explore();
        }}
      />
      <ProductDetail />
      <CartDrawer
        open={store.cartOpen}
        onOpenChange={store.setCartOpen}
        items={store.items}
        onQuantityChange={store.setQuantity}
        onRemove={store.removeProduct}
        onClear={store.clearCart}
        onContinueShopping={explore}
      />
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {state.notification && !store.cartOpen && !store.detailProduct && !state.productDialog && (
          <div className="toast" role="status">
            <CheckCircle2 size={21} />
            <p>{state.notification}</p>
            {state.notification === 'Produto adicionado ao carrinho.' && (
              <button
                className="toast-cart"
                onClick={() => {
                  dispatch({ type: 'dismiss' });
                  store.setCartOpen(true);
                }}
              >
                Ver carrinho
                <ArrowRight size={14} />
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Fechar notificação"
              onClick={() => dispatch({ type: 'dismiss' })}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
