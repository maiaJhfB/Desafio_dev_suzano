import type { Ref } from 'react';
import { ArrowRight, Headphones, Leaf, Menu, ShoppingCart } from 'lucide-react';
import { storeCategories } from './categories';
import { StoreSearch } from './store-search';
interface StoreHeaderProps {
  name: string;
  onSearch: (name: string) => void;
  cartCount: number;
  cartButtonRef: Ref<HTMLButtonElement>;
  onOpenCart: () => void;
  onChooseCategory: (category?: string) => void;
  onExplore: () => void;
}
export function StoreHeader({
  name,
  onSearch,
  cartCount,
  cartButtonRef,
  onOpenCart,
  onChooseCategory,
  onExplore,
}: StoreHeaderProps) {
  return (
    <header className="store-header">
      <div className="store-topline">
        <div className="store-container">
          <span>
            <Leaf size={13} />
            Escolhas que renovam o seu dia.
          </span>
          <span>Loja de demonstração · sem cobrança real</span>
        </div>
      </div>
      <div className="store-header-main store-container">
        <a href="/produtos" className="store-brand" aria-label="Suzano — início">
          <img
            src="/brand/suzano-oficial.svg"
            alt="Suzano — nós plantamos o futuro"
            width={169}
            height={53}
          />
          <span>loja</span>
        </a>
        <StoreSearch value={name} onSearch={onSearch} />
        <a
          className="header-service"
          href="https://www.suzano.com.br/fale-conosco"
          target="_blank"
          rel="noreferrer"
        >
          <Headphones size={23} />
          <span>
            Precisa de ajuda?<strong>Atendimento</strong>
          </span>
        </a>
        <button
          ref={cartButtonRef}
          className="header-cart"
          aria-label={`Carrinho, ${cartCount} itens`}
          onClick={() => onOpenCart()}
        >
          <span className="cart-icon">
            <ShoppingCart size={25} strokeWidth={1.6} />
            <span className="cart-count">{cartCount}</span>
          </span>
          <span>
            Meu
            <br />
            <strong>carrinho</strong>
          </span>
        </button>
      </div>
      <div className="store-nav">
        <nav className="store-container" aria-label="Navegação principal">
          <button
            onClick={() => {
              onChooseCategory();
              onExplore();
            }}
          >
            <Menu size={18} />
            Todos os produtos
          </button>
          {storeCategories.map((category) => (
            <button
              key={category.name}
              onClick={() => {
                onChooseCategory(category.name);
                onExplore();
              }}
            >
              {category.name}
            </button>
          ))}
          <a href="https://www.suzano.com.br/produtos-e-marcas" target="_blank" rel="noreferrer">
            Conheça nossas marcas
            <ArrowRight size={14} />
          </a>
        </nav>
      </div>
    </header>
  );
}
