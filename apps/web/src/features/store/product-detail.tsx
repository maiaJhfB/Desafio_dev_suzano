'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Check, ShoppingCart, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/money';
import { useStore } from './store-provider';
import { addProductMessage } from './cart-state';

export function ProductDetail() {
  const {
    detailProduct: product,
    setDetailProduct,
    addProduct,
    setCartOpen,
    cartOpen,
    restoreDetailFocus,
  } = useStore();
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
  }, [product]);
  return (
    <Dialog.Root
      open={!!product}
      onOpenChange={(open) => {
        if (!open) setDetailProduct(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="product-detail-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!cartOpen) restoreDetailFocus();
          }}
        >
          <Dialog.Close className="icon-button detail-close" aria-label="Fechar detalhes">
            <X size={22} />
          </Dialog.Close>
          {product && (
            <>
              <div className="detail-visual">
                {product.imagem_url && (
                  <img
                    src={product.imagem_url}
                    alt={product.nome}
                    width={500}
                    height={500}
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              <div className="detail-content">
                <p className="product-category">{product.categoria}</p>
                <Dialog.Title>{product.nome}</Dialog.Title>
                <span className="seller-label">
                  <Check size={13} /> Portfólio Suzano
                </span>
                <strong className="detail-price">{formatMoney(product.preco_centavos)}</strong>
                <Dialog.Description>{product.descricao}</Dialog.Description>
                <p className="detail-availability">
                  {product.quantidade_estoque
                    ? `${product.quantidade_estoque} unidades disponíveis`
                    : 'Produto indisponível'}
                </p>
                <button
                  className="button button-primary"
                  disabled={!product.quantidade_estoque}
                  onClick={() => {
                    const result = addProduct(product);
                    if (result === 'added') {
                      setDetailProduct(null);
                      setCartOpen(true);
                    } else setError(addProductMessage(result));
                  }}
                >
                  <ShoppingCart size={18} />
                  Adicionar ao carrinho
                </button>
                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
                <p className="detail-demo">
                  Preço e apresentação de demonstração. Nenhuma cobrança será realizada.
                </p>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
