import { FileText, Layers3, Package, Droplets, ShoppingBag } from 'lucide-react';

export const storeCategories = [
  {
    name: 'Papel sulfite',
    label: 'Papéis para o dia a dia',
    icon: FileText,
    image: '/store/report-a4.png',
  },
  {
    name: 'Papéis gráficos',
    label: 'Ideias ganham vida',
    icon: Layers3,
    image: '/store/polen.png',
  },
  { name: 'Papelcartão', label: 'Para criar e embalar', icon: Package, image: '/store/cartao.png' },
  {
    name: 'Embalagens',
    label: 'Novas possibilidades',
    icon: ShoppingBag,
    image: '/store/greenbag.webp',
  },
  {
    name: 'Higiene',
    label: 'Cuidado em cada detalhe',
    icon: Droplets,
    image: '/store/higiene.webp',
  },
];
