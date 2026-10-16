// Constantes do portal (métricas, metas, rótulos). Vieram do app.js de antes da migração para React (16/10).

export const PERIODS = [
  { id: "day", label: "Dia" }, { id: "week", label: "Semana" }, { id: "month", label: "Mês" },
  { id: "3m", label: "3 meses" }, { id: "6m", label: "6 meses" }, { id: "9m", label: "9 meses" }, { id: "12m", label: "12 meses" },
];


export const GROUPS = [
  { title: "Operação", metrics: [
    { id: "leads", label: "Leads", unit: "n", src: "leads" },
    { id: "orders", label: "Pedidos", unit: "n", src: "orders" },
    { id: "conversion", label: "Taxa de conversão", unit: "pct", src: "orders ÷ leads", goal: "≥ 6% mín · 10% ideal" },
    { id: "cpl", label: "CPL (custo por conversa)", unit: "brl", src: "Meta Ads", goal: "≤ R$ 1,75 mín · R$ 1,25 ideal" },
    { id: "api_per_lead", label: "Custo de API por lead", unit: "brl", src: "eval_conversation_cost", goal: "teto R$ 1,00" },
    { id: "cpl_api", label: "CPL + API", unit: "brl", src: "Meta Ads + eval_conversation_cost" },
    { id: "handoff", label: "Handoff (aviso ao operador)", unit: "pct", src: "não resolvidas ÷ conversas encerradas", goal: "≤ 10%" },
    { id: "fallback", label: "Resposta pronta (fallback)", unit: "pct", src: "eval_turn_outcomes" },
    { id: "optout", label: "Opt-out", unit: "pct", src: "leads", goal: "≤ 2,5%" },
    { id: "invalid_premise", label: "Premissa indevida", unit: "pct", src: "hermes_runs: conversas com premissa ÷ conversas lidas na última rodada", goal: "≤ 5%" },
  ]},
  { title: "Financeiro", metrics: [
    { id: "revenue", label: "Faturamento", unit: "brl", src: "orders" },
    { id: "op_cost", label: "Custo operacional", unit: "brl", src: "orders + config" },
    { id: "gross_profit", label: "Lucro bruto", unit: "brl", src: "orders + config" },
    { id: "net_profit", label: "Lucro líquido (comissões recebidas)", unit: "brl", src: "Coinzz/Logzz/Mercado Pago" },
    { id: "op_margin", label: "Margem operacional", unit: "pct", src: "(contribuição dos pedidos − anúncio − API) ÷ faturamento", goal: "> 0%" },
    { id: "roi", label: "ROI", unit: "x", src: "lucro bruto ÷ (anúncio + API)", goal: "≥ 1,5 mín · 2,5 ideal" },
    { id: "cash_left", label: "Caixa reservado restante", unit: "brl", src: "manual (R$ 1.500)" },
    { id: "prepaid_share", label: "% antecipado × entrega", unit: "pct", src: "orders" },
    { id: "refusal", label: "Recusa na porta", unit: "pct", src: "orders", goal: "≤ 17%" },
  ]},
  { title: "Anúncio", metrics: [
    { id: "spend", label: "Gasto", unit: "brl", src: "Meta Ads" },
    { id: "cpm", label: "CPM", unit: "brl", src: "Meta Ads" },
    { id: "ctr", label: "CTR do link", unit: "pct", src: "Meta Ads", goal: "≥ 1% mín · 2% ideal" },
  ]},
  { title: "Agente (Malu)", metrics: [
    { id: "resolution", label: "Taxa de resolução", unit: "pct", src: "conversas que compraram ou encerraram sem compra ÷ encerradas", goal: "≥ 90% (handoff ≤ 10%)" },
    { id: "transfers", label: "Não resolvidas (aviso ao operador)", unit: "n", src: "turn_outcomes (handoff ou fallback)" },
    { id: "first_response", label: "Tempo até a 1ª resposta", unit: "min", src: "messages (carimbos)" },
    { id: "handle_time", label: "Tempo de atendimento", unit: "min", src: "messages (carimbos)" },
    { id: "reply_rate", label: "Taxa de resposta", unit: "pct", src: "eval_funnel", goal: "≥ 60% mín · 75% ideal" },
    { id: "price_reach", label: "% que chega ao preço", unit: "pct", src: "eval_funnel", goal: "≥ 40% mín · 55% ideal" },
    { id: "link_reach", label: "% que recebe o link", unit: "pct", src: "eval_funnel" },
    { id: "rewrites", label: "Reescritas por resposta", unit: "n", src: "eval_turn_outcomes" },
    { id: "gate_blocks", label: "Bloqueios de gate", unit: "pct", src: "eval_gate_blocks" },
    { id: "delivered", label: "Entregas concluídas ÷ pedidos", unit: "pct", src: "orders", goal: "≥ 70% mín · 83% ideal" },
  ]},
];

export const ALL = GROUPS.flatMap((g) => g.metrics);


export const PAUSE = [
  { id: "p_premise", label: "Conversas com premissa indevida", what: "a Malu afirmou algo que a cliente não disse (lido pelo Hermes, em lotes de 50)", limit: "pausar acima de 5% das conversas", missing: "nenhuma rodada do Hermes no período ainda (ele roda a cada 50 leads)" },
  { id: "p_handoff", label: "Conversas que a Malu não resolveu", what: "a Malu precisou avisar o operador", limit: "pausar acima de 10% das conversas", missing: "nenhuma conversa encerrada no período" },
  { id: "p_optout", label: "Clientes que pediram para sair", what: "pediram para não receber mais mensagem", limit: "pausar acima de 2,5% dos leads", missing: "nenhum lead no período" },
  { id: "p_api", label: "Conversas caras de API", what: "das últimas 100 conversas, quantas custaram mais de R$ 1,00 de modelo", limit: "pausar acima de 5% delas", missing: "nenhuma conversa com custo registrado" },
  { id: "p_cash", label: "Necessidade de caixa", what: "quanto está adiantado em pedidos na entrega ainda não repassados (produto, entrega, manuseio e taxa; volta 14 dias depois de completo)", limit: "pausar acima de R$ 1.075 (o caixa utilizável do teste)", missing: "nenhum pedido no período" },
  { id: "p_channel", label: "Número do WhatsApp", what: "o número está liberado pela Meta e a Cloud API responde", limit: "pausar se restrito, banido ou fora do ar", missing: "estado do canal não informado" },
];


export const PHASES = [
  ["Copy (dias 1–5)", "CPL ≤ R$ 1,75 · CTR ≥ 1% · resposta ≥ 60% · chega ao preço ≥ 40%", "CPL ≤ R$ 1,25 · CTR ≥ 2% · resposta ≥ 75% · preço ≥ 55%"],
  ["Região (dias 6–10)", "CPL ≤ R$ 1,50 · conversão ≥ 6%", "CPL ≤ R$ 1,25 · conversão ≥ 10%"],
  ["Leitura (dias 11–12)", "entregas ≥ 70%", "entregas ≥ 83% (recusa ≤ 17%)"],
];

export const DECISION = [
  ["Escalar", "> 10%", "< R$ 1,25", "> 2,5"],
  ["Ajustar", "6%–10%", "R$ 1,25–1,75", "1,5–2,5"],
  ["Parar", "< 6%", "> R$ 1,75", "< 1,5"],
];

export const SAMPLE_FLOOR = { leads: 500, orders: 50, spend: 500 };



export const KPIS = ["leads", "orders", "conversion", "revenue", "resolution", "api_per_lead", "net_profit", "op_margin"];

export const LOWER = new Set(["cpl", "api_per_lead", "cpl_api", "handoff", "fallback", "optout", "invalid_premise", "op_cost", "refusal", "spend", "cpm", "rewrites", "gate_blocks", "transfers", "first_response", "handle_time"]);

export const FUNNEL = [["first_msg", "Mandou a 1ª mensagem"], ["reply", "Respondeu à agente"], ["price", "Chegou ao preço"], ["link", "Recebeu o link"], ["order", "Pedido criado"], ["delivered", "Entrega concluída"]];

export const SERVICE = [["leads", "Atendimentos"], ["first_response"], ["handle_time"]];

export const OUTCOMES = [
  ["bought", "Comprou", "ok", "Pedido criado, em rota ou entregue"],
  ["declined", "Encerrou sem compra", "ok", "Recusou, desistiu ou a régua encerrou, sem precisar de pessoa"],
  ["unresolved", "Não resolvida", "bad", "A Malu avisou o operador (handoff ou resposta pronta)"],
  ["abandoned", "Abandonada", "warn", "Mais de 24 h sem resposta dela, sem decisão"],
  ["open", "Em andamento", "", "Conversa com movimento nas últimas 24 h"],
];

export const OUTCOME = Object.fromEntries(OUTCOMES.map(([id, l, c]) => [id, { l, c }]));

export const STAGE = { novo: "Nova", conversando: "Conversando", tamanho_definido: "Tamanho definido", cobertura_conhecida: "Cobertura conhecida", caminho_escolhido: "Pagamento escolhido", link_enviado: "Link enviado", pedido_criado: "Pedido criado", em_rota: "Em rota", entregue_pago: "Entregue e pago", recusado: "Recusado na porta", perdido: "Perdido", bloqueado: "Bloqueado" };

export const AGENT_HEALTH = ["handoff", "fallback", "rewrites", "gate_blocks", "optout", "invalid_premise", "api_per_lead", "cpl_api"];

export const CHANNEL = [["number", "Número do WhatsApp"], ["cloud_api", "Cloud API"], ["window", "Janela gratuita de 72 h"], ["templates", "Templates aprovados na Meta"]];




export const REF = [
  ["Oferta (config e site)", [["Produto", "Colete Cinta Modeladora, tamanhos P, M, G, GG e XGG"], ["Pagamento na entrega", "R$ 129,90, frete grátis"], ["Pagamento antecipado", "R$ 110,42 (15% off), frete por conta da cliente, calculado no checkout"], ["Âncora de preço", "R$ 216,50"], ["Garantia", "7 dias"], ["Atendimento", "06:00 às 00:00; fora disso, mensagem automática"], ["Mix previsto", "70% na entrega, 30% antecipado, 1 peça por pedido"]]],
  ["Economia por pedido (estudo de projeção, não medido)", [["COD entregue", "+ R$ 63,35 (produto R$ 30, transação, handling R$ 4,99, entrega R$ 19,99)"], ["COD recusado", "− R$ 14,98 (recusa R$ 9,99)"], ["Antecipado", "+ R$ 70,21"], ["Média com mix 70/30", "R$ 57,18 por pedido"], ["Recusa na porta (premissa)", "12% a 17%; a Logzz declara 13% a 16%"], ["Devolução pós-envio", "5% a 10% a R$ 25,00"], ["Equilíbrio", "conversão de 3,58% com CPL de R$ 1,25"], ["Comissão da entrega", "libera 14 dias depois do pagamento"]]],
  ["Medido × premissa", [["Custo de API por conversa", "medido R$ 0,051 (4 conversas de teste, máx R$ 0,073) × premissa do estudo R$ 0,80 por lead"], ["Teto do modelo por conversa", "R$ 0,50 (p50 medido R$ 0,268 e p95 R$ 0,546 no modelo padrão, 30/09)"], ["Custo do WhatsApp por lead", "R$ 0 dentro da janela de 24 h ou da gratuita de 72 h; template UTILITY ~ R$ 0,04 por pedido"]]],
  ["Teste de tráfego (L3)", [["Fase Copy, dias 1 a 5", "R$ 300, 6 vídeos, 1 conjunto aberto no Brasil, mulheres de 18 a 55"], ["Fase Região, dias 6 a 10", "R$ 200, só as 2 copies vencedoras; A = estados com mais de 5 cidades atendidas, B = Sudeste + Centro-Oeste + Sul"], ["Fase Leitura, dias 11 e 12", "R$ 0; as entregas chegam à porta"], ["Verba total", "R$ 500 de anúncio + R$ 1.500 de caixa reservado para o custo do pedido"], ["Piso de amostra", "mais de 500 leads atendidos e mais de 50 pedidos criados"], ["Primeira resposta da agente", "1 minuto depois da mensagem"], ["Régua de silêncio", "silence_3 entre 63 h e 71 h depois da abertura da janela de 72 h"]]],
];

export const BUCKETS = { day: [24, 1 / 24], week: [7, 1], month: [30, 1], "3m": [13, 7], "6m": [26, 7], "9m": [39, 7], "12m": [52, 7] };

export const RANGE = { leads: [40, 90], orders: [3, 9], conversion: [5, 11], cpl: [1.1, 1.9], api_per_lead: [.4, .9], cpl_api: [1.6, 2.7], handoff: [6, 13], fallback: [2, 6], optout: [1, 3.2], invalid_premise: [2, 6.5], revenue: [390, 1170], op_cost: [200, 600], gross_profit: [120, 420], net_profit: [60, 300], roi: [1.2, 2.9], cash_left: [900, 1500], ticket_pieces: [1, 1.4], prepaid_share: [20, 40], refusal: [10, 19], spend: [60, 110], cpm: [12, 28], ctr: [.8, 2.4], cpc: [.5, 1.4], view_content: [50, 80], add_to_cart: [15, 35], checkout: [40, 70], site_conversion: [2, 4.5], cpa: [25, 45], failed_delivery: [12, 19], reply_rate: [55, 80], price_reach: [35, 60], link_reach: [20, 40], rewrites: [.3, 1.2], gate_blocks: [3, 9], delivered: [65, 88] };

export const SUMMED = new Set(["leads", "orders", "transfers", "revenue", "op_cost", "gross_profit", "net_profit", "spend"]);

export const STATUS_RUN = { success: "sucesso", error: "erro", crashed: "falhou", running: "rodando", waiting: "esperando", canceled: "cancelada" };

export const MODE = { trigger: "gatilho", webhook: "webhook", manual: "manual", integrated: "chamado por outro", retry: "nova tentativa", cli: "linha de comando" };

export const NODE = { webhook: "Webhook", httpRequest: "Chamada HTTP", if: "Condição", code: "Código", emailSend: "E-mail", wait: "Espera", scheduleTrigger: "Relógio", formTrigger: "Formulário (início)", form: "Formulário", executeWorkflow: "Chama workflow", executeWorkflowTrigger: "Chamado por workflow", respondToWebhook: "Responde webhook", splitInBatches: "Lotes", manualTrigger: "Manual" };

export const AD_STATUS = { ACTIVE: ["Ativo", "ok"], PAUSED: ["Pausado", ""], CAMPAIGN_PAUSED: ["Campanha pausada", ""], ADSET_PAUSED: ["Conjunto pausado", ""], DELETED: ["Apagado", ""], ARCHIVED: ["Arquivado", ""], IN_PROCESS: ["Em análise", "warn"], PENDING_REVIEW: ["Em análise", "warn"], DISAPPROVED: ["Reprovado", "bad"], WITH_ISSUES: ["Com problema", "bad"], PENDING_BILLING_INFO: ["Falta pagamento", "bad"] };

export const GENDER = { 1: "homens", 2: "mulheres" };

export const COMPARE = [["spend", "Gasto", "brl", 0], ["impressions", "Impressões", "n", 0], ["ctr", "CTR", "pct", 1], ["cpm", "CPM", "brl", -1], ["started", "Conversas", "n", 1], ["cpl", "CPL", "brl", -1], ["leads", "Leads", "n", 1], ["orders", "Pedidos", "n", 1], ["conv", "Conversão lead → pedido", "pct", 1], ["cpo", "Custo por pedido", "brl", -1]];
Object.assign(RANGE, { op_margin: [8, 22], resolution: [85, 95], transfers: [2, 6], first_response: [.2, 1.2], handle_time: [8, 25], leads_ad: [20, 60], leads_organic: [10, 30], delivered_orders: [2, 7] });
