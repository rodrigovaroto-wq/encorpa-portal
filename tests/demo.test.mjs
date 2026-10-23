// Dados de exemplo (src/lib/demo.js): um ano simulado passa pela conta do servidor, então os números fecham entre as abas. Rode: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoData, demoRaw } from "../src/lib/demo.js";
import { WA_PER_ORDER } from "../src/lib/economics.js";

const NOW = Date.parse("2026-10-23T15:00:00Z");
const d = demoData(null, NOW);
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} ≠ ${b}`);

test("exemplo: conversão = pedidos ÷ leads e lucro = margem − anúncio − IA − WhatsApp − fixos, em todo período", () => {
  for (const [period, p] of Object.entries(d.periods)) {
    const v = (id) => p.metrics[id]?.value;
    if (v("leads")) close(v("conversion"), (v("orders") / v("leads")) * 100, `${period} conversão`);
    const m = p.money;
    close(v("net_profit"), v("gross_profit") - m.ads - m.ai - m.whatsapp - m.fixed, `${period} lucro`);
    close(m.whatsapp, v("orders") * WA_PER_ORDER, `${period} WhatsApp`);
    close(v("cpl"), v("spend") / p.meta.ads.reduce((a, x) => a + x.started, 0), `${period} CPL`);
    assert.equal(p.mix.cod + p.mix.prepay, v("orders"), `${period} mix = pedidos`);
  }
});

test("exemplo: ordem de grandeza de uma operação de R$ 30 a R$ 50 por dia", () => {
  const m = d.periods.month.metrics;
  assert.ok(m.leads.value > 900 && m.leads.value < 2200, `leads no mês: ${m.leads.value}`);
  assert.ok(m.cpl.value > 1 && m.cpl.value < 1.6, `CPL: ${m.cpl.value}`);
  assert.ok(m.conversion.value > 5 && m.conversion.value < 12, `conversão: ${m.conversion.value}`);
  assert.ok(m.api_per_lead.value > 0.02 && m.api_per_lead.value < 0.1, `IA por lead: ${m.api_per_lead.value}`);
  assert.ok(m.resolution.value > 75 && m.resolution.value <= 100, `resolução no mês: ${m.resolution.value}`);
  assert.equal(d.global.ad_budget, 50);
});

test("exemplo: as telas leem os mesmos leads (score e perfil, conversas, versões)", () => {
  const raw = demoRaw(NOW);
  assert.equal(d.global.profiles.length, raw.leads.length);
  assert.equal(d.global.chats.length, 150);
  assert.equal(new Set(raw.leads.map((l) => l.id.slice(0, 8))).size > raw.leads.length * 0.99, true, "o começo do id varia (o portal mostra 8 caracteres)");
  assert.ok(d.global.versions.length === 26 && d.global.hermes.runs.length > 50);
  assert.ok(d.global.automations.workflows.length > 0);
});

test("exemplo: mesmo instante, mesmos números (cada dia sai de uma semente fixa)", () => {
  assert.equal(demoData(null, NOW).periods.week.metrics.revenue.value, d.periods.week.metrics.revenue.value);
});

test("exemplo: usa os workflows de verdade guardados no navegador quando houver", () => {
  const mine = { read: 1, runs: [], workflows: [{ id: "x", name: "Encorpa — WhatsApp envio", active: true, nodes: [], edges: [], runs: 0, errors: 0, last: null }] };
  assert.equal(demoData(mine, NOW).global.automations, mine);
});

test("exemplo: custo por pedido = (anúncio + IA + WhatsApp) ÷ pedidos; critério de mercado = (resolvidas + abandonadas + não resolvidas) ÷ atendidas", () => {
  for (const [period, p] of Object.entries(d.periods)) {
    const v = (id) => p.metrics[id]?.value, m = p.money;
    if (v("orders")) close(v("cost_per_order"), (m.ads + m.ai + m.whatsapp) / v("orders"), `${period} custo por pedido`);
    const o = p.outcomes;
    if (o.attended) close(o.market_resolution, ((o.solved + o.abandoned + o.unresolved) / o.attended) * 100, `${period} critério de mercado`);
  }
  assert.ok(d.global.versions.every((x) => !x.conversations || x.conversion === (x.bought / x.conversations) * 100));
});
