// Estrutura do portal. Nenhum dado real ainda: loadData() é o único ponto a ligar depois.

const PERIODS = [
  { id: "day", label: "Dia" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "9m", label: "9 meses" },
  { id: "12m", label: "12 meses" },
];

// id = chave da métrica; source = view/tabela do Supabase de onde virá (ver briefing).
const METRICS = [
  { id: "leads", label: "Leads", source: "leads" },
  { id: "funnel", label: "Funil", source: "eval_funnel" },
  { id: "orders", label: "Pedidos", source: "orders" },
  { id: "revenue", label: "Faturamento", source: "orders" },
  { id: "turn_cost", label: "Custo de API", source: "eval_turn_outcomes" },
  { id: "handoff", label: "Handoffs", source: "eval_turn_outcomes" },
];

// Os seis critérios do L3 ainda não foram preenchidos.
const PAUSE_CRITERIA = Array.from({ length: 6 }, (_, i) => ({ label: `Critério ${i + 1} (a definir)` }));

const state = { period: "week", data: null };

// Retornar { [metricId]: { value, previous, series: number[] } } quando houver backend.
async function loadData(_period) {
  return null;
}

const $ = (id) => document.getElementById(id);
const fmt = (v) => (v == null ? "—" : new Intl.NumberFormat("pt-BR").format(v));

function chartSvg(series) {
  const w = 300, h = 90;
  const base = `<line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}"/>`;
  if (!series || series.length < 2) return `<svg class="chart" viewBox="0 0 ${w} ${h}">${base}</svg>`;
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1;
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - 6 - ((v - min) / span) * (h - 12)}`);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}">${base}<path d="M${pts.join("L")}"/></svg>`;
}

function render() {
  const data = state.data || {};
  $("updated").textContent = state.data ? "Atualizado agora" : "Sem dados ainda";

  $("periods").innerHTML = PERIODS.map(
    (p) => `<button data-id="${p.id}" aria-pressed="${p.id === state.period}">${p.label}</button>`
  ).join("");

  $("metrics").innerHTML = METRICS.map((m) => {
    const d = data[m.id];
    return `<article class="card"><h3>${m.label}</h3><div class="value">${fmt(d?.value)}</div>${chartSvg(d?.series)}</article>`;
  }).join("");

  $("compare").tBodies[0].innerHTML = METRICS.map((m) => {
    const d = data[m.id];
    const delta = d && d.previous ? `${(((d.value - d.previous) / d.previous) * 100).toFixed(1)}%` : "—";
    return `<tr><td>${m.label}</td><td>${fmt(d?.value)}</td><td>${fmt(d?.previous)}</td><td>${delta}</td></tr>`;
  }).join("");

  $("pause").innerHTML = PAUSE_CRITERIA.map((c) => `<li><span>${c.label}</span><span class="muted">—</span></li>`).join("");
}

async function refresh() {
  state.data = await loadData(state.period);
  render();
}

$("periods").addEventListener("click", (e) => {
  const id = e.target.closest("button")?.dataset.id;
  if (id) { state.period = id; refresh(); }
});

refresh();
