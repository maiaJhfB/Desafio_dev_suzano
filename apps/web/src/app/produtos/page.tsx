import { Suspense } from 'react';
import { Catalog } from '@/components/catalog';

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="startup-screen" role="status">
          Preparando seu catálogo…
        </div>
      }
    >
      <Catalog />
    </Suspense>
  );
}
