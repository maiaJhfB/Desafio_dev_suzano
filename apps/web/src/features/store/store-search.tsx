'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export function StoreSearch({
  value,
  onSearch,
}: {
  value: string;
  onSearch: (value: string) => void;
}) {
  const [search, setSearch] = useState(value);
  useEffect(() => {
    setSearch(value);
  }, [value]);
  useEffect(() => {
    if (search.trim() === value) return;
    const timer = setTimeout(() => onSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, value, onSearch]);
  return (
    <form
      className="store-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(search.trim());
        document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      <label className="sr-only" htmlFor="search-products">
        Encontre um produto
      </label>
      <input
        id="search-products"
        type="search"
        placeholder="Buscar produtos, marcas e muito mais…"
        maxLength={120}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <button type="submit" aria-label="Buscar produtos">
        <Search size={22} strokeWidth={1.6} />
      </button>
    </form>
  );
}
