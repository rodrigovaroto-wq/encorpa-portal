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
    { id: "ticket_pieces", label: "Ticket médio (peças)", unit: "n", src: "orders" },
    { id: "prepaid_share", label: "% antecipado × entrega", unit: "pct", src: "orders" },
    { id: "refusal", label: "Recusa na porta", unit: "pct", src: "orders", goal: "≤ 17%" },
  ]},
  { title: "Anúncio e site", metrics: [
    { id: "spend", label: "Gasto", unit: "brl", src: "Meta Ads" },
    { id: "cpm", label: "CPM", unit: "brl", src: "Meta Ads" },
    { id: "ctr", label: "CTR do link", unit: "pct", src: "Meta Ads", goal: "≥ 1% mín · 2% ideal" },
    { id: "cpc", label: "CPC", unit: "brl", src: "Meta Ads" },
    { id: "view_content", label: "ViewContent ÷ cliques", unit: "pct", src: "Pixel" },
    { id: "add_to_cart", label: "AddToCart ÷ ViewContent", unit: "pct", src: "Pixel" },
    { id: "checkout", label: "Pedidos ÷ InitiateCheckout", unit: "pct", src: "Pixel + Coinzz" },
    { id: "site_conversion", label: "Conversão no site", unit: "pct", src: "Pixel + Coinzz", goal: "> 3%" },
    { id: "cpa", label: "CPA real", unit: "brl", src: "Meta Ads + Coinzz", goal: "< R$ 35" },
    { id: "failed_delivery", label: "Entrega frustrada", unit: "pct", src: "Coinzz/Logzz", goal: "< 16,5%" },
  ]},
  { title: "Agente (Malu)", metrics: [
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
const SAMPLE_FLOOR = { leads: 500, orders: 50 };

const state = { period: "week", segment: "creative", data: null };

// Retornar { metrics: {id:{value,previous,series}}, pause: {id:{value,status}},
// segments: {creative|region: {rótulo:{id:valor}}}, totals: {leads,orders} } quando houver backend.
async function loadData(_period) {
  return null;
}

const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const fmt = (v, unit) => {
  if (v == null) return "—";
  if (unit === "brl") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  if (unit === "pct") return `${nf.format(v)}%`;
  if (unit === "x") return `${nf.format(v)}×`;
  return nf.format(v);
};

function chartSvg(series) {
  const w = 300, h = 90;
  const base = `<line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}"/>`;
  if (!series || series.length < 2) return `<svg class="chart" viewBox="0 0 ${w} ${h}">${base}</svg>`;
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - 6 - ((v - min) / span) * (h - 12)}`);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}">${base}<path d="M${pts.join("L")}"/></svg>`;
}

function render() {
  const d = state.data || {};
  const m = d.metrics || {};
  $("updated").textContent = state.data ? "Atualizado agora" : "Sem dados ainda";

  $("periods").innerHTML = PERIODS.map((p) => `<button data-id="${p.id}" aria-pressed="${p.id === state.period}">${p.label}</button>`).join("");

  $("sample").innerHTML = [["Leads atendidos", "leads"], ["Pedidos criados", "orders"]].map(([l, k]) => {
    const v = d.totals?.[k] ?? 0, pct = Math.min(100, (v / SAMPLE_FLOOR[k]) * 100);
    return `<div class="bar"><div class="bar-head"><span>${l}</span><span>${v} / ${SAMPLE_FLOOR[k]}+</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div></div>`;
  }).join("");

  $("metrics").innerHTML = GROUPS.map((g) => `<h3 class="group">${g.title}</h3><div class="grid">${g.metrics.map((x) =>
    `<article class="card"><h3>${x.label}</h3><div class="value">${fmt(m[x.id]?.value, x.unit)}</div>${chartSvg(m[x.id]?.series)}<p class="meta">${x.goal ? `META: ${x.goal}<br>` : ""}FONTE: ${x.src}</p></article>`).join("")}</div>`).join("");

  $("compare").tBodies[0].innerHTML = ALL.map((x) => {
    const v = m[x.id];
    const delta = v && v.previous ? `${(((v.value - v.previous) / v.previous) * 100).toFixed(1)}%` : "—";
    return `<tr><td>${x.label}</td><td>${fmt(v?.value, x.unit)}</td><td>${fmt(v?.previous, x.unit)}</td><td>${delta}</td></tr>`;
  }).join("");

  $("pause").innerHTML = PAUSE.map((c) => {
    const p = d.pause?.[c.id];
    return `<li class="${p?.status || ""}"><span>${c.label}<small>PAUSAR SE: ${c.limit}</small></span><span>${p ? p.value : "—"}</span></li>`;
  }).join("");

  const names = SEGMENTS[state.segment], seg = d.segments?.[state.segment] || {};
  $("seg-tabs").innerHTML = [["creative", "Por criativo"], ["region", "Por região"]].map(([k, l]) => `<button data-seg="${k}" aria-pressed="${k === state.segment}">${l}</button>`).join("");
  $("segments").innerHTML = `<thead><tr><th>Métrica</th>${names.map((n) => `<th>${n}</th>`).join("")}</tr></thead><tbody>${SEGMENT_METRICS.map(([id, l, u]) =>
    `<tr><td>${l}</td>${names.map((n) => `<td>${fmt(seg[n]?.[id], u)}</td>`).join("")}</tr>`).join("")}</tbody>`;

  $("phases").innerHTML = PHASES.map(([f, a, b]) => `<tr><td>${f}</td><td>${a}</td><td>${b}</td></tr>`).join("");
  $("decision").innerHTML = DECISION.map((r) => `<tr><td>${r[0]}</td>${r.slice(1).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
}

async function refresh() {
  state.data = await loadData(state.period);
  render();
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.id) { state.period = b.dataset.id; refresh(); }
  else if (b.dataset.seg) { state.segment = b.dataset.seg; render(); }
});

refresh();
