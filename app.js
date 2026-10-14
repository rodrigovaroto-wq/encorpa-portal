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
    { id: "handoff", label: "Handoff", unit: "pct", src: "eval_turn_outcomes", goal: "≤ 10%" },
    { id: "fallback", label: "Resposta pronta (fallback)", unit: "pct", src: "eval_turn_outcomes" },
    { id: "optout", label: "Opt-out", unit: "pct", src: "leads", goal: "≤ 2,5%" },
    { id: "invalid_premise", label: "Premissa indevida", unit: "pct", src: "Hermes (lote de 50)", goal: "≤ 5%" },
  ]},
  { title: "Financeiro", metrics: [
    { id: "revenue", label: "Faturamento", unit: "brl", src: "orders" },
    { id: "op_cost", label: "Custo operacional", unit: "brl", src: "orders + config" },
    { id: "gross_profit", label: "Lucro bruto", unit: "brl", src: "orders + config" },
    { id: "net_profit", label: "Lucro líquido (comissões recebidas)", unit: "brl", src: "Coinzz/Logzz/Mercado Pago" },
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
    { id: "resolution", label: "Taxa de resolução", unit: "pct", src: "leads (sem handoff ÷ atendimentos)" },
    { id: "transfers", label: "Transferidos para pessoa", unit: "n", src: "leads.handoff_at" },
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
const PAUSE = [
  { id: "p_premise", label: "Premissa indevida", limit: "> 5% das conversas" },
  { id: "p_handoff", label: "Handoff", limit: "> 10% das conversas" },
  { id: "p_optout", label: "Opt-out", limit: "> 2,5%" },
  { id: "p_api", label: "Custo de API", limit: "> R$ 1,00 em mais de 5% dos últimos 100 leads" },
  { id: "p_cash", label: "Caixa reservado", limit: "acabando" },
  { id: "p_channel", label: "Saúde do canal", limit: "número restrito ou Cloud API fora" },
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


// Painel principal: as 8 que mandam.
const KPIS = ["leads", "orders", "conversion", "cpl", "roi", "net_profit"];

// Setores (abas). Cada um é renderizado por uma função abaixo.
const SECTORS = [["meta", "Meta ADS"], ["malu", "Malu AI Agent"], ["ops", "Operacional"]];

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
const SERVICE = [["leads", "Atendimentos"], ["resolution"], ["transfers"], ["first_response"], ["handle_time"]];
const AGENT_HEALTH = ["handoff", "fallback", "rewrites", "gate_blocks", "optout", "invalid_premise", "api_per_lead", "cpl_api"];
const CHANNEL = [["number", "Número do WhatsApp"], ["cloud_api", "Cloud API"], ["window", "Janela gratuita de 72 h"], ["templates", "Templates aprovados na Meta"]];



// Fatos fixos dos repositórios (Ricos-com-AI, Encorpa-Website, Encorpa-Campanhas). Datas = quando foram escritos.
const REF = [
  ["Oferta (config e site)", [["Produto", "Colete Cinta Modeladora, tamanhos P, M, G, GG e XGG"], ["Pagamento na entrega", "R$ 129,90, frete grátis"], ["Pagamento antecipado", "R$ 110,42 (15% off), frete por conta da cliente, calculado no checkout"], ["Âncora de preço", "R$ 216,50"], ["Garantia", "7 dias"], ["Atendimento", "06:00 às 00:00; fora disso, mensagem automática"], ["Mix previsto", "70% na entrega, 30% antecipado, 1 peça por pedido"]]],
  ["Economia por pedido (estudo de projeção, não medido)", [["COD entregue", "+ R$ 63,35 (produto R$ 30, transação, handling R$ 4,99, entrega R$ 19,99)"], ["COD recusado", "− R$ 14,98 (recusa R$ 9,99)"], ["Antecipado", "+ R$ 70,21"], ["Média com mix 70/30", "R$ 57,18 por pedido"], ["Recusa na porta (premissa)", "12% a 17%; a Logzz declara 13% a 16%"], ["Devolução pós-envio", "5% a 10% a R$ 25,00"], ["Equilíbrio", "conversão de 3,58% com CPL de R$ 1,25"], ["Comissão da entrega", "libera 14 dias depois do pagamento"]]],
  ["Medido × premissa", [["Custo de API por conversa", "medido R$ 0,051 (4 conversas de teste, máx R$ 0,073) × premissa do estudo R$ 0,80 por lead"], ["Teto do modelo por conversa", "R$ 0,50 (p50 medido R$ 0,268 e p95 R$ 0,546 no modelo padrão, 30/09)"], ["Custo do WhatsApp por lead", "R$ 0 dentro da janela de 24 h ou da gratuita de 72 h; template UTILITY ~ R$ 0,04 por pedido"]]],
  ["Teste de tráfego (L3)", [["Fase Copy, dias 1 a 5", "R$ 300, 6 vídeos, 1 conjunto aberto no Brasil, mulheres de 18 a 55"], ["Fase Região, dias 6 a 10", "R$ 200, só as 2 copies vencedoras; A = estados com mais de 5 cidades atendidas, B = Sudeste + Centro-Oeste + Sul"], ["Fase Leitura, dias 11 e 12", "R$ 0; as entregas chegam à porta"], ["Verba total", "R$ 500 de anúncio + R$ 1.500 de caixa reservado para o custo do pedido"], ["Piso de amostra", "mais de 500 leads atendidos e mais de 50 pedidos criados"], ["Primeira resposta da agente", "1 minuto depois da mensagem"], ["Régua de silêncio", "silence_3 entre 63 h e 71 h depois da abertura da janela de 72 h"]]],
  ["Etapas do pipeline (09/10)", [["L0 preparar", "feito; templates da Meta aprovados em 09/10"], ["L1 publicar", "feito; canal ligado e testado em 06/10"], ["L2 provar com dinheiro", "em andamento: teste real do operador e do sócio (antecipado e na entrega)"], ["L3 tráfego", "não começou"], ["L4 Hermes", "em andamento: H1 feito, H2 e H3 em parte, H4 e H5 pendentes"]]],
  ["Sistema no ar (09/10)", [["Agente (função turn)", "agent_version 15, função v90"], ["WhatsApp", "função whatsapp v24, transcrição de áudio"], ["Qualidade", "28 gates, 7.113 testes, 1.665 conversas simuladas passando"], ["Modelo da conversa", "muse-spark-1.3-contributor (decisão do operador)"], ["n8n", "6 workflows ok"], ["Banco", "Supabase, migrações até a 0025"]]],
];

const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const state = { period: store.get("period") || "week", segment: "creative", sector: store.get("sector") || "videos", demo: store.get("demo") === "1", data: null };

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
Object.assign(RANGE, { resolution: [85, 95], transfers: [2, 6], first_response: [.2, 1.2], handle_time: [8, 25] });
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
  return {
    demo: true, updated: new Date().toISOString(), metrics, api_over_pct: 3.8,
    totals: { leads: Math.round(leads * 1.0) % 600, orders: Math.round(orders) % 60, spend: Math.round(m.spend.value) % 500 },
    videos: seg(VIDEOS), segments: { creative: seg(VIDEOS), region: seg(SEGMENTS.region) },
    money: { ...flow, to_receive: flow.net_profit * .4, received: flow.net_profit * .6, prepaid_share: m.prepaid_share.value, cash_left: m.cash_left.value },
    funnel: Object.fromEntries(Object.entries({ first_msg: leads, reply: leads * pct("reply_rate"), price: leads * pct("price_reach"), link: leads * pct("link_reach"), order: orders, delivered: orders * pct("delivered") }).map(([k, v]) => [k, Math.round(v)])),
    hourly: Array.from({ length: 24 }, (_, h) => Math.round((h < 6 ? 1 : 6) * (1 + Math.sin(h / 4)) * days)),
    channel: { number: "Saudável", cloud_api: "Operando", window: "72 h ativa", templates: "3 aprovados" },
    versions: [12, 13, 14].map((v, i) => ({ version: `v${v}`, turns: 400 + i * 120, handoff: 12 - i * 2, fallback: 5 - i, rewrites: 1.1 - i * .2, cost: .8 - i * .08 })),
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
    p_channel: d.channel ? { value: d.channel.number, status: d.channel.number === "Saudável" ? "ok" : "bad" } : undefined,
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
function chartSvgRaw(series) {
  const w = 300, h = 90;
  const base = `<line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}"/>`;
  if (!series || series.length < 2) return `<svg class="chart" viewBox="0 0 ${w} ${h}">${base}</svg>`;
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - 6 - ((v - min) / span) * (h - 12)}`);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}">${base}<path d="M${pts.join("L")}"/></svg>`;
}

const TILE_TEXT = { meta: "Vídeos e criativos, anúncio e região A × B", malu: "Funil da conversa, saúde da agente, canal, versões e verificações", ops: "Fluxo de dinheiro, caixa, preços, custos, fases do teste, metas e estado do sistema" };
function currentView() {
  const v = location.hash.replace(/^#\/?/, "");
  return SECTORS.some(([k]) => k === v) ? v : "home";
}
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
  agent(d) {
    const f = d.funnel || {}, top = f.first_msg || 0;
    return `<h3 class="group">Funil da conversa</h3><div class="funnel">${FUNNEL.map(([id, l]) => {
      const n = f[id], w = top && n != null ? Math.max(2, (n / top) * 100) : 0;
      return `<div class="step"><span>${l}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div><b>${fmt(n, "n")}</b></div>`;
    }).join("")}</div>
      <h3 class="group">Atendimento</h3><div class="grid">${SERVICE.map(([id, label]) => cardHtml({ ...metricBy(id), ...(label ? { label } : {}) })).join("")}
      <article class="card"><h3>Volume por hora</h3>${hourBars(d.hourly)}<p class="meta">FONTE: messages (recebidas, horário de Brasília)</p></article></div>
      <h3 class="group">Saúde da agente</h3><div class="grid">${AGENT_HEALTH.map((id) => { const x = metricBy(id);
      return `<article class="card"><h3>${x.label}</h3><div class="value">${fmt(d.metrics?.[id]?.value, x.unit)}</div>${chartSvg(d.metrics?.[id]?.series, x.unit)}<p class="meta">${x.goal ? `META: ${x.goal}<br>` : ""}FONTE: ${x.src}</p></article>`; }).join("")}</div>
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
    return `<h3 class="group">Metas por fase</h3>${tbl(["Fase", "Mínima", "Ideal"], PHASES.map(([f, a, b]) => `<tr><td>${f}</td><td>${a}</td><td>${b}</td></tr>`))}` + REF.map(([t, rows]) => `<h3 class="group">${t}</h3>${tbl(["Item", "Valor"], rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`))}`).join("");
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

const PAGES = {
  meta: (d) => `<h3 class="group">Vídeos e criativos</h3>${SECTOR_VIEWS.videos(d)}<h3 class="group">Anúncio</h3>${SECTOR_VIEWS.ads(d)}<h3 class="group">Região</h3>${SECTOR_VIEWS.region(d)}`,
  malu: (d) => SECTOR_VIEWS.agent(d),
  ops: (d) => `${SECTOR_VIEWS.money(d)}
    <h3 class="group">Decisão no dia 12</h3>${tbl(["Decisão", "Conversão", "CPL", "ROI"], DECISION.map((r) => `<tr><td>${r[0]}</td>${r.slice(1).map((c) => `<td>${c}</td>`).join("")}</tr>`))}
    <h3 class="group">Critérios de pausa</h3>${tbl(["Critério", "Pausar se"], PAUSE.map((c) => `<tr><td>${c.label}</td><td>${c.limit}</td></tr>`))}
    <h3 class="group">Comparação entre períodos</h3><details class="more"><summary>Ver todas as métricas contra o período anterior</summary>${SECTOR_VIEWS.compare(d)}</details>
    ${SECTOR_VIEWS.ref(d)}`,
};

function cardHtml(x) {
  const v = (state.data?.metrics || {})[x.id];
  return `<article class="card"><h3>${x.label}</h3><div class="value">${fmt(v?.value, x.unit)}</div>${chartSvg(v?.series, x.unit)}<p class="meta">${x.goal ? `META: ${x.goal}<br>` : ""}FONTE: ${x.src}</p></article>`;
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
  const note = state.demo ? "Dados de exemplo — números inventados só para ver o portal funcionando. Não são reais." : state.data?.note;
  $("demo-banner").hidden = !note; $("demo-banner").textContent = note || "";

  $("periods").innerHTML = PERIODS.map((p) => `<button data-id="${p.id}" aria-pressed="${p.id === state.period}">${p.label}</button>`).join("");

  $("kpis").innerHTML = KPIS.map((id) => { const x = metricBy(id), v = m[id];
    const delta = v && v.previous ? `${v.value >= v.previous ? "▲" : "▼"} ${Math.abs(((v.value - v.previous) / v.previous) * 100).toFixed(1).replace(".", ",")}%` : "";
    return `<article class="kpi"><h3>${x.label}</h3><div class="big">${fmt(v?.value, x.unit)}</div><div class="delta">${delta || "&nbsp;"}</div>${x.goal ? `<div class="goal">META ${x.goal}</div>` : ""}</article>`; }).join("");

  $("sample").innerHTML = [["Leads atendidos", "leads", "n", "+"], ["Pedidos criados", "orders", "n", "+"], ["Verba do anúncio", "spend", "brl", ""]].map(([l, k, u, plus]) => {
    const v = d.totals?.[k] ?? (k === "spend" ? 0 : 0), pct = Math.min(100, (v / SAMPLE_FLOOR[k]) * 100);
    return `<div class="bar"><div class="bar-head"><span>${l}</span><span>${fmt(v, u)} / ${fmt(SAMPLE_FLOOR[k], u)}${plus}</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
  }).join("");

  const pz = d.pause || computePause(d);
  const count = (s) => PAUSE.filter((c) => pz[c.id]?.status === s).length;
  $("pause-sum").textContent = Object.keys(pz).length && PAUSE.some((c) => pz[c.id]) ? `${count("bad")} crítico · ${count("warn")} atenção · ${count("ok")} ok` : "";
  $("pause").innerHTML = PAUSE.map((c) => { const p = pz[c.id];
    return `<span class="chip ${p?.status || ""}" title="Pausar se: ${c.limit}"><i></i>${c.label}<b>${p ? p.value : "—"}</b></span>`; }).join("");

  const dec = computeDecision(m), floorOk = (d.totals?.leads ?? 0) >= SAMPLE_FLOOR.leads && (d.totals?.orders ?? 0) >= SAMPLE_FLOOR.orders;
  const NAME = { conversion: "Conversão", cpl: "CPL", roi: "ROI" };
  const miss = Object.keys(NAME).filter((id) => m[id]?.value == null).map((id) => NAME[id]);
  $("status").className = `status s${dec ?? "n"}`;
  $("status").innerHTML = dec == null
    ? `<b>Aguardando dados</b><span>Faltam ${miss.join(", ")} para a decisão do dia 12.</span>`
    : `<b>Hoje: ${DECISION[dec][0]}</b><span>Conversão ${fmt(m.conversion.value, "pct")} · CPL ${fmt(m.cpl.value, "brl")} · ROI ${fmt(m.roi.value, "x")}. A pior das três decide.${floorOk ? "" : " Amostra ainda abaixo do piso."}</span>`;

  const view = currentView();
  $("menu").innerHTML = [["home", "Painel"], ...SECTORS].map(([k, l]) => `<a href="#/${k}" aria-current="${k === view}">${l}</a>`).join("");
  $("home").hidden = view !== "home";
  $("page").hidden = view === "home";
  document.querySelector(".hero").classList.toggle("compact", view !== "home");
  $("tiles").innerHTML = SECTORS.map(([k, l]) => `<a class="tile" href="#/${k}"><b>${l}</b><span>${TILE_TEXT[k]}</span></a>`).join("");
  if (view !== "home") {
    $("page-title").textContent = SECTORS.find(([k]) => k === view)[1];
    $("sector").innerHTML = PAGES[view](d);
  }
}

async function refresh() {
  state.data = await loadData(state.period);
  render();
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.id) { state.period = b.dataset.id; store.set("period", state.period); refresh(); }
  else if (b.id === "demo") { state.demo = !state.demo; store.set("demo", state.demo ? "1" : "0"); refresh(); }
});

refresh();
setInterval(refresh, 30 * 60 * 1000); // relê os dados a cada 30 min (mesmo ritmo da rotina)
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
