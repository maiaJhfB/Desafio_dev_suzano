'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { createOrder, type Order } from '@/lib/orders';
import type { Produto } from '@/lib/types';
import {
  clearCheckoutAttempt,
  newCheckoutAttempt,
  orderSignature,
  readCheckoutAttempt,
} from './checkout-attempt';

export interface CartItem {
  product: Produto;
  quantity: number;
}

export interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onContinueShopping: () => void;
}

function maxQuantity(item: CartItem): number {
  return Math.max(0, Math.min(10_000, item.product.quantidade_estoque));
}

function quantityError(item: CartItem, text: string): string {
  const max = maxQuantity(item);
  if (max === 0) return 'Este produto está sem estoque. Remova-o para continuar.';
  const number = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < 1 || number > max) {
    return `Informe uma quantidade inteira de 1 a ${max}.`;
  }
  return '';
}

export function CartDrawer({
  open,
  onOpenChange,
  items,
  onQuantityChange,
  onRemove,
  onClear,
  onContinueShopping,
}: CartDrawerProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const pendingRef = useRef(false);
  const attemptRef = useRef<ReturnType<typeof newCheckoutAttempt> | null>(null);
  const observedSignature = useRef<string | null>(null);
  const signature = orderSignature(
    items.map((item) => ({ produto_id: item.product.id, quantidade: item.quantity })),
  );

  useEffect(() => {
    // StoreProvider hydrates a saved cart after the initial empty client render.
    if (observedSignature.current === null && !items.length) return;
    if (attemptRef.current?.signature !== signature)
      attemptRef.current = readCheckoutAttempt(signature);
    if (!attemptRef.current || !items.length) clearCheckoutAttempt();
    observedSignature.current = signature;
  }, [signature, items.length]);

  useEffect(() => {
    setDrafts(Object.fromEntries(items.map((item) => [item.product.id, String(item.quantity)])));
  }, [items]);

  useEffect(() => {
    if (open) {
      setError('');
      setConfirmedOrder(null);
    }
  }, [open]);

  const total = items.reduce((sum, item) => sum + item.product.preco_centavos * item.quantity, 0);
  const safeTotal =
    Number.isSafeInteger(total) &&
    total >= 0 &&
    items.every(
      (item) =>
        Number.isSafeInteger(item.product.preco_centavos) && item.product.preco_centavos >= 0,
    );
  const hasInvalidQuantity = items.some((item) =>
    quantityError(item, drafts[item.product.id] ?? String(item.quantity)),
  );
  const canCheckout = items.length > 0 && safeTotal && !hasInvalidQuantity;

  function changeQuantity(item: CartItem, value: string) {
    if (pendingRef.current) return;
    setError('');
    setDrafts((current) => ({ ...current, [item.product.id]: value }));
    if (!quantityError(item, value)) onQuantityChange(item.product.id, Number(value));
  }

  function continueShopping() {
    if (pendingRef.current) return;
    onOpenChange(false);
    onContinueShopping();
  }

  async function checkout() {
    if (pendingRef.current || !canCheckout) return;
    pendingRef.current = true;
    setPending(true);
    setError('');
    try {
      const attempt =
        attemptRef.current?.signature === signature
          ? attemptRef.current
          : (readCheckoutAttempt(signature) ?? newCheckoutAttempt(signature));
      attemptRef.current = attempt;
      const order = await createOrder(
        items.map((item) => ({ produto_id: item.product.id, quantidade: item.quantity })),
        attempt.key,
      );
      setConfirmedOrder(order);
      attemptRef.current = null;
      clearCheckoutAttempt();
      onClear();
    } catch (failure) {
      if (failure instanceof ApiError) {
        const message = failure.response.error.message;
        setError(
          `${message} Seu carrinho foi mantido. Confira os itens antes de tentar novamente.`,
        );
      } else {
        setError(
          failure instanceof Error && failure.message.includes('confirmação')
            ? failure.message
            : 'Não foi possível confirmar o pedido. Confira sua conexão. Seu carrinho foi mantido. Tentar novamente reutiliza a mesma tentativa de compra.',
        );
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!pendingRef.current) onOpenChange(value);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="cart-overlay" />
        <Dialog.Content className="cart-drawer" aria-busy={pending}>
          <header className="cart-header">
            <div>
              <Dialog.Title className="cart-title">Seu carrinho</Dialog.Title>
              <Dialog.Description className="cart-description">
                Revise seus produtos e finalize seu pedido de demonstração.
              </Dialog.Description>
            </div>
            <Dialog.Close className="cart-close" disabled={pending} aria-label="Fechar carrinho">
              <X size={23} aria-hidden="true" />
            </Dialog.Close>
          </header>

          {confirmedOrder ? (
            <div className="cart-confirmation" role="status">
              <CheckCircle2 className="cart-confirmation-icon" size={54} aria-hidden="true" />
              <h2>Pedido recebido!</h2>
              <p>Seu pedido de demonstração foi registrado com sucesso.</p>
              <dl className="cart-order-details">
                <div>
                  <dt>Pedido</dt>
                  <dd>{confirmedOrder.id}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{confirmedOrder.status}</dd>
                </div>
                <div>
                  <dt>Total confirmado</dt>
                  <dd>{formatMoney(confirmedOrder.total_pedido_centavos)}</dd>
                </div>
              </dl>
              <p className="cart-demo-notice">
                Nenhuma cobrança foi realizada. Pedidos pendentes não reservam estoque.
              </p>
              <button type="button" className="cart-primary" onClick={continueShopping}>
                Continuar comprando
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          ) : !items.length ? (
            <div className="cart-empty">
              <ShoppingBag size={56} strokeWidth={1.5} aria-hidden="true" />
              <h2>Seu carrinho está vazio</h2>
              <p>Encontre boas escolhas no catálogo e adicione seus produtos favoritos.</p>
              <button type="button" className="cart-primary" onClick={continueShopping}>
                Explorar produtos
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div className="cart-items">
                <ul className="cart-item-list" aria-label="Itens do carrinho">
                  {items.map((item) => {
                    const draft = drafts[item.product.id] ?? String(item.quantity);
                    const validation = quantityError(item, draft);
                    const quantityId = `cart-quantity-${item.product.id}`;
                    return (
                      <li className="cart-item" key={item.product.id}>
                        <div className="cart-item-image">
                          {item.product.imagem_url ? (
                            <img
                              src={item.product.imagem_url}
                              alt=""
                              width={90}
                              height={90}
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                event.currentTarget.hidden = true;
                              }}
                            />
                          ) : (
                            <ShoppingBag size={30} aria-hidden="true" />
                          )}
                        </div>
                        <div className="cart-item-content">
                          <p className="cart-item-category">{item.product.categoria}</p>
                          <h2>{item.product.nome}</h2>
                          <p className="cart-item-price">
                            {formatMoney(item.product.preco_centavos)} <span>por unidade</span>
                          </p>
                          <div className="cart-item-controls">
                            <div className="cart-quantity">
                              <button
                                type="button"
                                aria-label={`Diminuir quantidade de ${item.product.nome}`}
                                disabled={pending || item.quantity <= 1}
                                onClick={() => changeQuantity(item, String(item.quantity - 1))}
                              >
                                <Minus size={14} aria-hidden="true" />
                              </button>
                              <label className="cart-sr-only" htmlFor={quantityId}>
                                Quantidade de {item.product.nome}
                              </label>
                              <input
                                id={quantityId}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={maxQuantity(item)}
                                step={1}
                                value={draft}
                                onChange={(event) => changeQuantity(item, event.target.value)}
                                disabled={pending}
                                aria-invalid={!!validation}
                                aria-describedby={validation ? `${quantityId}-error` : undefined}
                              />
                              <button
                                type="button"
                                aria-label={`Aumentar quantidade de ${item.product.nome}`}
                                disabled={pending || item.quantity >= maxQuantity(item)}
                                onClick={() => changeQuantity(item, String(item.quantity + 1))}
                              >
                                <Plus size={14} aria-hidden="true" />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="cart-remove"
                              aria-label={`Remover ${item.product.nome} do carrinho`}
                              disabled={pending}
                              onClick={() => {
                                setError('');
                                onRemove(item.product.id);
                              }}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              <span>Remover</span>
                            </button>
                          </div>
                          {validation && (
                            <p className="cart-field-error" id={`${quantityId}-error`} role="alert">
                              {validation}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <section className="cart-summary" aria-label="Resumo do pedido">
                <h2>Resumo do pedido</h2>
                <div className="cart-summary-line">
                  <span>Produtos ({items.reduce((sum, item) => sum + item.quantity, 0)})</span>
                  <span>{safeTotal ? formatMoney(total) : 'Valor inválido'}</span>
                </div>
                <div className="cart-summary-total">
                  <span>Total</span>
                  <strong>{safeTotal ? formatMoney(total) : '—'}</strong>
                </div>
                {!safeTotal && (
                  <p className="cart-field-error" role="alert">
                    O valor do carrinho excede o limite permitido. Ajuste as quantidades.
                  </p>
                )}
                <p className="cart-demo-notice">
                  <CircleAlert size={15} aria-hidden="true" />
                  Compra de demonstração, sem cobrança. O pedido será criado como Pendente e não
                  reserva estoque.
                </p>
                {error && (
                  <p className="cart-api-error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  className="cart-primary"
                  disabled={!canCheckout || pending}
                  onClick={() => void checkout()}
                >
                  {pending ? (
                    <>
                      <LoaderCircle size={18} className="cart-spinner" aria-hidden="true" />
                      Enviando pedido…
                    </>
                  ) : (
                    <>
                      Finalizar pedido
                      <ArrowRight size={18} aria-hidden="true" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="cart-continue"
                  onClick={continueShopping}
                  disabled={pending}
                >
                  Continuar comprando
                </button>
              </section>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
