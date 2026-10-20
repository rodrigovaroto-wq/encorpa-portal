// Constantes do portal (métricas, metas, rótulos). Vieram do app.js de antes da migração para React (16/10).

export const PERIODS = [
  { id: "day", label: "Dia" }, { id: "week", label: "Semana" }, { id: "month", label: "Mês" },
  { id: "3m", label: "3 meses" }, { id: "6m", label: "6 meses" }, { id: "9m", label: "9 meses" }, { id: "12m", label: "12 meses" },
];


export const GROUPS = [
  { title: "Operação", metrics: [
    { id: "leads", label: "Leads", unit: "n", src: "leads" },
    { id: "orders", label: "Pedidos", unit: "n", src: "pedidos feitos: vendas, recusas na porta e devoluções (sem antecipado não pago e sem cancelado)" },
    { id: "conversion", label: "Taxa de conversão", unit: "pct", src: "pedidos feitos ÷ leads", goal: "≥ 6% mín · 10% ideal" },
    { id: "cpl", label: "CPL (custo por conversa)", unit: "brl", src: "Meta Ads", goal: "≤ R$ 1,75 mín · R$ 1,25 ideal" },
    { id: "api_per_lead", label: "Custo de API por lead", unit: "brl", src: "llm_calls (todas as chamadas de modelo dos leads) ÷ leads", goal: "teto R$ 1,00" },
    { id: "cpl_api", label: "CPL + API", unit: "brl", src: "Meta Ads + eval_conversation_cost" },
    { id: "handoff", label: "Handoff (aviso ao operador)", unit: "pct", src: "não resolvidas ÷ conversas encerradas", goal: "≤ 10%" },
    { id: "fallback", label: "Resposta pronta (fallback)", unit: "pct", src: "eval_turn_outcomes" },
    { id: "optout", label: "Opt-out", unit: "pct", src: "leads", goal: "≤ 2,5%" },
    { id: "invalid_premise", label: "Premissa indevida", unit: "pct", src: "hermes_runs: conversas com premissa ÷ conversas lidas na última rodada", goal: "≤ 5%" },
  ]},
  { title: "Financeiro", metrics: [
    { id: "revenue", label: "Faturamento", unit: "brl", src: "orders" },
    { id: "op_cost", label: "Custo dos pedidos", unit: "brl", src: "faturamento − margem dos pedidos" },
    { id: "gross_profit", label: "Margem dos pedidos", unit: "brl", src: "soma do que cada pedido vale pelo status de hoje" },
    { id: "fixed_cost", label: "Custos fixos (vencidos)", unit: "brl", src: "cobranças que venceram no período: recarga de US$ 10 da PikaPods (R$ 54) e mensalidade de R$ 35 do número, dia 5" },
    { id: "net_profit", label: "Lucro líquido (estimado)", unit: "brl", src: "margem dos pedidos − anúncio (imposto incluído) − IA − WhatsApp − fixos" },
    { id: "op_margin", label: "Margem operacional", unit: "pct", src: "(margem dos pedidos − anúncio − IA − WhatsApp − fixos) ÷ faturamento", goal: "> 0%" },
    { id: "roi", label: "ROI", unit: "x", src: "margem dos pedidos ÷ (anúncio + IA + WhatsApp), sem os fixos", goal: "≥ 1,5 mín · 2,5 ideal" },
    { id: "prepaid_share", label: "% antecipado × entrega", unit: "pct", src: "antecipados ÷ pedidos feitos" },
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
    { id: "handle_time", label: "Tempo de atendimento por lead", unit: "min", src: "messages: primeiro fluxo de cada lead, até ela ficar mais de 24 h sem responder; média entre os leads" },
    { id: "reply_rate", label: "Taxa de resposta", unit: "pct", src: "conversas em que ela respondeu à Malu ÷ conversas", goal: "≥ 60% mín · 75% ideal" },
    { id: "price_reach", label: "% que chega ao preço", unit: "pct", src: "eval_funnel", goal: "≥ 40% mín · 55% ideal" },
    { id: "link_reach", label: "% que recebe o link", unit: "pct", src: "conversas que chegaram ao link ÷ conversas" },
    { id: "rewrites", label: "Reescritas por resposta", unit: "n", src: "eval_turn_outcomes" },
    { id: "gate_blocks", label: "Bloqueios de gate", unit: "pct", src: "eval_gate_blocks" },
    { id: "delivered", label: "Entregas concluídas ÷ pedidos", unit: "pct", src: "entregues ÷ pedidos feitos (o recusado conta)", goal: "≥ 70% mín · 83% ideal" },
  ]},
];

export const ALL = GROUPS.flatMap((g) => g.metrics);


export const PAUSE = [
  { id: "p_premise", label: "Conversas com premissa indevida", what: "a Malu afirmou algo que a cliente não disse (lido pelo Hermes, em lotes de 50)", limit: "pausar acima de 5% das conversas", missing: "nenhuma rodada do Hermes no período ainda (ele roda a cada 50 leads)" },
  { id: "p_handoff", label: "Conversas que a Malu não resolveu", what: "a Malu precisou avisar o operador", limit: "pausar acima de 10% das conversas", missing: "nenhuma conversa encerrada no período" },
  { id: "p_optout", label: "Clientes que pediram para sair", what: "pediram para não receber mais mensagem", limit: "pausar acima de 2,5% dos leads", missing: "nenhum lead no período" },
  { id: "p_api", label: "Conversas caras de API", what: "das últimas 100 conversas, quantas custaram mais de R$ 1,00 de modelo", limit: "pausar acima de 5% delas", missing: "nenhuma conversa com custo registrado" },
  { id: "p_cash", label: "Caixa necessário", what: "o caixa para rodar o gasto médio diário com anúncios dos últimos 7 dias até o primeiro repasse voltar (21 dias), com as premissas ideais (CPL R$ 1,25, conversão 10%)", limit: "informativo: sem limite fixo para comparar (operador, 20/10)", missing: "nenhum gasto com anúncios nos últimos 7 dias (ou Meta Ads não ligado)" },
  { id: "p_channel", label: "Número do WhatsApp", what: "a Malu está enviando e o workflow \"WhatsApp envio\" do n8n não tem erro nas últimas execuções", limit: "pausar se restrito, banido ou fora do ar", missing: "sem leitura do n8n nem mensagem da Malu" },
];


export const PHASES = [
  ["Copy (23 a 29/10)", "conversão ≥ 6% · CPL ≤ R$ 1,75", "conversão > 7,5% · CPL < R$ 1,50"],
  ["Região (1 a 7/11)", "conversão ≥ 6% · CPL ≤ R$ 1,75", "conversão > 10% · CPL < R$ 1,25"],
  ["Leitura (8 e 9/11)", "entregas ≥ 70%", "entregas ≥ 83% (recusa ≤ 17%)"],
];

export const DECISION = [
  ["Escalar", "> 10%", "< R$ 1,25", "> 2,5"],
  ["Ajustar", "6%–10%", "R$ 1,25–1,75", "1,5–2,5"],
  ["Parar", "< 6%", "> R$ 1,75", "< 1,5"],
];

export const SAMPLE_FLOOR = { leads: 500, orders: 50, spend: 500 };



export const KPIS = ["leads", "orders", "conversion", "revenue", "resolution", "api_per_lead", "net_profit", "op_margin"];

export const LOWER = new Set(["cpl", "api_per_lead", "cpl_api", "handoff", "fallback", "optout", "invalid_premise", "op_cost", "fixed_cost", "refusal", "spend", "cpm", "rewrites", "gate_blocks", "transfers", "first_response", "handle_time"]);

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




// Premissas, conferidas no Ricos-com-AI em 17/10: oferta = BUSINESS_CONFIG de 15/10 (docs/operacao/business-config-2026-10-15.md),
// economia = contas do portal confirmadas pelo operador em 15/10 (lib/build.mjs), teste = R19.1 de 09/10 (05-plano/09 e 13).
export const REF = [
  ["Oferta (BUSINESS_CONFIG de 15/10)", [
    ["Produto", "Colete Cinta Modeladora, tamanhos P a XGG (cintura de 60 a 100 cm); na dúvida entre dois, o maior"],
    ["Pagamento na entrega", "1 peça R$ 129,90 · 2 peças R$ 233,82 · 3 peças R$ 311,76, frete grátis (R14.3 e R15.3)"],
    ["Pagamento antecipado", "1 peça R$ 116,91 (10% off) · 2 peças R$ 207,84 (20%) · 3 peças R$ 272,79 (30%); frete por conta da cliente, calculado por região no checkout (R10.5 e R15.3)"],
    ["Âncora de preço", "de R$ 216,50 por R$ 129,90 na entrega"],
    ["Garantia", "7 dias após o recebimento; devolução e troca sem custo para a cliente, pelo suporte da Logzz (R16.3 e R21.3)"],
    ["Atendimento", "06:00 às 00:00; fora disso, recibo automático e a resposta guardada sai às 6h"],
    ["Mix previsto", "70% na entrega, 30% antecipado, 1 peça por pedido (premissa, não medido)"]]],
  ["Economia por pedido (confirmada pelo operador em 15/10)", [
    ["Na entrega, se entregue", "1 peça R$ 67,18 · 2 peças R$ 135,94 · 3 peças R$ 180,53 (produto R$ 30/peça, entrega R$ 19,99, manuseio R$ 5,00, transação de 6,99% da comissão + R$ 2,49)"],
    ["Antecipado, se entregue", "1 peça R$ 77,92 · 2 peças R$ 136,14 · 3 peças R$ 169,15"],
    ["Recusa na porta", "− R$ 9,99 por pedido recusado (entrega frustrada R$ 4,99 + manuseio R$ 5,00), só na entrega; premissa de 12% a 17%"],
    ["Devolução depois de entregue", "− R$ 30 na entrega e − R$ 50 no antecipado; premissa de 5% a 10%"],
    ["Média esperada por pedido", "R$ 51,74 no mix 70/30 com 1 peça, recusa de 17% e devolução de 10%"],
    ["Equilíbrio", "conversão mínima de 2,5% com CPL de R$ 1,25 e de 3,0% com CPL de R$ 1,50 ((CPL + R$ 0,05 de IA por lead) ÷ R$ 51,70 por pedido, já sem o WhatsApp; o CPL da Meta já traz o imposto); os fixos pedem mais ~1,1 pedido por mês"],
    ["Outros custos", "imposto da Meta (13,83%) já incluído no gasto do anúncio (operador, 20/10) · WhatsApp R$ 0,04 por pedido · fixos ~ R$ 55,14/mês, lançados quando vencem (recarga da PikaPods, dia 5 do número)"],
    ["Repasse", "na entrega: 14 dias depois do pagamento na porta; antecipado: na hora"]]],
  ["Custos do projeto (planilha do operador, 20/10)", [
    ["Fixo: PikaPods (n8n)", "cobra por hora: US$ 3,73 por mês (~ R$ 20,14); saldo de US$ 9,46 em 20/10, recarga automática de US$ 10 quando fica abaixo de US$ 1"],
    ["Fixo: número do WhatsApp", "R$ 55 no início; depois R$ 35 por mês, vence dia 5"],
    ["Variável: anúncios na Meta", "conforme o uso, imposto incluído no valor cobrado"],
    ["Variável: API do WhatsApp", "R$ 0 dentro das janelas; ~ R$ 0,04 por pedido no template de pós-venda"],
    ["Variável: modelo de IA", "só as chamadas de modelo dos leads (resposta, reescrita, interpretação, áudio e imagem); personas e Hermes fora"],
    ["Câmbio", "R$ 5,40 por dólar, o mesmo do Ricos-com-AI"],
    ["Onde entram", "no resultado do período (fixos só no mês em que vencem e são pagos de novo, fora do ROI) e em Financeiro › Resultado › Investido até agora, ao vivo"]]],
  ["Medido × premissa", [
    ["Custo de IA por lead", "premissa R$ 0,05 (operador, 20/10) · medido p50 R$ 0,268 e p95 R$ 0,546 por conversa (30/09); personas da v25 ~ R$ 0,02 por conversa (15/10)"],
    ["Teto do modelo por conversa", "R$ 1,00, sem tolerância (R18.7)"],
    ["Custo do WhatsApp por lead", "R$ 0 dentro da janela de 24 h ou da gratuita de 72 h; template de pós-venda ~ R$ 0,04 por pedido"]]],
  ["Teste de tráfego (R19.1, 09/10)", [
    ["Ensaio", "R$ 100 em 2 dias, 5 criativos (HANDOFF de 15/10)"],
    ["Fase Copy, 23 a 29/10", "R$ 350 (R$ 50/dia), 5 vídeos, 1 conjunto aberto no Brasil, mulheres de 18 a 55"],
    ["Pausa, 30 e 31/10", "leitura da fase Copy"],
    ["Fase Região, 1 a 7/11", "R$ 350 (R$ 50/dia), só as 2 copies vencedoras; A = estados com mais de 5 cidades com pagamento na entrega, B = Sudeste + Centro-Oeste + Sul"],
    ["Fase Leitura, 8 e 9/11", "R$ 0; os pedidos na entrega chegam à porta"],
    ["Verba e caixa", "R$ 700 de anúncio, imposto incluído; caixa de R$ 1.325 com R$ 250 de segurança"],
    ["Piso de amostra", "mais de 500 leads e mais de 50 pedidos (com CPL de R$ 1,50 saem ~467 leads: só passa com CPL abaixo de ~R$ 1,40)"],
    ["Experimentos por lead", "A = abertura rápida (sem recibo de 60 s), B = link depois da escolha; ~235 leads por braço; Malu congelada de 23/10 a 09/11"],
    ["Lembretes", "silence_1 em 60 min · silence_2 às 9h do dia seguinte (ou +23 h) · silence_3 com cupom SUPER20 71 h depois da entrada pelo anúncio"]]],
];

export const BUCKETS = { day: [24, 1 / 24], week: [7, 1], month: [30, 1], "3m": [13, 7], "6m": [26, 7], "9m": [39, 7], "12m": [52, 7] };

export const RANGE = { leads: [40, 90], orders: [3, 9], conversion: [5, 11], cpl: [1.1, 1.9], api_per_lead: [.04, .06], cpl_api: [1.15, 1.95], handoff: [6, 13], fallback: [2, 6], optout: [1, 3.2], invalid_premise: [2, 6.5], revenue: [390, 1170], op_cost: [200, 600], gross_profit: [120, 420], net_profit: [60, 300], roi: [1.2, 2.9], ticket_pieces: [1, 1.4], prepaid_share: [20, 40], refusal: [10, 19], spend: [60, 110], cpm: [12, 28], ctr: [.8, 2.4], cpc: [.5, 1.4], view_content: [50, 80], add_to_cart: [15, 35], checkout: [40, 70], site_conversion: [2, 4.5], cpa: [25, 45], failed_delivery: [12, 19], reply_rate: [55, 80], price_reach: [35, 60], link_reach: [20, 40], rewrites: [.3, 1.2], gate_blocks: [3, 9], delivered: [65, 88] };

export const SUMMED = new Set(["leads", "orders", "transfers", "revenue", "op_cost", "gross_profit", "net_profit", "spend", "fixed_cost"]);

export const STATUS_RUN = { success: "sucesso", error: "erro", crashed: "falhou", running: "rodando", waiting: "esperando", canceled: "cancelada" };

export const MODE = { trigger: "gatilho", webhook: "webhook", manual: "manual", integrated: "chamado por outro", retry: "nova tentativa", cli: "linha de comando" };

export const NODE = { webhook: "Webhook", httpRequest: "Chamada HTTP", if: "Condição", code: "Código", emailSend: "E-mail", wait: "Espera", scheduleTrigger: "Relógio", formTrigger: "Formulário (início)", form: "Formulário", executeWorkflow: "Chama workflow", executeWorkflowTrigger: "Chamado por workflow", respondToWebhook: "Responde webhook", splitInBatches: "Lotes", manualTrigger: "Manual" };

export const AD_STATUS = { ACTIVE: ["Ativo", "ok"], PAUSED: ["Pausado", ""], CAMPAIGN_PAUSED: ["Campanha pausada", ""], ADSET_PAUSED: ["Conjunto pausado", ""], DELETED: ["Apagado", ""], ARCHIVED: ["Arquivado", ""], IN_PROCESS: ["Em análise", "warn"], PENDING_REVIEW: ["Em análise", "warn"], DISAPPROVED: ["Reprovado", "bad"], WITH_ISSUES: ["Com problema", "bad"], PENDING_BILLING_INFO: ["Falta pagamento", "bad"] };

export const GENDER = { 1: "homens", 2: "mulheres" };

export const COMPARE = [["spend", "Gasto", "brl", 0], ["impressions", "Impressões", "n", 0], ["ctr", "CTR", "pct", 1], ["cpm", "CPM", "brl", -1], ["started", "Conversas", "n", 1], ["cpl", "CPL", "brl", -1], ["leads", "Leads", "n", 1], ["orders", "Pedidos", "n", 1], ["conv", "Conversão lead → pedido", "pct", 1], ["cpo", "Custo por pedido", "brl", -1]];
Object.assign(RANGE, { op_margin: [8, 22], resolution: [85, 95], transfers: [2, 6], first_response: [.2, 1.2], handle_time: [8, 25], leads_ad: [20, 60], leads_organic: [10, 30], delivered_orders: [2, 7] });
