import type { CartItem } from '@/features/cart/cart-drawer';
import type { Produto } from '@/lib/types';

export type AddProductResult =
  'added' | 'out_of_stock' | 'stock_limit' | 'quantity_limit' | 'item_limit';

export function addCartProduct(
  items: CartItem[],
  product: Produto,
): { items: CartItem[]; result: AddProductResult } {
  if (product.quantidade_estoque < 1) return { items, result: 'out_of_stock' };
  const existing = items.find((item) => item.product.id === product.id);
  if (existing) {
    if (existing.quantity >= product.quantidade_estoque) return { items, result: 'stock_limit' };
    if (existing.quantity >= 10_000) return { items, result: 'quantity_limit' };
    return {
      items: items.map((item) =>
        item.product.id === product.id ? { product, quantity: item.quantity + 1 } : item,
      ),
      result: 'added',
    };
  }
  if (items.length >= 100) return { items, result: 'item_limit' };
  return { items: [...items, { product, quantity: 1 }], result: 'added' };
}

export function addProductMessage(result: AddProductResult): string {
  switch (result) {
    case 'added':
      return 'Produto adicionado ao carrinho.';
    case 'out_of_stock':
      return 'Este produto está sem estoque.';
    case 'stock_limit':
      return 'Você já adicionou todo o estoque disponível deste produto.';
    case 'quantity_limit':
      return 'O limite é de 10.000 unidades por produto.';
    case 'item_limit':
      return 'O carrinho aceita até 100 produtos diferentes. Remova um item para adicionar outro.';
  }
}
