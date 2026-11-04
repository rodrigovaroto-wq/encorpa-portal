// Constantes do portal (métricas, metas, rótulos). Vieram do app.js de antes da migração para React (16/10).

export const PERIODS = [
  { id: "day", label: "Dia" }, { id: "week", label: "Semana" }, { id: "month", label: "Mês" },
  { id: "3m", label: "3 meses" }, { id: "6m", label: "6 meses" }, { id: "9m", label: "9 meses" }, { id: "12m", label: "12 meses" },
];


export const GROUPS = [
  { title: "Operação", metrics: [
    { id: "leads", label: "Leads", unit: "n", src: "leads" },
    { id: "orders", label: "Pedidos", unit: "n", src: "pedidos feitos: vendas, recusas na porta e devoluções (sem antecipado não pago e sem cancelado)" },
    { id: "conversion", label: "Taxa de conversão", unit: "pct", src: "pedidos feitos ÷ leads", goal: "≥ 9% das conversas (WhatsApp) · ≥ 3% das visitas (Site)" },
    { id: "cpl", label: "CPL (custo por conversa)", unit: "brl", src: "Meta Ads", goal: "< R$ 2,00 (pausar acima de R$ 4,00 com R$ 50 gastos)" },
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
    { id: "cost_per_order", label: "Custo por pedido", unit: "brl", src: "(anúncio + IA + WhatsApp) ÷ pedidos feitos", goal: "≤ R$ 27 (teste A/B)" },
    { id: "ai_per_order", label: "IA por pedido", unit: "brl", src: "toda chamada de modelo dos leads ÷ pedidos feitos" },
    { id: "roi", label: "ROI", unit: "x", src: "margem dos pedidos ÷ (anúncio + IA + WhatsApp), sem os fixos", goal: "≥ 1,5 mín · 2,5 ideal" },
    { id: "prepaid_share", label: "% antecipado × entrega", unit: "pct", src: "antecipados ÷ pedidos feitos" },
    { id: "refusal", label: "Recusa na porta", unit: "pct", src: "orders", goal: "≤ 17%" },
  ]},
  { title: "Anúncio", metrics: [
    { id: "spend", label: "Gasto", unit: "brl", src: "Meta Ads" },
    { id: "cpm", label: "CPM", unit: "brl", src: "Meta Ads" },
    { id: "ctr", label: "CTR do link", unit: "pct", src: "Meta Ads", goal: "≥ 2% (pausar abaixo de 1% com R$ 50 gastos)" },
  ]},
  { title: "Agente (Malu)", metrics: [
    { id: "resolution", label: "Taxa de resolução", unit: "pct", src: "conversas que compraram ou encerraram sem compra ÷ encerradas", goal: "≥ 90% (handoff ≤ 10%)" },
    { id: "transfers", label: "Não resolvidas (aviso ao operador)", unit: "n", src: "turn_outcomes (handoff ou fallback)" },
    { id: "first_response", label: "Tempo até a 1ª resposta", unit: "min", src: "messages (carimbos)" },
    { id: "handle_time", label: "Tempo de atendimento", unit: "min", src: "messages: primeiro fluxo de cada lead, até ela ficar mais de 24 h sem responder; média entre os leads" },
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


// Teste A/B (operador, 02 e 03/11; Ricos-com-AI grafo §140): Site × WhatsApp, R$ 125 cada em 7 dias (R$ 17,86/dia; 04/11, era R$ 25/dia em 5 dias, por falta de caixa).
// As pausas seguem pelo gasto (R$ 50 e R$ 75), que agora cai no dia 3 e no dia 5. Sem data de início ainda.
export const PHASES = [
  ["Dias 1 a 3 (passa de R$ 50 por conjunto no dia 3)", "ler CTR, CPC e custo por conversa", "com R$ 50 gastos, pausar o conjunto que passar do limite de pausa"],
  ["Dias 4 e 5 (passa de R$ 75 por conjunto no dia 5)", "com R$ 75 gastos, zero pedidos criados pausa o conjunto", "com pedido, segue"],
  ["Dias 6 e 7 (até R$ 125 por conjunto)", "roda até o fim, sem editar", "vence o custo por pedido criado ≤ R$ 27"],
];

export const DECISION = [
  ["Escalar", "> 10%", "< R$ 1,25", "> 2,5"],
  ["Ajustar", "6%–10%", "R$ 1,25–1,75", "1,5–2,5"],
  ["Parar", "< 6%", "> R$ 1,75", "< 1,5"],
];

export const SAMPLE_FLOOR = { spend: 125, days: 7 }; // verba e dias de cada conjunto do teste A/B



export const KPIS = ["leads", "orders", "conversion", "revenue", "resolution", "api_per_lead", "net_profit", "op_margin"];

export const LOWER = new Set(["cost_per_order", "ai_per_order", "cpl", "api_per_lead", "cpl_api", "handoff", "fallback", "optout", "invalid_premise", "op_cost", "fixed_cost", "refusal", "spend", "cpm", "rewrites", "gate_blocks", "transfers", "first_response", "handle_time"]);

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




// Premissas, conferidas no Ricos-com-AI em 03/11: oferta = BUSINESS_CONFIG de 29/10 (docs/operacao/business-config-2026-10-29b.min.json) com a
// turn v49; economia = taxas da Logzz (a OmniCash da Coinzz) e do Mercado Pago (taxas-antecipadas-cod.md) nos preços de 27/10; teste = grafo §140.
export const REF = [
  ["Oferta (BUSINESS_CONFIG de 29/10, turn v49)", [
    ["Produto", "Colete Cinta Modeladora, tamanhos P a XGG (o M está sem estoque na Coinzz); na dúvida entre dois, o maior"],
    ["Preço", "1 peça R$ 109,90 · 2 peças R$ 197,82 (10%) · 3 peças R$ 263,76 (20%), o mesmo na entrega e no antecipado"],
    ["Âncora", "de R$ 179,90 por R$ 109,90 (selo \"40% OFF\")"],
    ["Frete", "grátis nos dois caminhos; a operação paga"],
    ["Checkout", "Coinzz, um por quantidade (encorpa-0, encorpa-site-0, oferta-site2-0), com Pix, cartão e pagar na entrega; o mesmo no site e na Malu"],
    ["Cupom", "SUPER20 (20%), só depois do lembrete de follow-up: 1 peça R$ 87,92 · 2 peças R$ 158,26 · 3 peças R$ 211,01"],
    ["Prazo", "na entrega 1 a 3 dias, com dia agendado; antecipado em média 5 dias, varia por região"],
    ["Garantia", "7 dias após o recebimento; troca e devolução pelo suporte"],
    ["Teto de custo da Malu", "R$ 0,30 por conversa"],
    ["Mix previsto", "70% na entrega, 30% antecipado, 1 peça por pedido (premissa, não medido)"]]],
  ["Economia por pedido (oferta de 27/10)", [
    ["Na entrega, se entregue", "1 peça R$ 48,58 · 2 peças R$ 102,45 · 3 peças R$ 135,88 (produto R$ 30/peça, entrega R$ 19,99, manuseio R$ 5,00, transação de 6,99% da comissão + R$ 2,49; o frete de R$ 24,98 da OmniCash é a entrega + o manuseio)"],
    ["Antecipado, se entregue", "1 peça R$ 44,76 · 2 peças R$ 100,06 · 3 peças R$ 134,03 (produto, manuseio R$ 5,00, Mercado Pago metade Pix e metade cartão, frete médio de R$ 26,36 pago pela operação)"],
    ["Com o cupom de 20%", "1 peça R$ 28,14 na entrega e R$ 23,44 no antecipado"],
    ["Recusa na porta", "− R$ 9,99 por pedido recusado (entrega frustrada R$ 4,99 + manuseio R$ 5,00), só na entrega; premissa de 17%"],
    ["Devolução depois de entregue", "− R$ 30 na entrega e − R$ 50 no antecipado; premissa de 10%"],
    ["Média esperada por pedido", "R$ 33,06 no mix 70/30 com 1 peça (entrega R$ 32,10, antecipado R$ 35,28), recusa de 17% e devolução de 10%; R$ 33,02 depois do WhatsApp"],
    ["Equilíbrio", "custo de anúncio por pedido até ~R$ 33; o critério do teste é ≤ R$ 27 por pedido criado"],
    ["Outros custos", "imposto da Meta (13,83%) já incluído no gasto do anúncio · WhatsApp R$ 0,04 por pedido · fixos ~ R$ 55,14/mês, lançados quando vencem (recarga da PikaPods, dia 5 do número)"],
    ["Repasse", "na entrega: 14 dias depois do pagamento na porta; antecipado: na hora"]]],
  ["Custos do projeto (planilha do operador, 20/10)", [
    ["Fixo: PikaPods (n8n)", "cobra por hora: US$ 3,73 por mês (~ R$ 20,14); recarga automática de US$ 10 quando fica abaixo de US$ 1"],
    ["Fixo: número do WhatsApp", "R$ 55 no início; depois R$ 35 por mês, vence dia 5"],
    ["Variável: anúncios na Meta", "conforme o uso, imposto incluído no valor cobrado"],
    ["Variável: API do WhatsApp", "R$ 0 dentro das janelas; ~ R$ 0,04 por pedido no template de pós-venda"],
    ["Variável: modelo de IA", "só as chamadas de modelo dos leads; personas e Hermes fora"],
    ["Câmbio", "R$ 5,40 por dólar, o mesmo do Ricos-com-AI"]]],
  ["Medido × premissa", [
    ["Custo de IA por lead", "premissa R$ 0,05 · medido em 18 conversas reais (20 a 29/10): p50 R$ 0,018, p95 R$ 0,089, máximo R$ 0,139"],
    ["Teto do modelo por conversa", "R$ 0,30, sem tolerância"],
    ["Frete do antecipado", "R$ 17,78 a R$ 44,45 por região nas 22 cidades (média R$ 26,36), medido na Coinzz em 02/11"]]],
  ["Teste A/B: Site × WhatsApp (operador, 02 e 03/11)", [
    ["Estrutura", "1 campanha de Vendas, orçamento por conjunto: Site (conversão no site, evento Compra) e WhatsApp (maximizar conversas)"],
    ["Verba", "R$ 17,86/dia por conjunto, 7 dias: R$ 125 por conjunto, R$ 250 no total (04/11: eram 5 dias, por falta de caixa). Sem data de início ainda"],
    ["Público", "mulheres de 18 a 55, nas 22 cidades com pagamento na entrega; os mesmos 5 vídeos nos dois conjuntos"],
    ["Metas do Site", "CTR do link ≥ 2% · CPC ≤ R$ 0,60 · 3% das visitas viram pedido → ~R$ 20 por pedido"],
    ["Metas do WhatsApp", "CTR do link > 2% · CPC < R$ 1,50 · conversa < R$ 2,00 · 9% das conversas viram pedido → ~R$ 22,22 por pedido"],
    ["Pausa com R$ 50 gastos (dia 3)", "Site: CTR < 1% ou CPC > R$ 1,20 · WhatsApp: CTR < 1%, CPC > R$ 3,00 ou conversa > R$ 4,00"],
    ["Pausa com R$ 75 gastos (dia 5)", "zero pedidos criados pausa o conjunto; com pedido, roda até o 7º dia"],
    ["Critério", "custo de anúncio por pedido criado ≤ R$ 27; quem ficar abaixo leva a verba"],
    ["Onde contar os pedidos", "WhatsApp: leads com a marca do anúncio (ctwa). Site: pedido de cliente sem essa marca, desde o início do conjunto Site (a Coinzz não manda UTM no webhook de venda)"]]],
];

// Período livre (operador, 04/11): "c:AAAA-MM-DD:AAAA-MM-DD", dias de Brasília, do começo do primeiro ao fim do último, até 3 anos.
// O intervalo do gráfico segue o tamanho: até 2 dias por hora, até 92 dias por dia, até 1 ano por semana, acima disso a cada 30 dias.
export function customPeriod(id) {
  const m = /^c:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(id || "");
  if (!m) return null;
  const from = Date.parse(`${m[1]}T00:00:00-03:00`), to = Date.parse(`${m[2]}T00:00:00-03:00`) + 864e5, span = (to - from) / 864e5;
  if (!(span > 0) || span > 1096) return null;
  const days = span <= 2 ? 1 / 24 : span <= 92 ? 1 : span <= 366 ? 7 : 30;
  return { id, from, to, days, n: Math.ceil(span / days) };
}
const dm = (ts) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });
export const periodLabel = (id) => { const c = customPeriod(id); return c ? `${dm(c.from)} a ${dm(c.to - 864e5)}` : PERIODS.find((p) => p.id === id)?.label; };
export const COMPARE_LABEL = { year: "Mesmo período do ano anterior", previous: "Período anterior" }; // a linha tracejada dos gráficos
export const BUCKETS = { day: [24, 1 / 24], week: [7, 1], month: [30, 1], "3m": [13, 7], "6m": [26, 7], "9m": [39, 7], "12m": [52, 7] };



export const STATUS_RUN = { success: "sucesso", error: "erro", crashed: "falhou", running: "rodando", waiting: "esperando", canceled: "cancelada" };

export const MODE = { trigger: "gatilho", webhook: "webhook", manual: "manual", integrated: "chamado por outro", retry: "nova tentativa", cli: "linha de comando" };

export const NODE = { webhook: "Webhook", httpRequest: "Chamada HTTP", if: "Condição", code: "Código", emailSend: "E-mail", wait: "Espera", scheduleTrigger: "Relógio", formTrigger: "Formulário (início)", form: "Formulário", executeWorkflow: "Chama workflow", executeWorkflowTrigger: "Chamado por workflow", respondToWebhook: "Responde webhook", splitInBatches: "Lotes", manualTrigger: "Manual" };

export const AD_STATUS = { ACTIVE: ["Ativo", "ok"], PAUSED: ["Pausado", ""], CAMPAIGN_PAUSED: ["Campanha pausada", ""], ADSET_PAUSED: ["Conjunto pausado", ""], DELETED: ["Apagado", ""], ARCHIVED: ["Arquivado", ""], IN_PROCESS: ["Em análise", "warn"], PENDING_REVIEW: ["Em análise", "warn"], DISAPPROVED: ["Reprovado", "bad"], WITH_ISSUES: ["Com problema", "bad"], PENDING_BILLING_INFO: ["Falta pagamento", "bad"] };

export const GENDER = { 1: "homens", 2: "mulheres" };

export const COMPARE = [["spend", "Gasto", "brl", 0], ["impressions", "Impressões", "n", 0], ["ctr", "CTR", "pct", 1], ["cpm", "CPM", "brl", -1], ["started", "Conversas", "n", 1], ["cpl", "CPL", "brl", -1], ["leads", "Leads", "n", 1], ["orders", "Pedidos", "n", 1], ["conv", "Conversão lead → pedido", "pct", 1], ["cpo", "Custo por pedido", "brl", -1]];

