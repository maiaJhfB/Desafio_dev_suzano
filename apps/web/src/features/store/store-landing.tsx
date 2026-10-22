import { ArrowRight, ChevronRight, Headphones, Leaf, Package, ShoppingCart } from 'lucide-react';
import { storeCategories } from './categories';
interface StoreLandingProps {
  onClearFilters: () => void;
  onExplore: () => void;
}
export function StoreHero({ onClearFilters, onExplore }: StoreLandingProps) {
  return (
    <section className="store-hero" aria-labelledby="page-title">
      <div className="store-container hero-inner">
        <div className="hero-copy">
          <p className="hero-eyebrow">
            <span />
            DO NOSSO MUNDO PARA O SEU DIA A DIA
          </p>
          <h1 id="page-title">
            Escolhas que
            <br />
            fazem <span>bem.</span>
          </h1>
          <p>
            Papéis, embalagens e cuidado.
            <br />
            Tudo o que você precisa, em um só lugar.
          </p>
          <button
            className="button button-hero"
            onClick={() => {
              onClearFilters();
              onExplore();
            }}
          >
            Explorar produtos
            <ArrowRight size={18} />
          </button>
          <span className="hero-footnote">Para você. Para o seu negócio. Para o futuro.</span>
        </div>
        <div className="hero-products" aria-hidden="true">
          <span className="hero-orbit orbit-one" />
          <span className="hero-orbit orbit-two" />
          <div className="hero-product-platform" />
          <img
            className="hero-report"
            src="/store/report-caixa.png"
            alt=""
            width={400}
            height={400}
          />
          <img className="hero-paper" src="/store/report-a4.png" alt="" width={300} height={300} />
          <div className="hero-seal">
            <Leaf size={21} />
            <span>
              O futuro
              <br />
              <strong>tem raízes.</strong>
            </span>
          </div>
          <span className="hero-caption">
            PAPEL REPORT
            <br />
            <strong>Ideias que ganham vida.</strong>
          </span>
        </div>
      </div>
    </section>
  );
}
export function StoreBenefits() {
  return (
    <div className="store-benefits">
      <div>
        <Leaf />
        <span>
          <strong>Origem renovável</strong>
          <small>Produtos do portfólio Suzano</small>
        </span>
      </div>
      <div>
        <Package />
        <span>
          <strong>Para todas as suas ideias</strong>
          <small>Casa, escritório e negócio</small>
        </span>
      </div>
      <div>
        <ShoppingCart />
        <span>
          <strong>Sua compra, do seu jeito</strong>
          <small>Escolha, adicione e revise</small>
        </span>
      </div>
      <div>
        <Headphones />
        <span>
          <strong>Mais perto de você</strong>
          <small>Conheça nossos canais de atendimento</small>
        </span>
      </div>
    </div>
  );
}
interface StoreCategoriesProps extends StoreLandingProps {
  category?: string;
  onChooseCategory: (category?: string) => void;
}
export function StoreCategories({
  category: selectedCategory,
  onChooseCategory,
  onClearFilters,
  onExplore,
}: StoreCategoriesProps) {
  return (
    <section className="store-category-section" aria-label="Compre por categoria">
      <div className="section-title">
        <h2>O que você precisa hoje?</h2>
        <button
          onClick={() => {
            onClearFilters();
            onExplore();
          }}
        >
          Ver todos os produtos
          <ArrowRight size={15} />
        </button>
      </div>
      <div className="category-tiles">
        {storeCategories.map((category) => (
          <button
            key={category.name}
            className={`category-tile${selectedCategory === category.name ? ' active' : ''}`}
            onClick={() => {
              onChooseCategory(category.name);
              onExplore();
            }}
          >
            <span className="category-thumbnail">
              <img src={category.image} alt="" width={100} height={100} />
            </span>
            <span>
              <strong>{category.name}</strong>
              <small>{category.label}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </section>
  );
}
export function StoreBrandBanner() {
  return (
    <section className="store-brand-banner">
      <div>
        <p>UM FUTURO MELHOR COMEÇA AGORA.</p>
        <h2>
          Pequenas escolhas.
          <br />
          <span>Novas possibilidades.</span>
        </h2>
        <a href="https://www.suzano.com.br/sustentabilidade" target="_blank" rel="noreferrer">
          Conheça o universo Suzano
          <ArrowRight size={17} />
        </a>
      </div>
      <img src="/brand/suzano-colorido.svg" alt="Suzano" width={190} height={45} />
      <Leaf size={220} className="banner-leaf" aria-hidden="true" />
    </section>
  );
}
