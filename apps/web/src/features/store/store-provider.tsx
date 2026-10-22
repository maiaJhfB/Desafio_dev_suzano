'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { z } from 'zod';
import type { Produto } from '@/lib/types';
import type { CartItem } from '@/features/cart/cart-drawer';
import { addCartProduct, type AddProductResult } from './cart-state';

const savedCart = z
  .array(
    z.object({
      product: z.object({
        id: z.string().uuid(),
        nome: z.string().min(1).max(120),
        categoria: z.string(),
        descricao: z.string(),
        preco_centavos: z.number().int().min(0).max(100000000),
        quantidade_estoque: z.number().int().min(0).max(1000000),
        imagem_url: z.string().url().nullable(),
        created_at: z.string(),
        updated_at: z.string(),
      }),
      quantity: z.number().int().min(1).max(10000),
    }),
  )
  .max(100);

type StoreContextValue = {
  items: CartItem[];
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addProduct: (product: Produto) => AddProductResult;
  setQuantity: (id: string, quantity: number) => void;
  removeProduct: (id: string) => void;
  clearCart: () => void;
  detailProduct: Produto | null;
  setDetailProduct: (product: Produto | null) => void;
  openProductDetail: (product: Produto, trigger: HTMLElement) => void;
  restoreDetailFocus: () => void;
};
const StoreContext = createContext<StoreContextValue | null>(null);
const storageKey = 'suzano-store-cart-v1';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const itemsRef = useRef<CartItem[]>([]);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Produto | null>(null);
  useEffect(() => {
    try {
      const restored = savedCart.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
      if (restored.success) {
        itemsRef.current = restored.data;
        setItems(restored.data);
      }
    } catch {
      /* A corrupt or unavailable storage starts a fresh cart. */
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem(storageKey, JSON.stringify(items));
      } catch {
        /* Shopping remains available without persistent storage. */
      }
  }, [items, hydrated]);
  const updateItems = useCallback((next: CartItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);
  const addProduct = useCallback(
    (product: Produto) => {
      const next = addCartProduct(itemsRef.current, product);
      if (next.result === 'added') updateItems(next.items);
      return next.result;
    },
    [updateItems],
  );
  const setQuantity = useCallback(
    (id: string, quantity: number) => {
      if (!Number.isInteger(quantity) || quantity < 1) return;
      updateItems(
        itemsRef.current.map((item) =>
          item.product.id === id
            ? { ...item, quantity: Math.min(quantity, item.product.quantidade_estoque, 10000) }
            : item,
        ),
      );
    },
    [updateItems],
  );
  const removeProduct = useCallback(
    (id: string) => updateItems(itemsRef.current.filter((item) => item.product.id !== id)),
    [updateItems],
  );
  const clearCart = useCallback(() => updateItems([]), [updateItems]);
  const openProductDetail = useCallback((product: Produto, trigger: HTMLElement) => {
    detailTriggerRef.current = trigger;
    setDetailProduct(product);
  }, []);
  const restoreDetailFocus = useCallback(() => {
    if (detailTriggerRef.current?.isConnected)
      detailTriggerRef.current.focus({ preventScroll: true });
  }, []);
  return (
    <StoreContext.Provider
      value={{
        items,
        cartOpen,
        setCartOpen,
        addProduct,
        setQuantity,
        removeProduct,
        clearCart,
        detailProduct,
        setDetailProduct,
        openProductDetail,
        restoreDetailFocus,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore deve ser usado dentro de StoreProvider.');
  return value;
}
