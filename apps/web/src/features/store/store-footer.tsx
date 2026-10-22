import type { Ref } from 'react';
import { Plus } from 'lucide-react';
import { apiMode } from '@/lib/api';
import { storeCategories } from './categories';
interface StoreFooterProps {
  onChooseCategory: (category?: string) => void;
  onExplore: () => void;
  addButtonRef: Ref<HTMLButtonElement>;
  onCreateProduct: () => void;
}
export function StoreFooter({
  onChooseCategory,
  onExplore,
  addButtonRef,
  onCreateProduct,
}: StoreFooterProps) {
  return (
    <footer className="store-footer">
      <div className="store-container">
        <div className="footer-main">
          <div>
            <img src="/brand/suzano-colorido.svg" alt="Suzano" width={150} height={35} />
            <p>
              Da natureza para as escolhas
              <br />
              que fazem parte da sua vida.
            </p>
          </div>
          <div>
            <h2>Encontre na loja</h2>
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
          </div>
          <div>
            <h2>Conheça a Suzano</h2>
            <a href="https://www.suzano.com.br/" target="_blank" rel="noreferrer">
              Sobre a empresa
            </a>
            <a href="https://www.suzano.com.br/produtos-e-marcas" target="_blank" rel="noreferrer">
              Nossas marcas
            </a>
            <a href="https://www.suzano.com.br/sustentabilidade" target="_blank" rel="noreferrer">
              Sustentabilidade
            </a>
          </div>
          <div className="footer-admin">
            <h2>Gerenciar catálogo</h2>
            <p>Área de demonstração administrativa.</p>
            <button
              ref={addButtonRef}
              className="button button-secondary"
              onClick={() => onCreateProduct()}
            >
              <Plus size={15} />
              Novo produto
            </button>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            Projeto de demonstração com identidade Suzano. Preços, estoque e apresentações
            ilustrativos. Sem cobrança ou envio real.
          </p>
          <span>
            {apiMode === 'mock'
              ? 'Modo demonstração · cadastros reiniciam ao recarregar'
              : 'Conectado ao seu catálogo'}
          </span>
        </div>
      </div>
    </footer>
  );
}
