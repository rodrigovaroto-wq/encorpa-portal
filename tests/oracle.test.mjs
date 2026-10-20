// Conta independente: refaz do zero, a partir dos dados brutos, cada número financeiro e operacional que o portal mostra, e compara
// com lib/build.mjs. As fórmulas aqui são escritas de novo de propósito (não importam nada do portal além de buildAll), para que um
// erro de fórmula no portal não se repita no teste. Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAll } from "../lib/build.mjs";

const NOW = Date.parse("2026-11-08T12:00:00Z"); // a semana (1 a 8/11) pega o vencimento do número no dia 5
const H = 3600000, D = 24 * H, at = (h) => new Date(NOW - h * H).toISOString(), day = (h) => new Date(NOW - h * H - 3 * H).toISOString().slice(0, 10);
const near = (a, b, msg, eps = 1e-6) => assert.ok(a != null && Math.abs(a - b) < eps, `${msg}: portal ${a} ≠ conta ${b}`);

// Economia por pedido, escrita de novo a partir das regras (operador, 15/10): produto R$ 30/peça, entrega R$ 19,99, manuseio R$ 5,
// transação 6,99% da comissão + R$ 2,49; antecipado pela tabela; recusa − R$ 9,99; devolução − R$ 30 (entrega) ou − R$ 50 (antecipado).
const cod = (price, n) => { const c = price - 30 * n - 19.99 - 5; return c - c * 0.0699 - 2.49; };
const PREPAY = { 1: 77.92, 2: 136.14, 3: 169.15 };

const ORDERS = [
  // id, horas atrás, status, forma, peças, preço, tipo esperado
  ["o1", 30, "Agendado", "cod", 1, 129.9, "sale"],
  ["o2", 50, "Completo", "cod", 1, 129.9, "sale"],
  ["o3", 70, "Completo", "cod", 2, 233.82, "sale"],
  ["o4", 80, "Frustrado", "cod", 1, 129.9, "refused"],
  ["o5", 90, "Cancelado", "cod", 1, 129.9, "void"],
  ["o6", 100, "Devolvido", "cod", 1, 129.9, "returned"],
  ["o7", 40, "Pagamento aprovado", "prepay", 1, 116.91, "sale"],
  ["o8", 45, "Aguardando pagamento", "prepay", 1, 116.91, "unpaid"],
  ["o9", 60, "Reembolsado", "prepay", 1, 116.91, "returned"],
  ["o10", 24 * 12, "Completo", "cod", 1, 129.9, "sale"], // fora da semana (12 dias atrás)
];
const value = ([, , , method, n, price, kind]) => kind === "sale" ? (method === "cod" ? cod(price, n) : PREPAY[n]) : kind === "refused" ? -9.99 : kind === "returned" ? (method === "cod" ? -30 : -50) : 0;

function data() {
  const leads = Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, name: null, phone: `55119000000${String(i).padStart(2, "0")}`, size: null, created_at: at(i < 10 ? 10 + i * 12 : 24 * 15 + i), handoff_at: null, opted_out_at: i === 3 ? at(5) : null, state: i % 2 ? "SP" : "MG", ctwa: i % 3 ? `clid${i}` : null }));
  return {
    leads,
    conversations: leads.map((l, i) => ({ id: `c${i}`, lead_id: l.id, stage: "conversando", cost_brl: 0, last_inbound_at: l.created_at, last_outbound_at: l.created_at, created_at: l.created_at })),
    messages: [], turn_outcomes: [],
    orders: ORDERS.map(([id, h, status, method, units, price], i) => ({ id, external_id: id, lead_id: `l${i % 10}`, created_at: at(h), updated_at: at(h - 1), amount_brl: price, status, payment_method: method, units, size: "M", scheduled_for: null })),
    llm_calls: [
      { id: "a1", conversation_id: "c0", cost_brl: 0.04, created_at: at(10) },
      { id: "a2", conversation_id: "c1", cost_brl: 0.06, created_at: at(22) },
      { id: "a3", conversation_id: null, cost_brl: 0.01, created_at: at(23) }, // áudio, sem conversa
      { id: "a4", conversation_id: "c11", cost_brl: 0.5, created_at: at(24 * 15) }, // fora da semana
    ],
    eval_turn_outcomes: [], eval_gate_blocks: [], eval_conversation_cost: [], eval_version_outcomes: [], eval_attribution: [],
    hermes_runs: [], hermes_proposals: [], hermes_backlog: [], agent_versions: [],
    meta: { campaigns: [], adsets: [], ads: [], daily: [
      { ad_id: "x", day: day(20), spend: 30, impressions: 3000, clicks: 30, started: 20 },
      { ad_id: "x", day: day(70), spend: 20, impressions: 2000, clicks: 10, started: 10 },
      { ad_id: "x", day: day(24 * 15), spend: 27.38, impressions: 1000, clicks: 5, started: 5 }, // fora da semana
    ] },
    n8n: null,
  };
}

test("conta independente da semana: pedidos, faturamento, margem, custos, lucro, margem operacional, ROI e taxas", async () => {
  const { data: out } = await buildAll({ fixture: data() }, NOW);
  const m = out.periods.week.metrics, money = out.periods.week.money, v = (id) => m[id]?.value;
  const week = ORDERS.filter(([, h]) => h < 7 * 24);
  const placed = week.filter((o) => ["sale", "refused", "returned"].includes(o[6])), sales = week.filter((o) => o[6] === "sale");
  const revenue = sales.reduce((a, o) => a + o[5], 0), margin = week.reduce((a, o) => a + value(o), 0);
  const leads = 10, spend = 50, started = 30, ai = 0.04 + 0.06 + 0.01, wa = placed.length * 0.04, fixed = 35; // número vence em 05/11
  const net = margin - spend - ai - wa - fixed;

  assert.equal(v("leads"), leads);
  assert.equal(v("orders"), placed.length, "pedidos feitos: venda, recusa e devolução (sem não pago e cancelado)");
  near(v("revenue"), revenue, "faturamento só das vendas");
  near(v("conversion"), (placed.length / leads) * 100, "conversão = pedidos feitos ÷ leads");
  near(v("gross_profit"), margin, "margem dos pedidos");
  near(v("op_cost"), revenue - margin, "custo dos pedidos");
  near(money.ads, spend, "anúncio da Meta, sem imposto por cima");
  near(money.ai, ai, "IA: chamadas dos leads no período, com áudio");
  near(money.whatsapp, wa, "WhatsApp por pedido feito");
  near(money.fixed, fixed, "fixo que venceu no período");
  near(v("net_profit"), net, "lucro líquido");
  near(v("op_margin"), (net / revenue) * 100, "margem operacional");
  near(v("roi"), margin / (spend + ai + wa), "ROI sem os fixos");
  near(v("cpl"), spend / started, "CPL = gasto ÷ conversas iniciadas");
  near(v("api_per_lead"), ai / leads, "IA por lead");
  near(v("cpl_api"), spend / started + ai / leads, "CPL + IA");
  near(v("optout"), (1 / leads) * 100, "opt-out");
  assert.equal(v("leads_ad") + v("leads_organic"), leads);
  const delivered = sales.filter((o) => o[2] === "Completo").length;
  assert.equal(v("delivered_orders"), delivered);
  near(v("delivered"), (delivered / placed.length) * 100, "entregas ÷ pedidos feitos (o recusado conta no denominador)");
  near(v("prepaid_share"), (placed.filter((o) => o[3] === "prepay").length / placed.length) * 100, "% antecipado");
  const codRefused = week.filter((o) => o[6] === "refused").length, codDelivered = week.filter((o) => o[3] === "cod" && o[2] === "Completo").length;
  near(v("refusal"), (codRefused / (codRefused + codDelivered)) * 100, "recusa = recusados ÷ (recusados + entregues) na entrega");
});

test("conta independente: somar os intervalos do gráfico dá o total do período (nada contado duas vezes nem perdido)", async () => {
  const { data: out } = await buildAll({ fixture: data() }, NOW);
  for (const period of ["week", "month"]) {
    const m = out.periods[period].metrics;
    for (const id of ["leads", "orders", "revenue", "gross_profit", "spend", "fixed_cost", "net_profit"]) {
      if (!m[id]?.series) continue;
      near(m[id].series.reduce((a, b) => a + (b || 0), 0), m[id].value, `${period} ${id}`, 1e-6);
    }
  }
});

test("conta independente: investido até agora e resultado acumulado", async () => {
  const { data: out } = await buildAll({ fixture: data() }, NOW);
  const inv = out.global.invested, row = (id) => inv.rows.find((r) => r.id === id).total;
  const allPlaced = ORDERS.filter((o) => ["sale", "refused", "returned"].includes(o[6])).length;
  near(row("pikapods"), 10 * 5.4, "PikaPods: a recarga de US$ 10 (a próxima só por volta de 28/12)");
  near(row("wa_number"), 55 + 35, "número: R$ 55 + a mensalidade de 05/11");
  near(row("ads"), 77.38, "anúncios: todo o gasto da Meta");
  near(row("ai"), 0.04 + 0.06 + 0.01 + 0.5, "IA: todas as chamadas dos leads");
  near(row("whatsapp"), allPlaced * 0.04, "WhatsApp: R$ 0,04 por pedido feito");
  const contribution = ORDERS.reduce((a, o) => a + value(o), 0), total = 54 + 90 + 77.38 + 0.61 + allPlaced * 0.04;
  near(inv.total, total, "total investido");
  near(inv.contribution, contribution, "margem dos pedidos até hoje");
  near(inv.result, contribution - total, "resultado acumulado");
});

test("conta independente: margem por pedido das premissas (R$ 67,18 · 135,94 · 180,53) e média esperada R$ 51,74", () => {
  near(cod(129.9, 1), 67.18, "1 peça", 0.005); near(cod(233.82, 2), 135.94, "2 peças", 0.005); near(cod(311.76, 3), 180.53, "3 peças", 0.005);
  const codExp = 0.83 * (0.9 * cod(129.9, 1) + 0.1 * -30) + 0.17 * -9.99, preExp = 0.9 * 77.92 + 0.1 * -50;
  near(0.7 * codExp + 0.3 * preExp, 51.74, "média esperada", 0.01);
});
