# Portal — inventário de funcionalidades (protótipo `index.html`)

Código e visual próprios, inspirados no layout e no conjunto de funcionalidades do template de referência.
Os dados são fictícios e gerados no navegador (função `seed()`). Cada item marcado com 🔌 precisa de API/back-end para ir para produção.

Marque **Entra / Depois / Fora** para decidir o escopo.

| # | Tela | Funcionalidade | No protótipo | Para produção | Decisão |
|---|------|----------------|--------------|---------------|---------|
| 1 | Global | Menu lateral compacto com tooltip, grupos e contadores | ✅ | — | |
| 2 | Global | Saudação e data no topo, alternância de tema escuro/claro | ✅ | — | |
| 3 | Global | Busca global (Ctrl+K): páginas, pedidos, clientes e produtos | ✅ | 🔌 busca no servidor | |
| 4 | Global | Notificações (estoque zerado, fatura vencida, chat, pedido pago) com "marcar como lidas" | ✅ | 🔌 eventos/push | |
| 5 | Global | Menu "Criar" (pedido, produto, cliente, fatura, cupom, despesa, e-mail) | ✅ | 🔌 | |
| 6 | Global | Layout responsivo (menu vira gaveta no celular) | ✅ | — | |
| 7 | Painel | KPIs: hoje, 7 dias, pedidos hoje (com variação % e sparkline) | ✅ | 🔌 | |
| 8 | Painel | Gráfico de vendas 12M/6M/30D/7D com comparação e tooltip | ✅ | 🔌 | |
| 9 | Painel | Meta mensal (anel de progresso, ritmo diário, edição) | ✅ | 🔌 | |
| 10 | Painel | Loja ao vivo (visitantes, carrinhos, conversão) | ⚠️ simulado | 🔌 analytics em tempo real | |
| 11 | Painel | Fila de separação com botão "Embalar" | ✅ | 🔌 | |
| 12 | Painel | Estoque baixo com "Repor" | ✅ | 🔌 | |
| 13 | Painel | Origem das vendas por canal | ✅ | 🔌 | |
| 14 | Painel | Últimos pedidos (abre a gaveta de detalhes) e mais vendidos | ✅ | 🔌 | |
| 15 | Pedidos | Tabela com filtros (canal, período, status), busca, paginação e seleção em massa | ✅ | 🔌 | |
| 16 | Pedidos | Quadro de separação (kanban com arrastar e soltar) | ✅ | 🔌 | |
| 17 | Pedidos | Devoluções, cancelamento com retorno ao estoque | ✅ | 🔌 | |
| 18 | Pedidos | Exportar CSV (compatível com Excel pt-BR) | ✅ | — | |
| 19 | Produtos | Catálogo em cards (filtro de status/categoria, ordenação, busca), criar/editar | ✅ | 🔌 + upload de fotos | |
| 20 | Produtos | Estoque: cobertura em dias, ponto de reposição, reposição | ✅ | 🔌 | |
| 21 | Produtos | Categorias com valor de estoque | ✅ | 🔌 | |
| 22 | Análises | Vendas: KPIs de 60 dias, receita por dia/semana/mês, tabela mês a mês vs ano anterior | ✅ | 🔌 | |
| 23 | Análises | Visitantes e origem do tráfego | ⚠️ simulado | 🔌 GA4/Pixel | |
| 24 | Análises | Funil de checkout | ⚠️ simulado | 🔌 GA4/Pixel | |
| 25 | Análises | Enviar relatório por e-mail | ⚠️ só a interface | 🔌 serviço de e-mail | |
| 26 | Clientes | Lista com segmentos (VIP, Recorrente, Novo, Em risco, Atacado), ordenação e busca | ✅ | 🔌 | |
| 27 | Clientes | Gaveta do cliente (métricas e histórico de pedidos) | ✅ | 🔌 | |
| 28 | Clientes | Moderação de avaliações | ✅ | 🔌 | |
| 29 | Financeiro | Resultado: vendas, despesas, taxas, lucro, gráfico de entradas e saídas, despesas por categoria, demonstrativo | ✅ | 🔌 ERP/contabilidade | |
| 30 | Financeiro | Repasses semanais do cartão | ⚠️ calculado | 🔌 gateway de pagamento | |
| 31 | Financeiro | Lançamento e exclusão de despesas | ✅ | 🔌 | |
| 32 | Faturas | KPIs, filtros, enviar, marcar paga, lembrar vencidas, saldo por cliente | ✅ | 🔌 + boleto/NF-e | |
| 33 | Cupons | Cards com usos e limite, pausar/ativar, copiar, criar | ✅ | 🔌 integração com o checkout | |
| 34 | Conversas | Caixa unificada, respostas rápidas, encerrar/reabrir | ✅ | 🔌 WhatsApp/Instagram API | |
| 35 | E-mail | Pastas, leitura, estrela, arquivar, escrever/responder/encaminhar | ✅ | 🔌 IMAP/SMTP ou Gmail API | |
| 36 | Apps | Vitrine de integrações com instalar/remover | ⚠️ só a interface | 🔌 integrações reais | |
| 37 | Configurações | Loja, equipe (papéis/convite), aparência (tema, cor, compacto), notificações, exportação/backup | ✅ | 🔌 autenticação e permissões | |
| 38 | Ajuda | Busca, categorias, FAQ e formulário de suporte com histórico | ✅ | 🔌 helpdesk | |

## Notas técnicas
- Tudo está em um único arquivo `index.html` (HTML + CSS + JS puro, sem dependências; a fonte Inter vem do Google Fonts). Os gráficos são SVG gerados à mão.
- O estado fica em `localStorage` (`portal-dashboard-v3`). Os dados de demonstração são regerados uma vez por dia, mantendo as preferências.
- Para ligar ao Portal real, troque `seed()` e as funções de consulta (`rev`, `cnt`, `units`, `custStats`…) por chamadas à API. As telas só leem o objeto `S`.
- As capturas `preview-*.png` são do protótipo.
