// Lógica compartilhada: gera os dados do portal a partir do Supabase.
// Lê só views agregadas (eval_*) e carimbos de data de leads/pedidos: nenhum nome, telefone, endereço, CPF ou conversa.
export const TABLES = {
  leads: "created_at,handoff_at,opted_out_at",
  orders: "created_at,amount_brl,status",
  eval_turn_outcomes: "day,turns,sent,fallbacks,handoffs,avg_rewrites,cost_brl",
  eval_gate_blocks: "day,gate,checks,blocks",
  eval_conversation_cost: "day,cost_brl",
  eval_version_outcomes: "agent_version,turns,fallbacks,handoffs,avg_rewrites,cost_brl",
};
const NOT_SALE = new Set(["cancelled", "canceled", "cancelado", "expired", "expirado", "refused", "recusado"]);
const BUCKETS = { day: [24, 1 / 24], week: [7, 1], month: [30, 1], "3m": [13, 7], "6m": [26, 7], "9m": [39, 7], "12m": [52, 7] };
const CHANNEL = { number: "Ligado e testado (06/10)", cloud_api: "Operando", window: "—", templates: "Aprovados (09/10)" }; // manual: ajuste quando mudar
const DAY = 86400000;

export async function getAll(table, { url, key, fixture } = {}) {
  if (fixture) return fixture[table] ?? [];
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${TABLES[table]}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export async function buildAll(opts, now = Date.now()) {
  const D = {};
  for (const name of Object.keys(TABLES)) D[name] = await getAll(name, opts);
  return { data: build(D, now), D };
}

const t = (s) => new Date(s).getTime();
const inWin = (ts, a, b) => ts >= a && ts < b;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const pct = (n, d) => (d > 0 ? (n / d) * 100 : null);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && !Number.isNaN(v)));

function windowMetrics(D, a, b) {
  const L = D.leads.filter((r) => inWin(t(r.created_at), a, b));
  const O = D.orders.filter((r) => inWin(t(r.created_at), a, b) && !NOT_SALE.has(String(r.status).toLowerCase()));
  const dayOf = (r) => t(`${r.day}T12:00:00Z`);
  const TO = D.eval_turn_outcomes.filter((r) => inWin(dayOf(r), a, b));
  const GB = D.eval_gate_blocks.filter((r) => inWin(dayOf(r), a, b));
  const CC = D.eval_conversation_cost.filter((r) => inWin(dayOf(r), a, b));
  const turns = sum(TO.map((r) => +r.turns));
  return clean({
    leads: L.length,
    orders: O.length,
    revenue: sum(O.map((r) => +r.amount_brl || 0)),
    conversion: pct(O.length, L.length),
    handoff: pct(L.filter((r) => r.handoff_at).length, L.length),
    optout: pct(L.filter((r) => r.opted_out_at).length, L.length),
    fallback: pct(sum(TO.map((r) => +r.fallbacks)), turns),
    rewrites: turns > 0 ? sum(TO.map((r) => (+r.avg_rewrites || 0) * +r.turns)) / turns : null,
    api_per_lead: CC.length ? sum(CC.map((r) => +r.cost_brl)) / CC.length : null,
    gate_blocks: pct(sum(GB.map((r) => +r.blocks)), sum(GB.map((r) => +r.checks))),
    api_cost: sum(TO.map((r) => +r.cost_brl)),
  });
}

export function build(D, now) {
  const out = {};
  for (const [period, [n, days]] of Object.entries(BUCKETS)) {
    const span = n * days * DAY, step = days * DAY, start = now - span;
    const cur = windowMetrics(D, start, now), prev = windowMetrics(D, start - span, start);
    const series = Array.from({ length: n }, (_, i) => windowMetrics(D, start + i * step, start + (i + 1) * step));
    const metrics = {};
    for (const id of Object.keys(cur)) {
      if (id === "api_cost") continue;
      const s = series.map((m) => m[id]);
      metrics[id] = { value: cur[id], ...(prev[id] != null ? { previous: prev[id] } : {}), ...(s.filter((v) => v != null).length > 1 ? { series: s.map((v) => v ?? 0) } : {}) };
    }
    out[period] = { metrics, money: { revenue: cur.revenue, api_cost: cur.api_cost } };
  }
  const all = windowMetrics(D, 0, now + DAY);
  const versions = D.eval_version_outcomes.map((r) => ({ version: `v${r.agent_version}`, turns: +r.turns, handoff: pct(+r.handoffs, +r.turns), fallback: pct(+r.fallbacks, +r.turns), rewrites: +r.avg_rewrites, cost: +r.cost_brl })).sort((a, b) => parseInt(a.version.slice(1)) - parseInt(b.version.slice(1)));
  const g = {};
  for (const r of D.eval_gate_blocks) { g[r.gate] ??= { gate: r.gate, checks: 0, blocks: 0 }; g[r.gate].checks += +r.checks; g[r.gate].blocks += +r.blocks; }
  const gates = Object.values(g).map((x) => ({ ...x, rate: pct(x.blocks, x.checks) ?? 0 })).sort((a, b) => b.blocks - a.blocks || b.checks - a.checks);
  for (const p of Object.values(out)) {
    Object.assign(p, {
      updated: new Date(now).toISOString(),
      note: "Dados do Supabase (views eval_*, leads e pedidos). Incluem as conversas de teste do operador e de amigos até a primeira venda real. Anúncio (gasto, CPL, ROI) ainda não está ligado.",
      totals: { leads: all.leads, orders: all.orders },
      funnel: { first_msg: all.leads, order: all.orders },
      channel: CHANNEL, versions, gates,
    });
  }
  return out;
}

