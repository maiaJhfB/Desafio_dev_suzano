'use client';

import { useState } from 'react';
import { Check, ImageOff, Plus } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import type { Produto } from '@/lib/types';
import { useStore } from '@/features/store/store-provider';
import { addProductMessage } from '@/features/store/cart-state';
import { useUI } from './providers';

export function ProductCard({ product }: { product: Produto }) {
  const [failedImage, setFailedImage] = useState(false);
  const { addProduct, openProductDetail } = useStore();
  const { dispatch } = useUI();
  return (
    <article className="product-card">
      <button
        className="product-visual"
        aria-label={`Ver detalhes de ${product.nome}`}
        onClick={(event) => openProductDetail(product, event.currentTarget)}
      >
        {product.imagem_url && !failedImage ? (
          <img
            src={product.imagem_url}
            alt={product.nome}
            loading="lazy"
            referrerPolicy="no-referrer"
            width={400}
            height={400}
            onError={() => setFailedImage(true)}
          />
        ) : (
          <span className="image-fallback">
            <ImageOff size={30} />
            <span>Imagem indisponível</span>
          </span>
        )}
        {!product.quantidade_estoque && <span className="unavailable-badge">Sem estoque</span>}
      </button>
      <div className="product-info">
        <p className="product-category">{product.categoria}</p>
        <h2>
          <button onClick={(event) => openProductDetail(product, event.currentTarget)}>
            {product.nome}
          </button>
        </h2>
        <p className="seller-label">
          <Check size={12} aria-hidden="true" /> Portfólio Suzano
        </p>
        <strong className="product-price">{formatMoney(product.preco_centavos)}</strong>
        <p className="product-description">{product.descricao}</p>
        <p className={`stock-label${product.quantidade_estoque ? '' : ' out-of-stock'}`}>
          {product.quantidade_estoque ? 'Disponível em estoque' : 'Indisponível no momento'}
        </p>
        <button
          className="add-to-cart"
          aria-label={`Adicionar ao carrinho ${product.nome}`}
          disabled={!product.quantidade_estoque}
          onClick={() => {
            const result = addProduct(product);
            dispatch({ type: 'notify', message: addProductMessage(result) });
          }}
        >
          <Plus size={17} aria-hidden="true" />
          Adicionar ao carrinho
        </button>
      </div>
    </article>
  );
}

export function ProductSkeleton() {
  return (
    <div className="product-card skeleton-card" aria-hidden="true">
      <div className="skeleton product-visual" />
      <div className="product-info">
        <div className="skeleton skeleton-short" />
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-price" />
        <div className="skeleton skeleton-line" />
      </div>
    </div>
  );
}
