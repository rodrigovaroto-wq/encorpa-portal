// Estrutura do portal. Nenhum dado real ainda: loadData() é o único ponto a ligar depois.
// Métricas e limites vêm de Ricos-com-AI (plano L3 e 10-execucao-mes-1 §8) e do Encorpa-Website
// (docs/analise-site-pos-teste.md). `src` = de onde o dado virá.

const PERIODS = [
  { id: "day", label: "Dia" }, { id: "week", label: "Semana" }, { id: "month", label: "Mês" },
  { id: "3m", label: "3 meses" }, { id: "6m", label: "6 meses" }, { id: "9m", label: "9 meses" }, { id: "12m", label: "12 meses" },
];

// unit: n = número, brl = R$, pct = %, x = multiplicador. goal = meta documentada.
const GROUPS = [
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
    { id: "invalid_premise", label: "Premissa indevida", unit: "pct", src: "Hermes (lote de 50)", goal: "≤ 5%" },
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
const ALL = GROUPS.flatMap((g) => g.metrics);

// Os seis critérios do L3 (manuais). dir: "max" = pausar acima do limite.
// Os seis critérios de pausa do teste. what = o que mede, em uma frase; missing = por que está sem número.
const PAUSE = [
  { id: "p_premise", label: "Conversas com premissa indevida", what: "a Malu afirmou algo que a cliente não disse (lido pelo Hermes, em lotes de 50)", limit: "pausar acima de 5% das conversas", missing: "o Hermes ainda não leu um lote de 50 conversas" },
  { id: "p_handoff", label: "Conversas que a Malu não resolveu", what: "a Malu precisou avisar o operador", limit: "pausar acima de 10% das conversas", missing: "nenhuma conversa encerrada no período" },
  { id: "p_optout", label: "Clientes que pediram para sair", what: "pediram para não receber mais mensagem", limit: "pausar acima de 2,5% dos leads", missing: "nenhum lead no período" },
  { id: "p_api", label: "Conversas caras de API", what: "das últimas 100 conversas, quantas custaram mais de R$ 1,00 de modelo", limit: "pausar acima de 5% delas", missing: "nenhuma conversa com custo registrado" },
  { id: "p_cash", label: "Caixa reservado para pedidos", what: "quanto sobra dos R$ 1.500 separados para o custo dos pedidos", limit: "pausar abaixo de R$ 300", missing: "falta ligar o extrato (Coinzz/Logzz/Mercado Pago); por enquanto não há valor gasto registrado" },
  { id: "p_channel", label: "Número do WhatsApp", what: "o número está liberado pela Meta e a Cloud API responde", limit: "pausar se restrito, banido ou fora do ar", missing: "estado do canal não informado" },
];

// Métricas por criativo (fase Copy) e por região (fase Região): 12 do §8.
const SEGMENT_METRICS = [
  ["spend", "Gasto", "brl"], ["cpm", "CPM", "brl"], ["ctr", "CTR do link", "pct"], ["cpl", "CPL", "brl"],
  ["reply_rate", "Taxa de resposta", "pct"], ["price_reach", "% chega ao preço", "pct"], ["link_reach", "% recebe o link", "pct"],
  ["conversion", "Conversão em pedido", "pct"], ["prepaid_share", "% antecipado", "pct"], ["handoff", "Handoff", "pct"],
  ["optout", "Opt-out", "pct"], ["api_per_lead", "Custo de API por lead", "brl"],
];
const SEGMENTS = {
  creative: ["Criativo 1", "Criativo 2", "Criativo 3", "Criativo 4", "Criativo 5", "Criativo 6"],
  region: ["Conjunto A (estados com > 5 cidades)", "Conjunto B (Sudeste + Centro-Oeste + Sul)"],
};

const PHASES = [
  ["Copy (dias 1–5)", "CPL ≤ R$ 1,75 · CTR ≥ 1% · resposta ≥ 60% · chega ao preço ≥ 40%", "CPL ≤ R$ 1,25 · CTR ≥ 2% · resposta ≥ 75% · preço ≥ 55%"],
  ["Região (dias 6–10)", "CPL ≤ R$ 1,50 · conversão ≥ 6%", "CPL ≤ R$ 1,25 · conversão ≥ 10%"],
  ["Leitura (dias 11–12)", "entregas ≥ 70%", "entregas ≥ 83% (recusa ≤ 17%)"],
];
const DECISION = [
  ["Escalar", "> 10%", "< R$ 1,25", "> 2,5"],
  ["Ajustar", "6%–10%", "R$ 1,25–1,75", "1,5–2,5"],
  ["Parar", "< 6%", "> R$ 1,75", "< 1,5"],
];
const SAMPLE_FLOOR = { leads: 500, orders: 50, spend: 500 };


// Painel principal: as 8 que mandam, 4 por linha.
const KPIS = ["leads", "orders", "conversion", "revenue", "resolution", "api_per_lead", "net_profit", "op_margin"];
// Métricas em que subir é ruim: a variação delas fica vermelha ao subir.
const LOWER = new Set(["cpl", "api_per_lead", "cpl_api", "handoff", "fallback", "optout", "invalid_premise", "op_cost", "refusal", "spend", "cpm", "rewrites", "gate_blocks", "transfers", "first_response", "handle_time"]);
// Variação contra o mesmo período anterior: % para contagem e dinheiro, pontos percentuais para taxa.
function deltaHtml(id, unit) {
  const v = state.data?.metrics?.[id];
  if (!v || v.value == null || v.previous == null) return `<div class="delta none">sem dado do período anterior</div>`;
  const diff = v.value - v.previous, up = diff >= 0, good = diff === 0 ? "" : up !== LOWER.has(id) ? "good" : "bad";
  const txt = unit === "pct" ? `${nf.format(Math.abs(diff))} p.p.` : v.previous ? `${nf.format(Math.abs((diff / Math.abs(v.previous)) * 100))}%` : fmt(Math.abs(diff), unit);
  return `<div class="delta ${good}">${diff === 0 ? "=" : up ? "▲" : "▼"} ${txt} <span>vs período anterior</span></div>`;
}

// Vídeos: os 6 ganchos/formatos da fase Copy. `headline` vem de eval_attribution.
const VIDEOS = Array.from({ length: 6 }, (_, i) => `Vídeo ${i + 1}`);
const VIDEO_CARD = [["spend", "Gasto", "brl"], ["ctr", "CTR", "pct"], ["cpl", "CPL", "brl"], ["reply_rate", "Resposta", "pct"], ["price_reach", "Chega ao preço", "pct"], ["conversion", "Conversão", "pct"]];

// Fluxo de dinheiro: do faturamento ao que sobra. sign = -1 sai, +1 entra.
const MONEY_FLOW = [
  ["revenue", "Faturamento (pedidos)", 1], ["product_cost", "Produto e manuseio", -1], ["tx_fee", "Taxa de transação", -1],
  ["delivery_fee", "Entrega concluída", -1], ["refusal_cost", "Recusa na porta", -1], ["return_cost", "Devolução", -1],
  ["gross_profit", "= Lucro bruto", 0], ["spend", "Anúncio", -1], ["api_cost", "API (modelo + WhatsApp)", -1], ["net_profit", "= Lucro líquido (recebido)", 0],
];
const MONEY_STATUS = [
  ["to_receive", "A receber (comissão libera em 14 dias)", "brl"], ["received", "Recebido", "brl"],
  ["prepaid_share", "Antecipado (cai na hora no Mercado Pago)", "pct"], ["cash_left", "Caixa reservado restante (de R$ 1.500)", "brl"],
];

// Agente: funil da conversa (eval_funnel) e saúde.
const FUNNEL = [["first_msg", "Mandou a 1ª mensagem"], ["reply", "Respondeu à agente"], ["price", "Chegou ao preço"], ["link", "Recebeu o link"], ["order", "Pedido criado"], ["delivered", "Entrega concluída"]];
// Atendimento com as mesmas definições do analytics da Octadesk (caso-portal.md §2.2). "Atendimentos" = leads.
const SERVICE = [["leads", "Atendimentos"], ["first_response"], ["handle_time"]];
// Desfecho de cada conversa (lib/build.mjs › conversationStatus). Abandono não conta como resolvida.
const OUTCOMES = [
  ["bought", "Comprou", "ok", "Pedido criado, em rota ou entregue"],
  ["declined", "Encerrou sem compra", "ok", "Recusou, desistiu ou a régua encerrou, sem precisar de pessoa"],
  ["unresolved", "Não resolvida", "bad", "A Malu avisou o operador (handoff ou resposta pronta)"],
  ["abandoned", "Abandonada", "warn", "Mais de 24 h sem resposta dela, sem decisão"],
  ["open", "Em andamento", "", "Conversa com movimento nas últimas 24 h"],
];
const OUTCOME = Object.fromEntries(OUTCOMES.map(([id, l, c]) => [id, { l, c }]));
const STAGE = { novo: "Nova", conversando: "Conversando", tamanho_definido: "Tamanho definido", cobertura_conhecida: "Cobertura conhecida", caminho_escolhido: "Pagamento escolhido", link_enviado: "Link enviado", pedido_criado: "Pedido criado", em_rota: "Em rota", entregue_pago: "Entregue e pago", recusado: "Recusado na porta", perdido: "Perdido", bloqueado: "Bloqueado" };
// Menu lateral: seção › sub-abas. desc = a linha que explica a página (como o cabeçalho de cada tela da Octadesk).
// badge(d) = contador ao lado da sub-aba, só quando pede atenção.
const NAV = [
  { id: "home", label: "Painel", desc: "Os números que mandam e o que pede atenção agora." },
  { id: "malu", label: "Malu (agente)", subs: [
    ["results", "Resultados", "Quantas conversas a Malu resolveu sozinha, por desfecho e por versão."],
    ["conversations", "Conversas", "Cada conversa com o desfecho, a etapa e o motivo, sem dado pessoal.", (d) => d.outcomes?.unresolved],
    ["gaps", "Lacunas", "O que a Malu ainda não resolve sozinha: cada linha é um contorno a construir.", (d) => d.gaps?.length],
    ["service", "Atendimento", "Funil da conversa, tempos de resposta e volume por hora."],
    ["health", "Saúde e versões", "Resposta pronta, reescritas, gates, canal e o antes × depois de cada versão."]] },
  { id: "auto", label: "Automações", subs: [
    ["workflows", "Workflows", "Os workflows do n8n desenhados como fluxo, com estado e última execução.", (d) => d.automations?.workflows?.filter((w) => w.active && w.errors).length],
    ["flow", "Fluxo da Malu", "O caminho de uma mensagem dela até a resposta, e onde cada desfecho nasce."],
    ["runs", "Execuções", "As últimas execuções do n8n, com estado e duração.", (d) => d.automations?.runs?.filter((r) => r.status === "error" || r.status === "crashed").length]] },
  { id: "money", label: "Financeiro", subs: [
    ["flow", "Do faturamento ao lucro", "Para onde vai cada real que entra e a situação do caixa."],
    ["api", "Consumo de API", "Custo do modelo e do WhatsApp no período, por dia, por lead e a projeção do mês."],
    ["compare", "Comparação", "Todas as métricas contra o período anterior."]] },
  { id: "ads", label: "Anúncios", subs: [
    ["campaigns", "Campanhas", "Campanhas do Meta Ads com orçamento, estado e resultado, atualizadas sozinhas."],
    ["adsets", "Conjuntos", "Conjuntos de anúncios: público, posicionamento, orçamento e resultado."],
    ["ads", "Anúncios e criativos", "Cada anúncio com o criativo e as métricas: gasto, CTR, CPL, conversas e pedidos."],
    ["tests", "Testes de Criativos", "Decisão do dia 12, piso de amostra, critérios de pausa, criativos e região do teste L3."],
    ["rules", "Metas e decisão", "Metas por fase, regra de decisão e critérios de pausa."],
    ["ref", "Premissas", "Oferta, economia por pedido e premissas do teste, com a data de cada fonte."]] },
];
const AGENT_HEALTH = ["handoff", "fallback", "rewrites", "gate_blocks", "optout", "invalid_premise", "api_per_lead", "cpl_api"];
const CHANNEL = [["number", "Número do WhatsApp"], ["cloud_api", "Cloud API"], ["window", "Janela gratuita de 72 h"], ["templates", "Templates aprovados na Meta"]];



// Fatos fixos dos repositórios (Ricos-com-AI, Encorpa-Website, Encorpa-Campanhas). Datas = quando foram escritos.
const REF = [
  ["Oferta (config e site)", [["Produto", "Colete Cinta Modeladora, tamanhos P, M, G, GG e XGG"], ["Pagamento na entrega", "R$ 129,90, frete grátis"], ["Pagamento antecipado", "R$ 110,42 (15% off), frete por conta da cliente, calculado no checkout"], ["Âncora de preço", "R$ 216,50"], ["Garantia", "7 dias"], ["Atendimento", "06:00 às 00:00; fora disso, mensagem automática"], ["Mix previsto", "70% na entrega, 30% antecipado, 1 peça por pedido"]]],
  ["Economia por pedido (estudo de projeção, não medido)", [["COD entregue", "+ R$ 63,35 (produto R$ 30, transação, handling R$ 4,99, entrega R$ 19,99)"], ["COD recusado", "− R$ 14,98 (recusa R$ 9,99)"], ["Antecipado", "+ R$ 70,21"], ["Média com mix 70/30", "R$ 57,18 por pedido"], ["Recusa na porta (premissa)", "12% a 17%; a Logzz declara 13% a 16%"], ["Devolução pós-envio", "5% a 10% a R$ 25,00"], ["Equilíbrio", "conversão de 3,58% com CPL de R$ 1,25"], ["Comissão da entrega", "libera 14 dias depois do pagamento"]]],
  ["Medido × premissa", [["Custo de API por conversa", "medido R$ 0,051 (4 conversas de teste, máx R$ 0,073) × premissa do estudo R$ 0,80 por lead"], ["Teto do modelo por conversa", "R$ 0,50 (p50 medido R$ 0,268 e p95 R$ 0,546 no modelo padrão, 30/09)"], ["Custo do WhatsApp por lead", "R$ 0 dentro da janela de 24 h ou da gratuita de 72 h; template UTILITY ~ R$ 0,04 por pedido"]]],
  ["Teste de tráfego (L3)", [["Fase Copy, dias 1 a 5", "R$ 300, 6 vídeos, 1 conjunto aberto no Brasil, mulheres de 18 a 55"], ["Fase Região, dias 6 a 10", "R$ 200, só as 2 copies vencedoras; A = estados com mais de 5 cidades atendidas, B = Sudeste + Centro-Oeste + Sul"], ["Fase Leitura, dias 11 e 12", "R$ 0; as entregas chegam à porta"], ["Verba total", "R$ 500 de anúncio + R$ 1.500 de caixa reservado para o custo do pedido"], ["Piso de amostra", "mais de 500 leads atendidos e mais de 50 pedidos criados"], ["Primeira resposta da agente", "1 minuto depois da mensagem"], ["Régua de silêncio", "silence_3 entre 63 h e 71 h depois da abertura da janela de 72 h"]]],
];

const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const state = { period: store.get("period") || "week", filter: "all", demo: store.get("demo") === "1", data: null };

// Dados: lê data.js (snapshot embutido, funciona em arquivo local) ou data.json (servidor); o formato está no README.
// Sem ele, o botão "Ver exemplo" liga dados de mentira (marcados na tela).
// { updated, metrics:{id:{value,previous,series}}, totals:{leads,orders}, pause?, api_over_pct?, videos?, segments?,
//   money?, funnel?, channel?, versions?, gates? }
async function loadData(period) {
  if (state.demo) return demoData(period);
  if (location.protocol !== "file:") await loadLive(); // publicado: busca na função do Vercel (ou cai no data.js)
  if (window.PORTAL_DATA) return window.PORTAL_DATA[period] || window.PORTAL_DATA;
  if (location.protocol === "file:") return null; // navegador bloqueia fetch em arquivo local
  try {
    const r = await fetch("data.json", { cache: "no-store" });
    if (!r.ok) return null;
    const all = await r.json();
    return all[period] || all;
  } catch { return null; }
}

async function loadLive() {
  try {
    const r = await fetch("/api/data", { cache: "no-store", credentials: "same-origin" });
    if (r.ok) { window.PORTAL_DATA = await r.json(); return; }
  } catch { /* sem função: usa o data.js */ }
  await reloadDataFile();
}

function reloadDataFile() {
  return new Promise((done) => {
    const s = document.createElement("script");
    s.src = `data.js?t=${Date.now()}`;
    s.onload = s.onerror = () => { s.remove(); done(); };
    document.head.appendChild(s);
  });
}

// ---- dados de exemplo (NÃO são reais) ----
const BUCKETS = { day: [24, 1 / 24], week: [7, 1], month: [30, 1], "3m": [13, 7], "6m": [26, 7], "9m": [39, 7], "12m": [52, 7] };
const RANGE = { leads: [40, 90], orders: [3, 9], conversion: [5, 11], cpl: [1.1, 1.9], api_per_lead: [.4, .9], cpl_api: [1.6, 2.7], handoff: [6, 13], fallback: [2, 6], optout: [1, 3.2], invalid_premise: [2, 6.5], revenue: [390, 1170], op_cost: [200, 600], gross_profit: [120, 420], net_profit: [60, 300], roi: [1.2, 2.9], cash_left: [900, 1500], ticket_pieces: [1, 1.4], prepaid_share: [20, 40], refusal: [10, 19], spend: [60, 110], cpm: [12, 28], ctr: [.8, 2.4], cpc: [.5, 1.4], view_content: [50, 80], add_to_cart: [15, 35], checkout: [40, 70], site_conversion: [2, 4.5], cpa: [25, 45], failed_delivery: [12, 19], reply_rate: [55, 80], price_reach: [35, 60], link_reach: [20, 40], rewrites: [.3, 1.2], gate_blocks: [3, 9], delivered: [65, 88] };
Object.assign(RANGE, { op_margin: [8, 22], resolution: [85, 95], transfers: [2, 6], first_response: [.2, 1.2], handle_time: [8, 25] });
const SUMMED = new Set(["leads", "orders", "transfers", "revenue", "op_cost", "gross_profit", "net_profit", "spend"]);

function rng(seed) { let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function demoData(period) {
  const [n, days] = BUCKETS[period];
  const metrics = {};
  for (const x of ALL) {
    const [lo, hi] = RANGE[x.id] || [1, 10], r = rng(period + x.id), k = SUMMED.has(x.id) ? days : 1;
    const gen = () => Array.from({ length: n }, (_, i) => (lo + (hi - lo) * (0.25 + 0.5 * r() + 0.25 * Math.sin(i / 3))) * k);
    const cur = gen(), prev = gen();
    const agg = (s) => (x.id === "cash_left" ? s[s.length - 1] : SUMMED.has(x.id) ? s.reduce((a, b) => a + b, 0) : s.reduce((a, b) => a + b, 0) / s.length);
    const rd = x.id === "leads" || x.id === "orders" ? Math.round : (v) => v;
    metrics[x.id] = { value: rd(agg(cur)), previous: rd(agg(prev)), series: cur.map(rd) };
  }
  const r = rng("seg" + period), pick = (id, f = 1) => { const [lo, hi] = RANGE[id]; return (lo + (hi - lo) * r()) * f; };
  const seg = (names) => Object.fromEntries(names.map((nm) => [nm, Object.fromEntries(SEGMENT_METRICS.map(([id]) => [id, pick(id, id === "spend" ? 3 : 1)]))]));
  const m = metrics, rev = m.revenue.value, leads = m.leads.value, orders = m.orders.value;
  const flow = { revenue: rev, product_cost: rev * .3, tx_fee: rev * .07, delivery_fee: rev * .15, refusal_cost: rev * .04, return_cost: rev * .02 };
  flow.gross_profit = rev - flow.product_cost - flow.tx_fee - flow.delivery_fee - flow.refusal_cost - flow.return_cost;
  flow.spend = m.spend.value; flow.api_cost = leads * m.api_per_lead.value * .3;
  flow.net_profit = flow.gross_profit - flow.spend - flow.api_cost;
  m.gross_profit.value = flow.gross_profit; m.net_profit.value = flow.net_profit; m.op_cost.value = rev - flow.gross_profit;
  m.roi.value = flow.gross_profit / (flow.spend + flow.api_cost);
  const pct = (id) => m[id].value / 100;
  const stat = ["bought", "declined", "declined", "unresolved", "abandoned", "abandoned", "abandoned", "open"];
  const why = ["a cliente quer 6 peças, mais que o maior kit (3)", "a cliente pergunta sobre um pedido existente", "nenhuma reescrita passou", "sem tempo para reescrever"];
  const stg = { bought: "pedido_criado", declined: "perdido", unresolved: "conversando", abandoned: "link_enviado", open: "tamanho_definido" };
  const convs = Array.from({ length: 24 }, (_, i) => { const st = stat[Math.floor(r() * stat.length)];
    return { id: Math.floor(r() * 0xffffffff).toString(16).padStart(8, "0"), start: Date.now() - i * 3.6e6 * 7 * days, status: st, stage: stg[st], messages: 3 + Math.floor(r() * 20), first_response: .2 + r(), version: 13 + (i < 12 ? 1 : 0), reason: st === "unresolved" ? why[Math.floor(r() * why.length)] : null }; });
  const oc = Object.fromEntries(OUTCOMES.map(([id]) => [id, convs.filter((c) => c.status === id).length]));
  const closed = convs.length - oc.open;
  return {
    demo: true, conversations: convs,
    automations: { workflows: [
      { name: "Encorpa — Turno da agente", active: true, runs: 140, errors: 0, last: { status: "success", at: new Date().toISOString() }, nodes: [["Mensagem chega", "webhook", 0, 0], ["Chama a função turn", "httpRequest", 220, 0], ["Deu certo?", "if", 440, 0], ["Responde", "respondToWebhook", 660, -60], ["Avisa o operador", "emailSend", 660, 60]].map(([name, type, x, y]) => ({ name, type, x, y })), edges: [["Mensagem chega", "Chama a função turn"], ["Chama a função turn", "Deu certo?"], ["Deu certo?", "Responde"], ["Deu certo?", "Avisa o operador"]] },
      { name: "Encorpa — Relógio da régua", active: true, runs: 96, errors: 1, last: { status: "error", at: new Date().toISOString() }, nodes: [["A cada 10 min", "scheduleTrigger", 0, 0], ["Varre follow-ups", "httpRequest", 220, 0], ["Avisa o operador", "emailSend", 440, 0]].map(([name, type, x, y]) => ({ name, type, x, y })), edges: [["A cada 10 min", "Varre follow-ups"], ["Varre follow-ups", "Avisa o operador"]] },
      { name: "TEMP — teste", active: false, runs: 0, errors: 0, last: null, nodes: [{ name: "Manual", type: "manualTrigger", x: 0, y: 0 }], edges: [] }],
      runs: Array.from({ length: 12 }, (_, i) => ({ workflow: i % 3 ? "Encorpa — Turno da agente" : "Encorpa — Relógio da régua", status: i === 4 ? "error" : "success", mode: i % 3 ? "webhook" : "trigger", at: new Date(Date.now() - i * 6e5).toISOString(), ms: 400 + i * 90 })) },
    outcomes: { attended: convs.length, ...oc, solved: oc.bought + oc.declined, resolution: ((oc.bought + oc.declined) / closed) * 100 },
    gaps: why.map((w, i) => ({ reason: w, count: 6 - i, conversations: 5 - i, last: new Date(Date.now() - i * 864e5).toISOString(), version: 14 })), updated: new Date().toISOString(), metrics, api_over_pct: 3.8,
    totals: { leads: Math.round(leads * 1.0) % 600, orders: Math.round(orders) % 60, spend: Math.round(m.spend.value) % 500 },
    videos: seg(VIDEOS), segments: { creative: seg(VIDEOS), region: seg(SEGMENTS.region) },
    money: { ...flow, api_per_day: flow.api_cost / (n * days), api_30d: (flow.api_cost / (n * days)) * 30, to_receive: flow.net_profit * .4, received: flow.net_profit * .6, prepaid_share: m.prepaid_share.value, cash_left: m.cash_left.value },
    funnel: Object.fromEntries(Object.entries({ first_msg: leads, reply: leads * pct("reply_rate"), price: leads * pct("price_reach"), link: leads * pct("link_reach"), order: orders, delivered: orders * pct("delivered") }).map(([k, v]) => [k, Math.round(v)])),
    hourly: Array.from({ length: 24 }, (_, h) => Math.round((h < 6 ? 1 : 6) * (1 + Math.sin(h / 4)) * days)),
    channel: { number: "Saudável", cloud_api: "Operando", window: "72 h ativa", templates: "3 aprovados" },
    versions: [12, 13, 14].map((v, i) => ({ version: `v${v}`, conversations: 60 + i * 20, resolution: 70 + i * 6, unresolved: 9 - i * 3, abandoned: 12 - i * 2, turns: 400 + i * 120, handoff: 12 - i * 2, fallback: 5 - i, rewrites: 1.1 - i * .2, cost: .8 - i * .08 })),
    gates: ["tamanho", "endereço", "identidade", "cobertura", "checkout"].map((g, i) => ({ gate: g, checks: 300 - i * 30, blocks: 20 - i * 3, rate: ((20 - i * 3) / (300 - i * 30)) * 100 })),
  };
}

// Critérios de pausa (L3): calculados das métricas quando o data.json não traz `pause`.
function computePause(d) {
  const m = d.metrics || {}, v = (id) => m[id]?.value;
  const lvl = (x, warn, bad) => (x == null ? "" : x > bad ? "bad" : x > warn ? "warn" : "ok");
  const row = (x, s, u) => (x == null ? undefined : { value: fmt(x, u), status: s });
  return {
    p_premise: row(v("invalid_premise"), lvl(v("invalid_premise"), 4, 5), "pct"),
    p_handoff: row(v("handoff"), lvl(v("handoff"), 8, 10), "pct"),
    p_optout: row(v("optout"), lvl(v("optout"), 2, 2.5), "pct"),
    p_api: row(d.api_over_pct, lvl(d.api_over_pct, 4, 5), "pct"),
    p_cash: row(v("cash_left"), v("cash_left") == null ? "" : v("cash_left") < 300 ? "bad" : v("cash_left") < 600 ? "warn" : "ok", "brl"),
    p_channel: d.channel ? { value: d.channel.number, status: /restrit|banid|fora|erro|desconect/i.test(d.channel.number) ? "bad" : "ok" } : undefined,
  };
}

// Decisão do dia 12: a pior das três métricas decide (0 escalar, 1 ajustar, 2 parar).
function computeDecision(m) {
  const c = m.conversion?.value, p = m.cpl?.value, r = m.roi?.value;
  if (c == null || p == null || r == null) return null;
  return Math.max(c > 10 ? 0 : c >= 6 ? 1 : 2, p < 1.25 ? 0 : p <= 1.75 ? 1 : 2, r > 2.5 ? 0 : r >= 1.5 ? 1 : 2);
}

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const fmt = (v, unit) => {
  if (v == null) return "—";
  if (unit === "brl") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  if (unit === "pct") return `${nf.format(v)}%`;
  if (unit === "x") return `${nf.format(v)}×`;
  if (unit === "min") return v < 1 ? `${Math.round(v * 60)} s` : `${nf.format(v)} min`;
  return nf.format(v);
};

function chartSvg(series, unit) {
  const lab = series && series.length > 1 ? `<div class="range"><span>mín ${fmt(Math.min(...series), unit)}</span><span>máx ${fmt(Math.max(...series), unit)}</span></div>` : "";
  return chartSvgRaw(series) + lab;
}
// Barras por hora do dia (0 a 23 h, horário de Brasília).
function hourBars(h) {
  if (!h) return `<p class="note">Sem dados.</p>`;
  const w = 300, hh = 90, max = Math.max(1, ...h), bw = w / 24;
  const bars = h.map((v, i) => `<rect x="${i * bw + 1}" y="${hh - 14 - (v / max) * (hh - 20)}" width="${bw - 2}" height="${(v / max) * (hh - 20)}"><title>${i} h: ${v}</title></rect>`).join("");
  const ticks = [0, 6, 12, 18].map((i) => `<text x="${i * bw + 1}" y="${hh - 2}">${i} h</text>`).join("");
  return `<svg class="chart bars" viewBox="0 0 ${w} ${hh}" role="img" aria-label="Mensagens recebidas por hora: pico de ${max}">${bars}${ticks}</svg>`;
}
// Gráfico com leitura ao passar o mouse: ponto, valor e intervalo (o tooltip flutuante).
function hoverChart(series, unit, id) {
  if (!series || series.length < 2) return `<p class="note">Sem série no período.</p>`;
  const w = 300, h = 110, min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const P = series.map((v, i) => [(i / (series.length - 1)) * w, h - 8 - ((v - min) / span) * (h - 20)]);
  const area = `M0,${h} L${P.map((p) => p.join(",")).join(" L")} L${w},${h} Z`;
  return `<div class="hc" data-series='${JSON.stringify(series)}' data-unit="${unit}"><svg class="chart big" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path class="area" d="${area}"/><path d="M${P.map((p) => p.join(",")).join("L")}"/><line class="cross" x1="0" x2="0" y1="0" y2="${h}" hidden/></svg><div class="tip" hidden></div>
    <div class="range"><span>mín ${fmt(min, unit)}</span><span>máx ${fmt(max, unit)}</span></div></div>`;
}
document.addEventListener("pointermove", (e) => {
  const hc = e.target.closest?.(".hc");
  document.querySelectorAll(".hc .tip:not([hidden])").forEach((t) => { if (t.parentElement !== hc) { t.hidden = true; t.parentElement.querySelector(".cross").setAttribute("hidden", ""); } });
  if (!hc) return;
  const s = JSON.parse(hc.dataset.series), r = hc.getBoundingClientRect(), i = Math.max(0, Math.min(s.length - 1, Math.round(((e.clientX - r.left) / r.width) * (s.length - 1))));
  const [n, days] = BUCKETS[state.period], back = (s.length - 1 - i) * days, tip = hc.querySelector(".tip"), cross = hc.querySelector(".cross");
  const label = days < 1 ? `há ${Math.round(back * 24)} h` : back === 0 ? "intervalo atual" : `há ${back} dia${back > 1 ? "s" : ""}`;
  tip.hidden = false; tip.innerHTML = `<b>${fmt(s[i], hc.dataset.unit)}</b> ${label}`;
  tip.style.left = `${Math.min(r.width - 120, Math.max(0, (i / (s.length - 1)) * r.width - 50))}px`;
  cross.removeAttribute("hidden"); cross.setAttribute("x1", (i / (s.length - 1)) * 300); cross.setAttribute("x2", (i / (s.length - 1)) * 300);
});
function chartSvgRaw(series) {
  const w = 300, h = 90;
  const base = `<line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}"/>`;
  if (!series || series.length < 2) return `<svg class="chart" viewBox="0 0 ${w} ${h}">${base}</svg>`;
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - 6 - ((v - min) / span) * (h - 12)}`);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}">${base}<path d="M${pts.join("L")}"/></svg>`;
}

function route() {
  const [sec, sub] = location.hash.replace(/^#\/?/, "").split("/");
  const nav = NAV.find((n) => n.id === sec) || NAV[0];
  const s = nav.subs ? (nav.subs.find(([k]) => k === sub) || nav.subs.find(([k]) => k === store.get(`sub:${nav.id}`)) || nav.subs[0]) : null;
  return { nav, sub: s };
}
const STATUS_RUN = { success: "sucesso", error: "erro", crashed: "falhou", running: "rodando", waiting: "esperando", canceled: "cancelada" };
const MODE = { trigger: "gatilho", webhook: "webhook", manual: "manual", integrated: "chamado por outro", retry: "nova tentativa", cli: "linha de comando" };
const NODE = { webhook: "Webhook", httpRequest: "Chamada HTTP", if: "Condição", code: "Código", emailSend: "E-mail", wait: "Espera", scheduleTrigger: "Relógio", formTrigger: "Formulário (início)", form: "Formulário", executeWorkflow: "Chama workflow", executeWorkflowTrigger: "Chamado por workflow", respondToWebhook: "Responde webhook", splitInBatches: "Lotes", manualTrigger: "Manual" };
const when = (s) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—");
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Desenho de um workflow do n8n: posição real dos nós, sem sobreposição; gatilhos em verde.
// Os nós podem ser arrastados (só mover: ligação e nó não se apagam). A posição fica neste navegador.
const FLOWS = {};
const NW = 168, NH = 46;
function layout(w) {
  const saved = (() => { try { return JSON.parse(store.get(`flow:${w.id || w.name}`) || "{}"); } catch { return {}; } })();
  const minX = Math.min(...w.nodes.map((n) => n.x)), minY = Math.min(...w.nodes.map((n) => n.y));
  const pos = {};
  for (const n of [...w.nodes].sort((a, b) => a.x - b.x || a.y - b.y)) {
    if (saved[n.name]) { pos[n.name] = saved[n.name]; continue; }
    const p = { x: (n.x - minX) * 0.85 + 10, y: (n.y - minY) * 0.85 + 10 };
    // empurra para baixo enquanto encostar em outro nó já posicionado
    for (let hit = true; hit; ) { hit = Object.values(pos).some((q) => Math.abs(q.x - p.x) < NW + 14 && Math.abs(q.y - p.y) < NH + 14); if (hit) p.y += NH + 16; }
    pos[n.name] = p;
  }
  return pos;
}
function edgePath(p, q) {
  const x1 = p.x + NW, y1 = p.y + NH / 2, x2 = q.x, y2 = q.y + NH / 2, c = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`;
}
function flowSvg(w) {
  if (!w.nodes.length) return "";
  const key = w.id || w.name, pos = layout(w);
  FLOWS[key] = { pos, edges: w.edges.filter(([a, b]) => pos[a] && pos[b]) };
  const vw = Math.max(...Object.values(pos).map((p) => p.x)) + NW + 200, vh = Math.max(...Object.values(pos).map((p) => p.y)) + NH + 120;
  const edges = FLOWS[key].edges.map(([a, b], i) => `<path data-e="${i}" d="${edgePath(pos[a], pos[b])}"/>`).join("");
  const types = Object.fromEntries(w.nodes.map((n) => [n.name, n.type]));
  const nodes = Object.entries(pos).map(([name, p]) => { const type = types[name], trig = /Trigger$|^webhook$/.test(type);
    return `<g class="nd ${trig ? "trig" : ""}" data-n="${esc(name)}" transform="translate(${p.x},${p.y})"><rect width="${NW}" height="${NH}" rx="8"/><text x="10" y="19">${esc(name.length > 23 ? name.slice(0, 22) + "…" : name)}</text><text class="t" x="10" y="35">${NODE[type] || type}</text><title>${esc(name)}</title></g>`; }).join("");
  return `<div class="flow-wrap"><svg class="wf" data-flow="${esc(key)}" viewBox="0 0 ${vw} ${vh}" style="width:${vw}px" role="img" aria-label="Fluxo do workflow ${esc(w.name)}">${edges}${nodes}</svg><button class="reset" data-reset="${esc(key)}">Voltar ao desenho original</button></div>`;
}
let drag = null;
document.addEventListener("pointerdown", (e) => {
  const g = e.target.closest?.("svg.wf g.nd");
  if (!g) return;
  const svg = g.ownerSVGElement, f = FLOWS[svg.dataset.flow], m = svg.getScreenCTM().inverse();
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m), p = f.pos[g.dataset.n];
  drag = { g, svg, f, name: g.dataset.n, dx: pt.x - p.x, dy: pt.y - p.y, m };
  g.setPointerCapture(e.pointerId); e.preventDefault();
});
document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(drag.m), p = drag.f.pos[drag.name];
  p.x = Math.max(0, pt.x - drag.dx); p.y = Math.max(0, pt.y - drag.dy);
  drag.g.setAttribute("transform", `translate(${p.x},${p.y})`);
  drag.f.edges.forEach(([a, b], i) => { if (a === drag.name || b === drag.name) drag.svg.querySelector(`path[data-e="${i}"]`).setAttribute("d", edgePath(drag.f.pos[a], drag.f.pos[b])); });
});
document.addEventListener("pointerup", () => {
  if (!drag) return;
  const { f, name, svg } = drag, p = f.pos[name];
  // soltou em cima de outro nó: volta para baixo dele, para nunca ficar sobreposto
  for (let hit = true; hit; ) { hit = Object.entries(f.pos).some(([k, q]) => k !== name && Math.abs(q.x - p.x) < NW + 8 && Math.abs(q.y - p.y) < NH + 8); if (hit) p.y += NH + 16; }
  drag.g.setAttribute("transform", `translate(${p.x},${p.y})`);
  f.edges.forEach(([a, b], i) => svg.querySelector(`path[data-e="${i}"]`).setAttribute("d", edgePath(f.pos[a], f.pos[b])));
  store.set(`flow:${svg.dataset.flow}`, JSON.stringify(f.pos));
  // a área do desenho cresce até caber o nó movido
  const vw = Math.max(...Object.values(f.pos).map((q) => q.x)) + NW + 200, vh = Math.max(...Object.values(f.pos).map((q) => q.y)) + NH + 120;
  svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`); svg.style.width = `${vw}px`;
  drag = null;
});
const metricBy = (id) => ALL.find((x) => x.id === id);
const tbl = (head, rows) => `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;

const SECTOR_VIEWS = {
  videos(d) {
    const v = d.videos || {};
    return `<div class="grid">${VIDEOS.map((n) => `<article class="card video"><div class="thumb">▶ ${n}</div><h3>${n}</h3>
      <dl>${VIDEO_CARD.map(([id, l, u]) => `<dt>${l}</dt><dd>${fmt(v[n]?.[id], u)}</dd>`).join("")}</dl><p class="meta">FONTE: Meta Ads + eval_attribution</p></article>`).join("")}</div>
      <h3 class="group">Todas as métricas por vídeo</h3>${segTable("creative", d, VIDEOS)}`;
  },
  money(d) {
    const m = d.money || {};
    return `<h3 class="group">Do faturamento ao lucro</h3>${tbl(["Etapa", "Valor"], MONEY_FLOW.map(([id, l, s]) =>
      `<tr class="${s === 0 ? "sum" : ""}"><td>${s < 0 ? "− " : ""}${l}</td><td>${fmt(m[id], "brl")}</td></tr>`))}
      <h3 class="group">Situação do caixa</h3><div class="grid">${MONEY_STATUS.map(([id, l, u]) => `<article class="card"><h3>${l}</h3><div class="value">${fmt(m[id], u)}</div></article>`).join("")}</div>
      <p class="note">Fase 1: lucro líquido estimado a partir de orders + taxas do config; conciliação com o extrato depois. Fonte: orders, Mercado Pago, Coinzz/Logzz.</p>`;
  },
  results(d) {
    const o = d.outcomes || {}, m = d.metrics || {}, top = o.attended || 0;
    const delta = (id) => { const v = m[id]; return v && v.previous ? ` · ${v.value >= v.previous ? "▲" : "▼"} ${Math.abs(v.value - v.previous).toFixed(1).replace(".", ",")} p.p. contra o período anterior` : ""; };
    const card = (l, v, u, sub) => `<article class="card"><h3>${l}</h3><div class="value">${fmt(v, u)}</div><p class="meta">${sub}</p></article>`;
    return `<div class="grid">${card("Atendidas", o.attended, "n", "Conversas abertas no período")}
      ${card("Resolvidas pela Malu", o.solved, "n", "Compraram ou encerraram sem compra, sem pessoa")}
      ${card("Não resolvidas", o.unresolved, "n", "A Malu avisou o operador")}
      ${card("Abandonadas", o.abandoned, "n", "24 h sem resposta dela, sem decisão")}
      ${card("Taxa de resolução", o.resolution, "pct", `Resolvidas ÷ encerradas (sem as em andamento). META ≥ 90%`).replace("</div><p", `</div>${deltaHtml("resolution", "pct")}<p`)}</div>
      <h3 class="group">Detalhamento por desfecho</h3><div class="funnel">${OUTCOMES.map(([id, l, , tip]) => {
        const n = o[id], w = top && n != null ? Math.max(2, (n / top) * 100) : 0;
        return `<div class="step" title="${tip}"><span>${l}</span><div class="bar-track"><div class="bar-fill ${OUTCOME[id].c}" style="width:${w}%"></div></div><b>${fmt(n, "n")}</b></div>`;
      }).join("")}</div>
      <h3 class="group">Resolução por período</h3><article class="card">${chartSvg(m.resolution?.series, "pct")}<p class="meta">Taxa de resolução em cada intervalo do período escolhido</p></article>
      <h3 class="group">Resultado por versão da Malu</h3>${tbl(["Versão", "Conversas", "Resolução", "Não resolvidas", "Abandonadas", "Resposta pronta", "Custo"], (d.versions || [{}]).map((r) =>
      `<tr><td>${r.version ?? "—"}</td><td>${fmt(r.conversations, "n")}</td><td>${fmt(r.resolution, "pct")}</td><td>${fmt(r.unresolved, "n")}</td><td>${fmt(r.abandoned, "n")}</td><td>${fmt(r.fallback, "pct")}</td><td>${fmt(r.cost, "brl")}</td></tr>`))}
      <p class="note">Abaixo do piso de amostra (500 leads) a diferença entre versões é ruído: leia como direção, não como veredito.</p>`;
  },
  conversations(d) {
    const all = d.conversations || [], rows = state.filter === "all" ? all : all.filter((c) => c.status === state.filter);
    const count = (id) => all.filter((c) => c.status === id).length;
    return `<div class="tabs">${[["all", `Todas ${all.length}`], ...OUTCOMES.map(([id, l]) => [id, `${l} ${count(id)}`])].map(([id, l]) => `<button data-filter="${id}" aria-pressed="${state.filter === id}">${l}</button>`).join("")}</div>
      ${rows.length ? tbl(["Conversa", "Início", "Desfecho", "Etapa", "Mensagens", "1ª resposta", "Versão", "Motivo"], rows.map((c) =>
      `<tr><td><code>${c.id}</code></td><td>${new Date(c.start).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}</td><td><span class="chip ${OUTCOME[c.status]?.c || ""}"><i></i>${OUTCOME[c.status]?.l || c.status}</span></td><td>${STAGE[c.stage] || c.stage || "—"}</td><td>${fmt(c.messages, "n")}</td><td>${fmt(c.first_response, "min")}</td><td>${c.version != null ? `v${c.version}` : "—"}</td><td>${c.reason || "—"}</td></tr>`)) : `<p class="note">Nenhuma conversa neste filtro.</p>`}
      <p class="note">Sem nome, telefone ou texto da conversa: o código da conversa é o começo do id no Supabase, para abrir lá.</p>`;
  },
  gaps(d) {
    const g = d.gaps || [];
    return `<p class="note">O que a Malu não resolveu sozinha, agrupado pelo motivo que o código gravou. Cada linha é um contorno a construir para ela resolver sem pessoa (meta R21.1). As mais frequentes primeiro.</p>
      ${g.length ? tbl(["Motivo", "Ocorrências", "Conversas", "Última vez", "Versão"], g.map((x) =>
      `<tr><td>${x.reason}</td><td>${fmt(x.count, "n")}</td><td>${fmt(x.conversations, "n")}</td><td>${new Date(x.last).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}</td><td>${x.version != null ? `v${x.version}` : "—"}</td></tr>`)) : `<p class="note">Nenhuma lacuna no período.</p>`}`;
  },
  service(d) {
    const f = d.funnel || {}, top = f.first_msg || 0;
    return `<h3 class="group">Funil da conversa</h3><div class="funnel">${FUNNEL.map(([id, l]) => {
      const n = f[id], w = top && n != null ? Math.max(2, (n / top) * 100) : 0;
      return `<div class="step"><span>${l}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div><b>${fmt(n, "n")}</b></div>`;
    }).join("")}</div>
      <h3 class="group">Atendimento</h3><div class="grid">${SERVICE.map(([id, label]) => cardHtml({ ...metricBy(id), ...(label ? { label } : {}) })).join("")}
      <article class="card"><h3>Volume por hora</h3>${hourBars(d.hourly)}<p class="meta">FONTE: messages (recebidas, horário de Brasília)</p></article></div>`;
  },
  health(d) {
    return `<h3 class="group">Saúde da agente</h3><div class="grid">${AGENT_HEALTH.map((id) => { const x = metricBy(id);
      return `<article class="card"><h3>${x.label}</h3><div class="value">${fmt(d.metrics?.[id]?.value, x.unit)}</div>${deltaHtml(id, x.unit)}${chartSvg(d.metrics?.[id]?.series, x.unit)}<p class="meta">${x.goal ? `META: ${x.goal}<br>` : ""}FONTE: ${x.src}</p></article>`; }).join("")}</div>
      <h3 class="group">Canal</h3>${tbl(["Item", "Estado"], CHANNEL.map(([id, l]) => `<tr><td>${l}</td><td>${d.channel?.[id] ?? "—"}</td></tr>`))}
      <h3 class="group">Antes × depois de cada versão</h3>${tbl(["Versão", "Respostas", "Handoff", "Fallback", "Reescritas", "Custo"], (d.versions || [{}]).map((r) =>
      `<tr><td>${r.version ?? "—"}</td><td>${fmt(r.turns, "n")}</td><td>${fmt(r.handoff, "pct")}</td><td>${fmt(r.fallback, "pct")}</td><td>${fmt(r.rewrites, "n")}</td><td>${fmt(r.cost, "brl")}</td></tr>`))}
      <h3 class="group">O que a verificação barra</h3>${tbl(["Gate", "Checagens", "Bloqueios", "Taxa"], (d.gates || [{}]).map((r) =>
      `<tr><td>${r.gate ?? "—"}</td><td>${fmt(r.checks, "n")}</td><td>${fmt(r.blocks, "n")}</td><td>${fmt(r.rate, "pct")}</td></tr>`))}`;
  },
  ads() {
    return `<div class="grid">${GROUPS[2].metrics.map(cardHtml).join("")}</div>`;
  },
  region(d) {
    return `<p class="note">Região medida pelo conjunto (A × B), não pelo endereço. A e B se sobrepõem no Sudeste, Centro-Oeste e Sul: leitura direcional.</p>${segTable("region", d, SEGMENTS.region)}`;
  },
  ref() {
    return REF.map(([t, rows]) => `<h3 class="group">${t}</h3>${tbl(["Item", "Valor"], rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`))}`).join("");
  },
  workflows(d) {
    const a = d.automations;
    if (!a) return `<p class="note">Automações ainda não ligadas: no Vercel, crie a variável <code>N8N_API_KEY</code> (chave da API do n8n, só leitura de workflows e execuções). O portal nunca lê os parâmetros dos nós, onde ficam URLs e credenciais.</p>`;
    if (a.error) return `<p class="note">Não consegui ler o n8n: ${a.error}</p>`;
    const on = a.workflows.filter((w) => w.active);
    return `<div class="grid">${[["Ativos", on.length], ["Desligados", a.workflows.length - on.length], ["Execuções lidas", a.read ?? a.runs.length], ["Ativos com erro recente", on.filter((w) => w.errors).length]].map(([l, v]) => `<article class="card"><h3>${l}</h3><div class="value">${fmt(v, "n")}</div></article>`).join("")}</div>
      ${a.workflows.map((w) => `<details class="flow" ${w.active ? "open" : ""}><summary><span class="chip ${w.active ? (w.errors ? "bad" : "ok") : ""}"><i></i>${w.active ? (w.errors ? `${w.errors} com erro` : "Ativo") : "Desligado"}</span><b>${w.name}</b><small>${w.nodes.length} etapas · ${w.last ? `última ${STATUS_RUN[w.last.status] || w.last.status} ${when(w.last.at)}` : "sem execução entre as últimas lidas"}</small></summary>${flowSvg(w)}</details>`).join("")}`;
  },
  flow(d) {
    const o = d.outcomes || {}, wf = (k) => d.automations?.workflows?.find((w) => w.name.includes(k));
    const step = (t, sub, k) => { const w = k && wf(k); return `<div class="node"><b>${t}</b><span>${sub}</span>${w ? `<small class="chip ${w.active ? "ok" : ""}"><i></i>n8n: ${w.name.replace(/^Encorpa — /, "")}</small>` : ""}</div>`; };
    return `<div class="pipe">${step("Mensagem dela", "WhatsApp Cloud API (texto ou áudio transcrito)")}<i>→</i>${step("Entrada", "webhook recebe e enfileira", "Turno")}<i>→</i>${step("Turno", "Edge Function turn: estado, fatos do lead, régua")}<i>→</i>${step("Modelo escreve", "o modelo só escreve texto")}<i>→</i>${step("Gates verificam", "tamanho, endereço, preço, cobertura, checkout; até 5 reescritas")}</div>
      <h3 class="group">Onde cada desfecho nasce</h3><div class="grid">
      <article class="card"><h3>Gate aprovou</h3><div class="value">${fmt(o.solved, "n")}</div><p class="meta">Resposta enviada. Conversas resolvidas no período (compraram ou encerraram sem compra).</p></article>
      <article class="card"><h3>Gate vetou 5 vezes ou faltou contorno</h3><div class="value">${fmt(o.unresolved, "n")}</div><p class="meta">Resposta pronta segura para ela e e-mail ao operador (R22.1). Vira linha em Lacunas.</p></article>
      <article class="card"><h3>Silêncio dela</h3><div class="value">${fmt(o.abandoned, "n")}</div><p class="meta">A régua de follow-up assume${wf("Relógio") ? " (n8n: Relógio da régua)" : ""}.</p></article>
      <article class="card"><h3>Venda</h3><div class="value">${fmt(o.bought, "n")}</div><p class="meta">Pedido criado; confirmação da Coinzz${wf("Venda") ? " (n8n: Venda confirmada)" : ""}.</p></article></div>
      <p class="note">O fluxo da conversa é código com teste, não editor de arrasta-e-solta (decisão R11.1): esta tela mostra, não altera.</p>`;
  },
  runs(d) {
    const r = d.automations?.runs;
    if (!r) return SECTOR_VIEWS.workflows(d);
    return tbl(["Workflow", "Estado", "Início", "Duração", "Disparo"], r.map((x) => `<tr><td>${x.workflow}</td><td><span class="chip ${x.status === "success" ? "ok" : x.status === "error" || x.status === "crashed" ? "bad" : "warn"}"><i></i>${STATUS_RUN[x.status] || x.status}</span></td><td>${when(x.at)}</td><td>${x.ms == null ? "—" : x.ms < 1000 ? `${x.ms} ms` : `${nf.format(x.ms / 1000)} s`}</td><td>${MODE[x.mode] || x.mode}</td></tr>`));
  },
  campaigns: (d) => metaView(d, "campaigns"),
  adsets: (d) => metaView(d, "adsets"),
  tests(d) {
    return `<div id="status-box"></div><div class="two"><div><h3 class="group">Progresso do teste</h3><div class="bars">${sampleBars(d)}</div></div>
      <div><h3 class="group">Critérios de pausa <small>${pauseSum(d)}</small></h3>${pauseChips(d)}</div></div>
      <h3 class="group">Criativos</h3>${SECTOR_VIEWS.videos(d)}<h3 class="group">Região</h3>${SECTOR_VIEWS.region(d)}`;
  },
  metaAds: (d) => metaView(d, "ads"),
  rules() {
    return `<h3 class="group">Decisão no dia 12</h3>${tbl(["Decisão", "Conversão", "CPL", "ROI"], DECISION.map((r) => `<tr><td>${r[0]}</td>${r.slice(1).map((c) => `<td>${c}</td>`).join("")}</tr>`))}
      <h3 class="group">Critérios de pausa</h3>${tbl(["Critério", "O que mede", "Quando pausar"], PAUSE.map((c) => `<tr><td>${c.label}</td><td>${c.what}</td><td>${c.limit}</td></tr>`))}
      <h3 class="group">Metas por fase</h3>${tbl(["Fase", "Mínima", "Ideal"], PHASES.map(([f, a, b]) => `<tr><td>${f}</td><td>${a}</td><td>${b}</td></tr>`))}`;
  },
  api(d) {
    const m = d.money || {};
    return `<div class="grid">${[["api_cost", "No período"], ["api_per_day", "Média por dia"], ["api_30d", "Projeção para 30 dias"]].map(([id, l]) => `<article class="card"><h3>${l}</h3><div class="value">${fmt(m[id], "brl")}</div></article>`).join("")}
      ${["api_per_lead", "cpl_api"].map((id) => cardHtml(metricBy(id))).join("")}</div>`;
  },
  compare(d) {
    const m = d.metrics || {};
    return tbl(["Métrica", "Período atual", "Período anterior", "Variação"], ALL.map((x) => {
      const v = m[x.id];
      const delta = v && v.previous ? `${(((v.value - v.previous) / v.previous) * 100).toFixed(1).replace(".", ",")}%` : "—";
      return `<tr><td>${x.label}</td><td>${fmt(v?.value, x.unit)}</td><td>${fmt(v?.previous, x.unit)}</td><td>${delta}</td></tr>`;
    }));
  },
};

// Cada sub-aba aponta para uma view; as que têm nome repetido entre seções ganham prefixo aqui.
const VIEW = { "money/flow": "money", "auto/flow": "flow", "ads/ads": "metaAds" };
// Meta Ads (só leitura): campanhas, conjuntos e anúncios com as métricas do período escolhido.
const AD_STATUS = { ACTIVE: ["Ativo", "ok"], PAUSED: ["Pausado", ""], CAMPAIGN_PAUSED: ["Campanha pausada", ""], ADSET_PAUSED: ["Conjunto pausado", ""], DELETED: ["Apagado", ""], ARCHIVED: ["Arquivado", ""], IN_PROCESS: ["Em análise", "warn"], PENDING_REVIEW: ["Em análise", "warn"], DISAPPROVED: ["Reprovado", "bad"], WITH_ISSUES: ["Com problema", "bad"], PENDING_BILLING_INFO: ["Falta pagamento", "bad"] };
const GENDER = { 1: "homens", 2: "mulheres" };
const stat = (s) => { const [l, c] = AD_STATUS[s] || [s, ""]; return `<span class="chip ${c}"><i></i>${l}</span>`; };
const budget = (x) => (x.daily_budget ? `${fmt(x.daily_budget, "brl")}/dia` : x.lifetime_budget ? `${fmt(x.lifetime_budget, "brl")} no total` : "—");
const perf = (x) => `<td>${fmt(x.spend, "brl")}</td><td>${fmt(x.impressions, "n")}</td><td>${fmt(x.ctr, "pct")}</td><td>${fmt(x.cpm, "brl")}</td><td>${fmt(x.started, "n")}</td><td>${fmt(x.cpl, "brl")}</td><td>${fmt(x.leads, "n")}</td><td>${fmt(x.orders, "n")}</td>`;
const PERF = ["Gasto", "Impressões", "CTR", "CPM", "Conversas", "CPL", "Leads", "Pedidos"];
function metaView(d, kind) {
  const m = d.meta;
  if (!m) return `<p class="note">Meta Ads ainda não ligado. Falta criar no Vercel as variáveis <code>META_ACCESS_TOKEN</code> (token só de leitura) e <code>META_AD_ACCOUNT_ID</code>. Depois disso esta aba se atualiza sozinha a cada 5 minutos, e anúncio novo ou removido na Meta aparece ou some sozinho.</p>`;
  if (m.error) return `<p class="note">Não consegui ler a Meta: ${esc(m.error)}</p>`;
  const camp = Object.fromEntries(m.campaigns.map((c) => [c.id, c.name])), sets = Object.fromEntries(m.adsets.map((s) => [s.id, s.name]));
  const note = `<p class="note">Métricas do período escolhido no topo. CPL = gasto ÷ conversas iniciadas no WhatsApp. Leads e pedidos vêm do clique no anúncio gravado na conversa (total do anúncio, não do período).</p>`;
  if (kind === "campaigns") return (m.campaigns.length ? tbl(["Campanha", "Estado", "Objetivo", "Orçamento", "Anúncios", ...PERF], m.campaigns.map((c) => `<tr><td>${esc(c.name)}</td><td>${stat(c.status)}</td><td>${c.objective || "—"}</td><td>${budget(c)}</td><td>${fmt(c.ads, "n")}</td>${perf(c)}</tr>`)) : `<p class="note">Nenhuma campanha na conta.</p>`) + note;
  if (kind === "adsets") return (m.adsets.length ? tbl(["Conjunto", "Campanha", "Estado", "Orçamento", "Otimização", "Público", ...PERF], m.adsets.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(camp[s.campaign_id] || "—")}</td><td>${stat(s.status)}</td><td>${budget(s)}</td><td>${s.optimization || "—"}</td><td>${[s.audience.age, (s.audience.genders || []).map((g) => GENDER[g]).join(" e ") || "todos", s.audience.places].filter(Boolean).join(" · ")}</td>${perf(s)}</tr>`)) : `<p class="note">Nenhum conjunto na conta.</p>`) + note;
  return (m.ads.length ? `<div class="grid">${m.ads.map((a) => `<article class="card ad"><div class="thumb">${a.creative?.thumb ? `<img src="${esc(a.creative.thumb)}" alt="" loading="lazy">` : "sem prévia"}</div>
    <h3>${esc(a.name)}</h3><p class="meta">${esc(camp[a.campaign_id] || "")} › ${esc(sets[a.adset_id] || "")}</p>${stat(a.status)}
    <dl>${[["Gasto", a.spend, "brl"], ["CTR", a.ctr, "pct"], ["CPM", a.cpm, "brl"], ["Conversas", a.started, "n"], ["CPL", a.cpl, "brl"], ["Leads", a.leads, "n"], ["Pedidos", a.orders, "n"]].map(([l, v, u]) => `<dt>${l}</dt><dd>${fmt(v, u)}</dd>`).join("")}</dl>
    ${a.creative?.body ? `<p class="meta">${esc(a.creative.body.slice(0, 140))}${a.creative.body.length > 140 ? "…" : ""}</p>` : ""}</article>`).join("")}</div>` : `<p class="note">Nenhum anúncio na conta.</p>`) + note;
}

function cardHtml(x) {
  const v = (state.data?.metrics || {})[x.id];
  return `<article class="card"><h3>${x.label}</h3><div class="value">${fmt(v?.value, x.unit)}</div>${deltaHtml(x.id, x.unit)}${chartSvg(v?.series, x.unit)}<p class="meta">${x.goal ? `META: ${x.goal}<br>` : ""}FONTE: ${x.src}</p></article>`;
}

function segTable(kind, d, names) {
  const seg = d.segments?.[kind] || {};
  return `<div class="table-wrap"><table><thead><tr><th>Métrica</th>${names.map((n) => `<th>${n}</th>`).join("")}</tr></thead><tbody>${SEGMENT_METRICS.map(([id, l, u]) =>
    `<tr><td>${l}</td>${names.map((n) => `<td>${fmt(seg[n]?.[id], u)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function render() {
  const d = state.data || {};
  const m = d.metrics || {};
  $("updated").textContent = state.data ? `${state.data.demo ? "EXEMPLO · " : ""}atualizado ${new Date(state.data.updated || Date.now()).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}` : "Sem dados ainda";
  $("demo").textContent = state.demo ? "Voltar aos dados reais" : "Ver exemplo";

  $("periods").innerHTML = PERIODS.map((p) => `<button data-id="${p.id}" aria-pressed="${p.id === state.period}">${p.label}</button>`).join("");

  $("kpis").innerHTML = KPIS.map((id) => { const x = metricBy(id), v = m[id];
    return `<article class="kpi"><h3>${x.label}</h3><div class="big">${fmt(v?.value, x.unit)}</div>${deltaHtml(id, x.unit)}${x.goal ? `<div class="goal">META ${x.goal}</div>` : ""}</article>`; }).join("");
  $("charts").innerHTML = KPIS.map((id) => { const x = metricBy(id), v = m[id];
    return `<article class="card"><h3>${x.label}</h3>${hoverChart(v?.series, x.unit, id)}</article>`; }).join("");

  const { nav, sub } = route();
  if (sub) store.set(`sub:${nav.id}`, sub[0]);
  $("side").innerHTML = NAV.map((n) => `<div class="sec ${n === nav ? "on" : ""}"><a href="#/${n.id}" aria-current="${n === nav && !n.subs}">${n.label}</a>${n.subs && n === nav ? n.subs.map(([k, l, , badge]) => { const c = badge?.(d);
    return `<a class="sub" href="#/${n.id}/${k}" aria-current="${sub?.[0] === k}">${l}${c ? `<em>${c}</em>` : ""}</a>`; }).join("") : ""}</div>`).join("");
  const home = nav.id === "home";
  $("periods").hidden = nav.id === "auto"; // workflows e execuções não dependem do período
  $("home").hidden = !home; $("page").hidden = home;
  if (!home) {
    $("crumb").textContent = `${nav.label} › ${sub[1]}`;
    $("page-title").textContent = sub[1];
    $("page-desc").textContent = sub[2];
    $("sector").innerHTML = SECTOR_VIEWS[VIEW[`${nav.id}/${sub[0]}`] || sub[0]](d);
    if ($("status-box")) $("status-box").outerHTML = statusBox(d);
  }
}

function sampleBars(d) {
  return [["Leads atendidos", "leads", "n", "+"], ["Pedidos criados", "orders", "n", "+"], ["Verba do anúncio", "spend", "brl", ""]].map(([l, k, u, plus]) => {
    const v = d.totals?.[k] ?? 0, pct = Math.min(100, (v / SAMPLE_FLOOR[k]) * 100);
    return `<div class="bar"><div class="bar-head"><span>${l}</span><span>${fmt(v, u)} / ${fmt(SAMPLE_FLOOR[k], u)}${plus}</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
  }).join("");
}
function pauseSum(d) {
  const pz = d.pause || computePause(d), count = (s) => PAUSE.filter((c) => pz[c.id]?.status === s).length;
  return PAUSE.some((c) => pz[c.id]) ? `${count("bad")} crítico · ${count("warn")} atenção · ${count("ok")} ok` : "";
}
function pauseChips(d) {
  const pz = d.pause || computePause(d), SIT = { ok: "dentro do limite", warn: "perto do limite", bad: "PAUSAR" };
  return `<ul class="pause">${PAUSE.map((c) => { const p = pz[c.id];
    return `<li class="${p?.status || ""}"><span>${c.label}<small>${c.what}. ${c.limit[0].toUpperCase() + c.limit.slice(1)}.</small></span>${p ? `<b>${p.value}<small>${SIT[p.status] || ""}</small></b>` : `<b class="na">sem número<small>${c.missing}</small></b>`}</li>`; }).join("")}</ul>`;
}
function statusBox(d) {
  const m = d.metrics || {}, dec = computeDecision(m), floorOk = (d.totals?.leads ?? 0) >= SAMPLE_FLOOR.leads && (d.totals?.orders ?? 0) >= SAMPLE_FLOOR.orders;
  const NAME = { conversion: "Conversão", cpl: "CPL", roi: "ROI" }, miss = Object.keys(NAME).filter((id) => m[id]?.value == null).map((id) => NAME[id]);
  return `<div class="status s${dec ?? "n"}">${dec == null ? `<b>Aguardando dados</b><span>Faltam ${miss.join(", ")} para a decisão do dia 12.</span>`
    : `<b>Hoje: ${DECISION[dec][0]}</b><span>Conversão ${fmt(m.conversion.value, "pct")} · CPL ${fmt(m.cpl.value, "brl")} · ROI ${fmt(m.roi.value, "x")}. A pior das três decide.${floorOk ? "" : " Amostra ainda abaixo do piso."}</span>`}</div>`;
}

async function refresh() {
  state.data = await loadData(state.period);
  render();
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.reset) { try { localStorage.removeItem(`flow:${b.dataset.reset}`); } catch {} render(); }
  else if (b.dataset.filter) { state.filter = b.dataset.filter; render(); }
  else if (b.dataset.id) { state.period = b.dataset.id; store.set("period", state.period); refresh(); }
  else if (b.id === "demo") { state.demo = !state.demo; store.set("demo", state.demo ? "1" : "0"); refresh(); }
});

refresh();
setInterval(refresh, 5 * 60 * 1000); // relê a cada 5 min (o servidor guarda a resposta 5 min)
window.addEventListener("hashchange", () => { state.filter = "all"; render(); window.scrollTo(0, 0); });
