import fixture from '../../../../packages/contracts/store-products.json';
import type { Produto } from '@/lib/types';

export const seedProducts: Produto[] = fixture.map((product, index) => ({
  ...product,
  created_at: new Date(Date.UTC(2026, 9, 20 - index, 12)).toISOString(),
  updated_at: new Date(Date.UTC(2026, 9, 20 - index, 12)).toISOString(),
}));
