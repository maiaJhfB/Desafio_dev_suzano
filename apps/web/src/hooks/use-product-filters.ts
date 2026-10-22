'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseFilters, serializeFilters } from '@/lib/filters';
import type { ProductFilters } from '@/lib/types';
import { useUI } from '@/components/providers';

export function useProductFilters() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { dispatch } = useUI();
  const raw = params.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(raw)), [raw]);
  const latestFilters = useRef(filters);
  useEffect(() => {
    latestFilters.current = filters;
  }, [filters]);
  const canonical = serializeFilters(filters).toString();

  useEffect(() => {
    if (canonical !== raw) {
      router.replace(`${pathname}${canonical ? `?${canonical}` : ''}`, { scroll: false });
      dispatch({
        type: 'notify',
        message: 'Os filtros da URL foram ajustados para valores válidos.',
      });
    }
  }, [canonical, pathname, raw, router, dispatch]);

  const changeFilters = useCallback(
    (patch: Partial<ProductFilters>, replace = false) => {
      const next = { ...latestFilters.current, ...patch };
      if (patch.pagina === undefined) next.pagina = 1;
      latestFilters.current = next;
      const search = serializeFilters(next).toString();
      const url = `${pathname}${search ? `?${search}` : ''}`;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [filters, pathname, router],
  );

  return { filters, changeFilters };
}
