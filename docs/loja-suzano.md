# Loja demonstrativa com identidade Suzano

A interface evolui o catálogo do teste para uma loja: busca em destaque, navegação por categorias, cards com preço e estoque, carrinho e envio de pedido. O arranjo de compra usa padrões conhecidos de marketplaces. Logo, cores e imagens de referência vêm dos canais oficiais da Suzano; a composição desta interface é uma implementação própria para o teste.

## Fontes consultadas

Consulta em 21/10/2026, usando fontes oficiais:

| Fonte                                                                                                                   | Uso no projeto                                              |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [Site institucional Suzano](https://www.suzano.com.br/en)                                                               | Referência visual institucional e identificação da marca    |
| [Loja Suzano](https://loja.suzano.com.br/suzano/pt/)                                                                    | Referência de apresentação comercial e categorias de papel  |
| [Logo publicado na loja Suzano](https://loja.suzano.com.br/_ui/responsive/theme-suzano/images/logosuzano_white.png)     | Origem verificável do logotipo branco oficial               |
| [Portfólio Imprimir e Escrever](https://www.suzano.com.br/produtos-e-marcas/papel/imprimir-e-escrever)                  | Referência de famílias Report A4, A3, Coloridos e Reciclato |
| [Linha Report na loja oficial](https://loja.suzano.com.br/suzano/pt/Papel-Sulfite/Papel-Sulfite-Report/c/SUZANO_REPORT) | Referência dos nomes e variantes de produtos                |

Os canais oficiais apresentam famílias como Report, Senninha, Pólen e papéis revestidos e não revestidos. O catálogo local seleciona exemplos para demonstrar categorias, busca, ordenação e paginação. As descrições são resumidas para a demonstração, sem reproduzir textos promocionais extensos. [Loja Suzano](https://loja.suzano.com.br/suzano/pt/), [Portfólio de papéis](https://www.suzano.com.br/produtos-e-marcas/papel/imprimir-e-escrever).

O [registro de assets](brand/assets.json) relaciona as URLs de origem e os arquivos incorporados. O SVG colorido do cabeçalho institucional foi preservado em `apps/web/public/brand/suzano-colorido.svg`. As fontes Suzano Text Regular, Medium e Bold publicadas pelo site institucional são servidas localmente para manter a composição e a captura de tela independentes de fontes externas.

Os tokens foram extraídos dos recursos oficiais: azul do logo `#03267F`, azul do site `#1932C8` e verde `#00C85A`. A fonte dos dois últimos é o stylesheet `suzano-otimizacao.webflow.69cb021343dbf125cabfa964.1781c751b.opt.min.css`, registrado no manifesto. Eles não são apresentados como um manual normativo de marca: não foi localizado e validado um brandbook público com códigos oficiais.

Para legibilidade, verde é usado como acento ou com texto azul escuro. Branco sobre o verde tem contraste aproximado de 2,23:1, enquanto azul `#03267F` sobre verde chega a 5,93:1. Branco sobre o azul `#1932C8` chega a 9,01:1. Esses valores são cálculos das combinações exatas de cor e não substituem a inspeção dos elementos renderizados.

## Escopo de compra

Preços e quantidades de estoque são **ilustrativos**, definidos pelo seed do teste. Eles não são cotações comerciais, disponibilidade atual nem condições oferecidas pela loja oficial. A demonstração funciona localmente e não envia pedidos à Suzano.

O carrinho permite adicionar produtos e alterar quantidades. Seu estado fica salvo no navegador para sobreviver ao recarregamento. A API continua sendo a autoridade sobre preços e estoque: dados do carrinho não definem o valor final aceito pelo servidor.

Ao selecionar **Finalizar pedido**, o frontend envia produtos e quantidades ao endpoint de pedidos, com status **Pendente**. O servidor calcula os totais e devolve o identificador do pedido. A tela mostra **Pedido recebido** e o identificador para confirmar a operação. Só se limpa o carrinho depois da resposta de sucesso; falhas devem preservar os itens.

Não há cobrança, dados de cartão, frete contratado ou integração com meio de pagamento. Criar um pedido pendente confere estoque sem reservá-lo ou baixá-lo. A conclusão pelo endpoint de status revalida a disponibilidade e baixa o estoque em uma transação, conforme [as regras de domínio](arquitetura.md).

No modo mock, MSW responde ao mesmo contrato HTTP e o pedido existe apenas na demonstração daquela sessão. No modo real, NestJS e PostgreSQL persistem o pedido. O carrinho persistido no navegador não altera essa diferença entre os modos.

## Relação com o teste técnico

Cadastro, cinco atributos do produto, filtros, ordenação, estado global, HTTP mock e testes permanecem como base. Categorias navegáveis, carrinho e checkout demonstrativo são extensões solicitadas posteriormente; não substituem os obrigatórios. A identidade visual é um complemento ao critério de desempate de aparência, enquanto comportamento, organização e testes continuam centrais.

## Verificação da loja

`apps/web/tests/e2e/store.spec.ts` cobre quatro cenários: adicionar produto, aumentar a quantidade, recarregar com carrinho preservado, enviar pedido e observar confirmação; usar a loja e o dialog em viewport de 360 px, incluindo quantidade inválida e retorno de foco; abrir os detalhes de um produto e adicioná-lo ao carrinho; fechar os detalhes por teclado e devolver o foco ao título ou à imagem de origem. Execução, resultado e eventuais limitações estão em [evidencias.md](evidencias.md); a existência do teste isoladamente não representa uma execução aprovada.
